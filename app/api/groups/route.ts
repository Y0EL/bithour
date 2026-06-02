import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET - Fetch all groups
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (session.user as any).role;
        if (!['SYSTEM', 'MANAGER'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const groups = await prisma.group.findMany({
            include: {
                _count: {
                    select: { users: true }
                }
            },
            orderBy: [
                { isSystem: 'desc' },
                { createdAt: 'asc' }
            ]
        });

        return NextResponse.json({ groups });
    } catch (error: any) {
        console.error('GET /api/groups error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create new group
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (session.user as any).role;
        if (userRole !== 'SYSTEM') {
            return NextResponse.json({ error: 'Only SYSTEM can create groups' }, { status: 403 });
        }

        const { name, description } = await req.json();

        if (!name || name.trim() === '') {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        // Check if group already exists
        const existing = await prisma.group.findUnique({
            where: { name: name.trim() }
        });

        if (existing) {
            return NextResponse.json({ error: 'Group name already exists' }, { status: 400 });
        }

        const group = await prisma.group.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                isSystem: false
            }
        });

        return NextResponse.json({ group }, { status: 201 });
    } catch (error: any) {
        console.error('POST /api/groups error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH - Update or delete group
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (session.user as any).role;
        if (userRole !== 'SYSTEM') {
            return NextResponse.json({ error: 'Only SYSTEM can modify groups' }, { status: 403 });
        }

        const { id, action, name, description } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Group ID required' }, { status: 400 });
        }

        const group = await prisma.group.findUnique({ where: { id } });
        if (!group) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        // Prevent modification of system groups (OC)
        if (group.isSystem) {
            return NextResponse.json({ error: 'Cannot modify system groups' }, { status: 403 });
        }

        if (action === 'DELETE') {
            // Remove users from this group first
            await prisma.user.updateMany({
                where: { groupId: id },
                data: { groupId: null }
            });

            await prisma.group.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }

        if (action === 'UPDATE') {
            const updated = await prisma.group.update({
                where: { id },
                data: {
                    name: name?.trim() || group.name,
                    description: description?.trim() || group.description
                }
            });
            return NextResponse.json({ group: updated });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('PATCH /api/groups error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
