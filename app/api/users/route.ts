import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// List Users
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
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                fullName: true,
                isActive: true,
                createdAt: true,
                groupId: true,
                group: {
                    select: {
                        id: true,
                        name: true,
                        isSystem: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Create User
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role: currentUserRole } = session.user as any;
    if (currentUserRole !== 'SYSTEM' && currentUserRole !== 'MANAGER') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { username, email, password, role, fullName } = body;

        if (!username || !email || !password || !role || !fullName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email },
                ],
            },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role,
                fullName,
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                fullName: true,
                createdAt: true,
            },
        });

        return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Update User
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role: currentUserRole } = session.user as any;
    if (currentUserRole !== 'SYSTEM' && currentUserRole !== 'MANAGER') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { id, action, ...data } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
        }

        let updateData = {};

        if (action === 'TOGGLE_STATUS') {
            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
            updateData = { isActive: !user.isActive };
        } else if (action === 'CHANGE_ROLE') {
            if (!data.role) return NextResponse.json({ error: 'Missing role' }, { status: 400 });
            updateData = { role: data.role };
        } else if (action === 'RESET_PASSWORD') {
            if (!data.password) return NextResponse.json({ error: 'Missing password' }, { status: 400 });
            const hashedPassword = await bcrypt.hash(data.password, 10);
            updateData = { password: hashedPassword };
        } else if (action === 'ASSIGN_GROUP') {
            // Allow null to remove from group
            updateData = { groupId: data.groupId || null };
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                fullName: true,
                isActive: true,
                createdAt: true,
                groupId: true,
                group: {
                    select: {
                        id: true,
                        name: true,
                        isSystem: true
                    }
                }
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
