import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { uploadToS3 } from '@/lib/s3';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const isManual = formData.get('isManual') === 'true';
        const token = formData.get('token') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const doc = await prisma.document.findUnique({
            where: { id }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Authorization check
        let isAuthorized = false;
        if (session) {
            isAuthorized = true;
        } else if (token) {
            const creator = await prisma.creator.findUnique({
                where: { sessionToken: token }
            });
            if (creator) {
                const username = creator.usernameTikTok.replace(/^@/, '');
                if (doc.title.includes(username) || (doc.metadata as any)?.from_username?.includes(username)) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Upload to S3 from Server (Avoids CORS)
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const timestamp = new Date().getTime();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `documents/${doc.documentNo}/signed/${timestamp}_${sanitizedFileName}`;

        const finalUrl = await uploadToS3(buffer, filePath, file.type);

        // 2. Update document with signed file URL
        const updatedDoc = await prisma.document.update({
            where: { id },
            data: {
                signedFileUrl: finalUrl,
                signedAt: new Date(),
                isManualSigned: isManual || false,
                status: 'COMPLETED'
            }
        });

        // 3. Add Activity Log
        try {
            let logUserId = (session?.user as any)?.id;
            let creatorId = null;

            if (!logUserId && token) {
                const creatorData = await prisma.creator.findUnique({
                    where: { sessionToken: token }
                });
                if (creatorData) {
                    logUserId = creatorData.createdById;
                    creatorId = creatorData.id;
                }
            }

            if (logUserId) {
                await prisma.activityLog.create({
                    data: {
                        userId: logUserId,
                        creatorId: creatorId,
                        action: 'UPLOAD_SIGNED_DOCUMENT',
                        details: JSON.stringify({
                            documentNo: doc.documentNo,
                            documentId: id,
                            isManual: isManual || false,
                            source: token ? 'CREATOR_PORTAL' : 'ADMIN_DASHBOARD'
                        })
                    }
                });
            }
        } catch (logErr) {
            console.error('[Log Error]:', logErr);
        }

        return NextResponse.json({ success: true, document: updatedDoc });

    } catch (error: any) {
        console.error('[Upload Signed Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
