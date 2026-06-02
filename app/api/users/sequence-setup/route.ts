import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    try {
        const { type, category, lastRef, lastSeq } = await req.json();

        if (!type || !category || typeof lastRef !== 'number' || typeof lastSeq !== 'number') {
            return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
        }

        await prisma.userSequence.upsert({
            where: {
                userId_docType_category: {
                    userId,
                    docType: type,
                    category
                }
            },
            update: {
                lastRef,
                lastSeq
            },
            create: {
                userId,
                docType: type,
                category,
                lastRef,
                lastSeq
            }
        });

        return NextResponse.json({ success: true, message: 'Initial sequence updated successfully.' });
    } catch (error: any) {
        console.error('Error updating sequence:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
