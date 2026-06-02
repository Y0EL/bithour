export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const showArchived = searchParams.get('archived') === 'true';

        const user = session.user as any;
        const isAdmin = ['SYSTEM', 'MANAGER', 'TEAM_LEADER', 'BD_ASSISTANT_MANAGER'].includes(user.role);

        const sessions = await prisma.signingSession.findMany({
            where: {
                isArchived: showArchived,
                ...(isAdmin ? {} : { createdById: user.id })
            },
            include: {
                Document: {
                    select: { fileUrl: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(sessions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
