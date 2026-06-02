import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session || !['SYSTEM', 'MANAGER'].includes((session.user as any).role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { token: id } = await params;
        const newToken = crypto.randomBytes(32).toString('hex');
        const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.signingSession.update({
            where: { id },
            data: {
                token: newToken,
                expiresAt: newExpiry,
                status: 'PENDING'
            }
        });

        return NextResponse.json({ message: 'Session regenerated' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
