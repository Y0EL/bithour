import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { generateInvoicePDF, generateMOUPDF } from '@/utils/pdfGenerator';
import { appendOrUpdateSheetRow, getLatestRefWithAI } from '@/lib/sheets';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Direct PDF Generation Endpoint
 * Refactored to be SYNCHRONOUS to avoid numbering race conditions
 */
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

        const requestId = crypto.randomUUID();
        const userId = (session.user as any).id;
        const currentType = (formData.invType || formData.mouType || 'B').toUpperCase();

        // 1. SMART NUMBERING (SYCNHRONOUS)
        if (!formData.isRevision) {
            const aiResult = await getLatestRefWithAI(type, currentType);

            if (!formData.refNum && !formData.ref_number) {
                const refValNum = aiResult.skippedRefs.length > 0 ? aiResult.skippedRefs[0] : (aiResult.lastRef + 1);
                const refVal = refValNum.toString().padStart(3, '0');
                if (type === 'INVOICE') formData.refNum = refVal;
                else formData.ref_number = refVal;
            }

            if (!formData.invSequence && !formData.mouSequence) {
                const seqValNum = aiResult.skippedSeqs.length > 0 ? aiResult.skippedSeqs[0] : (aiResult.lastSeq + 1);
                const seqVal = seqValNum.toString().padStart(4, '0');
                if (type === 'INVOICE') formData.invSequence = seqVal;
                else formData.mouSequence = seqVal;
            }
        }

        const dateStr = (formData.invoice_date || formData.agreement_date_short || new Date().toISOString().split('T')[0]).replace(/-/g, '');
        const refVal = (formData.refNum || formData.ref_number || '001').toString().padStart(3, '0');
        const seqVal = (formData.invSequence || formData.mouSequence || '0001').toString().padStart(4, '0');

        let docNo = '';
        if (type === 'INVOICE') {
            docNo = `${currentType}-${refVal}-INV-DTI-${dateStr}-${seqVal}`;
        } else {
            docNo = `${currentType}-MoU-DTI-${dateStr}-${refVal}-${seqVal}`;
        }

        if (formData.isRevision) {
            docNo += type === 'INVOICE' ? ` REV${(formData.revisionCount || 0) + 1}` : `-R${formData.revisionCount || 1}`;
        }

        formData[type === 'INVOICE' ? 'invoice_no' : 'mou_number'] = docNo;

        // 2. GENERATE PDF (SYNCHRONOUS)
        // console.log(`[Direct Sync] Generating ${type} ${docNo}...`);
        let fileUrl = '';
        if (type === 'INVOICE') {
            fileUrl = await generateInvoicePDF(formData, `${docNo}.pdf`);
        } else {
            fileUrl = await generateMOUPDF({ fields: formData } as any, `${docNo}.pdf`, formData.signature_party2_base64 || '');
        }

        // 3. CREATE DOCUMENT IN DB
        const contextMap: Record<string, string> = { 'A': 'Endorsement', 'B': 'VideoOwningContent', 'C': 'DigitalAssets', 'D': 'Exclusive' };
        const context = type === 'INVOICE' ? (contextMap[currentType] || 'Invoice') : 'MOU';
        const displayUsername = (formData.from_username || formData.party2_username || 'Creator').replace(/^@/, '');
        const displayTitle = `${context} - ${displayUsername}`;

        const document = await prisma.document.upsert({
            where: { documentNo: docNo },
            update: { fileUrl, metadata: formData, status: 'COMPLETED', title: displayTitle, updatedAt: new Date() },
            create: {
                type: type,
                documentNo: docNo,
                title: displayTitle,
                fileUrl,
                status: 'COMPLETED',
                createdById: userId,
                metadata: formData,
            }
        });

        // 4. REPORT TO SHEETS (SYNCHRONOUS)
        if (!formData.isRevision) {
            // console.log(`[Direct Sync] Reporting ${docNo} to Sheets...`);
            await appendOrUpdateSheetRow({
                type,
                category: currentType,
                ref: refVal,
                docNo,
                amount: type === 'INVOICE' ? (formData.total_due || 0) : (formData.compensation_amount || 0),
                creatorName: formData.from_name || formData.party2_name || 'Creator',
                bdName: (session.user as any).name || 'BD',
                status: 'COMPLETED',
                fileUrl,
                formData
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Document generated successfully',
            documentId: document.id,
            fileUrl,
            docNo
        });

    } catch (error: any) {
        console.error('Direct PDF Generation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
