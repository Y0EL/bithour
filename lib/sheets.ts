import { google } from 'googleapis';
import { prisma } from './prisma';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getSheetsService() {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
        console.error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
        return null;
    }

    try {
        const credentials = JSON.parse(saJson);
        if (!credentials.client_email) return null; // local dev — no real credentials
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });
        const client = await auth.getClient();
        return google.sheets({ version: 'v4', auth: client as any });
    } catch (error) {
        console.error('Error initializing Google Sheets service:', error);
        return null;
    }
}

async function getTargetSheetName(sheets: any, spreadsheetId: string): Promise<string> {
    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetTitles = spreadsheet.data.sheets.map((s: any) => s.properties.title);
        
        // Priority 1: Sheet named exactly "2026" or containing "2026"
        const currentYear = new Date().getFullYear().toString();
        const yearSheet = sheetTitles.find((t: string) => t === currentYear || t.includes(currentYear));
        if (yearSheet) return yearSheet;

        // Priority 2: Invoices (if it exists)
        if (sheetTitles.includes('Invoices')) return 'Invoices';

        // Fallback: Sheet1
        return 'Sheet1';
    } catch (err) {
        return 'Sheet1';
    }
}

async function getAllRelevantSheetNames(sheets: any, spreadsheetId: string): Promise<string[]> {
    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        return (spreadsheet.data.sheets || [])
            .map((s: any) => s.properties.title || '')
            .filter((t: string) => 
                t &&
                !t.toLowerCase().includes('sku') && 
                !t.toLowerCase().includes('setting') &&
                !t.toLowerCase().includes('template') &&
                !t.toLowerCase().includes('helper') &&
                !t.toLowerCase().includes('list')
            );
    } catch (err) {
        return ['Sheet1'];
    }
}

/**
 * Utility to strip the 4-digit sequence from a document number for reporting
 * Format Examples: 
 * INV: B-094-INV-DTI-20260126-0027 -> B-094-INV-DTI-20260126
 * MoU: B-MoU-DTI-20260226-094-0028 -> B-MoU-DTI-20260226-094
 */
function stripDocNoSequence(docNo: string): string {
    if (!docNo) return '';
    const parts = docNo.split('-');

    // Both types currently have sequence at index 5
    if (parts.length >= 6) {
        const seqPart = parts[5];
        if (/^\d{4}/.test(seqPart)) {
            const remaining = seqPart.substring(4).trim();
            const newParts = [...parts];
            if (remaining) {
                newParts[5] = remaining; // Keep REV1, -R1, etc.
            } else {
                newParts.splice(5, 1);
            }
            return newParts.join('-').replace(/-$/, '');
        }
    }
    return docNo;
}

