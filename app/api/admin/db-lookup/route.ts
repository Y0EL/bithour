export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Only SYSTEM role can access this
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== 'SYSTEM') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const table = searchParams.get('table') || 'SigningSession';
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';

    try {
        let data: any[] = [];
        let total = 0;

        switch (table) {
            case 'SigningSession':
                const sessions = await prisma.signingSession.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    include: { createdBy: { select: { fullName: true, username: true } } }
                });
                data = sessions.map((s: any) => ({
                    id: s.id,
                    type: s.type,
                    token: s.token.substring(0, 8) + '...',
                    createdBy: s.createdBy?.fullName || s.createdBy?.username || 'Unknown',
                    refNum: (s.formData as any)?.refNum || (s.formData as any)?.ref_number || '-',
                    sequence: (s.formData as any)?.invSequence || (s.formData as any)?.mouSequence || '-',
                    category: (s.formData as any)?.invType || (s.formData as any)?.mouType || '-',
                    status: s.status === 'COMPLETED' ? 'SIGNED' : (new Date(s.expiresAt) < new Date() ? 'EXPIRED' : 'PENDING'),
                    isArchived: s.isArchived,
                    createdAt: s.createdAt.toISOString(),
                    expiresAt: s.expiresAt.toISOString()
                }));
                total = await prisma.signingSession.count();
                break;

            case 'Document':
                const docs = await prisma.document.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    include: { createdBy: { select: { fullName: true, username: true } } }
                });
                data = docs.map((d: any) => ({
                    id: d.id,
                    documentNo: d.documentNo,
                    type: d.type,
                    createdBy: d.createdBy?.fullName || d.createdBy?.username || 'Unknown',
                    refNum: (d.metadata as any)?.refNum || (d.metadata as any)?.ref_number || '-',
                    sequence: (d.metadata as any)?.invSequence || (d.metadata as any)?.mouSequence || '-',
                    category: (d.metadata as any)?.invType || (d.metadata as any)?.mouType || '-',
                    createdAt: d.createdAt.toISOString()
                }));
                total = await prisma.document.count();
                break;

            case 'User':
                const users = await prisma.user.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: limit
                });
                data = users.map((u: any) => ({
                    id: u.id,
                    username: u.username,
                    fullName: u.fullName,
                    role: u.role,
                    createdAt: u.createdAt.toISOString()
                }));
                total = await prisma.user.count();
                break;

            case 'UserSequence':
                const sequences = await prisma.userSequence.findMany({
                    orderBy: { updatedAt: 'desc' },
                    take: limit,
                    include: { User: { select: { fullName: true, username: true } } }
                });
                data = sequences.map((s: any) => ({
                    id: s.id,
                    user: s.User?.fullName || s.User?.username || 'Unknown',
                    docType: s.docType,
                    category: s.category,
                    lastRef: s.lastRef,
                    lastSeq: s.lastSeq,
                    updatedAt: s.updatedAt.toISOString()
                }));
                total = await prisma.userSequence.count();
                break;

            default:
                return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
        }

        return NextResponse.json({ data, total, table });
    } catch (error: any) {
        console.error('DB Lookup Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE endpoint
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== 'SYSTEM') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { table, id } = await req.json();

        switch (table) {
            case 'SigningSession':
                await prisma.signingSession.delete({ where: { id } });
                break;
            case 'Document':
                await prisma.document.delete({ where: { id } });
                break;
            case 'UserSequence':
                await prisma.userSequence.delete({ where: { id } });
                break;
            default:
                return NextResponse.json({ error: 'Cannot delete from this table' }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: `Deleted ${id} from ${table}` });
    } catch (error: any) {
        console.error('DB Delete Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
