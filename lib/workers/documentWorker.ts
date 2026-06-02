import { Worker, Job } from 'bullmq';
import { redisConnection, redisClient } from '../redis';
import { prisma } from '../prisma';
import { generateInvoicePDF, generateMOUPDF } from '@/utils/pdfGenerator';
import { appendOrUpdateSheetRow, getLatestRefWithAI } from '@/lib/sheets';
import { InvoiceData } from '@/utils/types';
import { MOURenderRequest } from '@/utils/mouTypes';

const ensureVAPrefix = (bankName: string, accNo: string): string => {
    if (!bankName || !accNo) return accNo;
    const bank = bankName.toLowerCase();
    const acc = accNo.trim().replace(/\s/g, '').replace(/-/g, ''); // Remove spaces and dashes

    // Map of keywords to their default BCA/Universal Virtual Account prefixes
    const prefixMap: Record<string, string> = {
        'dana': '3901',
        'gopay': '70001',
        'go-pay': '70001',
        'ovo': '39358',
        'shopeepay': '122',
        'shopee-pay': '122',
        'shope-pay': '122',
        'linkaja': '09110',
        'link-aja': '09110',
        'astrapay': '20206',
        'astra-pay': '20206',
        'isaku': '77777',
        'i-saku': '77777'
    };

    for (const key in prefixMap) {
        if (bank.includes(key)) {
            const prefix = prefixMap[key];

            // If it already starts with the prefix, don't touch it
            if (acc.startsWith(prefix)) return acc;

            // Ensure we have the full phone number with leading zero
            let phonePart = acc;
            if (phonePart.startsWith('8')) {
                phonePart = '0' + phonePart;
            }

            // Check if it's a mobile number (starts with 08)
            if (phonePart.startsWith('08')) {
                return prefix + phonePart;
            }
        }
    }
    return acc;
};

