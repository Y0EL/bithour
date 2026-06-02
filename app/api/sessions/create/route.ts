import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

import { appendOrUpdateSheetRow } from '@/lib/sheets';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { type, formData } = body;

        if (!type || !formData) {
            return NextResponse.json({ error: 'Missing type or formData' }, { status: 400 });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // 1. Get Document Number from formData (should already be real from AI/gap selection)
        const docNo = type === 'INVOICE' ? formData.invoice_no : formData.mou_number;

        // 2. Create the Document first (Status: PENDING_SIGN)
        const document = await prisma.document.create({
            data: {
                type,
                documentNo: docNo || `TEMP-${Date.now()}`,
                title: `${type} PENDING - ${docNo}`,
                fileUrl: '', // No file yet
                status: 'PENDING_SIGN',
                createdById: (session.user as any).id,
                metadata: formData,
            }
        });

        // 3. Create the Signing Session
        const newSession = await prisma.signingSession.create({
            data: {
                token,
                type,
                formData,
                expiresAt,
                createdById: (session.user as any).id,
                documentId: document.id
            },
        });

        const baseUrl = (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost'))
            ? process.env.NEXTAUTH_URL
            : `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        const signUrl = `${baseUrl}/sign/${token}`;

        // 4. Record to Google Sheets immediately (SMART MERGING)
        try {
            const amount = type === 'INVOICE' ? (formData.total_due || 0) : (formData.compensation_amount || 0);
            const creatorName = formData.from_name || formData.party2_name || 'Creator';
            const category = type === 'INVOICE' ? formData.invType : formData.mouType;
            const ref = type === 'INVOICE' ? formData.refNum : formData.ref_number;
            const bdName = (session.user as any).name || (session.user as any).username || 'BD';

            await appendOrUpdateSheetRow({
                type,
                category: category || 'B',
                ref,
                docNo,
                amount,
                creatorName,
                bdName,
                status: 'PENDING SIGN',
                fileUrl: signUrl,
                formData // Passing formData
            });
        } catch (sheetError) {
            console.error('Failed to sync PENDING document to Google Sheets:', sheetError);
        }

        // 5. Update Backup UserSequence
        try {
            const isInvoice = type === 'INVOICE';
            const category = isInvoice ? formData.invType : formData.mouType;
            const refVal = isInvoice ? formData.refNum : formData.ref_number;
            const seqVal = isInvoice ? formData.invSequence : formData.mouSequence;

            const numRef = parseInt(refVal);
            const numSeq = parseInt(seqVal);

            if (!isNaN(numRef) && !isNaN(numSeq)) {
                await prisma.userSequence.upsert({
                    where: {
                        userId_docType_category: {
                            userId: (session.user as any).id,
                            docType: type,
                            category: category || 'B'
                        }
                    },
                    update: { lastRef: numRef, lastSeq: numSeq },
                    create: {
                        userId: (session.user as any).id,
                        docType: type,
                        category: category || 'B',
                        lastRef: numRef,
                        lastSeq: numSeq
                    }
                });
            }
        } catch (seqError) {
            console.error('Failed to update sequence during session creation:', seqError);
        }

        return NextResponse.json({ signUrl, token });
    } catch (error: any) {
        console.error('Session Creation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
