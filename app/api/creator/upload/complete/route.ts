import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


/**
 * POST /api/creator/upload/complete
 * Finalize the upload after browser completes uploading to Backblaze
 * Saves the file URL to the creator record in the database
 */
export async function POST(req: NextRequest) {
    try {
        const { token, finalUrl, fileName } = await req.json();

        if (!token || !finalUrl) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get creator by session token
        const creator = await prisma.creator.findUnique({
            where: { sessionToken: token }
        });

        if (!creator) {
            return NextResponse.json(
                { error: 'Invalid session token' },
                { status: 404 }
            );
        }

        // Prepare video history - save previous video URL to history
        const videoHistory = creator.videoHistory as any[] || [];
        if (creator.videoUrl) {
            videoHistory.push({
                url: creator.videoUrl,
                uploadedAt: creator.videoUploadedAt?.toISOString() || new Date().toISOString()
            });
        }

        // Update creator with new video URL from Backblaze
        const updatedCreator = await prisma.creator.update({
            where: { id: creator.id },
            data: {
                videoUrl: finalUrl,
                videoUploadedAt: new Date(),
                videoHistory: videoHistory,
                isDraftApproved: false // Reset approval status for new upload
            }
        });

        // Trigger background processing (Optimization & Thumbnail)
        try {
            const { videoProcessQueue } = await import('@/lib/queue');
            await videoProcessQueue.add('process-video', {
                creatorId: creator.id,
                videoUrl: finalUrl
            });
        } catch (err) {
            console.error('Failed to queue video process:', err);
        }

        // Add message to creator chat
        await prisma.creatorMessage.create({
            data: {
                content: `🎥 Video uploaded to Backblaze: ${fileName || 'video file'}`,
                creatorId: creator.id,
                senderId: null // From creator
            }
        });

        return NextResponse.json({
            success: true,
            videoUrl: finalUrl,
            fileData: {
                url: finalUrl,
                fileName: fileName || 'video',
                uploadedAt: new Date().toISOString()
            }
        });

    } catch (error: unknown) {
        console.error('Error completing upload:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to complete upload';
        return NextResponse.json(
            { error: errorMessage },

            { status: 500 }
        );
    }
}
