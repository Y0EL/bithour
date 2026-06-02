import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { batchAppendToSheet, getAllReportedDocNos } from '@/lib/sheets';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;

    try {
        // Look back 7 days to be safe for missing reports
        const scanStart = new Date();
        scanStart.setDate(scanStart.getDate() - 7);
        scanStart.setHours(0, 0, 0, 0);

        const [documents, reportedDocNos] = await Promise.all([
            prisma.document.findMany({
                where: {
                    createdById: userId,
                    createdAt: { gte: scanStart }
                }
            }),
            getAllReportedDocNos()
        ]);

        const reportedSet = new Set(reportedDocNos);
        const hasNewDocs = documents.some((doc: any) => !reportedSet.has(doc.documentNo));

        return NextResponse.json({
            reported: documents.length > 0 && !hasNewDocs,
            hasNewDocs,
            count: documents.filter((doc: any) => !reportedSet.has(doc.documentNo)).length
        });
    } catch (error: any) {
        return NextResponse.json({ reported: false, hasNewDocs: false, error: error.message });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userName = (session.user as any).name;

    try {
        // --- 1. ACQUIRE LOCK ---
        const now = new Date();
        const existingLock = await prisma.reportLock.findUnique({ where: { id: 'singleton' } });

        if (existingLock?.isLocked && existingLock.expiresAt && existingLock.expiresAt > now) {
            return NextResponse.json({
                error: 'LOCKED',
                message: `Laporan sedang diproses oleh ${existingLock.lockedBy}. Silahkan tunggu sebentar.`
            }, { status: 423 });
        }

        // Lock it
        await prisma.reportLock.upsert({
            where: { id: 'singleton' },
            update: {
                isLocked: true,
                lockedBy: userName,
                expiresAt: new Date(Date.now() + 2 * 60 * 1000)
            },
            create: {
                id: 'singleton',
                isLocked: true,
                lockedBy: userName,
                expiresAt: new Date(Date.now() + 2 * 60 * 1000)
            }
        });

        const scanStart = new Date();
        scanStart.setDate(scanStart.getDate() - 7);
        scanStart.setHours(0, 0, 0, 0);

        // 2. Fetch current documents (Filtered by USER) and ALL reported numbers in sheet
        const [allDocuments, reportedDocNos] = await Promise.all([
            prisma.document.findMany({
                where: {
                    createdById: userId, // CRITICAL: Only Yoel's docs for Yoel
                    createdAt: { gte: scanStart }
                },
                include: { createdBy: { select: { fullName: true } } },
                orderBy: { createdAt: 'asc' }
            }),
            getAllReportedDocNos()
        ]);

        const reportedSet = new Set(reportedDocNos);

        // 3. Filter out what's ALREADY in the sheet AND skip revisions (e.g., -R1, -R2)
        const newDocuments = allDocuments.filter((doc: any) => {
            const isAlreadyReported = reportedSet.has(doc.documentNo);
            const isRevision = doc.documentNo.includes('-R');
            return !isAlreadyReported && !isRevision;
        });

        if (newDocuments.length === 0) {
            await prisma.reportLock.update({ where: { id: 'singleton' }, data: { isLocked: false } });
            return NextResponse.json({
                error: 'NO_NEW_DATA',
                message: 'Semua dokumen Anda sudah dilaporkan ke Google Sheets.'
            }, { status: 400 });
        }

        // --- UNIFICATION LOGIC (Hide MOU if Invoice exists in same batch) ---
        const referencedMous = new Set<string>();
        allDocuments.forEach((doc: any) => {
            if (doc.type === 'INVOICE') {
                const meta = doc.metadata as any || {};
                if (meta.mou_reference) referencedMous.add(meta.mou_reference);
            }
        });

        const finalDocuments = newDocuments.filter((doc: any) => {
            if (doc.type === 'MOU' && referencedMous.has(doc.documentNo)) return false;
            return true;
        });

        if (finalDocuments.length === 0) {
            await prisma.reportLock.update({ where: { id: 'singleton' }, data: { isLocked: false } });
            return NextResponse.json({
                message: 'Semua dokumen baru Anda sudah terwakili dalam laporan.'
            });
        }

        // --- SORTING ---
        const sortedDocuments = finalDocuments.sort((a: any, b: any) => {
            const getDocNumbers = (doc: any) => {
                const parts = doc.documentNo.split('-');
                let ref = 0, seq = 0;
                if (doc.type === 'INVOICE') {
                    ref = parseInt(parts[1] || '0');
                    seq = parseInt(parts[5] || '0');
                } else {
                    ref = parseInt(parts[4] || '0');
                    seq = parseInt(parts[5] || '0');
                }
                return { ref, seq };
            };
            const aNum = getDocNumbers(a);
            const bNum = getDocNumbers(b);
            if (aNum.ref !== bNum.ref) return aNum.ref - bNum.ref;
            return aNum.seq - bNum.seq;
        });

        const rows = sortedDocuments.map((doc: any) => {
            const meta = doc.metadata as any || {};
            const isInvoice = doc.type === 'INVOICE';
            const d = new Date();
            const reportingDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

            const typeValue = isInvoice ? 'Invoice' : 'MOU';
            const mouNo = isInvoice ? (meta.mou_reference || '') : doc.documentNo;
            const invNo = isInvoice ? doc.documentNo : '';
            const bd = doc.createdBy.fullName;
            const kol = isInvoice ? meta.from_username : meta.party2_username;

            const nameInBank = isInvoice ? (meta.payment_details?.account_name || '') : (meta.account_holder || '');
            const bankName = isInvoice ? (meta.payment_details?.bank_name || '') : (meta.bank_name || '');
            const city = isInvoice ? (meta.payment_details?.kcp_kota || '') : (meta.kcp_kota || '');
            const accountNo = isInvoice ? (meta.payment_details?.account_number || '') : (meta.account_number || '');
            const amount = isInvoice ? (meta.total_due || 0) : (meta.compensation_amount || 0);

            const formattedAmount = amount.toLocaleString('en-US');
            const dateValue = isInvoice ? meta.invoice_date : meta.agreement_date_short;
            let formattedDateValue = '';
            if (dateValue) {
                const [y, m, d] = dateValue.split('-');
                formattedDateValue = `${y}/${parseInt(m)}/${parseInt(d)}`;
            }

            const nik = isInvoice ? (meta.nik || '') : (meta.party2_ktp || '');
            const npwp = meta.npwp || '';

            return [
                reportingDate,
                typeValue,
                mouNo,
                invNo,
                bd,
                kol,
                nameInBank,
                '',
                '',
                '',
                bankName,
                city,
                nameInBank,
                accountNo,
                formattedAmount,
                formattedDateValue,
                nik,
                npwp,
                'FALSE'
            ];
        });

        await batchAppendToSheet(rows);

        // --- 4. RELEASE LOCK ---
        await prisma.reportLock.update({ where: { id: 'singleton' }, data: { isLocked: false } });

        return NextResponse.json({
            success: true,
            message: `Berhasil menambahkan ${rows.length} dokumen milik ${userName} ke Google Sheets.`,
            count: rows.length
        });

    } catch (error: any) {
        console.error('Report Error:', error);
        await prisma.reportLock.update({ where: { id: 'singleton' }, data: { isLocked: false } }).catch(() => { });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
