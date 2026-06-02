import { google } from 'googleapis';
import { prisma } from './prisma';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const OC_SPREADSHEET_ID = '17ZN35lcQ9X0bGXzu3QEYMDHZ5NgUJCNhH8L9jGOLGUs';

/**
 * Get dynamic sheet name based on current month
 * Example: if January, returns "M1 Sourcing" or "M1 Dealing"
 */
export function getOCSheetName(baseName: 'Sourcing' | 'Dealing'): string {
    const month = new Date().getMonth() + 1; // 1-12
    return `M${month} ${baseName}`;
}

/**
 * Get the most appropriate sheet name by checking existence
 * Fallback to previous month if current month's sheet is missing
 */
export async function resolveSheetName(baseName: 'Sourcing' | 'Dealing'): Promise<string> {
    const sheets = await getSheetsService();
    if (!sheets) return getOCSheetName(baseName);

    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: OC_SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });

        const sheetTitles = response.data.sheets?.map(s => s.properties?.title || '') || [];
        const currentMonthName = getOCSheetName(baseName);

        // 1. Try current month
        if (sheetTitles.includes(currentMonthName)) return currentMonthName;

        // 2. Try current month without space (e.g. "M2Dealing")
        const currentMonthNoSpace = `M${new Date().getMonth() + 1}${baseName}`;
        if (sheetTitles.includes(currentMonthNoSpace)) return currentMonthNoSpace;

        // 3. Fallback to previous month (M-1)
        const prevMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth();
        const prevMonthName = `M${prevMonth} ${baseName}`;
        if (sheetTitles.includes(prevMonthName)) {
            // console.log(`[OC Sheets] Current month sheet ${currentMonthName} not found. Falling back to ${prevMonthName}`);
            return prevMonthName;
        }

        // 4. Default back to current
        return currentMonthName;
    } catch (error) {
        console.error('[OC Sheets] Error resolving sheet name:', error);
        return getOCSheetName(baseName);
    }
}

async function getSheetsService() {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) return null;
    try {
        const credentials = JSON.parse(saJson);
        const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
        const client = await auth.getClient();
        return google.sheets({ version: 'v4', auth: client as any });
    } catch (error) {
        console.error('[OC Sheets] Failed to initialize:', error);
        return null;
    }
}

/**
 * Attempt to get TikTok follower count using server-side scraping
 */
export async function getFollowerCount(username: string): Promise<number | null> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const url = `https://www.tiktok.com/@${cleanUsername}`;

    // console.log(`[TikTok Scraper] Fetching followers for @${cleanUsername}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            next: { revalidate: 3600 }
        });

        if (!response.ok) return null;

        const html = await response.text();
        const followerMatch = html.match(/"followerCount":\s*(\d+)/);
        if (followerMatch && followerMatch[1]) {
            return parseInt(followerMatch[1]);
        }

        const statsMatch = html.match(/"stats":\s*{[^}]*"followerCount":\s*(\d+)/);
        if (statsMatch && statsMatch[1]) {
            return parseInt(statsMatch[1]);
        }

        return null;
    } catch (error: any) {
        console.error(`[TikTok Scraper] Error scraping @${cleanUsername}:`, error.message);
        return null;
    }
}

/**
 * Map internal creator status to "Noted" column value for OC spreadsheet
 */
export function mapStatusToNoted(status: string, isRevision: boolean = false): string {
    if (isRevision) return 'Revisi';

    const mapping: Record<string, string> = {
        'DEALING': 'Dealing',
        'SAMPLING': 'Sampling',
        'DRAFTING': 'Draft',
        'FINANCING': 'Done Payment',
        'MONITORING': 'Done Payment'
    };

    return mapping[status] || status;
}

/**
 * Get the next available row number in a sheet
 * Reads the sheet and finds the last row with data, then returns lastRow + 1
 */
export async function getNextRowNumber(sheetName: string): Promise<number> {
    const sheets = await getSheetsService();
    if (!sheets) {
        console.error('[OC Sheets] Cannot get next row - sheets service unavailable');
        return 2; // Default to row 2 (after header)
    }

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: OC_SPREADSHEET_ID,
            range: `'${sheetName}'!A:A`, // Read column A to count rows
        });

        const rows = response.data.values || [];
        const nextRow = rows.length + 1;

        // console.log(`[OC Sheets] Next available row in "${sheetName}": ${nextRow}`);
        return nextRow;
    } catch (error: any) {
        console.error(`[OC Sheets] Error getting next row number: ${error.message}`);
        return 2; // Fallback to row 2
    }
}

