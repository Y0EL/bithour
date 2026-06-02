import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { type, requestedValue } = body;

        if (!type || !requestedValue) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (type !== 'NAME' && type !== 'USERNAME') {
            return NextResponse.json({ error: 'Invalid change type' }, { status: 400 });
        }

        // Create the change request
        const request = await prisma.changeRequest.create({
            data: {
                userId: (session.user as any).id,
                type,
                requestedValue,
                status: 'PENDING',
            },
        });

        return NextResponse.json({
            message: 'Request submitted successfully. Waiting for administrator approval.',
            request
        });
    } catch (error) {
        console.error('Error submitting change request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
