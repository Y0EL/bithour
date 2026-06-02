import { NextRequest, NextResponse } from 'next/server';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { prisma } from '@/lib/prisma';


/**
 * POST /api/creator/upload/init
 * Initialize a presigned upload URL to Backblaze B2
 * Returns an upload URL that the browser can use to upload directly to Backblaze
 */
export async function POST(req: NextRequest) {
    try {
        const { token, fileName, mimeType, fileSize } = await req.json();

        if (!token || !fileName || !mimeType || !fileSize) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate file type (only videos)
        if (!mimeType.startsWith('video/')) {
            return NextResponse.json(
                { error: 'Only video files are allowed' },
                { status: 400 }
            );
        }

        // Validate file size (max 2GB)
        const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
        if (fileSize > MAX_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds 2GB limit' },
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

        // Generate timestamped filename for Backblaze
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `creators/${creator.id}/videos/${timestamp}_${sanitizedFileName}`;

        // Generate presigned upload URL for Backblaze
        const { uploadUrl, finalUrl } = await generatePresignedUploadUrl(
            filePath,
            mimeType,
            3600 // 1 hour expiry
        );

        return NextResponse.json({
            uploadUrl,
            finalUrl,
            fileName: sanitizedFileName,
            filePath
        });

    } catch (error: unknown) {
        console.error('Error initializing upload:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize upload';
        return NextResponse.json(
            { error: errorMessage },

            { status: 500 }
        );
    }
}
