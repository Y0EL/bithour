import { NextRequest, NextResponse } from 'next/server';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { fileName, mimeType, fileSize, token } = await req.json();
        const session = await getServerSession(authOptions);

        let documentId = id;

        // 1. Authorization Check
        const doc = await prisma.document.findUnique({
            where: { id: documentId }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Check if authorized (either session or creator token)
        let isAuthorized = false;
        if (session) {
            isAuthorized = true; // Admin/BD can upload for any document for now (might need role check)
        } else if (token) {
            // Check if this document belongs to this creator
            const creator = await prisma.creator.findUnique({
                where: { sessionToken: token }
            });

            if (creator) {
                // Documents for creator are usually matched by metadata or signing sessions
                // For now, if we have a valid creator token, we allow it if the document title contains their username
                // or if there's a more direct link we can find.
                const username = creator.usernameTikTok.replace(/^@/, '');
                if (doc.title.includes(username) || (doc.metadata as any)?.from_username?.includes(username)) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!fileName || !mimeType || !fileSize) {
            return NextResponse.json({ error: 'Missing file details' }, { status: 400 });
        }

        // Validate file type (PDF or common image formats for signatures)
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedMimes.includes(mimeType)) {
            return NextResponse.json({ error: 'Only PDF or images are allowed' }, { status: 400 });
        }

        // 2. Generate Path
        const timestamp = new Date().getTime();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `documents/${doc.documentNo}/signed/${timestamp}_${sanitizedFileName}`;

        // 3. Generate Presigned URL
        const { uploadUrl, finalUrl } = await generatePresignedUploadUrl(
            filePath,
            mimeType,
            3600 // 1 hour
        );

        return NextResponse.json({
            uploadUrl,
            finalUrl,
            filePath
        });

    } catch (error: any) {
        console.error('[Upload Signed Init Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
