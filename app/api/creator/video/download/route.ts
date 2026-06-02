import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { extractFileId, downloadFromDrive } from '@/lib/drive';
import { Readable } from 'stream';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get('creatorId');
    const isEndorsed = searchParams.get('isEndorsed') === 'true';

    if (!creatorId) return NextResponse.json({ error: 'Creator ID required' }, { status: 400 });

    const userRole = session.user.role;
    const canAccess = ['ADMIN', 'MANAGER', 'REVIEWER', 'CURATOR'].includes(userRole);

    const creator = await prisma.creator.findUnique({
        where: canAccess ? { id: creatorId } : { id: creatorId, createdById: session.user.id }
    });

    if (!creator) {
        return NextResponse.json({ error: 'Creator not found or access denied' }, { status: 404 });
    }

    const targetUrl = isEndorsed ? (creator as any).endorsedVideoUrl : creator.videoUrl;

    if (!targetUrl) {
        return NextResponse.json({ error: 'Video URL not found' }, { status: 404 });
    }

    // Format filename: username_date
    const dateStr = creator.videoUploadedAt
        ? creator.videoUploadedAt.toISOString().slice(0, 10).replace(/-/g, '')
        : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${creator.usernameTikTok}_${isEndorsed ? 'final' : 'draft'}_${dateStr}.mp4`;

    const b2Bucket = process.env.B2_BUCKET_NAME || '';
    const r2Bucket = process.env.R2_BUCKET_NAME || '';

    // 1. Our Storage (B2 or R2) — Proxy for download with Content-Disposition
    const isOurStorage = targetUrl.includes(b2Bucket) || targetUrl.includes(r2Bucket) ||
        targetUrl.includes('backblazeb2.com') || targetUrl.includes('r2.cloudflarestorage.com');

    if (isOurStorage) {
        try {
            const bucketName = targetUrl.includes('r2.cloudflarestorage.com') ? r2Bucket : b2Bucket;
            const urlParts = targetUrl.split(`${bucketName}/`);
            const s3Key = decodeURIComponent(urlParts[urlParts.length - 1]);

            const { downloadFromS3 } = await import('@/lib/s3');
            const s3Response = await downloadFromS3(s3Key);

            if (!s3Response.Body) throw new Error('Failed to get video body from storage');

            return new NextResponse(s3Response.Body as any, {
                headers: {
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                    'Content-Type': s3Response.ContentType || 'video/mp4',
                },
            });
        } catch (error: any) {
            console.error('Download Proxy Error (S3):', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    // 2. Google Drive Proxy
    if (targetUrl.includes('drive.google.com')) {
        try {
            const fileId = extractFileId(targetUrl);
            if (!fileId) throw new Error('Could not extract File ID from Drive link');

            const driveResponse = await downloadFromDrive(fileId);

            // Convert Node.js stream to Web stream for NextResponse
            const webStream = Readable.toWeb(driveResponse.data as Readable);

            return new NextResponse(webStream as any, {
                headers: {
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                    'Content-Type': driveResponse.headers['content-type'] || 'video/mp4',
                    'Content-Length': driveResponse.headers['content-length'] || '',
                },
            });
        } catch (error: any) {
            console.error('Download Proxy Error (Drive):', error);
            // If proxy fails (e.g. permissions), redirect to the original URL as last resort
            return NextResponse.redirect(targetUrl);
        }
    }

    // 3. Simple Redirect fallback for other URLs
    if (targetUrl.startsWith('http')) {
        return NextResponse.redirect(targetUrl);
    }

    return NextResponse.json({ error: 'Unsupported video URL' }, { status: 400 });
}
