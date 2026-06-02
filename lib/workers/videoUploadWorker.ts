import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redis';
import { prisma } from '../prisma';
import { videoProcessQueue } from '../queue';

export const setupVideoUploadWorker = () => {
    const worker = new Worker(
        'video-upload',
        async (job: Job) => {
            const { creatorId, videoUrl, originalFileName } = job.data;
            // // console.log(`[Video Upload Worker] Starting job ${job.id} for creator ${creatorId}, file: ${originalFileName}`);

            try {
                // Get creator
                const creator = await prisma.creator.findUnique({
                    where: { id: creatorId }
                });

                if (!creator) {
                    throw new Error(`Creator ${creatorId} not found`);
                }

                // Prepare history - save previous video URL to history
                let history = ((creator as any).videoHistory as any[]) || [];
                if (creator.videoUrl) {
                    history.push({
                        url: creator.videoUrl,
                        uploadedAt: creator.videoUploadedAt?.toISOString() || new Date().toISOString()
                    });
                }

                // Update creator status and video URL
                await prisma.creator.update({
                    where: { id: creatorId },
                    data: {
                        videoUrl,
                        originalVideoUrl: videoUrl,
                        videoUploadedAt: new Date(),
                        videoHistory: history,
                        isDraftApproved: false,
                        videoReviewStatus: 'PENDING',
                        status: 'DRAFTING'
                    } as any
                });

                // Trigger processing job for optimized streaming
                await videoProcessQueue.add('optimize-video', {
                    creatorId,
                    videoUrl
                });

                // // console.log(`[Video Upload Worker] Job ${job.id} completed. Added to processing queue.`);
                return { success: true, videoUrl };

            } catch (error: unknown) {
                console.error(`[Video Upload Worker] Job ${job.id} failed:`, error);
                throw error;
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { connection: redisConnection as any }
    );

    worker.on('failed', (job, err) => {
        console.error(`[Video Upload Worker] Job ${job?.id} failed with error: ${err.message}`);
    });

    // // console.log('[Video Upload Worker] Video upload worker is ready.');
    return worker;
};