/**
 * Report to "Sourcing" sheet (first time only when status becomes DEALING)
 */
export async function reportToOCSourcing(creator: any, kolName: string) {
    // console.log(`[OC Sheets] Starting Sourcing report for @${creator.usernameTikTok}...`);
    const sheets = await getSheetsService();
    if (!sheets) {
        return { success: false, error: 'Sheets service not available' };
    }

    try {
        const sheetName = await resolveSheetName('Sourcing');
        const rowNumber = await getNextRowNumber(sheetName);
        const cleanUsername = creator.usernameTikTok?.startsWith('@') ? creator.usernameTikTok.substring(1) : creator.usernameTikTok;

        const followerCount = await getFollowerCount(cleanUsername);
        // Save to DB
        if (followerCount) {
            await prisma.creator.update({ where: { id: creator.id }, data: { followers: followerCount } as any });
        }

        const followerDisplay = followerCount ? followerCount.toLocaleString('id-ID') : 'N/A';
        const formFillingTime = new Date().toLocaleString('id-ID');
        const profileLink = `https://www.tiktok.com/@${cleanUsername}`;

        const values = [
            rowNumber - 1, // No (row number minus header)
            formFillingTime, // Form Filling Time
            `@${cleanUsername}`, // Username
            profileLink, // Creator profile link
            followerDisplay, // Follower Count
            creator.phoneNumber || '-', // WhatsApp
            'Yes', // Does it meet the requirements?
            'Yes', // Approach
            '', // Pass or not (blank)
            'haircomb' // Collaborated Product
        ];

        // console.log(`[OC Sheets] Appending to ${sheetName} sheet, row ${rowNumber}:`, values);

        await sheets.spreadsheets.values.append({
            spreadsheetId: OC_SPREADSHEET_ID,
            range: `'${sheetName}'!A:J`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [values] }
        });

        // console.log(`[OC Sheets] Successfully reported to Sourcing sheet`);
        return { success: true, rowNumber };
    } catch (error: any) {
        console.error('[OC Sheets] Sourcing report failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Update or create entry in "M1 Dealing" sheet
 * This is called on every status change for OC group users
 */
export async function updateOCDealing(creator: any, kolName: string, isRevision: boolean = false) {
    // console.log(`[OC Sheets] Updating M1 Dealing for @${creator.usernameTikTok}, status: ${creator.status}, revision: ${isRevision}...`);
    const sheets = await getSheetsService();
    if (!sheets) {
        return { success: false, error: 'Sheets service not available' };
    }

    try {
        const sheetName = await resolveSheetName('Dealing');
        let rowNumber = creator.ocSheetRowNumber;

        // If no row number exists, this is the first time - append new row
        if (!rowNumber) {
            rowNumber = await getNextRowNumber(sheetName);
        }

        const cleanUsername = creator.usernameTikTok?.startsWith('@') ? creator.usernameTikTok.substring(1) : creator.usernameTikTok;

        let followerVal = null;
        if (!creator.ocSheetRowNumber) {
            followerVal = await getFollowerCount(cleanUsername);
            if (followerVal) {
                await prisma.creator.update({ where: { id: creator.id }, data: { followers: followerVal } as any });
            }
        }

        const followerDisplay = followerVal ? followerVal.toLocaleString('id-ID') : (creator.followers ? creator.followers.toLocaleString('id-ID') : 'N/A');

        const formFillingTime = creator.ocSheetRowNumber ?
            null : // Keep original time if updating
            new Date().toLocaleString('id-ID');

        const profileLink = `https://www.tiktok.com/@${cleanUsername}`;
        const notedValue = mapStatusToNoted(creator.status, isRevision);
        const approvedValue = (creator.status === 'FINANCING' || creator.status === 'MONITORING' || (creator as any).videoReviewStatus === 'APPROVED') ? 'OK' : '';

        // Determine which column gets the video link
        const draftLink = (creator.videoUrl && !isRevision) ? creator.videoUrl : (creator as any).originalVideoUrl || '';
        const revisiLink = (creator.videoUrl && isRevision) ? creator.videoUrl : '';
        const feedbackValue = (creator as any).reviewNotes || '';

        // Build values array (28 columns total)
        const values = [
            creator.ocSheetRowNumber ? null : (rowNumber - 1), // NO
            creator.ocSheetRowNumber ? null : formFillingTime, // Form Filling Time
            creator.ocSheetRowNumber ? null : `@${cleanUsername}`, // Username
            creator.ocSheetRowNumber ? null : profileLink, // Creator profile link
            creator.ocSheetRowNumber ? null : followerDisplay, // Follower Count
            creator.ocSheetRowNumber ? null : (creator.phoneNumber || '-'), // WhatsApp
            creator.ocSheetRowNumber ? null : 'haircomb', // Collaborated Product
            creator.ocSheetRowNumber ? null : 'Yes', // Send Personal Information
            creator.ocSheetRowNumber ? null : 'Yes', // Send MoU
            '', // MoU Signed (blank)
            creator.sampleDeliveryDate ? new Date(creator.sampleDeliveryDate).toLocaleDateString('id-ID') : '', // Sample Delivery Time
            creator.sampleTrackingNumber || '', // Sample Tracking Number
            notedValue, // Noted (realtime status)
            draftLink, // Draft (video link if first upload)
            feedbackValue, // Feedback
            revisiLink, // Revisi (video link if revision)
            approvedValue, // Approved
            '', '', '', '', '', '', '', '', '', '', '' // Remaining blank columns (18-28)
        ];

        if (creator.ocSheetRowNumber) {
            // Update existing row
            // console.log(`[OC Sheets] Updating existing row ${rowNumber} in ${sheetName}`);

            // Range 1: K to N (Sample info, Noted, Draft)
            const range1 = `'${sheetName}'!K${rowNumber}:N${rowNumber}`;
            const values1 = [
                creator.sampleDeliveryDate ? new Date(creator.sampleDeliveryDate).toLocaleDateString('id-ID') : '',
                creator.sampleTrackingNumber || '',
                notedValue,
                draftLink || ''
            ];

            await sheets.spreadsheets.values.update({
                spreadsheetId: OC_SPREADSHEET_ID,
                range: range1,
                valueInputOption: 'RAW',
                requestBody: { values: [values1] }
            });

            // Range 2: O to Q (Feedback, Revisi link, Approved)
            const range2 = `'${sheetName}'!O${rowNumber}:Q${rowNumber}`;
            const values2 = [
                feedbackValue,
                revisiLink,
                approvedValue
            ];

            await sheets.spreadsheets.values.update({
                spreadsheetId: OC_SPREADSHEET_ID,
                range: range2,
                valueInputOption: 'RAW',
                requestBody: { values: [values2] }
            });

            // Range 3: F (WhatsApp) - Realtime update if changed
            if (creator.phoneNumber) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: OC_SPREADSHEET_ID,
                    range: `'${sheetName}'!F${rowNumber}`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [[creator.phoneNumber]] }
                });
            }
        } else {
            // Append new row
            // console.log(`[OC Sheets] Appending new row ${rowNumber} to ${sheetName}`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: OC_SPREADSHEET_ID,
                range: `'${sheetName}'!A:AB`, // Columns A to AB (28 columns)
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                requestBody: { values: [values] }
            });
        }

        // console.log(`[OC Sheets] Successfully updated ${sheetName} sheet`);
        return { success: true, rowNumber };
    } catch (error: any) {
        const sn = await resolveSheetName('Dealing');
        console.error(`[OC Sheets] ${sn} update failed:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Sync feedback from spreadsheet to chat
 * Reads column O (Feedback) for the given creator's row
 */
export async function syncFeedbackFromSheet(creator: any) {
    if (!creator.ocSheetRowNumber) return null;

    const sheets = await getSheetsService();
    if (!sheets) return null;

    try {
        const sheetName = await resolveSheetName('Dealing');
        const rowNumber = creator.ocSheetRowNumber;

        // Column O is the 15th column
        const range = `'${sheetName}'!O${rowNumber}`;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: OC_SPREADSHEET_ID,
            range,
        });

        const feedback = response.data.values?.[0]?.[0];
        if (feedback && feedback.trim()) {
            return feedback.trim();
        }
        return null;
    } catch (error: any) {
        console.error('[OC Sheets] Feedback sync failed:', error.message);
        return null;
    }
}
