import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = session.user as any;
        const isSystem = user.role === 'SYSTEM';
        const isManager = user.role === 'MANAGER';
        const isAdmin = ['SYSTEM', 'MANAGER', 'TEAM_LEADER', 'BD_ASSISTANT_MANAGER'].includes(user.role);

        // Find the session with Document
        const signingSession = await prisma.signingSession.findUnique({
            where: { id },
            include: { Document: true }
        });

        if (!signingSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Check permissions: Owner or Admin
        const isOwner = signingSession.createdById === user.id;

        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Unauthorized: You can only manage your own sessions' }, { status: 403 });
        }

        const docNo = signingSession.Document?.documentNo || (signingSession.formData as any)?.invoice_no || (signingSession.formData as any)?.mou_number;

        // Force permanent delete if it's still PENDING (unsigned) to allow number reuse
        const isNotSigned = signingSession.status === 'PENDING';

        if (isSystem || isManager || signingSession.isArchived || isNotSigned) {
            // PERMANENT DELETE Logic

            // 1. Cleanup Sheets (Synchronous)
            if (docNo) {
                try {
                    const { deleteRowFromSheet } = await import('@/lib/sheets');
                    await deleteRowFromSheet(docNo);
                    // console.log(`[Manage DELETE] Removed ${docNo} from Sheets.`);
                } catch (err) {
                    console.error('[Manage DELETE] Sheet cleanup failed:', err);
                }
            }

            // 2. Cleanup Sequence Cache (allow number reuse)
            try {
                const userId = signingSession.createdById;
                const docType = signingSession.type;
                const category = signingSession.type === 'INVOICE' ? ((signingSession.formData as any)?.invType || 'B') : ((signingSession.formData as any)?.mouType || 'B');

                await prisma.userSequence.deleteMany({
                    where: { userId, docType, category }
                });
                // console.log(`[Manage DELETE] Cleared sequence cache for ${userId} ${docType} ${category}`);
            } catch (err) {
                console.error('[Manage DELETE] Sequence cache cleanup failed:', err);
            }

            // 3. Delete Session and associated Document
            await prisma.$transaction(async (tx) => {
                if (signingSession.documentId) {
                    // Only delete document if it's not COMPLETED or if we are SYSTEM/MANAGER/ADMIN
                    const doc = await tx.document.findUnique({ where: { id: signingSession.documentId } });
                    if (doc && (doc.status !== 'COMPLETED' || isAdmin)) {
                        await tx.document.delete({ where: { id: signingSession.documentId } });
                    }
                }
                await tx.signingSession.delete({ where: { id } });
            });

            return NextResponse.json({ success: true, message: 'Session and associated document deleted permanently to allow number reuse.' });
        } else {
            // Soft delete (archive) for COMPLETED sessions
            await prisma.signingSession.update({
                where: { id },
                data: { isArchived: true },
            });
            return NextResponse.json({ success: true, message: 'Session archived successfully' });
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = session.user as any;
        const isAdmin = ['SYSTEM', 'MANAGER', 'TEAM_LEADER', 'BD_ASSISTANT_MANAGER'].includes(user.role);

        // Fetch session to check owner
        const signingSession = await prisma.signingSession.findUnique({
            where: { id },
        });

        if (!signingSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const isOwner = signingSession.createdById === user.id;

        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body;

        if (action === 'restore') {
            await prisma.signingSession.update({
                where: { id },
                data: { isArchived: false },
            });
            return NextResponse.json({ success: true, message: 'Session restored successfully' });
        }

        // Default legacy behavior: mark as complete
        await prisma.signingSession.update({
            where: { id },
            data: { status: 'COMPLETED' },
        });

        return NextResponse.json({ success: true, message: 'Session marked as complete' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
