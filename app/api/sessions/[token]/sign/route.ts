import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInvoicePDF, generateMOUPDF } from '@/utils/pdfGenerator';
import { InvoiceData } from '@/utils/types';
import { MOURenderRequest } from '@/utils/mouTypes';
import { syncQueue } from '@/lib/queue';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    try {
        const session = await prisma.signingSession.findUnique({
            where: { token },
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (new Date() > session.expiresAt) {
            return NextResponse.json({ error: 'Session expired' }, { status: 410 });
        }

        if (session.status === 'COMPLETED') {
            return NextResponse.json({ error: 'Document already signed' }, { status: 400 });
        }

        const body = await req.json();
        const { formData, signature, invType, refNum } = body;

        // 1. Detect changes for team notification
        const originalData = JSON.stringify(session.formData);
        const newData = JSON.stringify(formData);
        const changedByClient = originalData !== newData;

        let changeLog = null;
        if (changedByClient) {
            changeLog = "Creator modified their information before signing.";
        }

        let fileUrl = '';
        let docNo = '';

        const dateStr = (formData.invoice_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');

        const revSuffix = formData.isRevision && formData.revisionCount ? `-R${formData.revisionCount}` : '';

        if (session.type === 'INVOICE') {
            const contextMap: Record<string, string> = {
                'A': 'Endorsement',
                'B': 'VideoOwningContent',
                'C': 'DigitalAssets',
                'D': 'Exclusive'
            };
            const currentType = (body.invType || formData.invType || 'B').toUpperCase();
            const context = contextMap[currentType] || 'Invoice';
            const username = (formData.from_username || 'creator').replace(/^@/, '');
            const currentRef = body.refNum || formData.refNum || '000';

            docNo = formData.invoice_no;
            const fileName = `INV_${context}_${username}-${dateStr}-${currentRef}${revSuffix}.pdf`;

            // Prepare data for PDF generator
            const invoiceData: InvoiceData = {
                ...formData,
                signature: {
                    name: formData.from_name || formData.fullName,
                    image_base64: signature
                }
            };

            fileUrl = await generateInvoicePDF(invoiceData, fileName);

        } else if (session.type === 'MOU') {
            docNo = formData.mou_number;
            const fileName = `MOU - ${docNo}${revSuffix}.pdf`;

            const mouData: MOURenderRequest = {
                fields: formData
            };

            fileUrl = await generateMOUPDF(mouData, fileName, signature);
        }

        // 1.5 Check if docNo already exists to avoid P2002
        if (docNo) {
            const existingDoc = await prisma.document.findUnique({
                where: { documentNo: docNo }
            });
            if (existingDoc && existingDoc.id !== session.documentId) {
                return NextResponse.json({
                    error: `Document number ${docNo} already exists. Please contact admin if this is a mistake.`
                }, { status: 400 });
            }
        }

        const contextMap: Record<string, string> = {
            'A': 'Endorsement',
            'B': 'VideoOwningContent',
            'C': 'DigitalAssets',
            'D': 'Exclusive'
        };
        const currentType = (body.invType || formData.invType || 'B').toUpperCase();
        const context = session.type === 'INVOICE' ? (contextMap[currentType] || 'Invoice') : 'MOU';
        const displayUsername = (formData.from_username || formData.party2_username || 'Creator').replace(/^@/, '');

        const displayTitle = `${context} - ${displayUsername}${revSuffix}`;

        // 2. Upsert Document and Update Session
        let document;
        if (session.documentId) {
            document = await prisma.document.update({
                where: { id: session.documentId },
                data: {
                    documentNo: docNo || `TEMP-${Date.now()}`,
                    title: displayTitle,
                    fileUrl,
                    status: 'COMPLETED',
                    metadata: formData,
                }
            });
        } else {
            const safeDocNo = docNo || `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            document = await prisma.document.upsert({
                where: { documentNo: safeDocNo },
                update: { fileUrl, metadata: formData, status: 'COMPLETED', title: displayTitle, updatedAt: new Date() },
                create: {
                    type: session.type,
                    documentNo: safeDocNo,
                    title: displayTitle,
                    fileUrl,
                    status: 'COMPLETED',
                    createdById: session.createdById,
                    metadata: formData,
                }
            });
        }

        await prisma.signingSession.update({
            where: { id: session.id },
            data: {
                status: 'COMPLETED',
                documentId: document.id,
                changedByClient,
                changeLog,
                formData: formData // Save the final version
            }
        });

        // 2.5 Auto-Update Creator Status if linked
        if (session.creatorId) {
            try {
                // Removed auto-update to SAMPLING. User wants status to stay as-is.
                await prisma.creator.update({
                    where: { id: session.creatorId },
                    data: {
                        // Sync back any changes creator made to their info
                        name: formData.party2_name || formData.from_name || undefined,
                        ktpNumber: formData.party2_ktp || formData.nik || undefined,
                        address: formData.party2_address || formData.from_address || undefined,
                        bankName: formData.bank_name || formData.payment_details?.bank_name || undefined,
                        accountNumber: formData.account_number || formData.payment_details?.account_number || undefined,
                        accountName: formData.account_holder || formData.payment_details?.account_name || undefined,
                    }
                });
                // console.log(`[Sign Sync] Updated creator ${session.creatorId} status to ${nextStatus} and synced profile data.`);
            } catch (creatorUpdateError) {
                console.error('[Sign Sync] Failed to update creator status:', creatorUpdateError);
            }
        }

        // 3. Sync to Google Sheets via BullMQ
        try {
            const amount = session.type === 'INVOICE' ? (formData.total_due || 0) : (formData.compensation_amount || 0);
            const creator = await prisma.creator.findUnique({
                where: { id: session.creatorId || '' },
                include: { createdBy: true }
            });
            const bdName = creator?.createdBy?.fullName || 'Internal';
            const category = session.type === 'INVOICE' ? (body.invType || formData.invType || 'B') : (formData.mouType || 'B');
            const ref = session.type === 'INVOICE' ? (body.refNum || formData.refNum || '000') : (formData.ref_number || '000');

            await syncQueue.add('report-sign-complete', {
                type: 'REPORT_DOCUMENT',
                creatorId: session.creatorId,
                docType: session.type,
                category,
                ref,
                docNo,
                amount,
                bdName,
                status: 'COMPLETED',
                fileUrl: fileUrl.startsWith('http') ? fileUrl : (process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}${fileUrl}` : fileUrl),
                formData
            });
        } catch (queueError) {
            console.error('[Queue Error] Failed to sync to Google Sheets:', queueError);
        }

        // 4. Update User's Last Ref & Seq in DB (UserSequence table)
        try {
            const isInvoice = session.type === 'INVOICE';
            const category = isInvoice ? (body.invType || formData.invType) : (body.mouType || formData.mouType);
            const refVal = isInvoice ? (body.refNum || formData.refNum) : formData.ref_number;
            const seqVal = isInvoice ? (body.invSequence || formData.invSequence) : (body.mouSequence || formData.mouSequence);

            const numRef = parseInt(refVal);
            const numSeq = parseInt(seqVal);

            if (!isNaN(numRef) && !isNaN(numSeq)) {
                // Update UserSequence (The new source of truth)
                await prisma.userSequence.upsert({
                    where: {
                        userId_docType_category: {
                            userId: session.createdById,
                            docType: session.type,
                            category: category || 'B'
                        }
                    },
                    update: {
                        lastRef: numRef,
                        lastSeq: numSeq
                    },
                    create: {
                        userId: session.createdById,
                        docType: session.type,
                        category: category || 'B',
                        lastRef: numRef,
                        lastSeq: numSeq
                    }
                });

                // Also update legacy fields on User for safety
                if (isInvoice) {
                    await prisma.user.update({
                        where: { id: session.createdById },
                        data: {
                            lastInvRef: numRef,
                            lastInvSeq: numSeq
                        }
                    });
                } else {
                    await prisma.user.update({
                        where: { id: session.createdById },
                        data: {
                            lastMouRef: numRef,
                            lastMouSeq: numSeq
                        }
                    });
                }
            }
        } catch (refUpdateError) {
            console.error('Failed to update user last sequence:', refUpdateError);
        }

        return NextResponse.json({ message: 'Document signed successfully', fileUrl, document_id: document.id });

    } catch (error: any) {
        console.error('Signing Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}