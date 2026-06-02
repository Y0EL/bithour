import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// List pending requests
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = session.user as any;
    if (role !== 'SYSTEM' && role !== 'MANAGER') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const requests = await prisma.changeRequest.findMany({
            where: { status: 'PENDING' },
            include: {
                user: {
                    select: {
                        username: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ requests });
    } catch (error) {
        console.error('Error fetching change requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Approve or Reject request
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = session.user as any;
    if (role !== 'SYSTEM' && role !== 'MANAGER') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { id, status } = body;

        if (!id || !status || (status !== 'APPROVED' && status !== 'REJECTED')) {
            return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
        }

        const request = await prisma.changeRequest.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (request.status !== 'PENDING') {
            return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
        }

        if (status === 'APPROVED') {
            // APPLY THE CHANGE
            if (request.type === 'NAME') {
                await prisma.user.update({
                    where: { id: request.userId },
                    data: { fullName: request.requestedValue },
                });
            } else if (request.type === 'USERNAME') {
                // Check if username taken
                const existing = await prisma.user.findUnique({
                    where: { username: request.requestedValue },
                });
                if (existing) {
                    return NextResponse.json({ error: 'Target username is already taken. Request cannot be approved.' }, { status: 400 });
                }
                await prisma.user.update({
                    where: { id: request.userId },
                    data: { username: request.requestedValue },
                });
            }
        }

        const updatedRequest = await prisma.changeRequest.update({
            where: { id },
            data: {
                status,
                approvedById: (session.user as any).id,
            },
        });

        return NextResponse.json({ message: `Request ${status.toLowerCase()} successfully`, request: updatedRequest });
    } catch (error) {
        console.error('Error processing change request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
