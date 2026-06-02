// Suppress all console logs except errors at the top level
// This affects the entire node process including workers
if (typeof global !== 'undefined') {
    const noop = () => { };
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.debug = noop;
}

export async function register() {

    // Skip worker initialization during Docker build (DOCKER_BUILD=1 is set in builder stage only)
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DOCKER_BUILD !== '1') {
        const setup = async (name: string, fn: () => void) => {
            try {
                fn();
                console.log(`[Instrumentation] ${name} started successfully`);
            } catch (err) {
                console.error(`[Instrumentation] Failed to start ${name}:`, err);
            }
        };

        const { setupDocumentWorker } = await import('@/lib/workers/documentWorker');
        const { setupDriveWorker } = await import('@/lib/workers/driveWorker');
        const { setupVideoUploadWorker } = await import('@/lib/workers/videoUploadWorker');
        const { setupChatWorker } = await import('@/lib/workers/chatWorker');
        const { setupSyncWorker } = await import('@/lib/workers/syncWorker');
        const { setupVideoProcessorWorker } = await import('@/lib/workers/videoProcessor');

        await setup('Document Worker', setupDocumentWorker);
        await setup('Drive Worker', setupDriveWorker);
        await setup('Video Upload Worker', setupVideoUploadWorker);
        await setup('Chat Worker', setupChatWorker);
        await setup('External Sync Worker', setupSyncWorker);
        await setup('Video Processor Worker', setupVideoProcessorWorker);
    }
}
