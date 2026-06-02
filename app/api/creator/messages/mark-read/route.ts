import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis';

/**
 * Mark all unread messages for a creator as read by internal team
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { creatorId } = await req.json();

        if (!creatorId) {
            return NextResponse.json({ error: 'creatorId is required' }, { status: 400 });
        }

        // Mark all messages from creator (senderId is null) as read
        const result = await prisma.creatorMessage.updateMany({
            where: {
                creatorId,
                senderId: null, // Only messages from creator
                isReadByInternal: false
            },
            data: {
                isReadByInternal: true
            }
        });

        // Publish to Redis for real-time update
        try {
            await redisClient.publish('creator:messages:read', JSON.stringify({
                creatorId,
                count: result.count,
                timestamp: new Date().toISOString()
            }));
        } catch (redisErr) {
            console.error('[Mark-as-Read] Redis publish failed:', redisErr);
        }

        return NextResponse.json({
            success: true,
            markedCount: result.count
        });

    } catch (error: any) {
        console.error('Mark-as-Read Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
