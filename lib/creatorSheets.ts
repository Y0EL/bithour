import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHIPMENT_SPREADSHEET_ID = '1iuiU-9f4TIFaBYOKfNmrPCPPBF_eM_rH-g53I4MQdzw';

async function getSheetsService() {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) return null;
    try {
        const credentials = JSON.parse(saJson);
        const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
        const client = await auth.getClient();
        return google.sheets({ version: 'v4', auth: client as any });
    } catch (error) {
        return null;
    }
}

export async function getSKUMappings() {
    const sheets = await getSheetsService();
    if (!sheets) return [];

    try {
        // User specified: SKU is Column F (Index 5), Product Details is Column G (Index 6)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHIPMENT_SPREADSHEET_ID,
            range: 'SKU!A:G',
        });

        const rows = response.data.values || [];
        if (rows.length < 1) return [];

        // console.log(`[SKUMatch] Total raw rows from SKU sheet: ${rows.length}`);

        const mappings = rows.map((row, index) => {
            // Column F is index 5, Column G is index 6
            const sku = row[5]?.toString().trim();
            const productName = row[6]?.toString().trim();

            return { sku, productName };
        }).filter(i =>
            i.sku &&
            i.productName &&
            i.sku.toLowerCase() !== 'sku' &&
            !i.productName.toLowerCase().includes('product details')
        );

        // console.log(`[SKUMatch] Parsed Mappings Count (from Col F & G):`, mappings.length);
        if (mappings.length > 0) {
            // console.log(`[SKUMatch] First valid mapping extracted: SKU=${mappings[0].sku}, Product=${mappings[0].productName}`);
        }
        return mappings;
    } catch (error) {
        console.error('Error fetching SKU:', error);
        return [];
    }
}