async function getLastRowDeep(sheets: any, spreadsheetId: string, sheetName: string): Promise<number> {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:A`,
        });

        const rows = response.data.values || [];
        return rows.length + 1;
    } catch (error) {
        console.error('Error fetching last row:', error);
        return 1;
    }
}

/**
 * AI-powered function to parse Google Sheets and find the latest document numbers
 */
export async function getLatestRefWithAI(type: 'INVOICE' | 'MOU', category: string, skipAI: boolean = false): Promise<{
    lastRef: number,
    lastSeq: number,
    lastDate?: string,
    skippedRefs: number[],
    skippedSeqs: number[],
    absoluteNextRef: number,
    absoluteNextSeq: number
}> {
    const sheets = await getSheetsService();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!sheets || !spreadsheetId) {
        console.warn('Missing dependencies for getLatestRefWithAI');
        return { 
            lastRef: 0, lastSeq: 0, skippedRefs: [], skippedSeqs: [],
            absoluteNextRef: 1, absoluteNextSeq: 1
        };
    }

    try {
        const sheetNames = await getAllRelevantSheetNames(sheets, spreadsheetId);
        const ranges = sheetNames.map(name => `${name}!A:P`);
        
        // 1. Fetch ALL relevant sheets in one batch
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
        });

        const allValueRanges = response.data.valueRanges || [];
        
        let maxRefFound = 0;
        let maxSeqFound = 0;
        let maxDateInt = 0; // Use integer comparison for YYYYMMDD dates
        let lastDateFound = '';
        const foundRefs = new Set<number>();
        const foundSeqs = new Set<number>();

        allValueRanges.forEach(vr => {
            const rows = vr.values || [];
            rows.forEach(row => {
                // Scan BOTH Col C (MOU) and Col D (Invoice)
                const docs = [
                    (row[2] || '').toString().trim(),
                    (row[3] || '').toString().trim()
                ];
                docs.forEach(docNo => {
                    if (!docNo || !docNo.startsWith(category + '-')) return;

                    const parts = docNo.split('-');
                    let r = 0, s = 0, d = '';

                    if (docNo.includes('-INV-')) {
                        if (parts.length >= 2) r = parseInt(parts[1]);
                        if (parts.length >= 5) d = parts[4].substring(0, 8);
                        if (parts.length >= 6) s = parseInt(parts[5]);
                    } else if (docNo.toLowerCase().includes('-mou-')) {
                        if (parts[1]?.toLowerCase() === 'mou') {
                            if (parts.length >= 4) d = parts[3].substring(0, 8);
                            if (parts.length >= 5) r = parseInt(parts[4]);
                            if (parts.length >= 6) s = parseInt(parts[5]);
                        } else if (parts[2]?.toLowerCase() === 'mou') {
                            if (parts.length >= 2) r = parseInt(parts[1]);
                            if (parts.length >= 5) d = parts[4].substring(0, 8);
                            if (parts.length >= 6) s = parseInt(parts[5]);
                        }
                    }

                    if (!isNaN(r) && r > 0 && r < 10000) {
                        maxRefFound = Math.max(maxRefFound, r);
                        foundRefs.add(r);
                    }
                    if (!isNaN(s) && s > 0 && s < 10000) {
                        const docMatchesType = (type === 'INVOICE' && docNo.includes('-INV-')) ||
                            (type === 'MOU' && docNo.toLowerCase().includes('-mou-'));
                        if (docMatchesType) {
                            maxSeqFound = Math.max(maxSeqFound, s);
                            foundSeqs.add(s);
                        }
                    }
                    if (d && d.length === 8 && !isNaN(parseInt(d))) {
                        const currentInt = parseInt(d);
                        if (currentInt > maxDateInt) {
                            maxDateInt = currentInt;
                            lastDateFound = d;
                        }
                    }
                });
            });
        });

        // 2. Database Check
        try {
            const latestDbDoc = await prisma.document.findFirst({
                where: {
                    type: type,
                    documentNo: { startsWith: `${category}-` }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (latestDbDoc) {
                const parts = latestDbDoc.documentNo.split('-');
                let dbSeq = 0;
                if (parts.length >= 6) dbSeq = parseInt(parts[5]);
                if (!isNaN(dbSeq) && dbSeq > maxSeqFound) {
                    maxSeqFound = dbSeq;
                    foundSeqs.add(dbSeq);
                }
                if (!lastDateFound && latestDbDoc.createdAt) {
                    lastDateFound = latestDbDoc.createdAt.toISOString().split('T')[0].replace(/-/g, '');
                }
            }
        } catch (dbErr) {
            console.error('Error fetching latest sequence from DB:', dbErr);
        }

        // 3. Gap Detection (bounded to prevent resetting to 1 if historical data is not present)
        const skippedRefs: number[] = [];
        const skippedSeqs: number[] = [];
        
        const refArray = Array.from(foundRefs);
        const seqArray = Array.from(foundSeqs);
        
        const minRefFound = refArray.length > 0 ? Math.min(...refArray) : 1;
        const minSeqFound = seqArray.length > 0 ? Math.min(...seqArray) : 1;

        // ONLY fill gaps between the min and max observed in the current sheets.
        // This prevents the system from blindly suggesting '1' if the active sheet starts at '68'.
        for (let i = minRefFound; i < maxRefFound; i++) { 
            if (!foundRefs.has(i)) skippedRefs.push(i); 
        }
        for (let i = minSeqFound; i < maxSeqFound; i++) { 
            if (!foundSeqs.has(i)) skippedSeqs.push(i); 
        }

        return {
            lastRef: maxRefFound,
            lastSeq: maxSeqFound,
            lastDate: lastDateFound,
            skippedRefs: skippedRefs.sort((a, b) => a - b),
            skippedSeqs: skippedSeqs.sort((a, b) => a - b),
            absoluteNextRef: maxRefFound + 1,
            absoluteNextSeq: maxSeqFound + 1
        };
    } catch (error) {
        console.error('Error in getLatestRefWithAI:', error);
        return { 
            lastRef: 0, lastSeq: 0, skippedRefs: [], skippedSeqs: [],
            absoluteNextRef: 1, absoluteNextSeq: 1
        };
    }
}

/**
 * Smart function to append or update a row based on REF merging logic
 */
export async function appendOrUpdateSheetRow(data: {
    type: 'INVOICE' | 'MOU',
    category: string,
    ref: string,
    docNo: string,
    amount: number,
    creatorName: string,
    bdName: string,
    status: string,
    fileUrl: string,
    formData?: any // Adding formData to extract more details
}) {
    const sheets = await getSheetsService();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!sheets || !spreadsheetId) return null;

    try {
        const sheetName = await getTargetSheetName(sheets, spreadsheetId);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:S`, // Extended to cover 19 columns (S is 19th)
        });

        const rows = response.data.values || [];
        const docNoToShow = data.type === 'MOU' ? stripDocNoSequence(data.docNo) : data.docNo;
        const docNoToMatch = stripDocNoSequence(data.docNo);
        const refPadded = data.ref.padStart(3, '0');

        let foundRowIndex = -1;

        // 1. First, check if this EXACT docNo already exists (handles re-writing/signing/manual upload)
        // We strip sequence from both sides to ensure matching even if one has it and the other doesn't
        for (let i = rows.length - 1; i >= 0; i--) {
            const mouDocNo = stripDocNoSequence((rows[i][2] || '').toString().trim());
            const invDocNo = stripDocNoSequence((rows[i][3] || '').toString().trim());
            if ((mouDocNo && mouDocNo === docNoToMatch) || (invDocNo && invDocNo === docNoToMatch)) {
                foundRowIndex = i + 1;
                break;
            }
        }

        // 2. If not found by docNo, fall back to REF-based merging logic
        if (foundRowIndex === -1) {
            // Helper: extract REF from a docNo string
            const extractRef = (docNo: string): string => {
                if (!docNo) return '';
                const parts = docNo.split('-');
                if (docNo.includes('-INV-') && parts.length >= 6) return parts[1]?.padStart(3, '0') || '';
                if (docNo.toLowerCase().includes('-mou-')) {
                    if (parts[1]?.toLowerCase() === 'mou' && parts.length >= 5) return parts[4]?.padStart(3, '0') || '';
                    if (parts[2]?.toLowerCase() === 'mou' && parts.length >= 6) return parts[1]?.padStart(3, '0') || '';
                }
                return '';
            };

            // Bidirectional merge: search BOTH Col C (MOU) and Col D (Invoice) for matching REF
            for (let i = rows.length - 1; i >= 0; i--) {
                const mouDocNo = (rows[i][2] || '').toString();  // Col C
                const invDocNo = (rows[i][3] || '').toString();  // Col D
                const mouRef = extractRef(mouDocNo);
                const invRef = extractRef(invDocNo);
                const rowCat = mouDocNo.split('-')[0] || invDocNo.split('-')[0] || '';

                if (rowCat !== data.category) continue;

                // If generating MOU and this row already has an Invoice with same REF → merge
                if (data.type === 'MOU' && invRef === refPadded && !mouDocNo) {
                    foundRowIndex = i + 1;
                    break;
                }
                // If generating INVOICE and this row already has a MOU with same REF → merge
                if (data.type === 'INVOICE' && mouRef === refPadded && !invDocNo) {
                    foundRowIndex = i + 1;
                    break;
                }
            }
        }

        const formData = data.formData || {};
        const d = new Date();
        // Date format: DD/MM/YYYY
        const dd = d.getDate().toString().padStart(2, '0');
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = d.getFullYear();
        const reportingDate = `${dd}/${mm}/${yyyy}`;
        // Due date: H+1 (next day)
        const due = new Date(d.getTime() + 24 * 60 * 60 * 1000);
        const dueDd = due.getDate().toString().padStart(2, '0');
        const dueMm = (due.getMonth() + 1).toString().padStart(2, '0');
        const dueDate = `${dueDd}/${dueMm}/${due.getFullYear()}`;

        const nameInBank = data.type === 'INVOICE' ? (formData.payment_details?.account_name || '') : (formData.account_holder || '');
        const bankName = data.type === 'INVOICE' ? (formData.payment_details?.bank_name || '') : (formData.bank_name || '');
        const city = data.type === 'INVOICE' ? (formData.payment_details?.kcp_kota || '') : (formData.kcp_kota || '');
        const accountNo = data.type === 'INVOICE' ? (formData.payment_details?.account_number || '') : (formData.account_number || '');
        const nik = data.type === 'INVOICE' ? (formData.nik || '') : (formData.party2_ktp || '');
        const npwp = formData.npwp || '';
        const amountFormatted = data.amount.toLocaleString('en-US');

        if (foundRowIndex !== -1) {
            // UPDATE EXISTING ROW (MERGE OR SIGN)
            const updateRequests = [];

            // Update Type: If it's an Invoice or both exist, mark as 'Invoice'
            updateRequests.push(sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!B${foundRowIndex}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[(data.type === 'INVOICE' || rows[foundRowIndex - 1][3]) ? 'Invoice' : 'MOU']] }
            }));

            // Update Doc Numbers
            if (data.type === 'MOU') {
                updateRequests.push(sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!C${foundRowIndex}`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [[docNoToShow]] }
                }));
            } else {
                updateRequests.push(sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!D${foundRowIndex}`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [[docNoToShow]] }
                }));
            }

            // Sync Stats (Amount, NIK, NPWP, Due Date, Bank Details)
            updateRequests.push(sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!K${foundRowIndex}:R${foundRowIndex}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[bankName, city, nameInBank, accountNo, amountFormatted, nik, npwp, dueDate]] }
            }));

            await Promise.all(updateRequests);

            // COLORING: If status is COMPLETED, color the row light green
            if (data.status.includes('COMPLETED')) {
                try {
                    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
                    const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === sheetName);
                    const sheetId = sheet?.properties?.sheetId ?? 0;

                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId,
                        requestBody: {
                            requests: [
                                {
                                    repeatCell: {
                                        range: {
                                            sheetId: sheetId,
                                            startRowIndex: foundRowIndex - 1,
                                            endRowIndex: foundRowIndex,
                                            startColumnIndex: 0,
                                            endColumnIndex: 19
                                        },
                                        cell: {
                                            userEnteredFormat: {
                                                backgroundColor: { red: 228 / 255, green: 237 / 255, blue: 219 / 255 }
                                            }
                                        },
                                        fields: 'userEnteredFormat.backgroundColor'
                                    }
                                }
                            ]
                        }
                    });
                } catch (colorErr) {
                    console.error('Error coloring row:', colorErr);
                }
            }

            return { updated: true, rowIndex: foundRowIndex };
        } else {
            // APPEND NEW ROW
            const newRow = [
                reportingDate,                                   // A
                data.type === 'MOU' ? 'MOU' : 'Invoice',        // B
                data.type === 'MOU' ? docNoToShow : '',          // C
                data.type === 'INVOICE' ? docNoToShow : '',      // D
                data.bdName,                                     // E
                data.creatorName,                                // F
                '',                                              // G — Nomor Task KMSS (kosong)
                '',                                              // H — DingTalk ref (kosong)
                '',                                              // I — kosong
                '',                                              // J — kosong
                bankName,                                        // K
                city,                                            // L
                nameInBank,                                      // M
                accountNo,                                       // N
                amountFormatted,                                 // O
                nik,                                             // P — NIK
                npwp,                                            // Q — NPWP
                dueDate,                                         // R — Due Date H+1
                'FALSE'                                          // S
            ];

            const nextRow = rows.length + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A${nextRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [newRow] }
            });

            // COLORING for new completed rows
            if (data.status.includes('COMPLETED')) {
                try {
                    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
                    const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === sheetName);
                    const sheetId = sheet?.properties?.sheetId ?? 0;

                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId,
                        requestBody: {
                            requests: [
                                {
                                    repeatCell: {
                                        range: {
                                            sheetId: sheetId,
                                            startRowIndex: nextRow - 1,
                                            endRowIndex: nextRow,
                                            startColumnIndex: 0,
                                            endColumnIndex: 19
                                        },
                                        cell: {
                                            userEnteredFormat: {
                                                backgroundColor: { red: 228 / 255, green: 237 / 255, blue: 219 / 255 }
                                            }
                                        },
                                        fields: 'userEnteredFormat.backgroundColor'
                                    }
                                }
                            ]
                        }
                    });
                } catch (colorErr) {
                    console.error('Error coloring row:', colorErr);
                }
            }

            return { appended: true, rowIndex: nextRow };
        }

    } catch (error) {
        console.error('Error in appendOrUpdateSheetRow:', error);
        return null;
    }
}

