import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { checkReferenceInSheet } from '@/lib/sheets';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || 'INVOICE') as 'INVOICE' | 'MOU';
    const category = searchParams.get('category') || 'B';
    const refNum = searchParams.get('refNum');

    if (!refNum || refNum.length < 1) {
        return NextResponse.json({ available: true });
    }

    try {
        const targetRef = refNum.padStart(3, '0');

        // 1. Check Prisma (Local DB)
        // We look for documents that have the same type, category and refNum in their documentNo
        // Invoice Format: B-081-INV-...
        // MOU Format: B-MoU-DTI-YYYYMMDD-081-...
        const existingDoc = await prisma.document.findFirst({
            where: {
                type: type,
                documentNo: {
                    contains: `-${targetRef}-`
                }
            },
            include: {
                createdBy: {
                    select: { fullName: true }
                }
            }
        });

        if (existingDoc) {
            // Check if category matches (since 'contains' might match other categories)
            const parts = existingDoc.documentNo.split('-');
            if (parts[0] === category) {
                return NextResponse.json({
                    available: false,
                    owner: existingDoc.createdBy.fullName,
                    docNo: existingDoc.documentNo,
                    source: 'Database'
                });
            }
        }

        // 2. Check Google Sheets (The "Smart Search")
        const sheetMatch = await checkReferenceInSheet(type, category, targetRef);

        if (sheetMatch) {
            return NextResponse.json({
                available: false,
                owner: sheetMatch.owner,
                docNo: sheetMatch.docNo,
                source: 'Google Sheets'
            });
        }

        return NextResponse.json({ available: true });

    } catch (error: any) {
        console.error('Error checking reference:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
