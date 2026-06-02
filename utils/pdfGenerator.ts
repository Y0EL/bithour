import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { InvoiceData } from '@/utils/types';
import { MOURenderRequest } from '@/utils/mouTypes';
import { uploadToS3 } from '@/lib/s3';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56.69;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const ty = (topY: number) => PAGE_HEIGHT - topY;

const wrapText = (text: string, maxWidth: number, font: any, fontSize: number): string[] => {
    const words = (text || "").split(' ');
    const lines: string[] = [];
    let currentLine = '';
    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else currentLine = testLine;
    });
    if (currentLine) lines.push(currentLine);
    return lines;
};

export async function generateInvoicePDF(data: InvoiceData, fileName: string) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Title "INVOICE"
    const titleFontSize = 16;
    const titleWidth = fontBold.widthOfTextAtSize('INVOICE', titleFontSize);
    page.drawText('INVOICE', {
        x: (PAGE_WIDTH - titleWidth) / 2,
        y: ty(70),
        size: titleFontSize,
        font: fontBold,
    });

    // HEADER BOXES
    const headerBoxY = 110;
    const headerBoxHeight = 100;
    const boxGap = 10;
    const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
    const boxPadding = 12;

    page.drawRectangle({
        x: MARGIN,
        y: ty(headerBoxY + headerBoxHeight),
        width: boxWidth,
        height: headerBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
    });

    let leftTextY = headerBoxY + boxPadding;
    page.drawText(`To : ${data.to?.name || ''}`, { x: MARGIN + boxPadding, y: ty(leftTextY), size: 10, font: fontBold });

    (data.to?.address_lines || []).forEach((line) => {
        const wrappedLines = wrapText(line || '', boxWidth - (boxPadding * 2), fontRegular, 9);
        wrappedLines.forEach(wLine => {
            leftTextY += 13;
            if (leftTextY < headerBoxY + headerBoxHeight - 5) {
                page.drawText(String(wLine || ''), { x: MARGIN + boxPadding, y: ty(leftTextY), size: 9, font: fontRegular });
            }
        });
    });

    page.drawRectangle({
        x: MARGIN + boxWidth + boxGap,
        y: ty(headerBoxY + headerBoxHeight),
        width: boxWidth,
        height: headerBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
    });

    let rightTextY = headerBoxY + boxPadding;
    const rightBoxX = MARGIN + boxWidth + boxGap + boxPadding;
    const cleanUsername = (data.from_username || '').replace(/^@/, '');
    const fromText = cleanUsername ? `${data.from_name || ''} (${cleanUsername})` : (data.from_name || '');
    page.drawText(`From : ${fromText}`, { x: rightBoxX, y: ty(rightTextY), size: 9, font: fontRegular });
    rightTextY += 18;
    page.drawText(`Invoice No. : ${data.invoice_no || ''}`, { x: rightBoxX, y: ty(rightTextY), size: 9, font: fontBold });
    rightTextY += 13;
    page.drawText(`Invoice Date : ${data.invoice_date || ''}`, { x: rightBoxX, y: ty(rightTextY), size: 9, font: fontRegular });

    // ITEM TABLE
    const tableTopY = 240;
    const colWidths = [30, 210, 50, 100, 91.9];
    const colX = [MARGIN, MARGIN + colWidths[0], MARGIN + colWidths[0] + colWidths[1], MARGIN + colWidths[0] + colWidths[1] + colWidths[2], MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]];
    const rowHeight = 22;

    page.drawRectangle({
        x: MARGIN, y: ty(tableTopY + rowHeight), width: CONTENT_WIDTH, height: rowHeight,
        borderColor: rgb(0, 0, 0), borderWidth: 1, color: rgb(0.95, 0.95, 0.95)
    });

    ['No.', 'Description', 'QTY', 'Unit Price', 'TOTAL (Rp)'].forEach((label, i) => {
        const textFontSize = i === 4 ? 8 : 9; // Slightly smaller for TOTAL (Rp) header
        const textWidth = fontBold.widthOfTextAtSize(label, textFontSize);
        let x = colX[i] + 5;
        if (i > 1) x = colX[i] + colWidths[i] - textWidth - 5;
        page.drawText(label, { x, y: ty(tableTopY + 15), size: textFontSize, font: fontBold });
        if (i > 0) {
            page.drawLine({
                start: { x: colX[i], y: ty(tableTopY) },
                end: { x: colX[i], y: ty(tableTopY + rowHeight) },
                thickness: 1, color: rgb(0, 0, 0),
            });
        }
    });

    let currentTableY = tableTopY + rowHeight;
    data.items.forEach((item, index) => {
        page.drawRectangle({ x: MARGIN, y: ty(currentTableY + rowHeight), width: CONTENT_WIDTH, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        page.drawText(String(item.no || index + 1), { x: colX[0] + 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });

        // Intelligent Description Shrinking
        const descText = String(item.description || '');
        const maxDescWidth = colWidths[1] - 10;
        let descFontSize = 9;
        let textWidth = fontRegular.widthOfTextAtSize(descText, descFontSize);

        while (textWidth > maxDescWidth && descFontSize > 6) {
            descFontSize -= 0.5;
            textWidth = fontRegular.widthOfTextAtSize(descText, descFontSize);
        }

        page.drawText(descText, {
            x: colX[1] + 5,
            y: ty(currentTableY + 15 + (9 - descFontSize) / 2), // Adjust vertical alignment slightly
            size: descFontSize,
            font: fontRegular
        });

        const qtyStr = String(item.qty || '0');
        page.drawText(qtyStr, { x: colX[2] + colWidths[2] - fontRegular.widthOfTextAtSize(qtyStr, 9) - 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
        const upStr = (item.unit_price || 0).toLocaleString();
        page.drawText(upStr, { x: colX[3] + colWidths[3] - fontRegular.widthOfTextAtSize(upStr, 9) - 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
        const totalStr = (item.total || 0).toLocaleString();
        page.drawText(totalStr, { x: colX[4] + colWidths[4] - fontRegular.widthOfTextAtSize(totalStr, 9) - 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
        for (let i = 1; i < colX.length; i++) {
            page.drawLine({ start: { x: colX[i], y: ty(currentTableY) }, end: { x: colX[i], y: ty(currentTableY + rowHeight) }, thickness: 1, color: rgb(0, 0, 0) });
        }
        currentTableY += rowHeight;
    });

    for (let j = 0; j < 2; j++) {
        page.drawRectangle({ x: MARGIN, y: ty(currentTableY + rowHeight), width: CONTENT_WIDTH, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        for (let i = 1; i < colX.length; i++) {
            page.drawLine({ start: { x: colX[i], y: ty(currentTableY) }, end: { x: colX[i], y: ty(currentTableY + rowHeight) }, thickness: 1, color: rgb(0, 0, 0) });
        }
        currentTableY += rowHeight;
    }

    const totalBoxWidth = colWidths[2] + colWidths[3] + colWidths[4]; // Start from QTY column
    const totalBoxX = colX[2];
    page.drawRectangle({ x: totalBoxX, y: ty(currentTableY + rowHeight), width: totalBoxWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
    page.drawText('SUB TOTAL', { x: totalBoxX + 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
    const stStr = `Rp ${data.sub_total.toLocaleString()}`;
    page.drawText(stStr, { x: colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(stStr, 9) - 5, y: ty(currentTableY + 15), size: 9, font: fontBold });
    page.drawLine({ start: { x: colX[4], y: ty(currentTableY) }, end: { x: colX[4], y: ty(currentTableY + rowHeight) }, thickness: 1, color: rgb(0, 0, 0) });
    currentTableY += rowHeight;

    page.drawRectangle({ x: totalBoxX, y: ty(currentTableY + rowHeight), width: totalBoxWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1, color: rgb(0.95, 0.95, 0.95) });
    page.drawText('TOTAL DUE', { x: totalBoxX + 5, y: ty(currentTableY + 15), size: 9, font: fontBold });
    const tdStr = `Rp ${data.total_due.toLocaleString()}`;
    page.drawText(tdStr, { x: colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(tdStr, 11) - 5, y: ty(currentTableY + 16), size: 11, font: fontBold });
    page.drawLine({ start: { x: colX[4], y: ty(currentTableY) }, end: { x: colX[4], y: ty(currentTableY + rowHeight) }, thickness: 1, color: rgb(0, 0, 0) });

    if (data.is_dp && data.dp_percentage) {
        currentTableY += rowHeight;
        page.drawRectangle({ x: totalBoxX, y: ty(currentTableY + rowHeight), width: totalBoxWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        const dpLabel = `DONE PAYMENT (${data.dp_percentage}%)`;
        page.drawText(dpLabel, { x: totalBoxX + 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
        const dpValue = `Rp ${data.done_payment?.toLocaleString()}`;
        page.drawText(dpValue, { x: colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(dpValue, 9) - 5, y: ty(currentTableY + 15), size: 9, font: fontBold });
        page.drawLine({ start: { x: colX[4], y: ty(currentTableY) }, end: { x: colX[4], y: ty(currentTableY + rowHeight) }, thickness: 1, color: rgb(0, 0, 0) });

        currentTableY += rowHeight;
        page.drawRectangle({ x: totalBoxX, y: ty(currentTableY + rowHeight), width: totalBoxWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        const remLabel = `REMAINING PAYMENT (${100 - data.dp_percentage}%)`;
        page.drawText(remLabel, { x: totalBoxX + 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
        const remValue = `Rp ${data.remaining_payment?.toLocaleString()}`;
        page.drawText(remValue, { x: colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(remValue, 9) - 5, y: ty(currentTableY + 15), size: 9, font: fontBold });
        page.drawLine({ start: { x: colX[4], y: ty(currentTableY) }, end: { x: colX[4], y: ty(currentTableY + rowHeight) }, thickness: 1, color: rgb(0, 0, 0) });
    }

    const footerY = currentTableY + 45;
    page.drawText('PAYMENT DETAILS', { x: MARGIN, y: ty(footerY), size: 8, font: fontBold });
    let pY = footerY + 20;

    const isVA = data.payment_details.bank_name?.toLowerCase().includes('virtual account') ||
        data.payment_details.bank_name?.toLowerCase().includes('dana') ||
        data.payment_details.bank_name?.toLowerCase().includes('gopay') ||
        data.payment_details.bank_name?.toLowerCase().includes('ovo') ||
        data.payment_details.bank_name?.toLowerCase().includes('shopeepay');
    const accLabel = isVA ? 'Virtual Account' : 'Account Number';
    const swiftCode = isVA ? '' : (data.payment_details.swift_code || '-');

    const paymentLines = [
        `Bank Name : ${data.payment_details.bank_name}`,
        `Nama Penerima : ${data.payment_details.account_name}`,
        `${accLabel} : ${data.payment_details.account_number}`,
        `SWIFT Code : ${swiftCode}`,
        `KCP/Kota : ${data.payment_details.kcp_kota}`
    ];

    paymentLines.forEach(line => {
        page.drawText(line, { x: MARGIN, y: ty(pY), size: 9, font: fontRegular });
        pY += 18;
    });

    const sigX = MARGIN + boxWidth + 10;
    page.drawText('SIGNATURE', { x: sigX, y: ty(footerY), size: 8, font: fontBold });

    let signatureHeightOffset = 60; // Space reserved for signature image

    if (data.signature.image_base64) {
        try {
            const base64Data = data.signature.image_base64.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const trimmedBuffer = await sharp(buffer).trim().toBuffer();
            const sigImage = await pdfDoc.embedPng(trimmedBuffer);
            const { width, height } = sigImage.scaleToFit(140, 50);

            // Draw image centered in the reserved space
            const imageY = footerY + 10 + (50 - height) / 2;
            page.drawImage(sigImage, {
                x: sigX,
                y: ty(imageY + height),
                width,
                height
            });
        } catch (error) {
            console.error("Error drawing signature image:", error);
        }
    }

    page.drawText(String(data.signature.name || ''), { x: sigX, y: ty(footerY + 10 + 50 + 25), size: 9, font: fontBold });
    page.drawText(String(data.invoice_date || ''), { x: sigX, y: ty(footerY + 10 + 50 + 38), size: 8, font: fontBold });

    const pdfBytes = await pdfDoc.save();

    // Upload to S3 (Backblaze)
    try {
        // console.log(`[PDF] Starting S3 upload for Invoice: ${fileName}`);
        const s3Url = await uploadToS3(Buffer.from(pdfBytes), `invoices/${fileName}`, 'application/pdf');
        // console.log(`[PDF] S3 upload successful: ${s3Url}`);
        return s3Url;
    } catch (error: any) {
        console.error("[PDF] S3 Upload FAILED, falling back to local storage:", error.message);
        // Fallback to local if S3 fails
        const filePath = path.join(process.cwd(), 'public', 'invoices', fileName);
        if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, pdfBytes);

        const origin = process.env.NEXTAUTH_URL || 'https://crowncare.site';
        const fallbackUrl = `${origin.endsWith('/') ? origin.slice(0, -1) : origin}/invoices/${fileName}`;
        // console.log(`[PDF] Local fallback saved at: ${fallbackUrl}`);
        return fallbackUrl;
    }
}

const PERMANENT_ACCOUNTS = [
    "crowncare.id",
    "crowncare_sisirpewarna",
    "Crowncare003",
    "Crowncare004",
    "Crowncare005",
    "Crowncare006",
    "Crowncare008",
    "Crowncareindo",
    "Crowncareofficial1",
    "Crowncarecolorpro",
    "Crowncare007",
    "Syaahaircare",
    "Hairlinepro",
    "Crowncare.hair.care",
    "eztusgnjt5w"
];

function drawAlignedField(page: any, label: string, value: string, x: number, startY: number, fontSize: number, labelWidth: number, regularFont: any, boldFont: any, checkPageBreak: (s: number) => boolean, ty: (y: number) => number): number {
    const lineHeight = fontSize * 1.35;
    let localY = startY;

    // Draw Label (Regular)
    page.drawText(label, { x, y: ty(localY), size: fontSize, font: regularFont });

    // Draw Colon at fixed offset
    const colonX = x + labelWidth;
    page.drawText(":", { x: colonX, y: ty(localY), size: fontSize, font: regularFont });

    // Calculate available width for value
    const valueX = colonX + 10;
    const valueMaxWidth = PAGE_WIDTH - MARGIN - valueX;

    // Wrap the value
    const words = (value || "").split(' ');
    const lines: string[] = [];
    let currentLine = '';
    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (regularFont.widthOfTextAtSize(testLine, fontSize) > valueMaxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else currentLine = testLine;
    });
    if (currentLine) lines.push(currentLine);

    lines.forEach((line, idx) => {
        if (idx > 0) {
            localY += lineHeight;
            checkPageBreak(lineHeight);
        }

        // drawRichText
        const terms = ["Pihak Pertama", "Pihak Kedua", "PIHAK PERTAMA", "PIHAK KEDUA"];
        let cx = valueX;
        const parts = line.split(/(Pihak Pertama|Pihak Kedua|PIHAK PERTAMA|PIHAK KEDUA)/g);
        parts.forEach(part => {
            const font = terms.includes(part) ? boldFont : regularFont;
            page.drawText(String(part || ''), { x: cx, y: ty(localY), size: fontSize, font });
            cx += font.widthOfTextAtSize(String(part || ''), fontSize);
        });
    });

    return localY + lineHeight;
}

export async function generateMOUPDF(data: MOURenderRequest, fileName: string, signatureBase64: string) {
    const fields = data.fields;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const BODY_SIZE = 13.5;
    const TITLE_SIZE = 17;
    const SUBTITLE_SIZE = 16;
    let currentY = 56.69;

    const checkPageBreak = (neededSpace: number) => {
        if (currentY + neededSpace > PAGE_HEIGHT - 56.69) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            currentY = 56.69;
            return true;
        }
        return false;
    };

    const wrapText = (text: string, maxWidth: number, font: any, fontSize: number): string[] => {
        const words = (text || "").split(' ');
        const lines: string[] = [];
        let currentLine = '';
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else currentLine = testLine;
        });
        if (currentLine) lines.push(currentLine);
        return lines;
    };

    const drawRichText = (p: any, text: string, x: number, y: number, fontSize: number, rf: any, bf: any) => {
        const terms = ["Pihak Pertama", "Pihak Kedua", "PIHAK PERTAMA", "PIHAK KEDUA"];
        let cx = x;
        const parts = String(text || '').split(/(Pihak Pertama|Pihak Kedua|PIHAK PERTAMA|PIHAK KEDUA)/g);
        parts.forEach(part => {
            const font = terms.includes(part) ? bf : rf;
            p.drawText(String(part || ''), { x: cx, y, size: fontSize, font });
            cx += font.widthOfTextAtSize(String(part || ''), fontSize);
        });
    };

    // TITLE
    const tWidth = fontBold.widthOfTextAtSize('PERJANJIAN ALIH HAK CIPTA', TITLE_SIZE);
    page.drawText('PERJANJIAN ALIH HAK CIPTA', { x: (PAGE_WIDTH - tWidth) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 28;
    const mLabel = `Nomor: ${fields.mou_number || ''}`;
    const mWidth = fontBold.widthOfTextAtSize(mLabel, SUBTITLE_SIZE);
    page.drawText(mLabel, { x: (PAGE_WIDTH - mWidth) / 2, y: ty(currentY), size: SUBTITLE_SIZE, font: fontBold });
    currentY += 45;

    // OPENING
    const cleanMOUUsername = (fields.party2_username || '').replace(/^@/, '');
    wrapText(`Perjanjian ini (Perjanjian Alih Hak Cipta CrownCare X ${cleanMOUUsername}) dibuat dan ditandatangani pada ${fields.agreement_date} oleh dan antara:`, CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
        checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
    });
    currentY += 25;

    // PIHAK PERTAMA
    page.drawText('Pihak Pertama (Penerima Konten):', { x: 56.69, y: ty(currentY), size: SUBTITLE_SIZE, font: fontBold });
    currentY += 22;
    currentY = drawAlignedField(page, 'Nama', fields.party1_name, 56.69, currentY, BODY_SIZE, 120, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Perusahaan', fields.party1_company, 56.69, currentY, BODY_SIZE, 120, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Jabatan', fields.party1_position, 56.69, currentY, BODY_SIZE, 120, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Alamat', fields.party1_address, 56.69, currentY, BODY_SIZE, 120, fontRegular, fontBold, checkPageBreak, ty);
    currentY += 10;
    drawRichText(page, 'Selanjutnya disebut sebagai "PIHAK PERTAMA"', 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold);
    currentY += 30;

    // PIHAK KEDUA
    page.drawText('Pihak Kedua (Pembuat Konten):', { x: 56.69, y: ty(currentY), size: SUBTITLE_SIZE, font: fontBold });
    currentY += 22;
    currentY = drawAlignedField(page, 'Nama', fields.party2_name, 56.69, currentY, BODY_SIZE, 120, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Nomor KTP', fields.party2_ktp, 56.69, currentY, BODY_SIZE, 120, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Alamat', fields.party2_address, 56.69, currentY, BODY_SIZE, 120, fontRegular, fontBold, checkPageBreak, ty);
    currentY += 10;
    drawRichText(page, 'Selanjutnya disebut sebagai "PIHAK KEDUA"', 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold);
    currentY += 35;

    // MANDATORY PAGE BREAK
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    currentY = 56.69;

    // PASAL 1
    const p1 = 'Pasal 1'; page.drawText(p1, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p1, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 25;
    const p1t = 'Objek Alih Hak Cipta'; page.drawText(p1t, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p1t, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 30;
    wrapText('Pihak Kedua menyatakan bahwa ia adalah pemilik sah atas konten video orisinal dengan rincian sebagai berikut:', CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
        checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
    });
    currentY += 10;
    currentY = drawAlignedField(page, 'Judul/Nama Konten', fields.content_title, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Jenis Konten', fields.content_type, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Tanggal Pembuatan', fields.creation_date, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
    currentY = drawAlignedField(page, 'Durasi', fields.duration, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
    currentY += 25;

    // PASAL 2: Ruang Lingkup
    checkPageBreak(150);
    const p2Header = 'Pasal 2'; page.drawText(p2Header, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p2Header, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 25;
    const p2Title = 'Ruang Lingkup Kerja Sama'; page.drawText(p2Title, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p2Title, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 30;
    const pasal2Items = [
        '2.1 Pihak Kedua menyatakan bahwa video tersebut merupakan karya orisinal miliknya dan bebas dari tuntutan atau klaim pihak ketiga.',
        '2.2 Pihak Kedua menjamin bahwa video tidak melanggar hak cipta, merek dagang, atau hak lainnya dari pihak manapun.',
        '2.3 Pihak Pertama berhak mengunggah video ke platform miliknya, akun penerima izin:',
    ];
    pasal2Items.forEach(item => {
        wrapText(item, CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
            checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
        });
    });
    currentY += 5;
    PERMANENT_ACCOUNTS.forEach(account => {
        checkPageBreak(18);
        page.drawText('\u2022', { x: 56.69 + 20, y: ty(currentY), size: BODY_SIZE, font: fontRegular });
        page.drawText(account, { x: 56.69 + 35, y: ty(currentY), size: BODY_SIZE, font: fontRegular });
        currentY += 18;
    });
    currentY += 10;
    ['2.4 Pihak Pertama berhak mengedit dan menggunakan video untuk keperluan promosi;', '2.5 Pihak Pertama berhak mendistribusikan ulang tanpa mengubah makna atau memalsukan isi video.'].forEach(right => {
        wrapText(right, CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
            checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
        });
    });
    currentY += 25;

    // PASAL 3: Alih Hak Cipta
    checkPageBreak(150);
    const p3Header = 'Pasal 3'; page.drawText(p3Header, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p3Header, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 25;
    const p3Title = 'Alih Hak Cipta'; page.drawText(p3Title, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p3Title, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 30;
    ['3.1 Pihak Kedua dengan ini mengalihkan seluruh hak cipta (hak moral dan hak ekonomi) atas video sebagaimana dimaksud dalam Pasal 1 kepada Pihak Pertama', '3.2 Pengalihan ini bersifat penuh, permanen, tidak terbatas waktu dan wilayah, dan meliputi:'].forEach(item => {
        wrapText(item, CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
            checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
        });
    });
    ['- Hak untuk memperbanyak dan menyebarluaskan;', '- Hak untuk mengubah, mengedit, memotong, atau menggabungkan;', '- Hak untuk menayangkan di semua platform media;', '- Hak untuk memberikan hak lanjutan (sub-license) kepada pihak ketiga.'].forEach(right => {
        checkPageBreak(18); drawRichText(page, right, 56.69 + 15, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
    });
    wrapText('3.3 Sejak tanggal penandatanganan Perjanjian ini dan setelah kompensasi dibayarkan, Pihak Kedua tidak lagi memiliki hak atas video tersebut, dan tidak dapat menggunakannya tanpa izin tertulis dari Pihak Pertama', CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
        checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
    });
    currentY += 25;

    // PASAL 4: Kompensasi (Moved original Pasal 5 logic here as Pasal 4 to match agreement flow or kept as Pasal 5)
    // Actually standard in the route was Pasal 4 for Kompensasi, then 5 for Dispute, 6 for Misc.
    // I'll follow the route's structure as it's the "master" reference.

    checkPageBreak(120);
    const p4H = 'Pasal 4'; page.drawText(p4H, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p4H, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 25;
    const p4T = 'Kompensasi'; page.drawText(p4T, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p4T, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 30;

    if (fields.is_paid) {
        wrapText(`Atas penyerahan hak cipta konten sebagaimana dimaksud dalam Pasal 1, PIHAK PERTAMA setuju untuk memberikan kompensasi kepada PIHAK KEDUA sebesar Rp ${fields.compensation_amount} (${fields.compensation_in_words}).`, CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
            checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
        });
        currentY += 10;
        wrapText('Pembayaran akan dilakukan melalui transfer ke rekening bank PIHAK KEDUA dengan rincian sebagai berikut:', CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
            checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
        });
        currentY += 10;
        const isMOUVA = fields.bank_name?.toLowerCase().includes('virtual account') ||
            fields.bank_name?.toLowerCase().includes('dana') ||
            fields.bank_name?.toLowerCase().includes('gopay') ||
            fields.bank_name?.toLowerCase().includes('ovo') ||
            fields.bank_name?.toLowerCase().includes('shopeepay');
        const mouAccLabel = isMOUVA ? 'Virtual Account' : 'Nomor Rekening';

        currentY = drawAlignedField(page, 'Nama Bank', fields.bank_name, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, mouAccLabel, fields.account_number, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Nama Pemilik', fields.account_holder, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'KCP / Kota', fields.kcp_kota, 56.69, currentY, BODY_SIZE, 140, fontRegular, fontBold, checkPageBreak, ty);
    } else {
        wrapText('Kedua Belah Pihak sepakat bahwa pengalihan hak cipta ini dilakukan tanpa kompensasi biaya (Pro-bono/Unpaid collab).', CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
            checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
        });
    }
    currentY += 25;

    // PASAL 5: Penyelesaian Permasalahan
    checkPageBreak(120);
    const p5Header = 'Pasal 5'; page.drawText(p5Header, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p5Header, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 25;
    const p5Title = 'Penyelesaian Permasalahan'; page.drawText(p5Title, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p5Title, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 30;
    wrapText('Segala perselisihan yang timbul akibat Perjanjian ini akan diselesaikan terlebih dahulu secara musyawarah. Apabila tidak tercapai mufakat, maka akan diselesaikan melalui pengadilan negeri di wilayah hukum DKI Jakarta, sesuai hukum yang berlaku di Republik Indonesia.', CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
        checkPageBreak(18); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 18;
    });
    currentY += 25;

    // PASAL 6: Lain-Lain
    checkPageBreak(150);
    const p6Header = 'Pasal 6'; page.drawText(p6Header, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p6Header, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 25;
    const p6Title = 'Lain-Lain'; page.drawText(p6Title, { x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(p6Title, TITLE_SIZE)) / 2, y: ty(currentY), size: TITLE_SIZE, font: fontBold });
    currentY += 30;
    ['Perjanjian ini mengikat kedua belah pihak dan ahli warisnya.', 'Perjanjian ini dibuat dalam 2 (dua) rangkap asli dan memiliki kekuatan hukum yang sama.', 'Hal-hal yang belum diatur dalam Perjanjian ini akan dibicarakan dan disepakati secara tertulis oleh kedua belah pihak.'].forEach(item => {
        wrapText(item, CONTENT_WIDTH, fontRegular, BODY_SIZE).forEach(line => {
            checkPageBreak(15); drawRichText(page, line, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold); currentY += 15;
        });
    });
    currentY += 35;

    // SIGNATURES
    const displaySignDate = `${fields.sign_location || 'Jakarta'}, ${fields.sign_date || ''}`;
    drawRichText(page, displaySignDate, 56.69, ty(currentY), BODY_SIZE, fontRegular, fontBold);
    currentY += 30;
    drawRichText(page, 'PIHAK PERTAMA', 56.69, ty(currentY), 10, fontRegular, fontBold);
    drawRichText(page, 'PIHAK KEDUA', 56.69 + CONTENT_WIDTH / 2 + 20, ty(currentY), 10, fontRegular, fontBold);
    currentY += 15;

    try {
        const xfPath = path.join(process.cwd(), 'public', 'xf.png');
        if (fs.existsSync(xfPath)) {
            const xfImage = await pdfDoc.embedPng(await sharp(fs.readFileSync(xfPath)).trim().toBuffer());
            const { width, height } = xfImage.scaleToFit(200, 40);
            page.drawImage(xfImage, { x: 56.69, y: ty(currentY + 5 + (40 + height) / 2), width, height });
        }
    } catch { }

    if (signatureBase64) {
        try {
            const sigImage = await pdfDoc.embedPng(await sharp(Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ''), 'base64')).trim().toBuffer());
            const { width, height } = sigImage.scaleToFit(200, 40);
            page.drawImage(sigImage, { x: 56.69 + CONTENT_WIDTH / 2 + 20, y: ty(currentY + 5 + (40 + height) / 2), width, height });
        } catch { }
    }

    currentY += 65; // Increased distance from 50 to 65
    page.drawText('Bithour Production', { x: 56.69, y: ty(currentY), size: 12, font: fontBold });
    page.drawText(String(fields.party2_name || ''), { x: 56.69 + CONTENT_WIDTH / 2 + 20, y: ty(currentY), size: 12, font: fontBold });
    currentY += 15;
    page.drawText('PT. Bithour Production Indonesia', { x: 56.69, y: ty(currentY), size: 10, font: fontRegular });
    page.drawText('Kreator Eksklusif', { x: 56.69 + CONTENT_WIDTH / 2 + 20, y: ty(currentY), size: 10, font: fontRegular });

    const pdfBytes = await pdfDoc.save();

    // Upload to S3 (Backblaze)
    try {
        // console.log(`[MOU] Starting S3 upload for: ${fileName}`);
        const s3Url = await uploadToS3(Buffer.from(pdfBytes), `mou/${fileName}`, 'application/pdf');
        // console.log(`[MOU] S3 upload successful: ${s3Url}`);
        return s3Url;
    } catch (error: any) {
        console.error("[MOU] S3 Upload FAILED, falling back to local storage:", error.message);
        const filePath = path.join(process.cwd(), 'public', 'mou', fileName);
        if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, Buffer.from(pdfBytes));

        const origin = process.env.NEXTAUTH_URL || 'https://crowncare.site';
        const fallbackUrl = `${origin.endsWith('/') ? origin.slice(0, -1) : origin}/mou/${fileName}`;
        // console.log(`[MOU] Local fallback saved at: ${fallbackUrl}`);
        return fallbackUrl;
    }
}
