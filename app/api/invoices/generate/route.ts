import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { InvoiceData } from '@/utils/types';

// A4 dimensions in points
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56.69;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Helper to convert top-down Y coordinates to pdf-lib bottom-up coordinates
const ty = (topY: number) => PAGE_HEIGHT - topY;

export async function POST(req: NextRequest) {
    try {
        const data: InvoiceData = await req.json();

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // 1. Title "INVOICE"
        const title = 'INVOICE';
        const titleFontSize = 16;
        const titleWidth = fontBold.widthOfTextAtSize(title, titleFontSize);
        page.drawText(title, {
            x: (PAGE_WIDTH - titleWidth) / 2,
            y: ty(70),
            size: titleFontSize,
            font: fontBold,
        });

        // 2. HEADER BOXES (MANDATORY BORDERS)
        const headerBoxY = 110;
        const headerBoxHeight = 100;
        const boxGap = 10;
        const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
        const boxPadding = 12; // Internal padding

        // Left Box (TO)
        page.drawRectangle({
            x: MARGIN,
            y: ty(headerBoxY + headerBoxHeight),
            width: boxWidth,
            height: headerBoxHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });

        let leftTextY = headerBoxY + boxPadding;
        page.drawText(`To : ${data.to.name}`, {
            x: MARGIN + boxPadding,
            y: ty(leftTextY),
            size: 10,
            font: fontBold,
        });

        data.to.address_lines.forEach((line) => {
            leftTextY += 13;
            page.drawText(line, {
                x: MARGIN + boxPadding,
                y: ty(leftTextY),
                size: 9,
                font: fontRegular,
            });
        });

        // Right Box (FROM / INVOICE INFO)
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

        const fromText = data.from_username ? `${data.from_name} (${data.from_username})` : data.from_name;
        page.drawText(`From : ${fromText}`, { x: rightBoxX, y: ty(rightTextY), size: 9, font: fontRegular });
        rightTextY += 18;
        page.drawText(`Invoice No. : ${data.invoice_no}`, { x: rightBoxX, y: ty(rightTextY), size: 9, font: fontBold });
        rightTextY += 13;
        page.drawText(`Invoice Date : ${data.invoice_date}`, { x: rightBoxX, y: ty(rightTextY), size: 9, font: fontRegular });

        // 3. ITEM TABLE (STRICT GRID)
        const tableTopY = 240;
        const colWidths = [30, 240, 50, 70, 91.9]; // Total must be 481.9 (CONTENT_WIDTH)
        const colX = [
            MARGIN,
            MARGIN + colWidths[0],
            MARGIN + colWidths[0] + colWidths[1],
            MARGIN + colWidths[0] + colWidths[1] + colWidths[2],
            MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        ];

        const rowHeight = 22;

        // Header row background/border
        page.drawRectangle({
            x: MARGIN,
            y: ty(tableTopY + rowHeight),
            width: CONTENT_WIDTH,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
            color: rgb(0.95, 0.95, 0.95)
        });

        // Column Labels
        const labels = ['No.', 'Description', 'QTY', 'Unit Price', 'TOTAL (Rp)'];
        labels.forEach((label, i) => {
            const textWidth = fontBold.widthOfTextAtSize(label, 9);
            let x = colX[i] + 5;
            if (i > 1) { // Right-align numeric headers
                x = colX[i] + colWidths[i] - textWidth - 5;
            }
            page.drawText(label, { x, y: ty(tableTopY + 15), size: 9, font: fontBold });

            // Vertical grid lines for headers
            if (i > 0) {
                page.drawLine({
                    start: { x: colX[i], y: ty(tableTopY) },
                    end: { x: colX[i], y: ty(tableTopY + rowHeight) },
                    thickness: 1,
                    color: rgb(0, 0, 0),
                });
            }
        });

        // Rows
        let currentTableY = tableTopY + rowHeight;
        data.items.forEach((item, index) => {
            // Row box
            page.drawRectangle({
                x: MARGIN,
                y: ty(currentTableY + rowHeight),
                width: CONTENT_WIDTH,
                height: rowHeight,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1,
            });

            // Data
            page.drawText(item.no.toString(), { x: colX[0] + 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
            page.drawText(item.description, { x: colX[1] + 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });

            const qtyStr = item.qty.toString();
            page.drawText(qtyStr, {
                x: colX[2] + colWidths[2] - fontRegular.widthOfTextAtSize(qtyStr, 9) - 5,
                y: ty(currentTableY + 15), size: 9, font: fontRegular
            });

            const upStr = item.unit_price.toLocaleString();
            page.drawText(upStr, {
                x: colX[3] + colWidths[3] - fontRegular.widthOfTextAtSize(upStr, 9) - 5,
                y: ty(currentTableY + 15), size: 9, font: fontRegular
            });

            const totalStr = item.total.toLocaleString();
            page.drawText(totalStr, {
                x: colX[4] + colWidths[4] - fontRegular.widthOfTextAtSize(totalStr, 9) - 5,
                y: ty(currentTableY + 15), size: 9, font: fontRegular
            });

            // Vertical grid lines for rows
            for (let i = 1; i < colX.length; i++) {
                page.drawLine({
                    start: { x: colX[i], y: ty(currentTableY) },
                    end: { x: colX[i], y: ty(currentTableY + rowHeight) },
                    thickness: 1,
                    color: rgb(0, 0, 0),
                });
            }

            currentTableY += rowHeight;
        });

        // Draw 2 Empty Spacer Rows (Vertical space as requested)
        for (let j = 0; j < 2; j++) {
            page.drawRectangle({
                x: MARGIN,
                y: ty(currentTableY + rowHeight),
                width: CONTENT_WIDTH,
                height: rowHeight,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1,
            });
            // Vertical grid lines for empty rows
            for (let i = 1; i < colX.length; i++) {
                page.drawLine({
                    start: { x: colX[i], y: ty(currentTableY) },
                    end: { x: colX[i], y: ty(currentTableY + rowHeight) },
                    thickness: 1,
                    color: rgb(0, 0, 0),
                });
            }
            currentTableY += rowHeight;
        }

        // 4. TOTALS SECTION (Bordered)
        const totalBoxWidth = colWidths[3] + colWidths[4];
        const totalBoxX = colX[3];

        // Subtotal Row
        page.drawRectangle({
            x: totalBoxX,
            y: ty(currentTableY + rowHeight),
            width: totalBoxWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });
        page.drawText('SUB TOTAL', { x: totalBoxX + 5, y: ty(currentTableY + 15), size: 9, font: fontRegular });
        const stStr = `Rp ${data.sub_total.toLocaleString()}`;
        page.drawText(stStr, {
            x: colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(stStr, 9) - 5,
            y: ty(currentTableY + 15), size: 9, font: fontBold
        });
        // Vertical line in total box
        page.drawLine({
            start: { x: colX[4], y: ty(currentTableY) },
            end: { x: colX[4], y: ty(currentTableY + rowHeight) },
            thickness: 1,
            color: rgb(0, 0, 0),
        });

        currentTableY += rowHeight;

        // Total Due Row
        page.drawRectangle({
            x: totalBoxX,
            y: ty(currentTableY + rowHeight),
            width: totalBoxWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
            color: rgb(0.95, 0.95, 0.95)
        });
        page.drawText('TOTAL DUE', { x: totalBoxX + 5, y: ty(currentTableY + 15), size: 9, font: fontBold });
        const tdStr = `Rp ${data.total_due.toLocaleString()}`;
        page.drawText(tdStr, {
            x: colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(tdStr, 11) - 5,
            y: ty(currentTableY + 16), size: 11, font: fontBold
        });
        page.drawLine({
            start: { x: colX[4], y: ty(currentTableY) },
            end: { x: colX[4], y: ty(currentTableY + rowHeight) },
            thickness: 1,
            color: rgb(0, 0, 0),
        });

        // 5. FOOTER (COMPACT & TEXT-BASED)
        const footerYOffset = 45; // Lowered gap
        const footerY = currentTableY + footerYOffset;

        // Payment Details (No Box)
        let pY = footerY;
        page.drawText('PAYMENT DETAILS', { x: MARGIN, y: ty(pY), size: 8, font: fontBold });
        pY += 20;
        const details = [
            `Bank Name : ${data.payment_details.bank_name}`,
            `Account Name : ${data.payment_details.account_name}`,
            `Account Number : ${data.payment_details.account_number}`,
            `SWIFT Code : ${data.payment_details.swift_code || '-'}`,
            `KCP/Kota : ${data.payment_details.kcp_kota}`
        ];
        details.forEach(line => {
            page.drawText(line, { x: MARGIN, y: ty(pY), size: 9, font: fontRegular });
            pY += 18;
        });

        // Signature Area (No Box)
        const sigX = MARGIN + boxWidth + boxGap;
        page.drawText('SIGNATURE', { x: sigX, y: ty(footerY), size: 8, font: fontBold });

        const actualSigBoxW = 140;
        const actualSigBoxH = 50;
        const sigBoxYOffset = footerY + 10;

        if (data.signature.image_base64) {
            const base64Data = data.signature.image_base64.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const trimmedBuffer = await sharp(buffer).trim().toBuffer();
            const sigImage = await pdfDoc.embedPng(trimmedBuffer);
            const { width, height } = sigImage.scaleToFit(actualSigBoxW, actualSigBoxH);

            // Draw image directly (no placeholder box/border)
            page.drawImage(sigImage, {
                x: sigX,
                y: ty(sigBoxYOffset + (actualSigBoxH + height) / 2),
                width,
                height,
            });
        }

        // Name and Date below signature
        page.drawText(data.signature.name, {
            x: sigX, y: ty(sigBoxYOffset + actualSigBoxH + 15), size: 9, font: fontBold
        });
        page.drawText(data.invoice_date, {
            x: sigX, y: ty(sigBoxYOffset + actualSigBoxH + 28), size: 8, font: fontBold
        });

        // Save and Return
        const pdfBytes = await pdfDoc.save();
        const fileName = `${data.invoice_no}.pdf`;
        const filePath = path.join(process.cwd(), 'public', 'invoices', fileName);
        fs.writeFileSync(filePath, pdfBytes);

        return NextResponse.json({
            pdf_url: `/invoices/${fileName}`,
            invoice_no: data.invoice_no
        });

    } catch (error: any) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
