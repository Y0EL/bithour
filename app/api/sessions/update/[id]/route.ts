import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const sessionToken = await getServerSession(authOptions);
    const { id } = await params;

    if (!sessionToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { formData } = body;

        if (!formData) {
            return NextResponse.json({ error: 'Missing formData' }, { status: 400 });
        }

        const existingSession = await prisma.signingSession.findUnique({
            where: { id },
        });

        if (!existingSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (existingSession.createdById !== (sessionToken.user as any).id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isRevision = formData.isRevision === true;
        const updateData: any = {
            formData,
            updatedAt: new Date(),
        };

        if (isRevision) {
            updateData.status = 'PENDING';
            // Reset expiration for 24 hours for the revision
            updateData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            // Generate a fresh token for the revision URL
            updateData.token = `rev-${id.substring(0, 8)}-${Math.random().toString(36).substring(2, 7)}`;
        }

        const updatedSession = await prisma.signingSession.update({
            where: { id },
            data: updateData,
        });

        // Also update the linked Document if it exists so the dashboard reflects changes immediately
        if (updatedSession.documentId) {
            const docNo = updatedSession.type === 'INVOICE' ? formData.invoice_no : formData.mou_number;
            const contextMap: Record<string, string> = {
                'A': 'Endorsement',
                'B': 'VideoOwningContent',
                'C': 'DigitalAssets',
                'D': 'Exclusive'
            };
            const currentType = (formData.invType || 'B').toUpperCase();
            const context = updatedSession.type === 'INVOICE' ? (contextMap[currentType] || 'Invoice') : 'MOU';
            const displayUsername = (formData.from_username || formData.party2_username || 'Creator').replace(/^@/, '');
            const revSuffix = formData.isRevision && formData.revisionCount ? `-R${formData.revisionCount}` : '';
            const displayTitle = `${context} - ${displayUsername}${revSuffix}`;

            await prisma.document.update({
                where: { id: updatedSession.documentId },
                data: {
                    documentNo: docNo || `TEMP-${Date.now()}`,
                    title: displayTitle,
                    metadata: formData,
                }
            });
        }

        return NextResponse.json({ success: true, session: updatedSession, newToken: updatedSession.token });
    } catch (error: any) {
        console.error('Session Update Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
