import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    if (!query || query.length < 2) {
        return NextResponse.json({ results: [] });
    }

    try {
        const userId = (session.user as any).id;

        // 1. Search Documents
        const documents = await prisma.document.findMany({
            where: {
                createdById: userId,
                OR: [
                    { documentNo: { contains: query, mode: 'insensitive' } },
                    { title: { contains: query, mode: 'insensitive' } },
                    { metadata: { path: ['party2_name'], string_contains: query } },
                    { metadata: { path: ['party2_username'], string_contains: query } },
                    { metadata: { path: ['from_name'], string_contains: query } },
                    { metadata: { path: ['from_username'], string_contains: query } },
                ]
            },
            take: 10,
            orderBy: { createdAt: 'desc' }
        });

        // 2. Search Signing Sessions
        const sessions = await prisma.signingSession.findMany({
            where: {
                createdById: userId,
                isArchived: false,
                OR: [
                    { formData: { path: ['party2_name'], string_contains: query } },
                    { formData: { path: ['party2_username'], string_contains: query } },
                    { formData: { path: ['from_name'], string_contains: query } },
                    { formData: { path: ['from_username'], string_contains: query } },
                ]
            },
            take: 10,
            orderBy: { createdAt: 'desc' }
        });

        // Format results
        const combinedResults = [
            ...documents.map(doc => ({
                id: doc.id,
                type: doc.type,
                title: doc.title,
                docNo: doc.documentNo,
                status: 'COMPLETED',
                createdAt: doc.createdAt,
                itemType: 'DOCUMENT',
                url: doc.fileUrl,
                creator: (doc.metadata as any)?.party2_name || (doc.metadata as any)?.from_name || 'N/A'
            })),
            ...sessions.map(sess => ({
                id: sess.id,
                type: sess.type,
                title: `${sess.type} Session`,
                docNo: 'WAITING',
                status: sess.status,
                createdAt: sess.createdAt,
                itemType: 'SESSION',
                token: sess.token,
                creator: (sess.formData as any)?.party2_name || (sess.formData as any)?.from_name || 'N/A'
            }))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ results: combinedResults });
    } catch (error: any) {
        console.error('Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
