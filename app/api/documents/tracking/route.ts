export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as 'INVOICE' | 'MOU';

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!type) {
        return NextResponse.json({ error: 'Type is required' }, { status: 400 });
    }

    try {
        const user = session.user as any;
        const isAdmin = ['SYSTEM', 'MANAGER'].includes(user.role);
        const whereClause = isAdmin ? { type } : { type, createdById: user.id };

        // 1. Fetch real Documents only (exclude placeholder PENDING-xxx docs that are still processing)
        const documents = await prisma.document.findMany({
            where: {
                ...whereClause,
                NOT: { documentNo: { startsWith: 'PENDING-' } },
                fileUrl: { not: '' }
            },
            include: { createdBy: { select: { fullName: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Fetch Sessions that are PENDING and are not yet represented by a real Document entry.
        // If a session has a linked Document with a real documentNo (not PENDING-),
        // it will be shown in the Documents list above, so we skip it here.
        const sessions = await prisma.signingSession.findMany({
            where: {
                ...whereClause,
                status: 'PENDING',
                isArchived: false,
                OR: [
                    { documentId: null },
                    { 
                        Document: { 
                            documentNo: { startsWith: 'PENDING-' } 
                        } 
                    }
                ]
            },
            include: { createdBy: { select: { fullName: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // 3. Merge and Normalize
        const results = [
            ...documents.map((doc: any) => ({
                id: doc.id,
                itemType: 'DOCUMENT',
                docNo: doc.documentNo,
                title: doc.title,
                // If it's COMPLETED, it's Signed. If it's PENDING_SIGN, it's Unsigned.
                status: doc.status === 'COMPLETED' ? 'Signed' : 'Unsigned',
                fileUrl: doc.fileUrl,
                createdBy: doc.createdBy.fullName,
                createdAt: doc.createdAt,
                metadata: doc.metadata
            })),
            ...sessions.map((sess: any) => {
                const isExpired = new Date() > new Date(sess.expiresAt);
                const formData = sess.formData as any;
                const creatorName = formData?.from_name || formData?.party2_name || 'N/A';
                const realNo = sess.type === 'INVOICE' ? formData?.invoice_no : formData?.mou_number;

                return {
                    id: sess.id,
                    itemType: 'SESSION',
                    docNo: realNo || 'WAITING',
                    title: `${sess.type} - ${creatorName}`,
                    status: isExpired ? 'Expired' : 'Unsigned',
                    fileUrl: null,
                    createdBy: sess.createdBy.fullName,
                    createdAt: sess.createdAt,
                    metadata: formData
                };
            })
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(results);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
