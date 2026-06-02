import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { documentQueue } from '@/lib/queue';
import { z } from 'zod';
import crypto from 'crypto';

const requestSchema = z.object({
    type: z.enum(['INVOICE', 'MOU']),
    formData: z.any()
});

/**
 * Direct PDF Generation Endpoint
 * Refactored to be ASYNCHRONOUS using BullMQ
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const bodyContent = await req.json();
        const parsed = requestSchema.safeParse(bodyContent);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid payload structure', details: parsed.error.format() }, { status: 400 });
        }

        const { formData, type } = parsed.data;
        const userId = (session.user as any).id;
        const requestId = crypto.randomUUID();

        // Enqueue the job to BullMQ
        const job = await documentQueue.add('document-generation', {
            formData,
            type,
            userId,
            requestId
        });

        return NextResponse.json({
            success: true,
            message: 'Document generation job enqueued',
            job_id: job.id,
            status: 'queued'
        });

    } catch (error: unknown) {
        console.error('[API direct-generate Error]:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
