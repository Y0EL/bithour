import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PRODUCT_OPTIONS } from '@/lib/constants';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { text, type } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        const productListStr = PRODUCT_OPTIONS.join(', ');

        const prompt = `
            Extract information from the following text and return it strictly as a JSON object.
            The text contains data for a ${type === 'INVOICE' ? 'Invoice' : type === 'MOU' ? 'MOU' : 'Creator'} form.
            
            Text provided:
            "${text}"
            
            ${type === 'INVOICE' ? `
            Expected format for INVOICE:
            {
                "from_name": "Full name of the creator/sender",
                "from_username": "TikTok/Social media username remove the unnecessary @ symbol",
                "bank_name": "Bank name",
                "account_number": "Bank account number",
                "account_name": "Name on the bank account",
                "kcp_kota": "Bank branch or city (KCP)"
            }` : type === 'MOU' ? `
            Expected format for MOU:
            {
                "party2_name": "Full name of the creator",
                "party2_username": "TikTok username remove the unnecessary @ symbol",
                "party2_ktp": "KTP number",
                "party2_address": "Complete address",
                "bank_name": "Bank name",
                "account_number": "Account number",
                "account_holder": "Account holder name",
                "kcp_kota": "KCP/City of the bank"
            }` : `
            Expected format for CREATOR:
            {
                "name": "Full name of the creator",
                "usernameTikTok": "TikTok username (remove @)",
                "ktpNumber": "KTP number (16 digits)",
                "address": "Complete address for MOU",
                "bankName": "Bank name (e.g. BCA, DANA, Virtual Account, etc)",
                "accountNumber": "Account number",
                "accountName": "Account holder name",
                "kcpCity": "KCP or City of the bank",
                "hairCombColor": "Color choice (black, chestnut brown, or dark brown)",
                "isLongHair": true/false (based on 'rambut panjang' ya/tidak),
                "patokanAddress": "Address landmark/patokan",
                "phoneNumber": "Phone number/No HP",
                "shippingAddress": "Full shipping address (Alamat Lengkap (username tiktok) section)",
                "productDescription": "Pick ONE exactly from this list that matches creator choice best: [${productListStr}]"
            }`}

            Important Instructions:
            1. For CREATOR: If 'hairCombColor' is provided, it must be exactly "black", "chestnut brown", or "dark brown".
            2. For 'productDescription': You MUST pick one from the provided list. If the user only mentions a color (e.g. 'chestnut'), prioritize the full product "hair color comb chestnut brown" instead of "refill chestnut brown" unless they specifically say refill.
            3. For username fields: ALWAYS remove the "@" symbol.
            4. PAYMENT INTELLIGENCE (CRITICAL):
               If the account number starts with certain prefixes, identify the E-Wallet and Bank:
               - "3901..." -> Bank Name: "DANA (BCA)", label as Virtual Account.
               - "89508..." -> Bank Name: "DANA (Mandiri)"
               - "88810..." -> Bank Name: "DANA (BRI)"
               - "8059..." -> Bank Name: "DANA (CIMB)"
               - "70001..." or "88009..." -> Bank Name: "GoPay (BCA)"
               - "60737..." or "8999..." -> Bank Name: "GoPay (Mandiri)"
               - "39358..." -> Bank Name: "OVO (BCA)"
               - "60001..." -> Bank Name: "OVO (Mandiri)"
               - "8099..." -> Bank Name: "OVO (CIMB/BRI)"
               - "122..." -> Bank Name: "ShopeePay (BCA)"
               - "893..." -> Bank Name: "ShopeePay (Mandiri)"
               If the user ONLY provides a phone number (08...) for DANA/GoPay/OVO, default to BCA prefix (e.g. 3901 for DANA) and set Bank Name accordingly.
            5. Return ONLY the valid JSON object. Use empty strings for missing fields.
        `;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: 'You are a helpful assistant that parses document data into JSON.',
            generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(prompt);
        const content = result.response.text();
        return NextResponse.json(JSON.parse(content || '{}'));

    } catch (error: any) {
        console.error('AI Parsing Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
