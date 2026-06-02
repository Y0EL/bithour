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
        const { fullName, username } = body;

        const user = session.user as any;
        if (user.role !== 'SYSTEM' && user.role !== 'MANAGER') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const updateData: any = {};
        if (fullName) updateData.fullName = fullName;

        if (username) {
            // Check if username taken
            const existing = await prisma.user.findUnique({
                where: { username },
            });
            if (existing && existing.id !== user.id) {
                return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
            }
            updateData.username = username;
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
        });

        return NextResponse.json({
            message: 'Profile updated successfully',
            user: {
                fullName: updatedUser.fullName,
                username: updatedUser.username
            }
        });
    } catch (error) {
        console.error('Error updating admin profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
