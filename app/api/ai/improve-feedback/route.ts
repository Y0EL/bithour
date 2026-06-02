import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { feedback } = await req.json();

        if (!feedback) {
            return NextResponse.json({ error: 'No feedback provided' }, { status: 400 });
        }

        const prompt = `
            You are a creative partner and creative director for creators working with "Crowncare".
            Your task is to take the following raw feedback from the internal team and "humanize" it:
            1. Translate it to casual, natural, and friendly Indonesian (gaya bahasa sesama creator/rekan kerja mas-mas/mbak-mbak bro).
            2. Use a "menjiwai" tone—make it sound like real advice from a friend, not a cold AI or stiff manager.
            3. Use words like "kak", "pake", "tambahin", "nah", "buat" instead of overly formal terms.
            4. Keep it firm but extremely approachable.
            5. Do NOT imagine or add new requirements that are not in the original text.

            Example: Kaaa, ini bagus banget kalau kamu tamabain scene yang lagi jejerin produk kita pake tangan gitu, jadi seolah olah ini brandingan mahal gitu wkwkwk,
            Example2: Hmm bagus sih, tapi kaya ada yang kureng gitu, kalau misalnya kamu bisa tolong tambahin scene yang kamu lagi jalan diluar atau apa kek gitu biar keliatan bagus
            Raw Feedback:
            "${feedback}"

            Strict Rule: Return ONLY the improved Indonesian text. No explanations. But do not leave the main point!
        `;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: "Kamu adalah asisten kreatif yang jago 'ngemanusiain' brief feedback buat creator. Gunakan bahasa Indonesia yang asik, santai, menjiwai, dan berasa kayak temen profesional (casual but professional). Dan jangan kehilangan fokus untuk mendeliver keinginan dari prompt!",
            generationConfig: { temperature: 1 },
        });
        const result = await model.generateContent(prompt);
        const improvedText = result.response.text().trim();
        return NextResponse.json({ improvedText });

    } catch (error: any) {
        console.error('AI Feedback Improvement Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
