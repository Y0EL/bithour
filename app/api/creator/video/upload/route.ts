import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';

export async function POST(req: NextRequest) {
    // This can be called by either logged in user or creator via public token
    const { creatorId, token, fileName, fileType } = await req.json();

    if (!fileName || !fileType) {
        return NextResponse.json({ error: 'File name and type are required' }, { status: 400 });
    }

    let creator;
    if (token) {
        creator = await prisma.creator.findUnique({ where: { sessionToken: token } });
    } else {
        const session = await getServerSession(authOptions) as any;
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        creator = await prisma.creator.findUnique({ where: { id: creatorId, createdById: session.user.id } });
    }

    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    // For simplicity, we'll return a pre-signed URL or a direct upload handler
    // Since lib/s3 expects a Buffer, we might need to handle multipart if uploading directly
    // But for a better UX with large videos, a pre-signed URL is better.
    // However, the current lib/s3 doesn't have pre-signed URL support.

    // I will implement a direct upload handler for now, acknowledging user's request
    return NextResponse.json({
        uploadUrl: `/api/creator/video/upload/direct?creatorId=${creator.id}&token=${token || ''}`,
        message: 'Ready for upload'
    });
}
