export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getLatestRefWithAI } from '@/lib/sheets';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || 'INVOICE') as 'INVOICE' | 'MOU';
    const category = (searchParams.get('category') || 'B').toUpperCase();

    try {
        // --- HYBRID SOURCE LOGIC ---
        // We scan Google Sheets (Auth Truth) + Database (Secondary Fallback for SEQ)
        const aiResult = await getLatestRefWithAI(type, category);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        let maxRef = aiResult.lastRef;
        let maxSeq = aiResult.lastSeq;

        // Use the first skipped number if available, otherwise use absolute next
        let finalNextRef = aiResult.skippedRefs.length > 0 ? aiResult.skippedRefs[0] : aiResult.absoluteNextRef;
        let finalNextSeq = aiResult.skippedSeqs.length > 0 ? aiResult.skippedSeqs[0] : aiResult.absoluteNextSeq;

        // SEQ resets per YEAR only (not per month)
        if (aiResult.lastDate) {
            const lastYear = parseInt(aiResult.lastDate.substring(0, 4));
            // If the year in the sheet is older than current year, reset to 1
            if (currentYear > lastYear) {
                finalNextSeq = 1;
            }
        }

        // --- GAP DETECTION ---
        // If there are skipped numbers, we return them so the frontend can show the modal
        const skippedRefs = aiResult.skippedRefs.map((n: number) => n.toString().padStart(3, '0'));
        const skippedSeqs = aiResult.skippedSeqs.map((n: number) => n.toString().padStart(4, '0'));

        // Initial Setup Check
        if (maxRef === 0 && maxSeq === 0) {
            return NextResponse.json({
                setup_needed: true,
                message: `Sistem tidak menemukan urutan terakhir untuk ${type} tipe ${category}. Silahkan inisialisasi nomor pertama.`
            });
        }

        return NextResponse.json({
            nextRef: finalNextRef.toString().padStart(3, '0'),
            nextSeq: finalNextSeq.toString().padStart(4, '0'),
            absoluteNextRef: (maxRef + 1).toString().padStart(3, '0'),
            absoluteNextSeq: (maxSeq + 1).toString().padStart(4, '0'),
            currentRef: finalNextRef,
            currentSeq: finalNextSeq,
            skippedRefs,
            skippedSeqs
        });

    } catch (error: any) {
        console.error('Error fetching global next ref via AI:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
