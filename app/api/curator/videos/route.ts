import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'CURATOR' && user.role !== 'SYSTEM') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const searchParams = req.nextUrl.searchParams;
        const statusFilter = searchParams.get('status') || 'PENDING_CURATION';

        let whereClause: any = {
            OR: [
                { videoReviewStatus: 'APPROVED', isEndorsementReview: false },
                { videoReviewStatus: 'REVISION', isEndorsementReview: true }
            ]
        };

        if (statusFilter === 'ENDORSED') {
            whereClause = {
                endorsedVideoUrl: { not: null },
                isEndorsementReview: true,
                videoReviewStatus: { in: ['PENDING', 'APPROVED'] }
            };
        }

        const videos = await prisma.creator.findMany({
            where: whereClause,
            orderBy: { videoUploadedAt: 'desc' },
            include: {
                createdBy: { select: { fullName: true } },
                endorsedByCurator: { select: { fullName: true } }
            }
        });

        // Stats for Curator
        const pendingCurationCount = await prisma.creator.count({
            where: {
                OR: [
                    { videoReviewStatus: 'APPROVED', isEndorsementReview: false },
                    { videoReviewStatus: 'REVISION', isEndorsementReview: true }
                ]
            }
        });

        const endorsedCount = await prisma.creator.count({
            where: {
                endorsedVideoUrl: { not: null },
                isEndorsementReview: true,
                videoReviewStatus: { in: ['PENDING', 'APPROVED'] }
            }
        });

        return NextResponse.json({
            videos,
            stats: {
                PENDING_CURATION: pendingCurationCount,
                ENDORSED: endorsedCount,
                TOTAL: pendingCurationCount + endorsedCount
            }
        });
    } catch (error: any) {
        console.error('[Curator API Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
