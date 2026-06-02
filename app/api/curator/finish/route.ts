import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'CURATOR' && user.role !== 'SYSTEM') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const { creatorId } = await req.json();

        if (!creatorId) {
            return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 });
        }

        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator) {
            return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
        }

        // Mark as finished directly by Curator (no new video uploaded).
        // By setting isEndorsementReview = true & videoReviewStatus = APPROVED
        // It bypasses the secondary Review Team check and directly moves to "Finished"
        await prisma.creator.update({
            where: { id: creatorId },
            data: {
                isEndorsementReview: true,
                videoReviewStatus: 'APPROVED',
                endorsedByCuratorId: user.id
            }
        });

        await prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'CURATOR_MARKED_FINISHED',
                details: `Curator marked video curation as finished without new endorsement for ${creator.usernameTikTok}`,
                creatorId: creator.id
            }
        });

        return NextResponse.json({ message: 'Success' });
    } catch (error: any) {
        console.error('[Curator Finish Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
