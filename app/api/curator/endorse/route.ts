import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'CURATOR' && user.role !== 'SYSTEM') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const creatorId = formData.get('creatorId') as string;
        const file = formData.get('file') as File;

        if (!creatorId || !file) {
            return NextResponse.json({ error: 'Missing creatorId or file' }, { status: 400 });
        }

        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

        // 1. Upload to S3
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const extension = file.name.split('.').pop();
        const fileName = `endorsed/${creator.usernameTikTok}-${randomUUID()}.${extension}`;

        const fileUrl = await uploadToS3(buffer, fileName, file.type || 'video/mp4');

        // 2. Update database
        const updatedCreator = await prisma.creator.update({
            where: { id: creatorId },
            data: {
                endorsedVideoUrl: fileUrl,
                isEndorsementReview: true,
                endorsedByCuratorId: user.id,
                videoReviewStatus: 'PENDING', // Send back to Review Team
            }
        });

        // 3. Notify Review Team / BD
        try {
            await prisma.notification.create({
                data: {
                    userId: creator.createdById, // Notify BD
                    title: `Video Endorsed: ${creator.name}`,
                    content: `Tim Curator telah mengupload hasil editan/endorsement untuk video @${creator.usernameTikTok}. Silakan review ulang di Dashboard Review.`,
                    type: 'INFO'
                }
            });
        } catch (notifErr) {
            console.error('Failed to send notification', notifErr);
        }

        return NextResponse.json({ success: true, creator: updatedCreator });
    } catch (error: any) {
        console.error('[Curator Endorse Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
