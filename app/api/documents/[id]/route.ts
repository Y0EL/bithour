import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    const allowedRoles = ['SYSTEM', 'MANAGER', 'FINANCE', 'BD_ASSISTANT_MANAGER', 'BD'];
    if (!session || !allowedRoles.includes((session.user as any).role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { reason } = body;

        if (!reason) {
            return NextResponse.json({ error: 'Reason is required for deletion' }, { status: 400 });
        }

        // 1. Try Document
        const document = await prisma.document.findUnique({
            where: { id },
            include: { createdBy: true, SigningSession: true }
        });

        if (document) {
            // Delete physical file
            if (document.fileUrl.startsWith('/')) {
                const filePath = path.join(process.cwd(), 'public', document.fileUrl);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }

            // Notify
            await prisma.notification.create({
                data: {
                    userId: document.createdById,
                    title: 'Document Deleted by System',
                    content: `Document ${document.documentNo} (${document.type}) has been deleted by SYSTEM.\n\nReason: ${reason}`,
                    type: 'ALERT'
                }
            });

            // 1.5 Clean up UserSequence cache to allow number reuse
            const meta = (document.metadata as any) || {};
            const category = document.type === 'INVOICE' ? (meta.invType || 'B') : (meta.mouType || 'B');

            try {
                const { deleteRowFromSheet } = await import('@/lib/sheets');
                await deleteRowFromSheet(document.documentNo);
            } catch (err) {
                console.error('Failed to delete row from sheet', err);
            }

            await prisma.userSequence.deleteMany({
                where: {
                    userId: document.createdById,
                    docType: document.type,
                    category: category
                }
            });

            await prisma.$transaction(async (tx) => {
                if (document.SigningSession) {
                    await tx.signingSession.delete({ where: { id: document.SigningSession.id } });
                }
                await tx.document.delete({ where: { id } });
            });
            return NextResponse.json({ message: 'Document deleted successfully and sequence cache cleared' });
        }

        // 2. Try SigningSession
        const sessionRec = await prisma.signingSession.findUnique({
            where: { id },
            include: { createdBy: true }
        });

        if (sessionRec) {
            // 2.5 Clean up UserSequence cache
            const meta = (sessionRec.formData as any) || {};
            const category = sessionRec.type === 'INVOICE' ? (meta.invType || 'B') : (meta.mouType || 'B');
            const docNo = sessionRec.type === 'INVOICE' ? meta.invoice_no : meta.mou_number;

            try {
                if (docNo) {
                    const { deleteRowFromSheet } = await import('@/lib/sheets');
                    await deleteRowFromSheet(docNo);
                }
            } catch (err) {
                console.error('Failed to delete row from sheet (session)', err);
            }

            await prisma.userSequence.deleteMany({
                where: {
                    userId: sessionRec.createdById,
                    docType: sessionRec.type,
                    category: category
                }
            });

            await prisma.$transaction(async (tx) => {
                if (sessionRec.documentId) {
                    await tx.document.delete({ where: { id: sessionRec.documentId } });
                }
                await tx.signingSession.delete({ where: { id } });
            });
            return NextResponse.json({ message: 'Session deleted successfully and sequence cache cleared' });
        }

        return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const document = await prisma.document.findUnique({
            where: { id },
            include: { createdBy: { select: { fullName: true, username: true } } }
        });

        if (document) return NextResponse.json(document);

        const sessionRec = await prisma.signingSession.findUnique({
            where: { id },
            include: { createdBy: { select: { fullName: true, username: true } } }
        });

        if (sessionRec) {
            const formData = sessionRec.formData as any;
            return NextResponse.json({
                ...sessionRec,
                documentNo: 'WAITING',
                title: `${sessionRec.type} - Draft`,
                metadata: formData,
                isSession: true
            });
        }

        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authSession = await getServerSession(authOptions);
    const { id } = await params;

    if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { status } = body;

        if (status !== 'COMPLETED') {
            return NextResponse.json({ error: 'Unsupported status' }, { status: 400 });
        }

        // Try Document First
        const document = await prisma.document.findUnique({
            where: { id },
            include: { createdBy: true }
        });

        if (document) {
            const updatedDoc = await prisma.document.update({
                where: { id },
                data: { status: 'COMPLETED' }
            });

            // Sync with Google Sheets (Skip if revision)
            const meta = (document.metadata as any) || {};
            if (!meta.isRevision) {
                try {
                    const { appendToSheet } = await import('@/lib/sheets');
                    const amount = document.type === 'INVOICE' ? (meta.total_due || 0) : (meta.compensation_amount || 0);
                    const creatorName = meta.from_name || meta.party2_name || (document.createdBy as any).fullName || 'Creator';
                    const bdName = (document.createdBy as any).fullName || (document.createdBy as any).username || 'Unknown';

                    await appendToSheet([
                        new Date().toLocaleString('id-ID'),
                        creatorName,
                        amount,
                        document.documentNo,
                        bdName,
                        'COMPLETED (Marked)',
                        document.fileUrl
                    ], document.type === 'INVOICE' ? 'Invoices' : 'MOUs');
                } catch (sheetErr) {
                    console.error('Sheet Sync Error:', sheetErr);
                }
            }

            return NextResponse.json(updatedDoc);
        }

        // Try Session
        const sessionRec = await prisma.signingSession.findUnique({
            where: { id },
            include: { createdBy: true }
        });

        if (sessionRec) {
            const updatedSess = await prisma.signingSession.update({
                where: { id },
                data: { status: 'COMPLETED' }
            });

            // Sync with Sheets (Skip if revision)
            const meta = (sessionRec.formData as any) || {};
            if (!meta.isRevision) {
                try {
                    const { appendToSheet } = await import('@/lib/sheets');
                    const amount = sessionRec.type === 'INVOICE' ? (meta.total_due || 0) : (meta.compensation_amount || 0);
                    const creatorName = meta.from_name || meta.party2_name || (sessionRec.createdBy as any).fullName || 'Creator';
                    const bdName = (sessionRec.createdBy as any).fullName || (sessionRec.createdBy as any).username || 'Unknown';

                    await appendToSheet([
                        new Date().toLocaleString('id-ID'),
                        creatorName,
                        amount,
                        'WAITING (Manual)',
                        bdName,
                        'COMPLETED (Session Marked)',
                        '' // No file URL
                    ], sessionRec.type === 'INVOICE' ? 'Invoices' : 'MOUs');
                } catch (sheetErr) {
                    console.error('Sheet Sync Error:', sheetErr);
                }
            }

            return NextResponse.json(updatedSess);
        }

        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
