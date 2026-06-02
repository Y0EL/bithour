import { Worker, Job } from 'bullmq';
import { redisConnection, redisClient } from '../redis';
import { prisma } from '../prisma';

export const setupChatWorker = () => {
    const worker = new Worker(
        'chat-messages',
        async (job: Job) => {
            const { id, content, creatorId, senderId } = job.data;
            // // console.log(`[Chat Worker] Processing message for creator ${creatorId}`);

            try {
                const message = await prisma.creatorMessage.create({
                    data: {
                        id,
                        content,
                        creatorId,
                        senderId,
                        isReadByInternal: senderId !== null // Auto-mark as read if sent by internal
                    },
                    include: {
                        sender: {
                            select: { fullName: true, username: true }
                        }
                    }
                });

                // // console.log(`[Chat Worker] Message ${message.id} saved to DB.`);

                // Publish to Redis for real-time WebSocket updates
                try {
                    await redisClient.publish('creator:messages:new', JSON.stringify({
                        messageId: message.id,
                        creatorId: message.creatorId,
                        senderId: message.senderId,
                        content: message.content,
                        timestamp: message.createdAt.toISOString(),
                        isFromCreator: senderId === null
                    }));
                    // // console.log(`[Chat Worker] Published message to Redis pub/sub`);
                } catch (redisErr) {
                    console.error('[Chat Worker] Redis publish failed:', redisErr);
                }

                return message;
            } catch (error) {
                console.error('[Chat Worker] Failed to save message:', error);
                throw error;
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { connection: redisConnection as any }
    );

    worker.on('failed', (job, err) => {
        console.error(`[Chat Worker] Job ${job?.id} failed: ${err.message}`);
    });

    // // console.log('[Chat Worker] Chat worker is ready.');
    return worker;
};
