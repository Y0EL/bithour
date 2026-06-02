import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const allowedRoles = ['SYSTEM', 'MANAGER', 'FINANCE', 'BD_ASSISTANT_MANAGER', 'BD'];
    if (!session || !allowedRoles.includes((session.user as any).role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ids, action, reason } = await req.json();

        if (action === 'delete') {
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
            }

            // Optional: Log deletion reason in ActivityLog or similar if needed

            // Fetch document numbers before deleting to clean up sheets
            const [docs, sessions] = await Promise.all([
                prisma.document.findMany({ where: { id: { in: ids } }, select: { documentNo: true } }),
                prisma.signingSession.findMany({ where: { id: { in: ids } }, select: { formData: true, type: true } })
            ]);

            const docNumbers = [
                ...docs.map(d => d.documentNo),
                ...sessions.map(s => {
                    const meta = s.formData as any || {};
                    return s.type === 'INVOICE' ? meta.invoice_no : meta.mou_number;
                })
            ].filter(Boolean);

            // 1. Resolve all linked IDs to ensure no orphans
            const [selectedDocs, selectedSessions] = await Promise.all([
                prisma.document.findMany({
                    where: { id: { in: ids } },
                    include: { SigningSession: { select: { id: true } } }
                }),
                prisma.signingSession.findMany({
                    where: { id: { in: ids } }
                })
            ]);

            const finalDocIds = new Set(ids);
            const finalSessIds = new Set(ids);

            selectedDocs.forEach(d => {
                if (d.SigningSession) finalSessIds.add(d.SigningSession.id);
            });
            selectedSessions.forEach(s => {
                if (s.documentId) finalDocIds.add(s.documentId);
            });

            // 2. Perform deletion in transaction
            await prisma.$transaction(async (tx) => {
                await tx.document.deleteMany({
                    where: { id: { in: Array.from(finalDocIds) } }
                });
                await tx.signingSession.deleteMany({
                    where: { id: { in: Array.from(finalSessIds) } }
                });
            });

            // 3. Cleanup Sheets after DB success (Silent)
            try {
                const { deleteRowFromSheet } = await import('@/lib/sheets');
                for (const num of docNumbers) {
                    await deleteRowFromSheet(num).catch(e => console.error(`[Batch Sheet Clean] Failed ${num}:`, e));
                }
            } catch (err) {
                console.error('[Batch Sheet Clean] Global failure:', err);
            }

            return NextResponse.json({ success: true, message: `Deleted ${ids.length} items` });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Batch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
