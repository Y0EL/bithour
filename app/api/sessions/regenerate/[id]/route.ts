import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(
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
        const isAdmin = ['SYSTEM', 'MANAGER'].includes(user.role);

        // Find the session
        const signingSession = await prisma.signingSession.findUnique({
            where: { id },
        });

        if (!signingSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Only allow owner or admin to regenerate
        if (!isAdmin && signingSession.createdById !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Regenerate expiresAt (24 hours from now)
        const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const updatedSession = await prisma.signingSession.update({
            where: { id },
            data: {
                expiresAt: newExpiry,
                // Optional: We could also regenerate the token if we wanted a fresh link, 
                // but the prompt says "Regenerate temporal URLs", implying updating expiry is enough.
            }
        });

        return NextResponse.json({ success: true, expiresAt: updatedSession.expiresAt });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
