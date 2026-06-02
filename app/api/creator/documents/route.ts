import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    try {
        const creator = await prisma.creator.findUnique({
            where: { sessionToken: token }
        });

        if (!creator) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        const username = creator.usernameTikTok.replace(/^@/, '');

        // 1. Find all SigningSessions for this creator (Auto-match via username)
        const sessions = await prisma.signingSession.findMany({
            where: {
                Creator: {
                    usernameTikTok: creator.usernameTikTok
                }
            },
            include: { Document: true }
        });

        // 2. Extract unique documents from sessions
        const documents = sessions
            .filter((s: any) => s.Document)
            .map((s: any) => ({
                ...s.Document,
                signingToken: s.token
            }))
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(documents);
    } catch (error: any) {
        console.error('[Creator Documents GET Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
