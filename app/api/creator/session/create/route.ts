import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { appendOrUpdateSheetRow, getLatestRefWithAI } from '@/lib/sheets';
import { terbilang, normalizeBankName } from '@/utils/numberUtils';
import { generateInvoicePDF, generateMOUPDF } from '@/utils/pdfGenerator';
import { InvoiceData } from '@/utils/types';
import { MOURenderRequest } from '@/utils/mouTypes';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { creatorId, docType, category = 'B' } = body;

        if (!creatorId || !docType) {
            return NextResponse.json({ error: 'Missing creatorId or docType' }, { status: 400 });
        }

        // 1. Fetch Creator
        const creator = await prisma.creator.findUnique({
            where: { id: creatorId }
        });

        if (!creator) {
            return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
        }

        // 2. Setup Redis Lock for Atomic Numbering
        const { redisClient } = await import('@/lib/redis');
        const lockKey = `lock:sequence:${docType}:${category}`;
        let lockAcquired = false;

        let finalNextRef = 0;
        let finalNextSeq = 0;

        try {
            // Attempt to acquire lock for 10 seconds
            for (let i = 0; i < 20; i++) {
                const result = await redisClient.set(lockKey, 'locked', 'EX', 30, 'NX');
                if (result === 'OK') { lockAcquired = true; break; }
                await new Promise(r => setTimeout(r, 500));
            }

            if (!lockAcquired) throw new Error('Could not acquire numbering lock. Please try again.');

            // Check if creator already has a linked REF (from another document)
            const existingSession = await prisma.signingSession.findFirst({
                where: { creatorId: creator.id },
                orderBy: { createdAt: 'desc' },
                include: { Document: true }
            });

            const existingDoc = existingSession?.Document;
            let linkedRef = 0;

            if (existingDoc && existingDoc.documentNo) {
                const parts = existingDoc.documentNo.split('-');
                if (existingDoc.documentNo.includes('-INV-')) linkedRef = parseInt(parts[1]);
                else if (existingDoc.documentNo.includes('-MoU-')) {
                    if (parts[1]?.toLowerCase() === 'mou') linkedRef = parseInt(parts[4]);
                    else linkedRef = parseInt(parts[1]);
                }
            }

            const aiResult = await getLatestRefWithAI(docType, category);

            // NEW LOGIC: Use existing REF if linked, otherwise use FIRST SKIPPED or lastRef+1
            if (linkedRef > 0) {
                finalNextRef = linkedRef;
            } else {
                finalNextRef = aiResult.skippedRefs.length > 0 ? aiResult.skippedRefs[0] : (aiResult.lastRef + 1);
            }

            // SEQ: always use FIRST SKIPPED or lastSeq+1
            finalNextSeq = aiResult.skippedSeqs.length > 0 ? aiResult.skippedSeqs[0] : (aiResult.lastSeq + 1);

            const now = new Date();
            if (aiResult.lastDate) {
                const lastYear = parseInt(aiResult.lastDate.substring(0, 4));
                // SEQ resets per YEAR only (not per month)
                if (now.getFullYear() !== lastYear) finalNextSeq = 1;
            }

        } finally {
            if (lockAcquired) await redisClient.del(lockKey);
        }

        const now = new Date();
        const paddedRef = finalNextRef.toString().padStart(3, '0');
        const paddedSeq = finalNextSeq.toString().padStart(4, '0');
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const dateFormatted = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        // 3. Build Form Data
        let formData: any = {};
        let docNo = '';

        if (docType === 'MOU') {
            docNo = `${category}-MoU-DTI-${dateStr}-${paddedRef}-${paddedSeq}`;
            const amount = 100000;
            formData = {
                mou_number: docNo,
                agreement_date: dateFormatted,
                agreement_date_short: now.toISOString().split('T')[0],
                party1_name: 'Bithour Production',
                party1_company: 'PT. Bithour Production Indonesia',
                party1_position: 'Direktur',
                party1_address: 'Jl. Pluit Karang Utara Blok A1u Nomor 48 RT. 000 RW.000, Pluit, Penjaringan, Kota Adm. Jakarta Utara, DKI Jakarta',
                party2_name: creator.name,
                party2_ktp: creator.ktpNumber || '',
                party2_address: creator.address || '',
                party2_username: creator.usernameTikTok,
                content_title: `Video (${creator.usernameTikTok})`,
                content_type: 'Video pendek untuk keperluan promosi (platform TikTok, Instagram, dll.)',
                content_type_code: 'VIDEO',
                creation_date: dateFormatted,
                duration: '1-5 menit',
                platform_accounts: ['bithourproduction.com'],
                is_paid: true,
                compensation_amount: amount.toLocaleString('en-US'),
                compensation_in_words: terbilang(amount) + ' Rupiah',
                bank_name: normalizeBankName(creator.bankName || ''),
                account_holder: creator.accountName || '',
                account_number: creator.accountNumber || '',
                kcp_kota: creator.kcpCity || '',
                sign_date: dateFormatted,
                sign_location: 'Jakarta',
                ref_number: paddedRef,
                mouType: category,
                mouSequence: paddedSeq,
                npwp: '',
                signature_party1: { dataUrl: '', isEmpty: true },
                signature_party2: { dataUrl: '', isEmpty: true },
            };
        } else if (docType === 'INVOICE') {
            // Find linked MoU No for metadata display
            const linkedSession = await prisma.signingSession.findFirst({
                where: { creatorId: creator.id, type: 'MOU' },
                orderBy: { createdAt: 'desc' },
                include: { Document: true }
            });
            const mouNo = linkedSession?.Document?.documentNo || '';
            const amount = 100000;

            docNo = `${category}-${paddedRef}-INV-DTI-${dateStr}-${paddedSeq}`;
            formData = {
                invoice_no: docNo,
                invoice_date: now.toISOString().split('T')[0],
                from_name: creator.name,
                from_username: creator.usernameTikTok.replace(/^@/, ''),
                to: {
                    name: 'PT. BITHOUR PRODUCTION INDONESIA',
                    address_lines: ['JL. PLUIT KARANG AYU BARAT BLOK. A1 U NO. 48', 'PLUIT, PENJARINGAN', 'JAKARTA UTARA', 'DKI JAKARTA']
                },
                items: [{ no: 1, description: 'PURCHASE OWNING CONTENT (1st COLLABORATION)', qty: 1, unit_price: amount, total: amount }],
                payment_details: {
                    bank_name: normalizeBankName(creator.bankName || ''),
                    account_name: creator.accountName || '',
                    account_number: creator.accountNumber || '',
                    kcp_kota: creator.kcpCity || '',
                    swift_code: ''
                },
                signature: { name: creator.name, image_base64: '' },
                sub_total: amount,
                total_due: amount,
                ref_number: paddedRef,
                refNum: paddedRef, // Extra field for worker
                invSequence: paddedSeq,
                invType: category,
                mou_reference: mouNo,
                nik: creator.ktpNumber || '',
                npwp: ''
            };
        }

        // 4. Create Token and Session (Placeholders)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for creator link

        // Create Document first as placeholder
        const document = await prisma.document.create({
            data: {
                type: docType,
                documentNo: `PENDING-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                title: `${docType} PENDING - ${creator.name}`,
                fileUrl: '',
                status: 'PENDING_SIGN',
                createdById: (session.user as any).id,
                metadata: formData,
            }
        });

        const newSession = await prisma.signingSession.create({
            data: {
                token,
                type: docType,
                formData,
                expiresAt,
                createdById: (session.user as any).id,
                documentId: document.id,
                creatorId: creator.id
            },
        });

        // 5. Enqueue to BullMQ Background Worker (Zero Latency)
        const { documentQueue } = await import('@/lib/queue');
        await documentQueue.add('document-generation', {
            requestId: document.id,
            type: docType,
            formData,
            userId: (session.user as any).id,
            isPendingSign: true
        }, { jobId: document.id });

        // console.log(`[Quick Doc] Enqueued ${docType} job for @${creator.usernameTikTok} (DocID: ${document.id})`);

        return NextResponse.json({
            success: true,
            token,
            requestId: document.id,
            message: `Sesi ${docType} sedang kami buat di background. Mohon tunggu beberapa detik.`
        });

    } catch (error: any) {
        console.error('Creator Session Create Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
