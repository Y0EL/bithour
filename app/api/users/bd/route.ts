import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const users = await prisma.user.findMany({
            where: {
                role: {
                    in: ['BD', 'BD_ASSISTANT_MANAGER']
                },
                isActive: true
            },
            select: {
                id: true,
                fullName: true,
                username: true,
                role: true
            },
            orderBy: {
                fullName: 'asc'
            }
        });

        return NextResponse.json(users);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
