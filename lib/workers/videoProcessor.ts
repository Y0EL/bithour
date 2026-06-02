import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redis';
import { prisma } from '../prisma';
import ffmpeg from 'fluent-ffmpeg';
import { downloadFromS3, uploadStreamToS3 } from '../s3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

// Utility to get ffmpeg path safely
const getFfmpegPath = () => {
    // 1. Check environment variable (Best practice for VPS)
    if (process.env.FFMPEG_PATH) {
        return process.env.FFMPEG_PATH;
    }

    // 2. Default to system "ffmpeg"
    // On most Linux (VPS) and properly setup Windows, this just works.
    let path = 'ffmpeg';

    // 3. Optional: Attempt to load installer only if needed
    // Skip this in Next.js Turbopack development as it causes static analysis crashes
    const isNextDev = process.env.NODE_ENV === 'development';

    if (!isNextDev) {
        try {
            const req = eval('require');
            const ffmpegInstaller = req('@ffmpeg-installer/ffmpeg');
            if (ffmpegInstaller && ffmpegInstaller.path) {
                path = ffmpegInstaller.path;
            }
        } catch (e) {
            // Silently fallback to 'ffmpeg'
        }
    }

    return path;
};

export const setupVideoProcessorWorker = () => {
    try {
        const ffmpegPath = getFfmpegPath();
        ffmpeg.setFfmpegPath(ffmpegPath);
        // // console.log(`[Video Processor] Using FFmpeg from: ${ffmpegPath}`);
    } catch (err) {
        console.error('[Video Processor] Failed to set FFmpeg path:', err);
    }
    const worker = new Worker(
        'video-process',
        async (job: Job) => {
            const { creatorId, videoUrl } = job.data;
            // // console.log(`[Video Processor] Processing video for creator: ${creatorId}`);

            const tempDir = os.tmpdir();
            const timestamp = Date.now();
            const inputPath = path.join(tempDir, `input_${creatorId}_${timestamp}.mp4`);
            const outputPath = path.join(tempDir, `output_${creatorId}_${timestamp}.mp4`);
            const thumbnailFileName = `thumb_${creatorId}_${timestamp}.jpg`;
            const thumbnailPath = path.join(tempDir, thumbnailFileName);

            try {
                // 1. Get creator to see if they exist
                const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
                if (!creator) throw new Error('Creator not found');

                // 2. Download from storage (B2 or R2 — auto-detected by downloadFromS3)
                const b2Bucket = process.env.B2_BUCKET_NAME || '';
                const r2Bucket = process.env.R2_BUCKET_NAME || '';
                const bucketName = videoUrl.includes('r2.cloudflarestorage.com') ? r2Bucket : b2Bucket;
                const urlParts = videoUrl.split(`${bucketName}/`);
                const s3Key = decodeURIComponent(urlParts[urlParts.length - 1]);

                const s3Response = await downloadFromS3(s3Key);
                if (!s3Response.Body) throw new Error('Failed to download from S3');

                const writeStream = fs.createWriteStream(inputPath);
                await new Promise((resolve, reject) => {
                    (s3Response.Body as Readable).pipe(writeStream)
                        .on('finish', () => resolve(true))
                        .on('error', (err) => reject(err));
                });

                // 3. Transcode with FFmpeg (Optimize for Web Streaming)
                // // console.log(`[Video Processor] Transcoding ${inputPath} to ${outputPath}...`);
                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .outputOptions([
                            '-c:v libx264',
                            '-profile:v main',
                            '-level:v 3.1',
                            '-preset superfast',
                            '-crf 23',
                            '-maxrate 2M',
                            '-bufsize 4M',
                            '-vf scale=-2:720', // Scale to 720p height, keep aspect ratio
                            '-c:a aac',
                            '-b:a 128k',
                            '-movflags +faststart' // Move atom to front for fast streaming
                        ])
                        .on('end', () => {
                            // // console.log('[Video Processor] Transcoding finished');
                            resolve(true);
                        })
                        .on('error', (err) => {
                            console.error('[Video Processor] FFmpeg Error:', err);
                            reject(err);
                        })
                        .save(outputPath);
                });

                // 4. Extract Thumbnail
                // // console.log(`[Video Processor] Extracting thumbnail...`);

                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .screenshots({
                            timestamps: ['1'], // Capture frame at 1 second
                            filename: thumbnailFileName,
                            folder: tempDir,
                            size: '640x?' // Fixed width, auto height
                        })
                        .on('end', () => resolve(true))
                        .on('error', (err) => reject(err));
                });

                // 5. Upload Thumbnail
                const thumbnailS3Key = `creators/${creator.id}/videos/thumb_${timestamp}.jpg`;
                const thumbBuffer = fs.readFileSync(thumbnailPath);
                const thumbUrl = await uploadStreamToS3(thumbBuffer, thumbnailS3Key, 'image/jpeg');

                // 6. Upload Optimized Video
                const optimizedFileName = `creators/${creator.id}/videos/optimized_${timestamp}.mp4`;
                const fileBuffer = fs.readFileSync(outputPath);
                const optimizedUrl = await uploadStreamToS3(fileBuffer, optimizedFileName, 'video/mp4');

                // 7. Update Database
                await prisma.creator.update({
                    where: { id: creatorId },
                    data: {
                        videoUrl: optimizedUrl,
                        videoThumbnailUrl: thumbUrl,
                    } as any
                });

                // // console.log(`[Video Processor] Success: Optimized video available at ${optimizedUrl}`);
                // // console.log(`[Video Processor] Success: Thumbnail available at ${thumbUrl}`);

                return { success: true, optimizedUrl, thumbUrl };
            } catch (error) {
                console.error('[Video Processor] Job failed:', error);
                throw error;
            } finally {
                // Cleanup temp files
                if (fs.existsSync(inputPath)) try { fs.unlinkSync(inputPath); } catch (e) { }
                if (fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch (e) { }
                if (fs.existsSync(thumbnailPath)) try { fs.unlinkSync(thumbnailPath); } catch (e) { }
            }
        },
        { connection: redisConnection as any, concurrency: 1 } // Do one at a time to avoid crashing VPS
    );

    // // console.log('[Video Processor] Worker is ready.');
    return worker;
};
