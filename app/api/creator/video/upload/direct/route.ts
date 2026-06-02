import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { uploadStreamToS3 } from '@/lib/s3';
import { videoUploadQueue } from '@/lib/queue';

// Increase body size limit untuk upload file besar (max 2GB)
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout untuk upload besar

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get('creatorId');
    const token = searchParams.get('token');
    const type = searchParams.get('type'); // 'video' | 'proof'

    let creator;
    if (token) {
        creator = await prisma.creator.findUnique({ where: { sessionToken: token } });
    } else {
        const session = await getServerSession(authOptions) as any;
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        creator = await prisma.creator.findUnique({ where: { id: creatorId!, createdById: session.user.id } });
    }

    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

        const isProof = type === 'proof';

        // Validate file type
        if (isProof) {
            if (!file.type.startsWith('image/')) {
                return NextResponse.json({ error: 'Only image files are allowed for payment proof' }, { status: 400 });
            }
        } else {
            if (!file.type.startsWith('video/')) {
                return NextResponse.json({ error: 'Only video files are allowed' }, { status: 400 });
            }
        }

        // Validate file size (max 2GB)
        const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File size exceeds 2GB limit' }, { status: 400 });
        }

        // Sanitize filename: remove spaces and weird characters
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const prefix = isProof ? 'payment_proofs' : 'videos';
        const fileName = `creators/${creator.id}/${prefix}/${Date.now()}_${safeName}`;

        // Use streaming upload - file tidak disimpan di disk VPS, langsung stream ke Backblaze
        // File hanya transit di memory VPS, tidak tersimpan permanen
        const fileStream = file.stream();
        const fileUrl = await uploadStreamToS3(fileStream, fileName, file.type);

        // Payment proof: just return URL (DB update handled by caller: /api/creator PUT)
        if (isProof) {
            return NextResponse.json({
                fileUrl,
                // keep backward compat with existing UI code paths
                videoUrl: fileUrl,
                message: 'Proof uploaded successfully'
            });
        }

        // Video: Queue job untuk update database (handle concurrent uploads dengan BullMQ)
        const job = await videoUploadQueue.add('process-video-upload', {
            creatorId: creator.id,
            videoUrl: fileUrl,
            originalFileName: file.name,
            fileName,
            contentType: file.type,
        });

        return NextResponse.json({
            videoUrl: fileUrl,
            jobId: job.id,
            message: 'Upload successful, processing in background...'
        });
    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
