import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    try {
        const session = await prisma.signingSession.findUnique({
            where: { token },
            include: {
                createdBy: {
                    select: { fullName: true }
                }
            }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (new Date() > session.expiresAt) {
            return NextResponse.json({ error: 'Session expired' }, { status: 410 });
        }


        return NextResponse.json(session);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
