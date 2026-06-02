import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePresignedDownloadUrl } from '@/lib/s3';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const creatorId = searchParams.get('creatorId');

    if (!token && !creatorId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const type = searchParams.get('type');
        const historyIdx = searchParams.get('historyIdx');
        let creator;
        if (token) {
            creator = await prisma.creator.findUnique({ where: { sessionToken: token } });
        } else {
            creator = await prisma.creator.findUnique({ where: { id: creatorId! } });
        }

        let targetUrl;
        if (type === 'proof') {
            targetUrl = creator?.paymentProofUrl;
        } else if (historyIdx !== null && (creator as any)?.videoHistory) {
            const history = (creator as any).videoHistory as any[];
            targetUrl = history[parseInt(historyIdx)]?.url;
        } else if ((creator as any)?.isEndorsementReview && (creator as any)?.endorsedVideoUrl) {
            targetUrl = (creator as any).endorsedVideoUrl;
        } else {
            targetUrl = creator?.videoUrl;
        }

        if (!creator || !targetUrl) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const b2Bucket = process.env.B2_BUCKET_NAME || '';
        const r2Bucket = process.env.R2_BUCKET_NAME || '';

        // Check if URL belongs to our storage (either B2 or R2)
        const isOurStorage = targetUrl.includes(b2Bucket) || targetUrl.includes(r2Bucket) ||
            targetUrl.includes('backblazeb2.com') || targetUrl.includes('r2.cloudflarestorage.com');

        if (isOurStorage) {
            // Generate presigned URL from the correct storage backend (auto-detected)
            // Browser streams LANGSUNG dari B2/R2 tanpa proxy VPS
            const presignedUrl = await generatePresignedDownloadUrl(targetUrl, 7200);

            // 307 Temporary Redirect → browser streams langsung
            return NextResponse.redirect(presignedUrl, 307);
        }

        // Kalau bukan di storage kita (misal Google Drive) → redirect saja
        if (targetUrl.startsWith('http')) {
            return NextResponse.redirect(targetUrl);
        }

        // Fallback
        return new NextResponse('Unsupported video URL', { status: 400 });
    } catch (error) {
        console.error('Video Proxy Error:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