// Keeping legacy functions for backward compatibility but redirecting if possible
export async function appendToSheet(values: any[], sheetName: string = 'Sheet1') {
    const sheets = await getSheetsService();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!sheets || !spreadsheetId) return null;

    try {
        if (sheetName === 'Sheet1') sheetName = await getTargetSheetName(sheets, spreadsheetId);
        const nextRow = await getLastRowDeep(sheets, spreadsheetId, sheetName);
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${nextRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [values] },
        });
        return response.data;
    } catch (error) {
        console.error('Error appending to sheet:', error);
        return null;
    }
}

export async function findGlobalLastRef(type: 'INVOICE' | 'MOU', category: string): Promise<{ lastRef: number, lastSeq: number, lastDate?: string }> {
    const result = await getLatestRefWithAI(type, category);
    return {
        lastRef: result.lastRef,
        lastSeq: result.lastSeq,
        lastDate: result.lastDate
    };
}
export async function getAllReportedDocNos(sheetName: string = 'Sheet1'): Promise<string[]> {
    const sheets = await getSheetsService();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!sheets || !spreadsheetId) return [];

    try {
        if (sheetName === 'Sheet1') sheetName = await getTargetSheetName(sheets, spreadsheetId);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!C:D`,
        });

        const rows = response.data.values || [];
        const docNos: string[] = [];

        rows.forEach(row => {
            if (row[0]) docNos.push(row[0].toString().trim());
            if (row[1]) docNos.push(row[1].toString().trim());
        });

        return docNos;
    } catch (error) {
        console.error('Error fetching all reported doc numbers:', error);
        return [];
    }
}

export async function batchAppendToSheet(rows: any[][], sheetName: string = 'Sheet1') {
    const sheets = await getSheetsService();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!sheets || !spreadsheetId || rows.length === 0) return null;

    try {
        if (sheetName === 'Sheet1') sheetName = await getTargetSheetName(sheets, spreadsheetId);
        const nextRow = await getLastRowDeep(sheets, spreadsheetId, sheetName);
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${nextRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: rows },
        });
        return response.data;
    } catch (error) {
        console.error('Error batch appending to sheet:', error);
        return null;
    }
}

export async function checkReferenceInSheet(type: 'INVOICE' | 'MOU', category: string, refNum: string, sheetName: string = 'Sheet1'): Promise<{ owner: string, docNo: string } | null> {
    const sheets = await getSheetsService();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!sheets || !spreadsheetId) return null;

    try {
        if (sheetName === 'Sheet1') sheetName = await getTargetSheetName(sheets, spreadsheetId);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:G`, // Need at least A-G for owner and IDs
        });

        const rows = response.data.values || [];
        const targetRef = refNum.padStart(3, '0');

        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            if (!row || row.length < 4) continue;

            // Column C is MOU, D is Invoice
            const mouDocNo = (row[2] || '').toString();
            const invDocNo = (row[3] || '').toString();
            const docNo = type === 'MOU' ? mouDocNo : invDocNo;

            if (!docNo) continue;

            const parts = docNo.split('-');
            let refInDoc = '';

            if (parts[1]?.toLowerCase() === 'mou' || parts[2]?.toLowerCase() === 'mou') {
                // MOU formats
                if (parts[1]?.toLowerCase() === 'mou') refInDoc = parts[4];
                else refInDoc = parts[1];
            } else {
                // Invoice format: CAT-REF-INV...
                refInDoc = parts[1];
            }

            if (parts[0] === category && (refInDoc || '').padStart(3, '0') === targetRef) {
                return { owner: row[1] || 'N/A', docNo }; // Column B is Creator
            }
        }
        return null;
    } catch (error) {
        console.error('Error checking reference in sheet:', error);
        return null;
    }
}

