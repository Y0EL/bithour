import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redis';
import { prisma } from '../prisma';
import { syncFeedbackFromSheet, updateOCDealing, reportToOCSourcing } from '../ocSheets';
import { reportToShipmentSpreadsheet } from '../creatorSheets';
import { appendOrUpdateSheetRow } from '../sheets';

export const setupSyncWorker = () => {
    const worker = new Worker(
        'external-sync',
        async (job: Job) => {
            const { type, creatorId, isRevision, kolName } = job.data;
            // // // console.log(`[Sync Worker] Processing ${type} for creator ${creatorId}`);

            try {
                const creator = await prisma.creator.findUnique({
                    where: { id: creatorId }
                });

                if (!creator) throw new Error(`Creator ${creatorId} not found`);

                if (type === 'SYNC_FEEDBACK') {
                    const feedback = await syncFeedbackFromSheet(creator);
                    if (feedback) {
                        const trimmedFeedback = feedback.trim();
                        const feedbackContent = `📢 [FEEDBACK] ${trimmedFeedback}`;

                        const existingFeedback = await prisma.creatorMessage.findFirst({
                            where: {
                                creatorId: creator.id,
                                content: { contains: trimmedFeedback }
                            }
                        });

                        if (!existingFeedback) {
                            await prisma.creatorMessage.create({
                                data: {
                                    content: feedbackContent,
                                    creatorId: creator.id,
                                    senderId: null
                                }
                            });
                            // // // console.log(`[Sync Worker] New feedback saved for @${creator.usernameTikTok}`);
                        }
                    }
                } else if (type === 'REPORT_STATUS') {
                    const result = await updateOCDealing(creator, kolName || creator.name, isRevision);
                    if (result.success && result.rowNumber) {
                        await prisma.creator.update({
                            where: { id: creatorId },
                            data: { ocSheetRowNumber: result.rowNumber } as any
                        });
                        // // // console.log(`[Sync Worker] OC Dealing Sheet updated for @${creator.usernameTikTok} at row ${result.rowNumber}`);
                    }
                } else if (type === 'REPORT_SHIPMENT') {
                    const reporterName = kolName || 'System';
                    const result = await reportToShipmentSpreadsheet(creator, reporterName);
                    if (result.success) {
                        await prisma.creator.update({
                            where: { id: creatorId },
                            data: { isReportedToShipment: true } as any
                        });
                        // // // console.log(`[Sync Worker] Shipment Sheet updated for @${creator.usernameTikTok}. SKU: ${result.sku}`);
                    }
                } else if (type === 'REPORT_SOURCING') {
                    const reporterName = kolName || 'System';
                    const result = await reportToOCSourcing(creator, reporterName);
                    if (result.success) {
                        // // // console.log(`[Sync Worker] OC Sourcing Sheet updated for @${creator.usernameTikTok}`);
                    }
                } else if (type === 'REPORT_DOCUMENT') {
                    const { docType, category, ref, docNo, amount, bdName, status, fileUrl, formData } = job.data;
                    await appendOrUpdateSheetRow({
                        type: docType,
                        category,
                        ref,
                        docNo,
                        amount,
                        creatorName: creator.name,
                        bdName,
                        status,
                        fileUrl,
                        formData
                    });
                    // // // console.log(`[Sync Worker] Document ${docNo} reported to sheets for @${creator.usernameTikTok}`);
                }

                return { success: true };
            } catch (error: any) {
                console.error(`[Sync Worker] Job ${job.id} failed:`, error.message);
                throw error;
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { connection: redisConnection as any, concurrency: 2 }
    );

    worker.on('failed', (job, err) => {
        console.error(`[Sync Worker] Job ${job?.id} failed: ${err.message}`);
    });

    // // // console.log('[Sync Worker] Sync worker is ready.');
    return worker;
};
