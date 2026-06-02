import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

const getB2Endpoint = () => {
    const raw = process.env.B2_ENDPOINT;
    if (!raw) return undefined;
    if (raw.startsWith('http')) return raw;
    return `https://${raw}`;
};

const getR2Endpoint = () => {
    const raw = process.env.R2_ENDPOINT;
    if (!raw) return undefined;
    if (raw.startsWith('http')) return raw;
    return `https://${raw}`;
};

const b2Client = new S3Client({
    endpoint: getB2Endpoint(),
    region: process.env.B2_REGION || "us-east-005",
    credentials: {
        accessKeyId: process.env.B2_APPLICATION_KEY_ID!,
        secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
    forcePathStyle: true,
});

const r2Client = new S3Client({
    endpoint: getR2Endpoint(),
    region: process.env.R2_REGION || "auto",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
});

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

        // 2. If it's an S3/B2/R2 URL
        const isR2 = url.includes('r2.cloudflarestorage.com');
        const isB2 = url.includes('backblazeb2.com') || url.includes('.s3.');

        if (isR2 || isB2) {
            try {
                const urlObj = new URL(url);
                const r2Bucket = process.env.R2_BUCKET_NAME || '';
                const b2Bucket = process.env.B2_BUCKET_NAME || '';
                const bucketName = isR2 ? r2Bucket : b2Bucket;
                const client = isR2 ? r2Client : b2Client;

                // Intelligent Key Extraction with Decoding
                let rawPath = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                let key = decodeURIComponent(rawPath);

                // If it's path-style access (/bucket/key), remove the bucket name from key
                if (key.startsWith(`${bucketName}/`)) {
                    key = key.replace(`${bucketName}/`, '');
                }

                const command = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                });

                const response = await client.send(command);
                const stream = response.Body as any;

                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
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
                return NextResponse.json({
                    error: 'Failed to fetch file from storage.',
                    details: s3Error.message,
                    attemptedKey: decodeURIComponent(new URL(url).pathname)
                }, { status: 502 });
            }
        }

        // Default: just redirect
        return NextResponse.redirect(url);

    } catch (error: any) {
        console.error('Download error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
