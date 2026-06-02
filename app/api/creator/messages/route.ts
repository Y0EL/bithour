import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { chatQueue } from '@/lib/queue';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get('creatorId');
    const token = searchParams.get('token'); // For public access

    if (!creatorId && !token) {
        return NextResponse.json({ error: 'Creator ID or Token required' }, { status: 400 });
    }

    let creator;
    if (token) {
        creator = await prisma.creator.findUnique({ where: { sessionToken: token } });
    } else {
        const session = await getServerSession(authOptions) as any;
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        creator = await prisma.creator.findUnique({ where: { id: creatorId!, createdById: session.user.id } });
    }

    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    let messages = await prisma.creatorMessage.findMany({
        where: { creatorId: creator.id },
        orderBy: { createdAt: 'asc' },
        include: {
            sender: {
                select: { fullName: true, username: true }
            }
        }
    });

    // Hide internal transfer messages from creator view
    if (token) {
        messages = messages.filter((m: any) => !m.content.startsWith('📢 [TRANSFER]'));
    }

    return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
    const { content, creatorId, token } = await req.json();

    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });

    let creator;
    let senderId: string | null = null;
    let senderInfo = null;

    if (token) {
        // Public/Creator access
        creator = await prisma.creator.findUnique({ where: { sessionToken: token } });
    } else {
        // Logged in user access
        const session = await getServerSession(authOptions) as any;
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        senderId = session.user.id;
        senderInfo = { fullName: session.user.fullName, username: session.user.username };
        creator = await prisma.creator.findUnique({ where: { id: creatorId, createdById: session.user.id } });
    }

    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    // Generate deterministic ID for immediate UI feedback
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Queue the message instead of direct DB write (Safety/Scalability)
    await chatQueue.add('process-message', {
        id: messageId,
        content,
        creatorId: creator.id,
        senderId
    });

    // Return optimistic response
    return NextResponse.json({
        id: messageId,
        content,
        creatorId: creator.id,
        senderId,
        sender: senderInfo,
        createdAt: new Date().toISOString(),
        status: 'queued' // Optional marker
    });
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get('creatorId');

    if (!creatorId) return NextResponse.json({ error: 'Creator ID required' }, { status: 400 });

    const session = await getServerSession(authOptions) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only owners/admins can clear chat
    if (!['OWNER', 'ADMIN', 'SYSTEM', 'MANAGER', 'ANALYST'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        await prisma.creatorMessage.deleteMany({
            where: { creatorId }
        });
        return NextResponse.json({ success: true, message: 'Chat history cleared' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
