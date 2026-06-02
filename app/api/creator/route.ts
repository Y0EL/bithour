import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
type CreatorStatus = 'REACHOUT' | 'DEALING' | 'SAMPLING' | 'DRAFTING' | 'FINANCING' | 'FINISHED' | 'MONITORING' | 'FAIL';
import { syncQueue } from '@/lib/queue';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function generateMotivation(creatorName: string, oldOwner: string, newOwner: string) {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: 'You are a supportive AI teammate. Respond in Indonesian.',
        });
        const result = await model.generateContent(
            `A creator named ${creatorName} has just been transferred from ${oldOwner} to ${newOwner}. Provide a short, enthusiastic encouragement message (max 2 sentences) in Indonesian for the new owner ${newOwner} to work with this creator and make it successful.`
        );
        return result.response.text().trim() || "Semangat terus pantang menyerah!";
    } catch (e) {
        return "Semangat terus pantang menyerah!";
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session.user || !session.user.id) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const canSeeAll = ['MANAGER', 'SYSTEM', 'BD_ASSISTANT_MANAGER', 'TEAM_LEADER', 'OWNER', 'ADMIN', 'ANALYST', 'FINANCE', 'CURATOR'].includes(session.user.role);
        const creators = await prisma.creator.findMany({
            where: canSeeAll ? {} : { createdById: session.user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        CreatorMessage: true
                    }
                },
                // Get unread messages from creator (senderId is null AND not read by internal)
                CreatorMessage: {
                    where: {
                        senderId: null, // Messages from creator
                        isReadByInternal: false // Not yet read by internal team
                    },
                    select: {
                        id: true,
                        createdAt: true
                    }
                }
            }
        });

        // Transform to include unreadCount
        const creatorsWithUnread = creators.map((creator: any) => {
            const unreadMessages = creator.CreatorMessage || [];
            return {
                ...creator,
                unreadCount: unreadMessages.length,
                _count: {
                    messages: creator._count.CreatorMessage,
                    unreadMessages: unreadMessages.length
                }
            };
        });

        return NextResponse.json(creatorsWithUnread);
    } catch (error: any) {
        console.error('Failed to fetch creators:', error);
        return NextResponse.json(
            { error: 'Failed to fetch creators', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const rawData = await req.json();

        // Basic validation
        if (!rawData.usernameTikTok || !rawData.name) {
            return NextResponse.json({ error: 'Username and Name are required' }, { status: 400 });
        }

        // Sanitize data to only include valid fields for Creator model
        let isLongHairProcessed: boolean | null = null;
        if (typeof rawData.isLongHair === 'boolean') {
            isLongHairProcessed = rawData.isLongHair;
        } else if (typeof rawData.isLongHair === 'string') {
            if (rawData.isLongHair.toLowerCase() === 'true') isLongHairProcessed = true;
            else if (rawData.isLongHair.toLowerCase() === 'false') isLongHairProcessed = false;
            else isLongHairProcessed = null; // treats "" or other strings as null
        }

        const data = {
            name: rawData.name,
            usernameTikTok: rawData.usernameTikTok.replace('@', ''),
            ktpNumber: rawData.ktpNumber,
            address: rawData.address || rawData.shippingAddress,
            bankName: rawData.bankName,
            accountNumber: rawData.accountNumber,
            accountName: rawData.accountName,
            kcpCity: rawData.kcpCity,
            hairCombColor: rawData.hairCombColor,
            isLongHair: isLongHairProcessed,
            patokanAddress: rawData.patokanAddress,
            phoneNumber: rawData.phoneNumber,
            productDescription: rawData.productDescription,
            status: 'REACHOUT' as CreatorStatus,
            createdById: session.user.id,
            isOldCreator: !!rawData.isOldCreator
        };

        const creator = await prisma.creator.create({
            data: data as any
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                userId: session.user.id,
                action: 'CREATE_CREATOR',
                details: `Created creator ${data.usernameTikTok}`,
                creatorId: creator.id
            }
        });

        return NextResponse.json(creator);
    } catch (error: any) {
        console.error('Creator Creation Error:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Creator with this TikTok username already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Queue status reporting to Spreadsheets (BullMQ)
export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const rawData = await req.json();
        const { id, internalAction, ...updateDataRaw } = rawData;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        // Fetch current state
        const current = await prisma.creator.findUnique({ where: { id } });
        if (!current) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

        // Authorization check
        const isOwner = current.createdById === session.user.id;
        const isAdmin = ['MANAGER', 'SYSTEM', 'BD_ASSISTANT_MANAGER', 'TEAM_LEADER'].includes(session.user.role);
        if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // Allowed fields for update
        const allowedFields = [
            'name', 'usernameTikTok', 'ktpNumber', 'address', 'bankName',
            'accountNumber', 'accountName', 'kcpCity', 'hairCombColor',
            'isLongHair', 'patokanAddress', 'phoneNumber', 'status',
            'videoUrl', 'videoUploadedAt', 'paymentProofUrl', 'financeNotes',
            'videoHistory', 'isDraftApproved', 'createdById', 'productDescription',
            'sampleDeliveryDate', 'sampleTrackingNumber', 'isOldCreator',
            'failedReason', 'failedAt'
        ];

        let data: any = {};
        allowedFields.forEach((field: string) => {
            if (updateDataRaw[field] !== undefined) {
                let value = updateDataRaw[field];
                // Sanitize isLongHair if present
                if (field === 'isLongHair' && typeof value === 'string') {
                    if (value.toLowerCase() === 'true') value = true;
                    else if (value.toLowerCase() === 'false') value = false;
                    else value = null;
                }
                data[field] = value;
            }
        });

        // Handle Special Internal Actions
        if (internalAction === 'REQUEST_REVISION') {
            // Archive current video to history
            const history = ((current as any).videoHistory as any[]) || [];
            if (current.videoUrl) {
                history.push({ url: current.videoUrl, uploadedAt: current.videoUploadedAt });
            }
            data = {
                ...data,
                videoUrl: null,
                videoUploadedAt: null,
                videoHistory: history,
                isDraftApproved: false,
                status: 'DRAFTING'
            };
        }

        // Handle owner transfer notifications
        if (data.createdById && data.createdById !== current.createdById) {
            const [oldUser, newUser] = await Promise.all([
                prisma.user.findUnique({ where: { id: current.createdById } }),
                prisma.user.findUnique({ where: { id: data.createdById } })
            ]);

            const aiMotivation = await generateMotivation(current.name, oldUser?.fullName || 'BD', newUser?.fullName || 'BD');
            const transferMsg = `📢 [TRANSFER] Creator ini telah dipindahkan dari ${oldUser?.fullName || 'BD'} ke ${newUser?.fullName || 'BD'}. \n\n${aiMotivation}`;

            // Notification for new owner
            await prisma.notification.create({
                data: {
                    userId: data.createdById,
                    title: 'Creator Baru Diterima!',
                    content: `Kreator ${current.name} (@${current.usernameTikTok}) telah dipindahkan dari ${oldUser?.fullName || 'BD'} ke kamu. Ayo gas pol!`,
                    type: 'INFO'
                }
            });

            // Activity log for transfer
            await prisma.activityLog.create({
                data: {
                    userId: session.user.id,
                    action: 'TRANSFER_CREATOR',
                    details: `Transferred creator ${current.usernameTikTok} from ${oldUser?.username} to ${newUser?.username}`,
                    creatorId: current.id
                }
            });

            // Chat message for record
            await prisma.creatorMessage.create({
                data: {
                    content: transferMsg,
                    creatorId: current.id,
                    senderId: session.user.id
                }
            });
        }

        const creator = await prisma.creator.update({
            where: { id },
            data: data,
            include: {
                SigningSessions: {
                    orderBy: { createdAt: 'desc' },
                    include: { Document: true }
                }
            }
        });

        // Log activity if status changed
        if (data.status) {
            await prisma.activityLog.create({
                data: {
                    userId: session.user.id,
                    action: 'UPDATE_CREATOR_STATUS',
                    details: `Updated creator ${creator.usernameTikTok} status to ${data.status} (Action: ${internalAction || 'PUT'})`,
                    creatorId: creator.id
                }
            });

            // Automatic Shipment Reporting
            const shipmentStatuses: CreatorStatus[] = ['SAMPLING', 'FINISHED', 'MONITORING'];
            // console.log(`[StatusChange] New Status: ${data.status}, Already reported: ${(creator as any).isReportedToShipment}`);

            if (shipmentStatuses.includes(data.status as CreatorStatus) && !(creator as any).isReportedToShipment) {
                if ((creator as any).isOldCreator) {
                    // console.log(`[StatusChange] Skip reporting for ${creator.usernameTikTok} - Marked as Old Creator.`);
                } else {
                    // console.log(`[StatusChange] Queuing shipment reporting for ${creator.usernameTikTok}...`);
                    const reporterName = session.user.fullName || session.user.username || session.user.name || 'Admin';

                    await syncQueue.add('report-shipment', {
                        type: 'REPORT_SHIPMENT',
                        creatorId: creator.id,
                        kolName: reporterName
                    });
                }
            }

            // OC Group Automatic Reporting
            // Check if user is in OC group
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { group: true }
            });

            const isOCGroup = user?.group?.name === "OC" || user?.group?.name === "Owning Content";
            // console.log(`[OC Reporting] User group: ${user?.group?.name}, Is OC: ${isOCGroup}`);

            if (isOCGroup && (creator as any).isOldCreator) {
                // console.log(`[OC Reporting] Skip reporting for ${creator.usernameTikTok} - Marked as Old Creator.`);
            } else if (isOCGroup) {
                const reporterName = session.user.fullName || session.user.username || session.user.name || 'Admin';
                const isRevision = internalAction === 'REQUEST_REVISION';

                // First time DEALING - Report to both Sourcing and M1 Dealing
                if (data.status === 'DEALING' && !(creator as any).isReportedToOCSheet) {
                    // console.log(`[OC Reporting] First time DEALING for ${creator.usernameTikTok}, queuing sourcing and dealing jobs...`);

                    // 1. Mark as reported immediately to prevent double-queuing
                    await prisma.creator.update({
                        where: { id: creator.id },
                        data: { isReportedToOCSheet: true } as any
                    });

                    // 2. Queue Sourcing
                    await syncQueue.add('report-oc-sourcing', {
                        type: 'REPORT_SOURCING',
                        creatorId: creator.id,
                        kolName: reporterName
                    });

                    // 3. Queue Dealing
                    await syncQueue.add('report-oc-dealing', {
                        type: 'REPORT_STATUS',
                        creatorId: creator.id,
                        kolName: reporterName,
                        isRevision: false
                    });
                }
                // Subsequent status changes or revision - Update M1 Dealing only
                else if ((creator as any).isReportedToOCSheet && (data.status || isRevision)) {
                    // console.log(`[OC Reporting] Queuing M1 Dealing update for ${creator.usernameTikTok}, status: ${data.status || 'REVISION'}...`);

                    await syncQueue.add('report-oc-dealing-update', {
                        type: 'REPORT_STATUS',
                        creatorId: creator.id,
                        kolName: reporterName,
                        isRevision: isRevision
                    });
                }
            }
        }

        return NextResponse.json(creator);
    } catch (error: any) {
        console.error('Creator Update Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const idsString = searchParams.get('ids');

    try {
        if (idsString) {
            const ids = idsString.split(',').filter(Boolean);
            const result = await prisma.creator.deleteMany({
                where: {
                    id: { in: ids },
                    createdById: session.user.id
                }
            });
            return NextResponse.json({ success: true, count: result.count });
        }

        if (!id) return NextResponse.json({ error: 'ID or IDs are required' }, { status: 400 });

        await prisma.creator.delete({
            where: { id, createdById: session.user.id }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
