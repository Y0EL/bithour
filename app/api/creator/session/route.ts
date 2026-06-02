import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { syncQueue, chatQueue } from '@/lib/queue';
import { driveQueue } from '@/lib/driveQueue';
import { deleteRowFromSheet } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    try {
        const creator = await prisma.creator.findUnique({
            where: { sessionToken: token },
            include: {
                createdBy: { include: { group: true } }
            }
        });

        if (!creator) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        // Auto-attach logic: Find all sessions for this username across any records
        const signingSessions = await prisma.signingSession.findMany({
            where: {
                Creator: {
                    usernameTikTok: creator.usernameTikTok
                }
            },
            orderBy: { createdAt: 'desc' },
            include: { Document: true }
        });

        // Inject sessions into creator object
        const creatorWithSessions = {
            ...creator,
            SigningSessions: signingSessions
        };

        // OC Feedback Sync Logic - MOVING TO BULLMQ (Zero Latency)
        const userGroup = creator.createdBy?.group?.name;
        if (userGroup === 'OC' || userGroup === 'Owning Content') {
            await syncQueue.add('sync-feedback', {
                type: 'SYNC_FEEDBACK',
                creatorId: creator.id
            });
            // // console.log(`[Session GET] Enqueued feedback sync for @${creator.usernameTikTok}`);
        }

        // Return simplified creator data (exclude sensitive owner info and internal history)
        const { createdBy, reviewHistory, ...creatorData } = creatorWithSessions;
        return NextResponse.json(creatorData);
    } catch (error: unknown) {
        console.error('[Session GET Error]:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

const patchSchema = z.object({
    status: z.enum(['REACHOUT', 'DEALING', 'SAMPLING', 'DRAFTING', 'FINANCING', 'FINISHED', 'MONITORING']).optional(),
    isDraftApproved: z.boolean().optional(),
    videoUrl: z.string().optional(),
    name: z.string().optional(),
    address: z.string().optional(),
    phoneNumber: z.string().optional(),
    ktpNumber: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    accountName: z.string().optional(),
    hairCombColor: z.string().optional(),
    patokanAddress: z.string().optional(),
    isLongHair: z.boolean().optional()
});

export async function PATCH(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    try {
        const bodyContent = await req.json();
        const parsedData = patchSchema.parse(bodyContent);

        const {
            status,
            isDraftApproved,
            videoUrl,
            name,
            address,
            phoneNumber,
            ktpNumber,
            bankName,
            accountNumber,
            accountName,
            hairCombColor,
            patokanAddress,
            isLongHair
        } = parsedData;

        // 1. Get current creator state
        const currentCreator = await prisma.creator.findUnique({
            where: { sessionToken: token },
            include: { createdBy: { include: { group: true } } }
        });

        if (!currentCreator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

        // 2. Immutability Check: If status is SAMPLING or later, restrict profile updates
        const statusOrder: string[] = ['REACHOUT', 'DEALING', 'SAMPLING', 'DRAFTING', 'FINANCING', 'FINISHED', 'MONITORING'];
        const currentStatusIdx = statusOrder.indexOf(currentCreator.status);
        const samplingIdx = statusOrder.indexOf('SAMPLING');

        const isTryingToUpdateProfile = name || address || phoneNumber || ktpNumber || bankName || accountNumber || accountName || hairCombColor || patokanAddress || isLongHair !== undefined;

        if (currentStatusIdx >= samplingIdx && isTryingToUpdateProfile) {
            return NextResponse.json({ error: 'Data tidak dapat diubah setelah mencapai tahap Sampling.' }, { status: 403 });
        }

        // 3. Prepare update data
        const updateData: any = {
            status: status || undefined,
            isDraftApproved: isDraftApproved !== undefined ? isDraftApproved : undefined,
            name: name || undefined,
            address: address || undefined,
            phoneNumber: phoneNumber || undefined,
            ktpNumber: ktpNumber || undefined,
            bankName: bankName || undefined,
            accountNumber: accountNumber || undefined,
            accountName: accountName || undefined,
            hairCombColor: hairCombColor || undefined,
            patokanAddress: patokanAddress || undefined,
            isLongHair: isLongHair !== undefined ? isLongHair : undefined,
        };

        if (videoUrl) {
            updateData.videoUrl = videoUrl;
            updateData.videoUploadedAt = new Date();
            updateData.videoReviewStatus = 'PENDING';
            updateData.isDraftApproved = false; // Require new approval for new video

            // Manage history
            if (currentCreator.videoUrl && currentCreator.videoUrl !== videoUrl) {
                const history = (currentCreator.videoHistory as any[]) || [];
                history.push({
                    url: currentCreator.videoUrl,
                    uploadedAt: currentCreator.videoUploadedAt || new Date()
                });
                updateData.videoHistory = history;
            }

            // Enqueue Drive sync job (BullMQ)
            await driveQueue.add('copy-video', {
                creatorId: currentCreator.id,
                videoUrl: videoUrl,
                actionType: 'COPY_VIDEO'
            });
            // // console.log(`[Session PATCH] Enqueued Drive sync for ${currentCreator.usernameTikTok}`);

            // 3. INTERNAL NOTIFICATION: Notify the BD/Owner that a video has been uploaded
            try {
                await prisma.notification.create({
                    data: {
                        userId: currentCreator.createdById,
                        title: `Video Baru: ${currentCreator.name}`,
                        content: `@${currentCreator.usernameTikTok} baru saja mengirimkan link video untuk direview.`,
                        type: 'INFO'
                    }
                });
            } catch (notifError) {
                console.error('[Notification Error]:', notifError);
            }
        }

        // 3. Perform update
        const updated = await prisma.creator.update({
            where: { sessionToken: token },
            data: updateData
        });

        // 4. Handle OC Spreadsheet Reporting if applicable - MOVING TO BULLMQ
        const userGroup = currentCreator.createdBy?.group?.name;
        if (userGroup === 'OC' || userGroup === 'Owning Content') {
            const isActuallyRevision = updated.status === 'DRAFTING' && (Array.isArray(updated.videoHistory) && updated.videoHistory.length > 0);

            await syncQueue.add('report-status', {
                type: 'REPORT_STATUS',
                creatorId: updated.id,
                isRevision: isActuallyRevision,
                kolName: updated.name
            });
            // // console.log(`[Session PATCH] Enqueued Sheet update for ${updated.usernameTikTok}`);
        }

        // 5. If status changed to FINANCING, add message (Optimized)
        if (status === 'FINANCING') {
            const messageId = `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            await chatQueue.add('system-log-financing', {
                id: messageId,
                content: "✅ Creator has completed the draft and is waiting for payment.",
                creatorId: updated.id,
                senderId: null
            });
        }

        return NextResponse.json(updated);
    } catch (error: unknown) {
        console.error('[Session PATCH Error]:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation failed', details: error.format() }, { status: 400 });
        }
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

    try {
        const session = await prisma.signingSession.findUnique({
            where: { id: sessionId },
            include: { Document: true }
        });

        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        const formDataAny = session.formData as any;
        const docNo = session.Document?.documentNo || formDataAny?.mou_number || formDataAny?.invoice_no;
        const userId = session.createdById;
        const docType = session.type;
        const category = session.type === 'INVOICE' ? (formDataAny?.invType || 'B') : (formDataAny?.mouType || 'B');

        // 1. Delete Session and associated Document using Prisma Transaction FIRST
        await prisma.$transaction(async (tx) => {
            if (session.documentId) {
                await tx.document.delete({ where: { id: session.documentId } });
            }
            await tx.signingSession.delete({ where: { id: sessionId } });
        });

        // 2. ONLY proceed with Cache & Sheet cleanup if transaction succeeded

        // Cleanup Sequence Cache (allow number reuse)
        try {
            await prisma.userSequence.deleteMany({
                where: { userId, docType, category }
            });
            // // console.log(`[Session DELETE] Cleared sequence cache for ${userId} ${docType} ${category}`);
        } catch (err) {
            console.error('[Session DELETE] Sequence cache cleanup failed:', err);
        }

        // Cleanup Sheets (Synchronous)
        if (docNo) {
            try {
                await deleteRowFromSheet(docNo);
                // // console.log(`[Session DELETE] Removed ${docNo} from Sheets.`);
            } catch (err) {
                console.error('[Session DELETE] Sheet cleanup failed:', err);
            }
        }

        return NextResponse.json({ success: true, message: 'Session deleted and numbers released.' });
    } catch (error: unknown) {
        console.error('[Session DELETE Error]:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
