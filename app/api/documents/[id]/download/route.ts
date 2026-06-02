import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { downloadFromS3 } from '@/lib/s3';
import fs from 'fs';
import path from 'path';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const session = await getServerSession(authOptions);

    // --- AUTHENTICATION ---
    if (!session) {
        // If no user session, check if it's a creator with a valid token
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const validSession = await prisma.signingSession.findFirst({
            where: { token, documentId: id }
        });

        if (!validSession) {
            // Also check if the token belongs to the same creator even if for a different document (auto-attach)
            const creator = await prisma.creator.findUnique({ where: { sessionToken: token } });
            const docToCheck = await prisma.document.findUnique({
                where: { id },
                include: { SigningSession: true }
            });

            const isAllowed = creator && docToCheck && (
                docToCheck.SigningSession?.creatorId === creator.id ||
                (docToCheck.metadata as any)?.party2_username?.replace(/^@/, '') === creator.usernameTikTok.replace(/^@/, '')
            );

            if (!isAllowed) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }
    }

    try {
        const shouldViewInline = searchParams.get('view') === 'true';

        const doc = await prisma.document.findUnique({
            where: { id },
        });

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // --- PREFER SIGNED FILE ---
        const url = doc.signedFileUrl || doc.fileUrl;

        if (!url || url === '') {
            // Document might be generating
            if (doc.status === 'PENDING_SIGN') {
                return NextResponse.json({
                    error: 'Document is still being generated. Please wait a few seconds and refresh.',
                    status: 'GENERATING'
                }, { status: 202 });
            }
            return NextResponse.json({ error: 'Document file not found' }, { status: 404 });
        }
        const meta = (doc.metadata as any) || {};
        const isInvoice = doc.type === 'INVOICE';
        const isMOU = doc.type === 'MOU';

        // Construct a logical filename based on the latest standards
        let fileName = decodeURIComponent(url.split('/').pop() || 'document.pdf');

        try {
            const dateStr = (meta.invoice_date || meta.mou_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
            const username = (meta.from_username || meta.party2_username || 'creator').replace(/^@/, '');
            const refNum = meta.refNum || meta.ref_number || doc.documentNo?.split('-')[1] || '000';
            const rev = (meta.isRevision && meta.revisionCount) ? `-R${meta.revisionCount}` : '';

            if (doc.documentNo && doc.documentNo.includes('-DTI-')) {
                // If it's already in the new format, just use it
                fileName = `${doc.documentNo}.pdf`;
            } else if (isInvoice) {
                const cat = meta.invType || 'B';
                const seq = (meta.invSequence || '0001').padStart(4, '0');
                fileName = `${cat}-${refNum}-INV-DTI-${dateStr}-${seq}${rev}.pdf`;
            } else if (isMOU) {
                const cat = meta.mouType || 'B';
                const seq = (meta.mouSequence || '0001').padStart(4, '0');
                fileName = `${cat}-${refNum}-MoU-DTI-${dateStr}-${seq}${rev}.pdf`;
            }
        } catch (e) {
            console.error('[Download] Failed to construct dynamic filename:', e);
        }

        const disposition = shouldViewInline ? 'inline' : 'attachment';

        // 1. If it's a local file relative path (e.g. /invoices/...)
        if (url.startsWith('/')) {
            const filePath = path.join(process.cwd(), 'public', url);
            if (fs.existsSync(filePath)) {
                const fileBuffer = fs.readFileSync(filePath);
                return new NextResponse(fileBuffer, {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `${disposition}; filename="${fileName}"`,
                    },
                });
            }
        }

        // 2. Any S3-compatible URL (R2, B2, Tigris, MinIO) — proxy via server
        const isS3Url = url.startsWith('http') && !url.startsWith(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost');
        if (isS3Url) {
            try {
                const response = await downloadFromS3(url);
                const stream = response.Body as any;
                const chunks: Buffer[] = [];
                for await (const chunk of stream) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const buffer = Buffer.concat(chunks);
                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `${disposition}; filename="${fileName}"`,
                    },
                });
            } catch (s3Error: any) {
                console.error('S3 Fetch Error:', s3Error);
                return NextResponse.json({ error: 'Failed to fetch file from storage.', details: s3Error.message }, { status: 502 });
            }
        }

        return NextResponse.json({ error: 'Document file not accessible' }, { status: 404 });

    } catch (error: any) {
        console.error('Download error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
