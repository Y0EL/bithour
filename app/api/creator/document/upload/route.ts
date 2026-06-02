import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { uploadStreamToS3 } from '@/lib/s3';
import { syncQueue } from '@/lib/queue';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions) as any;

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const creatorId = formData.get('creatorId') as string;
        const type = formData.get('type') as 'MOU' | 'INVOICE';
        const docNo = formData.get('docNo') as string || `MANUAL-${Date.now()}`;

        if (!file || !creatorId || !type) {
            return NextResponse.json({ error: 'Missing file, creatorId, or type' }, { status: 400 });
        }

        // 1. Fetch Creator
        const creator = await prisma.creator.findUnique({
            where: { id: creatorId }
        });

        if (!creator) {
            return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
        }

        // 2. Stream to S3 (Backblaze)
        // Proxy behavior: no permanent storage on VPS
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `creators/${creator.id}/manual_docs/${Date.now()}_${safeName}`;

        const fileStream = file.stream();
        const fileUrl = await uploadStreamToS3(fileStream, fileName, file.type);

        // 3. Upsert Document Record (to avoid Unique Constraint error)
        const document = await prisma.document.upsert({
            where: { documentNo: docNo },
            update: {
                signedFileUrl: fileUrl,
                status: 'COMPLETED',
                isManualSigned: true,
                metadata: { manual_upload: true, original_name: file.name, updated_at: new Date() }
            },
            create: {
                type,
                documentNo: docNo,
                title: `${type} MANUAL - ${creator.name}`,
                fileUrl: fileUrl, // Original file
                signedFileUrl: fileUrl, // For manual upload, original is the signed one
                status: 'COMPLETED',
                isManualSigned: true,
                createdById: session.user.id,
                metadata: { manual_upload: true, original_name: file.name }
            }
        });

        // 4. Create Linked SigningSession (COMPLETED)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year placeholder

        await prisma.signingSession.create({
            data: {
                token,
                type,
                formData: { manual_upload: true, docNo, mou_number: type === 'MOU' ? docNo : undefined, invoice_no: type === 'INVOICE' ? docNo : undefined },
                status: 'COMPLETED',
                expiresAt,
                createdById: session.user.id,
                documentId: document.id,
                creatorId: creator.id
            }
        });

        // 5. Removed auto-update to SAMPLING. User wants status to stay as-is.

        // 6. Report to Sheets via BullMQ
        try {
            let extractedRef = '000';
            let extractedCat = 'B';

            // Try to extract REF and CAT from docNo if it follows Crowncare format
            // Format: CAT-REF-...
            if (docNo.includes('-')) {
                const parts = docNo.split('-');
                if (parts[0].length === 1) extractedCat = parts[0];
                if (parts[1] && /^\d+$/.test(parts[1])) extractedRef = parts[1];
            }

            await syncQueue.add('report-manual-document', {
                type: 'REPORT_DOCUMENT',
                creatorId: creator.id,
                docType: type,
                category: extractedCat,
                ref: extractedRef,
                docNo,
                amount: type === 'MOU' ? 100000 : 0, // Manual invoice might need amount adjustment but default to 0
                bdName: session.user.fullName || session.user.username || 'Internal',
                status: 'COMPLETED (MANUAL)',
                fileUrl,
                formData: { manual_upload: true }
            });
        } catch (queueError) {
            console.error('[Queue Error] Failed to enqueue manual doc report:', queueError);
        }

        return NextResponse.json({
            success: true,
            fileUrl,
            docNo,
            message: `${type} berhasil diunggah manual.`
        });

    } catch (error: any) {
        console.error('Manual Document Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