export const setupDocumentWorker = () => {
    const worker = new Worker(
        'document-generation',
        async (job: Job) => {
            const { formData, type, userId, requestId } = job.data;
            // // console.log(`[Worker] Starting job ${job.id} for ${type} (Request: ${requestId})`);

            try {
                await job.updateProgress(10);
                let fileUrl = '';
                let docNo = '';

                // Apply Smart VA Prefixing before PDF generation
                if (type === 'INVOICE' && formData.payment_details) {
                    formData.payment_details.account_number = ensureVAPrefix(
                        formData.payment_details.bank_name,
                        formData.payment_details.account_number
                    );
                } else if (type === 'MOU') {
                    formData.account_number = ensureVAPrefix(
                        formData.bank_name,
                        formData.account_number
                    );
                }

                // Fetch BD user name for sheet report
                const bdUser = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, username: true } });
                const bdName = bdUser?.fullName || bdUser?.username || 'Unknown';

                if (type === 'INVOICE') {
                    const currentType = (formData.invType || 'B').toUpperCase();
                    let refVal = formData.refNum || '';
                    let seqVal = formData.invSequence || '';

                    // Assign only if missing (API usually fills this now, but worker provides fallback)
                    if (!refVal || !seqVal) {
                        try {
                            const aiResult = await getLatestRefWithAI('INVOICE', currentType);
                            refVal = refVal || (aiResult.skippedRefs[0]?.toString().padStart(3, '0') || (aiResult.lastRef + 1).toString().padStart(3, '0'));
                            seqVal = seqVal || (aiResult.skippedSeqs[0]?.toString().padStart(4, '0') || (aiResult.lastSeq + 1).toString().padStart(4, '0'));
                        } catch (e) { console.error('Worker Numbering Error:', e); }
                    }

                    formData.refNum = refVal;
                    formData.invSequence = seqVal;

                    const dateStrInvoice = (formData.invoice_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
                    docNo = `${currentType}-${refVal}-INV-DTI-${dateStrInvoice}-${seqVal}`;

                    if (formData.isRevision) docNo += ` REV${(formData.revisionCount || 0) + 1}`;

                    await job.updateProgress(40);
                    formData.invoice_no = docNo;
                    fileUrl = await generateInvoicePDF(formData as InvoiceData, `${docNo}.pdf`);
                    await job.updateProgress(70);

                } else if (type === 'MOU') {
                    const currentType = (formData.mouType || 'B').toUpperCase();
                    let refVal = formData.ref_number || '';
                    let seqVal = formData.mouSequence || '';

                    if (!refVal || !seqVal) {
                        try {
                            const aiResult = await getLatestRefWithAI('MOU', currentType);
                            refVal = refVal || (aiResult.skippedRefs[0]?.toString().padStart(3, '0') || (aiResult.lastRef + 1).toString().padStart(3, '0'));
                            seqVal = seqVal || (aiResult.skippedSeqs[0]?.toString().padStart(4, '0') || (aiResult.lastSeq + 1).toString().padStart(4, '0'));
                        } catch (e) { console.error('Worker Numbering Error:', e); }
                    }

                    formData.ref_number = refVal;
                    formData.mouSequence = seqVal;

                    const dateStrMOU = (formData.agreement_date_short || new Date().toISOString().split('T')[0]).replace(/-/g, '');
                    docNo = `${currentType}-MoU-DTI-${dateStrMOU}-${refVal}-${seqVal}`;

                    if (formData.isRevision && (formData.revisionCount || 0) > 0) docNo += `-R${formData.revisionCount}`;

                    await job.updateProgress(40);
                    formData.mou_number = docNo;
                    fileUrl = await generateMOUPDF({ fields: formData } as MOURenderRequest, `${docNo}.pdf`, formData.signature_party2_base64 || '');
                    await job.updateProgress(70);
                }

                const contextMap: Record<string, string> = { 'A': 'Endorsement', 'B': 'VideoOwningContent', 'C': 'DigitalAssets', 'D': 'Exclusive' };
                const currentCat = (type === 'INVOICE' ? formData.invType : formData.mouType || 'B').toUpperCase();
                const contextShort = contextMap[currentCat] || 'Custom';
                const displayUsername = (formData.from_username || formData.party2_username || 'Creator').replace(/^@/, '');
                const displayTitle = `${type} - ${contextShort} - ${displayUsername}`;

                const documentId = job.data.documentId || job.data.requestId;
                const finalStatus = job.data.isPendingSign ? 'PENDING_SIGN' : 'COMPLETED';

                // UPDATE BOTH DOCUMENT AND SESSION (SSOT)
                const savedDoc = await prisma.$transaction(async (tx) => {
                    if (documentId) {
                        const updated = await tx.document.update({
                            where: { id: documentId },
                            data: { documentNo: docNo, fileUrl, status: finalStatus as any, metadata: formData, title: displayTitle }
                        });
                        await tx.signingSession.updateMany({
                            where: { documentId },
                            data: { formData: formData as any }
                        });
                        return updated;
                    } else {
                        const newDoc = await tx.document.upsert({
                            where: { documentNo: docNo },
                            update: { fileUrl, metadata: formData, updatedAt: new Date(), status: finalStatus as any },
                            create: { type, documentNo: docNo || `TEMP-${Date.now()}`, title: displayTitle, fileUrl, status: finalStatus as any, createdById: userId, metadata: formData }
                        });
                        await tx.signingSession.updateMany({
                            where: { documentId: (newDoc as any).id },
                            data: { formData: formData as any }
                        });
                        return newDoc;
                    }
                });

                await job.updateProgress(85);

                // --- SMART SHEET SYNC ---
                if (!formData.isRevision) {
                    try {
                        const amount = type === 'INVOICE' ? (formData.total_due || 0) : (formData.compensation_amount || 0);
                        const creatorName = formData.from_name || formData.party2_name || 'Creator';
                        const ref = type === 'INVOICE' ? formData.refNum : formData.ref_number;

                        await appendOrUpdateSheetRow({
                            type,
                            category: currentCat,
                            ref,
                            docNo,
                            amount,
                            creatorName,
                            bdName,
                            status: 'PENDING',
                            fileUrl,
                            formData // Passing formData
                        });
                    } catch (sheetError) {
                        console.error('Sheet Sync Error:', sheetError);
                    }
                }

                await job.updateProgress(95);

                // --- OC STATUS SYNC ---
                try {
                    const creatorId = job.data.creatorId || formData.creatorId;
                    if (creatorId) {
                        const creatorWithGroup = await prisma.creator.findUnique({
                            where: { id: creatorId },
                            include: { createdBy: { include: { group: true } } }
                        });
                        const groupName = creatorWithGroup?.createdBy?.group?.name;
                        if (groupName === 'OC' || groupName === 'Owning Content') {
                            const { syncQueue } = await import('@/lib/queue');
                            await syncQueue.add('report-status', {
                                type: 'REPORT_STATUS',
                                creatorId,
                                kolName: creatorWithGroup?.name,
                                isRevision: false
                            });
                        }
                    }
                } catch (ocSyncErr) {
                    console.error('[Worker] OC Sync Error:', ocSyncErr);
                }

                await job.updateProgress(100);
                await (prisma as any).activityLog.create({
                    data: {
                        userId: userId,
                        action: type === 'INVOICE' ? 'CREATE_INVOICE' : 'CREATE_MOU',
                        details: JSON.stringify({ documentNo: docNo, title: savedDoc.title, jobId: job.id })
                    }
                });

                // Update Backup UserSequence (Keeping for compatibility)
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
                                    userId: userId,
                                    docType: type,
                                    category: category || 'B'
                                }
                            },
                            update: { lastRef: numRef, lastSeq: numSeq },
                            create: {
                                userId: userId,
                                docType: type,
                                category: category || 'B',
                                lastRef: numRef,
                                lastSeq: numSeq
                            }
                        });
                    }
                } catch (e) {
                    console.error('Sequence Update Error:', e);
                }

                // // console.log(`[Worker] Job ${job.id} completed successfully.`);
                return { pdf_url: fileUrl, document_id: (savedDoc as any).id };

            } catch (error: unknown) {
                console.error(`[Worker] Job ${job.id} failed:`, error);
                throw error;
            }
        },
        { connection: redisConnection as any }
    );

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed with error: ${err.message}`);
    });

    // // console.log('[Worker] Document Generation worker is ready.');
    return worker;
};

