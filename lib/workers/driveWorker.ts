import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redis';
import { prisma } from '../prisma';
import { ensureCreatorFolder, copyFileToDrive, extractFileId, isFolderUrl, getLatestVideoFromFolder } from '../drive';

export const setupDriveWorker = () => {
    const worker = new Worker(
        'drive-sync',
        async (job: Job) => {
            const { creatorId, videoUrl, actionType } = job.data;
            // // console.log(`[Drive Worker] Starting job ${job.id} for creator ${creatorId}, action: ${actionType}`);

            try {
                const creator = await prisma.creator.findUnique({
                    where: { id: creatorId }
                });

                if (!creator) {
                    throw new Error(`Creator ${creatorId} not found`);
                }

                // Ensure creator has a dedicated folder
                let folderId = creator.driveFolderId;
                if (!folderId) {
                    // // console.log(`[Drive Worker] Creating folder for ${creator.usernameTikTok}...`);
                    const newFolderId = await ensureCreatorFolder(
                        creator.name,
                        creator.usernameTikTok,
                        creator.createdAt
                    );

                    if (!newFolderId) {
                        throw new Error('Failed to create or retrieve folder');
                    }

                    folderId = newFolderId;

                    // Save folder ID to database
                    await prisma.creator.update({
                        where: { id: creatorId },
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data: { driveFolderId: folderId } as any
                    });
                    // // console.log(`[Drive Worker] Folder created: ${folderId}`);
                }

                if (actionType === 'COPY_VIDEO' && videoUrl) {
                    let fileId = extractFileId(videoUrl);
                    if (!fileId) throw new Error('Invalid Google Drive link');

                    // 0. Resolve Folder Link: If it's a folder, find the latest video
                    if (isFolderUrl(videoUrl)) {
                        // // console.log(`[Drive Worker] Detected folder link. Searching for latest video in ${fileId}...`);
                        try {
                            const latestFile = await getLatestVideoFromFolder(fileId);
                            if (latestFile && latestFile.id) {
                                // // console.log(`[Drive Worker] Found latest video: ${latestFile.name} (${latestFile.id})`);
                                fileId = latestFile.id;

                                // Update the database so the dashboard review iframe works
                                const newVideoUrl = `https://drive.google.com/file/d/${fileId}/view`;
                                await prisma.creator.update({
                                    where: { id: creatorId },
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    data: { videoUrl: newVideoUrl } as any
                                });
                            } else {
                                const folderErrMsg = '❌ FOLDER ERROR: Link yang kamu kirim adalah folder, tapi tim kami tidak menemukan file video di dalamnya. Pastikan video sudah diupload ke folder tersebut.';
                                await postSystemMessage(creator.id, folderErrMsg);
                                return { success: false, error: 'No video found in folder' };
                            }
                        } catch (folderErr: any) {
                            console.error(`[Drive Worker] Folder Resolution Failed:`, folderErr.message);
                            if (folderErr.status === 403 || folderErr.code === 403) {
                                await postSystemMessage(creator.id, '⚠️ FOLDER PERMISSION ERROR: Folder Drive kamu tidak bisa diakses. Pastikan folder sudah di-set ke "Anyone with the link / Siapa saja yang memiliki link".');
                            }
                            throw folderErr;
                        }
                    }

                    // 1. Attempt to Copy Video (May fail if private/restricted)
                    try {
                        const historyCount = ((creator.videoHistory as unknown[]) || []).length;
                        const version = historyCount + 1;
                        const fileName = `${creator.usernameTikTok}_video_v${version}.mp4`;

                        // // console.log(`[Drive Worker] Copying video ${fileId} to folder ${folderId}...`);
                        await copyFileToDrive(fileId, folderId!, fileName);
                        // // console.log(`[Drive Worker] Video copied successfully as ${fileName}`);
                    } catch (copyError: any) {
                        console.error(`[Drive Worker] Copy Failed:`, copyError.message);
                        
                        if (copyError?.message && copyError.message.includes('storage quota')) {
                             // This is an infrastructure error (Service Account cannot own files outside a Shared Drive)
                             console.warn('[Drive Worker] Skipping copy: Service Account lacks storage quota. Consider using a Shared Drive.');
                             
                             // We don't want to blame the creator, but maybe we can warn the BD/Admin silently if we had a field,
                             // For now, we just skip it so the flow continues using the original link.
                        } else if (copyError.status === 403 || copyError.code === 403) {
                            const errMsg = '⚠️ DRIVE PERMISSION ERROR: Link Google Drive memang publik, tapi opsi "BATASI PENYALINAN/DOWNLOAD" aktif. \n\nCara Fix: Di Google Drive, klik Share > Settings (Gear icon) > PASTIKAN CENTANG "Viewers and commenters can see the option to download, print, and copy" DALAM KEADAAN AKTIF agar tim kami bisa memproses video kamu.';

                            await prisma.creator.update({
                                where: { id: creatorId },
                                data: {
                                    reviewNotes: errMsg
                                } as any
                            });
                        }
                    }

                }

                // // console.log(`[Drive Worker] Job ${job.id} done.`);
                return { success: true, folderId };

            } catch (error: unknown) {
                console.error(`[Drive Worker] Job ${job.id} failed:`, error);
                throw error;
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { connection: redisConnection as any }
    );

    worker.on('failed', (job, err) => {
        console.error(`[Drive Worker] Job ${job?.id} failed with error: ${err.message}`);
    });

    // // console.log('[Drive Worker] Drive sync worker is ready.');
    return worker;
};

async function postSystemMessage(creatorId: string, content: string) {
    try {
        const { chatQueue } = await import('../queue');
        const { randomUUID } = await import('crypto');
        await chatQueue.add('send-message', {
            id: randomUUID(),
            creatorId: creatorId,
            senderId: null, // System/Automated
            content: content
        });
    } catch (err) {
        console.error('[Drive Worker] Failed to post system message:', err);
    }
}