export async function matchProductWithAI(creator: any) {
    const skus = await getSKUMappings();
    if (skus.length === 0) return null;

    // PRIORITY 1: Use specific productDescription if provided (from the new dropdown/parse)
    if (creator.productDescription) {
        // console.log(`[SKUMatch] Priority 1: Using productDescription "${creator.productDescription}"`);
        const exactMatch = skus.find(s => s.productName.toLowerCase().trim() === creator.productDescription.toLowerCase().trim());
        if (exactMatch) {
            // console.log(`[SKUMatch] Found exact match for productDescription: ${exactMatch.sku}`);
            return exactMatch;
        }

        // Fuzzy match for productDescription
        const fuzzyMatch = skus.find(s =>
            s.productName.toLowerCase().includes(creator.productDescription.toLowerCase()) ||
            creator.productDescription.toLowerCase().includes(s.productName.toLowerCase())
        );
        if (fuzzyMatch) {
            // console.log(`[SKUMatch] Found fuzzy match for productDescription: ${fuzzyMatch.sku}`);
            return fuzzyMatch;
        }
    }

    // PRIORITY 2: Fallback to existing color + refill logic
    let color = (creator.hairCombColor || '').toLowerCase().trim();
    if (color.includes('chesnut') && !color.includes('chestnut')) {
        color = color.replace('chesnut', 'chestnut');
    }

    const wantsRefill = creator.isLongHair === true;
    // console.log(`[SKUMatch] Priority 2: Matching - Color: "${color}", Wants Refill: ${wantsRefill}`);

    const findMatch = (needsRefill: boolean) => {
        return skus.find(s => {
            const name = s.productName.toLowerCase();
            const hasColor = name.includes(color);
            const isRefill = name.includes('refill');

            if (needsRefill) return hasColor && isRefill;
            // If not needsRefill, strictly avoid "refill" in the name
            return hasColor && !isRefill && !name.includes('+') && !name.includes('combo');
        });
    };

    const directMatch = findMatch(wantsRefill);
    if (directMatch) {
        // console.log(`[SKUMatch] Direct Match Found (Color logic): ${directMatch.productName}`);
        return directMatch;
    }

    // console.log('[SKUMatch] Direct match failed. Calling AI as fallback...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const context = `
        CREATOR PREFERENCES:
        - Chosen Color: ${color}
        - Longer Hair Option (Rambut Panjang): ${wantsRefill ? 'YES (NEEDS REFILL)' : 'NO'}

        DATABASE (FROM SHEET):
        ${skus.slice(0, 50).map(s => `- [SKU: ${s.sku}] ${s.productName}`).join('\n')}
    `;

    const prompt = `
        Return a JSON object with the SKU and productName for color "${color}".
        If "Rambut Panjang" is YES, prioritize products with "+refill".
        MUST return valid JSON. Format: {"sku": "...", "productName": "..."}
    `;

    try {
        const aiModel = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: 'You are an inventory fulfillment assistant. Return only JSON data.',
            generationConfig: { responseMimeType: 'application/json' },
        });
        const aiResult = await aiModel.generateContent(context + "\n\n" + prompt);
        const result = JSON.parse(aiResult.response.text() || '{}');
        if (result.sku) {
            // console.log(`[SKUMatch] AI Selected: ${result.productName} (${result.sku})`);
            return result;
        }
    } catch (error: any) {
        console.error('[SKUMatch] AI Error Detail:', error.message);
    }


    return null;
}

export async function reportToShipmentSpreadsheet(creator: any, kolName: string) {
    // console.log(`[ShipmentReport] Starting report for ${creator.usernameTikTok}...`);
    const sheets = await getSheetsService();
    if (!sheets) {
        console.error('[ShipmentReport] Sheets service failed to initialize');
        return { success: false, error: 'Internal Error: Sheets service not available' };
    }

    // console.log(`[ShipmentReport] Matching product with AI for ${creator.usernameTikTok}...`);
    const matched = await matchProductWithAI(creator);
    if (!matched || !matched.sku) {
        console.error('[ShipmentReport] AI failed to match product SKU for', creator.usernameTikTok);
        return { success: false, error: 'AI failed to match product SKU' };
    }

    const date = new Date().toLocaleDateString('id-ID'); // Today's date

    // Format address with recipient name
    const addressLine1 = `Nama Penerima: ${creator.name}`;
    const addressLine2 = creator.address || '';
    const addressLine3 = creator.patokanAddress ? `Patokan: ${creator.patokanAddress}` : '';
    const formattedAddress = [addressLine1, addressLine2, addressLine3].filter(Boolean).join('\n');

    // Ensure data is string and not null
    const finalKOL = kolName || 'System';
    const finalPhone = creator.phoneNumber || '-';

    // Polish product name: replace '+' with '&' for better readability
    const polishedProductName = matched.productName.replace(/\+/g, ' & ');

    const values = [
        date,                   // Date
        finalKOL,               // KOL
        creator.usernameTikTok, // creator (tiktok id only)
        matched.sku,            // SKU
        polishedProductName,    // Product (polished)
        1,                      // Amount (Default)
        finalPhone,             // number
        formattedAddress,       // Address (formatted with recipient name)
        '',                     // Date of shipping
        '',                     // Tracking number
        ''                      // Manual order
    ];

    // console.log(`[ShipmentReport] Prepared values:`, values);

    try {
        const metadata = await sheets.spreadsheets.get({ spreadsheetId: SHIPMENT_SPREADSHEET_ID });
        const sheets_list = metadata.data.sheets || [];

        // Find the correct sheet: First one that isn't "SKU"
        const targetSheet = sheets_list.find(s => s.properties?.title !== 'SKU') || sheets_list[0];
        const sheetName = targetSheet.properties?.title || 'Sheet1';

        // console.log(`[ShipmentReport] Appending to sheet: ${sheetName}`);

        const result = await sheets.spreadsheets.values.append({
            spreadsheetId: SHIPMENT_SPREADSHEET_ID,
            range: `'${sheetName}'!A:K`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [values] }
        });

        // console.log(`[ShipmentReport] Successfully appended row. Updated Range: ${result.data.updates?.updatedRange}`);
        return { success: true, sku: matched.sku, productName: matched.productName };
    } catch (error: any) {
        console.error('[ShipmentReport] Error appending to sheet:', error.message);
        return { success: false, error: error.message };
    }
}