export async function deleteRowFromSheet(docNo: string, sheetName: string = 'Sheet1') {
    const sheets = await getSheetsService();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!sheets || !spreadsheetId || !docNo) return null;

    try {
        if (sheetName === 'Sheet1') sheetName = await getTargetSheetName(sheets, spreadsheetId);
        // 1. Get the real sheetId for the given sheetName
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === sheetName);
        const sheetId = sheet?.properties?.sheetId ?? 0;

        // 2. Fetch the ID columns to find the match
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!C:D`,
        });

        const rows = response.data.values || [];
        const searchId = docNo.toString().trim();
        let rowIndexToDelete = -1;

        // Start from end to match latest if there are duplicates (though shouldn't be)
        for (let i = rows.length - 1; i >= 0; i--) {
            const colC = (rows[i][0] || '').toString().trim();
            const colD = (rows[i][1] || '').toString().trim();

            if (colC === searchId || colD === searchId) {
                rowIndexToDelete = i;
                break;
            }
        }

        if (rowIndexToDelete !== -1) {
            // // console.log(`[Sheets] Deleting row ${rowIndexToDelete + 1} for ID ${searchId}`);
            // 3. Command to delete the actual dimension (row)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: 'ROWS',
                                    startIndex: rowIndexToDelete,
                                    endIndex: rowIndexToDelete + 1,
                                },
                            },
                        },
                    ],
                },
            });
            return true;
        }

        console.warn(`[Sheets] Could not find row with ID: ${searchId} `);
        return false;
    } catch (error) {
        console.error('Error deleting row from sheet:', error);
        return false;
    }
}
