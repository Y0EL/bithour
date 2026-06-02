import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = session.user as any;
        const isGlobalViewer = ['SYSTEM', 'MANAGER', 'FINANCE', 'BD_ASSISTANT_MANAGER', 'ANALYST'].includes(user.role);

        // Filters for data accessibility
        const whereClause = isGlobalViewer ? {} : { createdById: user.id };

        // 1. Get counts
        const whereClauseSess = { ...whereClause, documentId: null, isArchived: false };

        const [
            docInvoices, docMOUs, docTotal,
            sessInvoices, sessMOUs, sessTotal
        ] = await Promise.all([
            prisma.document.count({ where: { ...whereClause, type: 'INVOICE' } }),
            prisma.document.count({ where: { ...whereClause, type: 'MOU' } }),
            prisma.document.count({ where: whereClause }),
            prisma.signingSession.count({ where: { ...whereClauseSess, type: 'INVOICE' } }),
            prisma.signingSession.count({ where: { ...whereClauseSess, type: 'MOU' } }),
            prisma.signingSession.count({ where: whereClauseSess })
        ]);

        const totalInvoices = docInvoices + sessInvoices;
        const totalMOUs = docMOUs + sessMOUs;
        const totalDocuments = docTotal + sessTotal;

        // 2. Get this month count
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const [thisMonthDocs, thisMonthSess] = await Promise.all([
            prisma.document.count({
                where: {
                    ...whereClause,
                    createdAt: { gte: firstDayOfMonth }
                }
            }),
            prisma.signingSession.count({
                where: {
                    ...whereClauseSess,
                    createdAt: { gte: firstDayOfMonth }
                }
            })
        ]);

        const thisMonthCount = thisMonthDocs + thisMonthSess;

        // 3. Get recent activity (Documents)
        const recentDocuments = await prisma.document.findMany({
            where: whereClause,
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: { select: { fullName: true } }
            }
        });

        // 4. Get pending activity (Sessions)
        const pendingSessions = await prisma.signingSession.findMany({
            where: {
                ...whereClause,
                status: 'PENDING',
                isArchived: false
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: { select: { fullName: true } }
            }
        });

        // 5. Get Activity Logs (for Managers/System)
        const canViewLogs = user.role === 'SYSTEM';
        const activityLogs = canViewLogs ? await (prisma as any).activityLog.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                User: { select: { fullName: true } }
            }
        }) : [];

        // --- Analyst Specific Logic ---
        if (user.role === 'ANALYST') {
            const now = new Date();
            const startOfToday = new Date(now.setHours(0, 0, 0, 0));
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const [todayCount, weekCount, monthCount, pendingCount, recentReviews] = await Promise.all([
                (prisma.creator as any).count({ where: { reviewedAt: { gte: startOfToday }, reviewedById: user.id, videoReviewStatus: { in: ['APPROVED', 'REVISION', 'REJECTED'] } } }),
                (prisma.creator as any).count({ where: { reviewedAt: { gte: startOfWeek }, reviewedById: user.id, videoReviewStatus: { in: ['APPROVED', 'REVISION', 'REJECTED'] } } }),
                (prisma.creator as any).count({ where: { reviewedAt: { gte: startOfMonth }, reviewedById: user.id, videoReviewStatus: { in: ['APPROVED', 'REVISION', 'REJECTED'] } } }),
                (prisma.creator as any).count({ where: { videoUrl: { not: null }, videoReviewStatus: 'PENDING' } }),
                (prisma.creator as any).findMany({
                    where: { reviewedById: user.id },
                    take: 10,
                    orderBy: { reviewedAt: 'desc' },
                    select: { id: true, name: true, usernameTikTok: true, videoReviewStatus: true, reviewedAt: true }
                })
            ]);

            return NextResponse.json({
                stats: { todayCount, weekCount, monthCount, pendingCount },
                recentActivity: recentReviews.map((r: any) => ({
                    id: r.id,
                    type: 'REVIEW',
                    title: `Reviewed ${r.name}`,
                    docNo: r.usernameTikTok,
                    user: 'You',
                    createdAt: r.reviewedAt,
                    status: r.videoReviewStatus
                }))
            });
        }

        return NextResponse.json({
            stats: {
                totalInvoices,
                totalMOUs,
                totalDocuments,
                thisMonthCount
            },
            activityLogs: activityLogs.map((log: any) => ({
                id: log.id,
                user: log.User?.fullName || 'System',
                action: log.action,
                details: log.details,
                createdAt: log.createdAt
            })),
            recentActivity: recentDocuments.map(doc => ({
                id: doc.id,
                type: 'DOCUMENT',
                docType: doc.type,
                title: doc.title,
                docNo: doc.documentNo,
                user: doc.createdBy.fullName,
                createdAt: doc.createdAt,
                status: 'SIGNED'
            })).concat(pendingSessions.map(sess => ({
                id: sess.id,
                type: 'SESSION',
                docType: sess.type,
                title: `${sess.type} Session`,
                docNo: 'PENDING',
                user: sess.createdBy.fullName,
                createdAt: sess.createdAt,
                status: 'WAIT_SIGN'
            }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
