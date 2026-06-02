import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, id: userId } = session.user as any;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // optional filter

    try {
        const where: any = {};
        if (type) {
            where.type = type;
        }

        const isGlobalViewer = ['SYSTEM', 'MANAGER', 'FINANCE', 'BD_ASSISTANT_MANAGER'].includes(role);
        const userFilter = isGlobalViewer ? {} : { createdById: userId };

        const [documents, sessions] = await Promise.all([
            prisma.document.findMany({
                where: { ...where, ...userFilter },
                include: {
                    createdBy: {
                        select: { fullName: true, username: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.signingSession.findMany({
                where: {
                    ...where,
                    ...userFilter,
                    documentId: null,
                    isArchived: false
                },
                include: {
                    createdBy: {
                        select: { fullName: true, username: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Merge and normalize sessions to look like documents
        const normalizedSessions = sessions.map(sess => {
            const formData = sess.formData as any;
            const creatorName = formData?.from_name || formData?.party2_name || 'N/A';
            return {
                id: sess.id,
                type: sess.type,
                documentNo: 'WAITING',
                title: `${sess.type} - ${creatorName} (Draft)`,
                fileUrl: '', // No PDF yet
                status: sess.status === 'COMPLETED' ? 'COMPLETED' : 'DRAFT PDF', // Use 'DRAFT PDF' for frontend logic
                createdBy: sess.createdBy,
                createdAt: sess.createdAt,
                metadata: formData,
                isSession: true // Flag for frontend if needed
            };
        });

        const allItems = [...documents, ...normalizedSessions].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return NextResponse.json(allItems);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
