import { NextRequest, NextResponse } from 'next/server';
import { documentQueue } from '@/lib/queue';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const jobId = id;
    const job = await documentQueue.getJob(jobId);

    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const state = await job.getState();
    const result = job.returnvalue;

    return NextResponse.json({
        id: job.id,
        state,
        progress: job.progress,
        result: result || null,
        failedReason: job.failedReason || null,
    });
}
