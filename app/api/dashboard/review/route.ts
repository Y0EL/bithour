import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { chatQueue, syncQueue } from '@/lib/queue';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    // Allow ANALYST, SYSTEM, and MANAGER
    if (!['ANALYST', 'SYSTEM', 'MANAGER'].includes(user.role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. Get Stats
        const [todayCount, weekCount, monthCount] = await Promise.all([
            prisma.creator.count({
                where: {
                    reviewedAt: { gte: startOfToday },
                    videoReviewStatus: { in: ['APPROVED', 'REVISION', 'REJECTED'] }
                } as any
            }),
            prisma.creator.count({
                where: {
                    reviewedAt: { gte: startOfWeek },
                    videoReviewStatus: { in: ['APPROVED', 'REVISION', 'REJECTED'] }
                } as any
            }),
            prisma.creator.count({
                where: {
                    reviewedAt: { gte: startOfMonth },
                    videoReviewStatus: { in: ['APPROVED', 'REVISION', 'REJECTED'] }
                } as any
            })
        ]);

        // 2. Get Tab Counts
        const [totalCount, pendingCount, uploadedCount, approvedCount, revisionCount, rejectedCount] = await Promise.all([
            prisma.creator.count(),
            prisma.creator.count({ where: { videoUrl: { not: null }, videoReviewStatus: 'PENDING', isEndorsementReview: false } as any }),
            prisma.creator.count({ where: { videoUrl: { not: null }, isEndorsementReview: true, videoReviewStatus: 'PENDING' } as any }),
            prisma.creator.count({ where: { videoReviewStatus: 'APPROVED' } as any }),
            prisma.creator.count({ where: { videoReviewStatus: 'REVISION' } as any }),
            prisma.creator.count({ where: { videoReviewStatus: 'REJECTED' } as any })
        ]);

        // 3. Get Videos based on status filter
        const statusFilter = req.nextUrl.searchParams.get('status') || 'PENDING';

        let whereClause: any = { videoUrl: { not: null } };
        if (statusFilter === 'UPLOADED') {
            whereClause.isEndorsementReview = true;
            whereClause.videoReviewStatus = 'PENDING'; // Only show those waiting for review
        } else {
            whereClause.videoReviewStatus = statusFilter;
            // Original pending shouldn't show things already endorsed/finished by curators if those also use status PENDING
            if (statusFilter === 'PENDING') {
                whereClause.isEndorsementReview = false;
            }
        }

        const videos = await prisma.creator.findMany({
            where: whereClause,
            orderBy: { videoUploadedAt: statusFilter === 'PENDING' ? 'asc' : 'desc' },
            include: {
                createdBy: { select: { fullName: true } }
            }
        });

        return NextResponse.json({
            stats: { todayCount, weekCount, monthCount },
            tabCounts: {
                PENDING: pendingCount,
                UPLOADED: uploadedCount,
                APPROVED: approvedCount,
                REVISION: revisionCount,
                REJECTED: rejectedCount,
                TOTAL: totalCount
            },
            videos: videos
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (!['ANALYST', 'SYSTEM', 'MANAGER'].includes(user.role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const body = await req.json();
        let { creatorId, action, feedback } = body;

        if (!creatorId || !action) {
            return NextResponse.json({ error: 'Missing creatorId or action' }, { status: 400 });
        }

        // AUTO AI IMPROVE: Always translate and polish feedback to Indonesian
        if (feedback && feedback.trim()) {
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
                const aiModel = genAI.getGenerativeModel({
                    model: 'gemini-2.0-flash',
                    systemInstruction: "Kamu adalah Creative Analyst di Crowncare. Tugasmu adalah menerjemahkan dan memoles feedback video menjadi bahasa Indonesia yang santai, komunikatif, dan jelas. Hindari gaya bahasa yang terlalu kaku, tapi jangan berlebihan menggunakan slang atau panggilan seperti 'bro'. Pastikan pesan tetap sopan, to-the-point, dan tidak menambah instruksi baru. Kembalikan HANYA teks yang sudah dipoles.",
                    generationConfig: { temperature: 0.3 },
                });
                const aiRes = await aiModel.generateContent(`Improve this feedback: "${feedback}"`);
                const improved = aiRes.response.text().trim();
                if (improved) {
                    // console.log(`[AI Auto-Improve] Original: ${feedback} -> Improved: ${improved}`);
                    feedback = improved;
                }
            } catch (aiErr) {
                console.error('[AI Auto-Improve Error]:', aiErr);
                // Continue with original feedback if AI fails
            }
        }

        const creator = await prisma.creator.findUnique({
            where: { id: creatorId }
        });

        if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

        let reviewStatus: 'APPROVED' | 'REVISION' | 'REJECTED' = 'PENDING' as any;
        let creatorStatus = creator.status;
        let isDraftApproved = creator.isDraftApproved;

        if (action === 'APPROVE') {
            reviewStatus = 'APPROVED';
            creatorStatus = 'FINANCING'; // Move to financing after approval
            isDraftApproved = true;
        } else if (action === 'REVISION') {
            reviewStatus = 'REVISION';
            creatorStatus = 'DRAFTING';
            isDraftApproved = false;
        } else if (action === 'REJECT') {
            reviewStatus = 'REJECTED';
            isDraftApproved = false;
        }

        // Update Database
        const originalFeedback = body.feedback; // Keep original pre-AI
        const existingHistory = (creator as any).reviewHistory || [];
        const nextRevIndex = existingHistory.length + 1;

        const newHistoryEntry = {
            rev: nextRevIndex,
            action,
            originalFeedback: originalFeedback || (action === 'APPROVE' ? 'Approved' : 'No notes'),
            improvedFeedback: feedback,
            timestamp: new Date().toISOString(),
            reviewerName: user.fullName || user.username || 'Analyst'
        };

        const updatedHistory = [...existingHistory, newHistoryEntry];

        const updatedCreator = await prisma.creator.update({
            where: { id: creatorId },
            data: {
                videoReviewStatus: reviewStatus,
                reviewNotes: feedback || null,
                reviewedById: user.id,
                reviewedAt: new Date(),
                status: creatorStatus,
                isDraftApproved: isDraftApproved,
                reviewHistory: updatedHistory
            } as any
        });

        // 1. Queue Chat Message for Creator (Notification)
        // If it's a curator edit, we usually DON'T want the creator to see internal re-edit requests
        const isInternalReview = creator.isEndorsementReview;

        if (feedback && !isInternalReview) {
            const prefix = action === 'REVISION' ? '📢 [REVISI VIDEO]' : (action === 'REJECT' ? '❌ [VIDEO DITOLAK]' : '✅ [CATATAN]');
            await chatQueue.add('send-message', {
                id: randomUUID(),
                creatorId: creator.id,
                senderId: user.id,
                content: `${prefix}: ${feedback}`
            });
        } else if (action === 'APPROVE' && !isInternalReview) {
            await chatQueue.add('send-message', {
                id: randomUUID(),
                creatorId: creator.id,
                senderId: user.id,
                content: `✅ Selamat! Videomu telah disetujui. Silakan cek status di dashboard.`
            });
        }

        // If it's internal (Curator review), we might want to log that it was an internal note
        // The feedback is already saved in reviewNotes and reviewHistory, which the Curator can see.

        // 2. Queue Sync with OC Spreadsheet (Background)
        await syncQueue.add('report-status', {
            type: 'REPORT_STATUS',
            creatorId: creator.id,
            kolName: updatedCreator.name,
            isRevision: action === 'REVISION'
        });

        // 3. INTERNAL NOTIFICATION: Notify the BD/Owner of this creator
        try {
            const actionLabel = action === 'APPROVE' ? 'DISETUJUI (Siap Financing)' : (action === 'REVISION' ? 'BUTUH REVISI' : 'DITOLAK');
            // Use only valid NotificationType: SYSTEM, INFO, ALERT
            const type = action === 'REJECT' ? 'ALERT' : 'INFO';
            const reviewerName = (session.user as any).fullName || (session.user as any).username || 'Analyst';

            await prisma.notification.create({
                data: {
                    userId: creator.createdById,
                    title: `Video Review: ${updatedCreator.name}`,
                    content: `Analyst **${reviewerName}** telah menandai video @${updatedCreator.usernameTikTok} sebagai **${actionLabel}**.${feedback ? `\n\nCatatan: "${feedback}"` : ''}\n\nLangkah selanjutnya: Silakan cek dashboard atau hubungi kreator jika butuh revisi.`,
                    type: type as any
                }
            });
        } catch (notifError) {
            console.error('[Notification Error]:', notifError);
        }

        return NextResponse.json({ success: true, creator: updatedCreator });
    } catch (error: any) {
        console.error('[Review API Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
