import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { MOURenderRequest } from '@/utils/mouTypes';

// A4 dimensions in points
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 56.69;
const MARGIN_RIGHT = 56.69;
const MARGIN_TOP = 56.69;
const MARGIN_BOTTOM = 56.69;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const BODY_SIZE = 13.5;
const TITLE_SIZE = 17;
const SUBTITLE_SIZE = 16;

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

// Helper to convert top-down Y coordinates to pdf-lib bottom-up coordinates
const ty = (topY: number) => PAGE_HEIGHT - topY;

// Helper function to wrap text
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

function drawRichText(page: PDFPage, text: string, x: number, y: number, fontSize: number, regularFont: any, boldFont: any) {
    const terms = ["Pihak Pertama", "Pihak Kedua", "PIHAK PERTAMA", "PIHAK KEDUA"];
    let currentX = x;

    const parts = text.split(/(Pihak Pertama|Pihak Kedua|PIHAK PERTAMA|PIHAK KEDUA)/g);

    parts.forEach(part => {
        const isBoldTerm = terms.includes(part);
        const font = isBoldTerm ? boldFont : regularFont;

        page.drawText(part, {
            x: currentX,
            y,
            size: fontSize,
            font: font,
        });

        currentX += font.widthOfTextAtSize(part, fontSize);
    });
}

// Helper to draw aligned fields with vertical colon alignment and auto-wrapping for values
// Returns the NEXT available currentY (top-down)
function drawAlignedField(page: PDFPage, label: string, value: string, x: number, startY: number, fontSize: number, labelWidth: number, regularFont: any, boldFont: any, checkPageBreak: (s: number) => boolean, ty: (y: number) => number): number {
    const lineHeight = fontSize * 1.35;
    let localY = startY;

    // Draw Label (Regular)
    page.drawText(label, { x, y: ty(localY), size: fontSize, font: regularFont });

    // Draw Colon at fixed offset
    const colonX = x + labelWidth;
    page.drawText(":", { x: colonX, y: ty(localY), size: fontSize, font: regularFont });

    // Calculate available width for value
    const valueX = colonX + 10;
    const valueMaxWidth = PAGE_WIDTH - MARGIN_RIGHT - valueX;

    // Wrap the value
    const lines = wrapText(value || "", valueMaxWidth, regularFont, fontSize);

    lines.forEach((line, idx) => {
        if (idx > 0) {
            localY += lineHeight;
            checkPageBreak(lineHeight);
        }
        drawRichText(page, line, valueX, ty(localY), fontSize, regularFont, boldFont);
    });

    return localY + lineHeight;
}

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const fields = data.fields;

        if (!fields) {
            console.error('MOU Generation Error: fields missing in request body');
            return NextResponse.json({ error: 'Request body missing fields' }, { status: 400 });
        }

        if (!fields.mou_number) {
            console.error('MOU Generation Error: mou_number missing in fields');
            return NextResponse.json({ error: 'mou_number is required' }, { status: 400 });
        }


        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

        const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);

        const lineHeight = BODY_SIZE * 1.35;
        let currentY = MARGIN_TOP;

        // Helper to check if we need a new page
        const checkPageBreak = (neededSpace: number) => {
            if (currentY + neededSpace > PAGE_HEIGHT - MARGIN_BOTTOM) {
                page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                currentY = MARGIN_TOP;
                return true;
            }
            return false;
        };



        // === TITLE: PERJANJIAN ALIH HAK CIPTA ===
        const title = 'PERJANJIAN ALIH HAK CIPTA';
        const titleWidth = fontBold.widthOfTextAtSize(title, TITLE_SIZE);
        page.drawText(title, {
            x: (PAGE_WIDTH - titleWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 28;

        // === MoU Number (centered) ===
        const mouNo = `Nomor: ${fields.mou_number}`;
        const mouNoWidth = fontBold.widthOfTextAtSize(mouNo, SUBTITLE_SIZE);
        page.drawText(mouNo, {
            x: (PAGE_WIDTH - mouNoWidth) / 2,
            y: ty(currentY),
            size: SUBTITLE_SIZE,
            font: fontBold,
        });
        currentY += 45;

        // === Opening Paragraph ===
        const cleanMOUUsername = (fields.party2_username || '').replace(/^@/, '');
        const openingText = `Perjanjian ini (Perjanjian Alih Hak Cipta CrownCare X ${cleanMOUUsername}) dibuat dan ditandatangani pada ${fields.agreement_date} oleh dan antara:`;
        const wrappedOpening = wrapText(openingText, CONTENT_WIDTH, fontRegular, BODY_SIZE);
        wrappedOpening.forEach(line => {
            checkPageBreak(18);
            drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;
        });
        currentY += 25;

        // === PIHAK PERTAMA ===
        checkPageBreak(120);
        page.drawText('Pihak Pertama (Penerima Konten):', {
            x: MARGIN_LEFT,
            y: ty(currentY),
            size: SUBTITLE_SIZE,
            font: fontBold,
        });
        currentY += 22;

        const labelW = 120;
        currentY = drawAlignedField(page, 'Nama', fields.party1_name, MARGIN_LEFT, currentY, BODY_SIZE, labelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Perusahaan', fields.party1_company, MARGIN_LEFT, currentY, BODY_SIZE, labelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Jabatan', fields.party1_position, MARGIN_LEFT, currentY, BODY_SIZE, labelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Alamat', fields.party1_address, MARGIN_LEFT, currentY, BODY_SIZE, labelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY += 10;

        drawRichText(page, 'Selanjutnya disebut sebagai "PIHAK PERTAMA"', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
        currentY += 30;

        // === PIHAK KEDUA ===
        checkPageBreak(120);
        page.drawText('Pihak Kedua (Pembuat Konten):', {
            x: MARGIN_LEFT,
            y: ty(currentY),
            size: SUBTITLE_SIZE,
            font: fontBold,
        });
        currentY += 22;

        currentY = drawAlignedField(page, 'Nama', fields.party2_name, MARGIN_LEFT, currentY, BODY_SIZE, labelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Nomor KTP', fields.party2_ktp, MARGIN_LEFT, currentY, BODY_SIZE, labelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Alamat', fields.party2_address, MARGIN_LEFT, currentY, BODY_SIZE, labelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY += 10;

        drawRichText(page, 'Selanjutnya disebut sebagai "PIHAK KEDUA"', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
        currentY += 35;

        // === MANDATORY PAGE BREAK BEFORE PASAL 1 ===
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = MARGIN_TOP;

        // === PASAL 1: Objek Alih Hak Cipta ===
        const p1Header = 'Pasal 1';
        const p1HeaderWidth = fontBold.widthOfTextAtSize(p1Header, TITLE_SIZE);
        page.drawText(p1Header, {
            x: (PAGE_WIDTH - p1HeaderWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 25;

        const p1Title = 'Objek Alih Hak Cipta';
        const p1TitleWidth = fontBold.widthOfTextAtSize(p1Title, TITLE_SIZE);
        page.drawText(p1Title, {
            x: (PAGE_WIDTH - p1TitleWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 30;

        const pasal1Text = 'Pihak Kedua menyatakan bahwa ia adalah pemilik sah atas konten video orisinal dengan rincian sebagai berikut:';
        const wrapped1 = wrapText(pasal1Text, CONTENT_WIDTH, fontRegular, BODY_SIZE);
        wrapped1.forEach(line => {
            checkPageBreak(18);
            drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;
        });
        currentY += 10;

        const contentLabelW = 140;
        currentY = drawAlignedField(page, 'Judul/Nama Konten', fields.content_title, MARGIN_LEFT, currentY, BODY_SIZE, contentLabelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Jenis Konten', fields.content_type, MARGIN_LEFT, currentY, BODY_SIZE, contentLabelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Tanggal Pembuatan', fields.creation_date, MARGIN_LEFT, currentY, BODY_SIZE, contentLabelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY = drawAlignedField(page, 'Durasi', fields.duration, MARGIN_LEFT, currentY, BODY_SIZE, contentLabelW, fontRegular, fontBold, checkPageBreak, ty);
        currentY += 25;

        // === PASAL 2: Ruang Lingkup Kerja Sama ===
        checkPageBreak(180);
        const p2Header = 'Pasal 2';
        const p2HeaderWidth = fontBold.widthOfTextAtSize(p2Header, TITLE_SIZE);
        page.drawText(p2Header, {
            x: (PAGE_WIDTH - p2HeaderWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 25;

        const p2Title = 'Ruang Lingkup Kerja Sama';
        const p2TitleWidth = fontBold.widthOfTextAtSize(p2Title, TITLE_SIZE);
        page.drawText(p2Title, {
            x: (PAGE_WIDTH - p2TitleWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 30;

        const pasal2Items = [
            '2.1 Pihak Kedua menyatakan bahwa video tersebut merupakan karya orisinal miliknya dan bebas dari tuntutan atau klaim pihak ketiga.',
            '2.2 Pihak Kedua menjamin bahwa video tidak melanggar hak cipta, merek dagang, atau hak lainnya dari pihak manapun.',
            '2.3 Pihak Pertama berhak mengunggah video ke platform miliknya, akun penerima izin:',
        ];

        pasal2Items.forEach(item => {
            const wrapped = wrapText(item, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrapped.forEach(line => {
                checkPageBreak(18);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 18;
            });
        });
        currentY += 10;

        // Forced hardcoded accounts list
        PERMANENT_ACCOUNTS.forEach(account => {
            checkPageBreak(18);
            // Using a standard bullet symbol supported by Times
            page.drawText('\u2022', { x: MARGIN_LEFT + 20, y: ty(currentY), size: BODY_SIZE, font: fontRegular });
            page.drawText(account, { x: MARGIN_LEFT + 35, y: ty(currentY), size: BODY_SIZE, font: fontRegular });
            currentY += 18;
        });
        currentY += 10;

        const additionalRights = [
            '2.4 Pihak Pertama berhak mengedit dan menggunakan video untuk keperluan promosi;',
            '2.5 Pihak Pertama berhak mendistribusikan ulang tanpa mengubah makna atau memalsukan isi video.',
        ];

        additionalRights.forEach(right => {
            const wrapped = wrapText(right, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrapped.forEach(line => {
                checkPageBreak(18);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 18;
            });
        });
        currentY += 15;

        // === PASAL 3: Alih Hak Cipta ===
        checkPageBreak(200);
        const p3Header = 'Pasal 3';
        const p3HeaderWidth = fontBold.widthOfTextAtSize(p3Header, TITLE_SIZE);
        page.drawText(p3Header, {
            x: (PAGE_WIDTH - p3HeaderWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 20;

        const p3Title = 'Alih Hak Cipta';
        const p3TitleWidth = fontBold.widthOfTextAtSize(p3Title, TITLE_SIZE);
        page.drawText(p3Title, {
            x: (PAGE_WIDTH - p3TitleWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 25;

        const pasal3Items = [
            '3.1 Pihak Kedua dengan ini mengalihkan seluruh hak cipta (hak moral dan hak ekonomi) atas video sebagaimana dimaksud dalam Pasal 1 kepada Pihak Pertama',
            '3.2 Pengalihan ini bersifat penuh, permanen, tidak terbatas waktu dan wilayah, dan meliputi:',
        ];

        pasal3Items.forEach(item => {
            const wrapped = wrapText(item, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrapped.forEach(line => {
                checkPageBreak(15);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 15;
            });
        });

        const pasal3Rights = [
            '- Hak untuk memperbanyak dan menyebarluaskan;',
            '- Hak untuk mengubah, mengedit, memotong, atau menggabungkan;',
            '- Hak untuk menayangkan di semua platform media;',
            '- Hak untuk memberikan hak lanjutan (sub-license) kepada pihak ketiga.',
        ];

        pasal3Rights.forEach(right => {
            checkPageBreak(15);
            drawRichText(page, right, MARGIN_LEFT + 15, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 15;
        });

        const pasal3_3 = '3.3 Sejak tanggal penandatanganan Perjanjian ini dan setelah kompensasi dibayarkan, Pihak Kedua tidak lagi memiliki hak atas video tersebut, dan tidak dapat menggunakannya tanpa izin tertulis dari Pihak Pertama';
        const wrapped3_3 = wrapText(pasal3_3, CONTENT_WIDTH, fontRegular, BODY_SIZE);
        wrapped3_3.forEach(line => {
            checkPageBreak(15);
            drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 15;
        });
        currentY += 10;

        // === PASAL 4: Kompensasi ===
        checkPageBreak(250);
        const p4Header = 'Pasal 4';
        const p4HeaderWidth = fontBold.widthOfTextAtSize(p4Header, TITLE_SIZE);
        page.drawText(p4Header, {
            x: (PAGE_WIDTH - p4HeaderWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 20;

        const p4Title = 'Kompensasi';
        const p4TitleWidth = fontBold.widthOfTextAtSize(p4Title, TITLE_SIZE);
        page.drawText(p4Title, {
            x: (PAGE_WIDTH - p4TitleWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 25;

        drawRichText(page, 'Kerja sama ini disepakati dalam dua bentuk:', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
        currentY += 20;

        if (fields.is_paid) {
            // PAID VERSION
            drawRichText(page, '4.1 Jika Berbayar:', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;

            const paidText1 = 'Sebagai imbalan atas pengalihan hak cipta konten video dari Pihak Kedua kepada Pihak Pertama sebagaimana diatur dalam Pasal 3, Pihak Pertama setuju untuk membayar kompensasi sebesar:';
            const wrappedPaid1 = wrapText(paidText1, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrappedPaid1.forEach(line => {
                checkPageBreak(15);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 15;
            });
            currentY += 5;

            drawRichText(page, `Rp.${fields.compensation_amount} (terbilang: ${fields.compensation_in_words}).`, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;

            const paidText2 = 'Pembayaran akan dilakukan satu kali (lumpsum), selambat-lambatnya dalam waktu 7 hari kerja setelah penandatanganan perjanjian dan penyerahan lengkap materi video oleh Pihak Kedua.';
            const wrappedPaid2 = wrapText(paidText2, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrappedPaid2.forEach(line => {
                checkPageBreak(15);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 15;
            });
            currentY += 5;

            drawRichText(page, 'Pembayaran akan ditransfer ke rekening Pihak Kedua sebagai berikut:', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;

            const bankLabelW = 130;
            currentY = drawAlignedField(page, 'Bank', fields.bank_name, MARGIN_LEFT, currentY, BODY_SIZE, bankLabelW, fontRegular, fontBold, checkPageBreak, ty);
            currentY = drawAlignedField(page, 'Atas Nama', fields.account_holder, MARGIN_LEFT, currentY, BODY_SIZE, bankLabelW, fontRegular, fontBold, checkPageBreak, ty);
            currentY = drawAlignedField(page, 'Nomor Rekening', fields.account_number, MARGIN_LEFT, currentY, BODY_SIZE, bankLabelW, fontRegular, fontBold, checkPageBreak, ty);
            currentY += 22;

            const paidText3 = 'Setelah pembayaran dilakukan, hak cipta atas konten video tersebut sepenuhnya berpindah ke Pihak Pertama, dan Pihak Kedua tidak lagi memiliki hak hukum apa pun atas penggunaan, distribusi, atau publikasi video tersebut kecuali jika disetujui secara tertulis oleh Pihak Pertama.';
            const wrappedPaid3 = wrapText(paidText3, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrappedPaid3.forEach(line => {
                checkPageBreak(15);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 15;
            });
            currentY += 15;

            // Show unpaid section as well
            drawRichText(page, '4.2 Jika Tidak Berbayar:', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;

            const unpaidText = 'Kerja sama ini dilakukan tanpa kompensasi finansial dan hak cipta atas konten video tersebut sepenuhnya berpindah ke Pihak Pertama, dan Pihak Kedua tidak lagi memiliki hak hukum apa pun atas penggunaan, distribusi, atau publikasi video tersebut kecuali jika disetujui secara tertulis oleh Pihak Pertama.';
            const wrappedUnpaid = wrapText(unpaidText, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrappedUnpaid.forEach(line => {
                checkPageBreak(15);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 15;
            });
        } else {
            // UNPAID VERSION (show both sections but emphasize unpaid)
            drawRichText(page, '4.1 Jika Berbayar:', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;

            const paidTextShort = 'Sebagai imbalan atas pengalihan hak cipta konten video dari Pihak Kedua kepada Pihak Pertama sebagaimana diatur dalam Pasal 3, Pihak Pertama setuju untuk membayar kompensasi sebesar: [TIDAK BERLAKU]';
            const wrappedPaidShort = wrapText(paidTextShort, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrappedPaidShort.forEach(line => {
                checkPageBreak(15);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 15;
            });
            currentY += 15;

            drawRichText(page, '4.2 Jika Tidak Berbayar:', MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 18;

            const unpaidText = 'Kerja sama ini dilakukan tanpa kompensasi finansial dan hak cipta atas konten video tersebut sepenuhnya berpindah ke Pihak Pertama, dan Pihak Kedua tidak lagi memiliki hak hukum apa pun atas penggunaan, distribusi, atau publikasi video tersebut kecuali jika disetujui secara tertulis oleh Pihak Pertama.';
            const wrappedUnpaid = wrapText(unpaidText, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrappedUnpaid.forEach(line => {
                checkPageBreak(15);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 15;
            });
        }
        currentY += 10;

        // === PASAL 5: Penyelesaian Permasalahan ===
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = MARGIN_TOP;

        const p5Header = 'Pasal 5';
        const p5HeaderWidth = fontBold.widthOfTextAtSize(p5Header, TITLE_SIZE);
        page.drawText(p5Header, {
            x: (PAGE_WIDTH - p5HeaderWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 20;

        const p5Title = 'Penyelesaian Permasalahan';
        const p5TitleWidth = fontBold.widthOfTextAtSize(p5Title, TITLE_SIZE);
        page.drawText(p5Title, {
            x: (PAGE_WIDTH - p5TitleWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 25;

        const pasal5Text = 'Segala perselisihan yang timbul akibat Perjanjian ini akan diselesaikan terlebih dahulu secara musyawarah. Apabila tidak tercapai mufakat, maka akan diselesaikan melalui pengadilan negeri di wilayah hukum DKI Jakarta, sesuai hukum yang berlaku di Republik Indonesia.';
        const wrapped5 = wrapText(pasal5Text, CONTENT_WIDTH, fontRegular, BODY_SIZE);
        wrapped5.forEach(line => {
            checkPageBreak(15);
            drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
            currentY += 15;
        });
        currentY += 10;

        // === PASAL 6: Lain-Lain ===
        // Use a large check to keep header and content together
        checkPageBreak(250);

        const p6Header = 'Pasal 6';
        const p6HeaderWidth = fontBold.widthOfTextAtSize(p6Header, TITLE_SIZE);
        page.drawText(p6Header, {
            x: (PAGE_WIDTH - p6HeaderWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 20;

        const p6Title = 'Lain-Lain';
        const p6TitleWidth = fontBold.widthOfTextAtSize(p6Title, TITLE_SIZE);
        page.drawText(p6Title, {
            x: (PAGE_WIDTH - p6TitleWidth) / 2,
            y: ty(currentY),
            size: TITLE_SIZE,
            font: fontBold,
        });
        currentY += 25;

        const p6Items = [
            'Perjanjian ini mengikat kedua belah pihak dan ahli warisnya.',
            'Perjanjian ini dibuat dalam 2 (dua) rangkap asli dan memiliki kekuatan hukum yang sama.',
            'Hal-hal yang belum diatur dalam Perjanjian ini akan dibicarakan dan disepakati secara tertulis oleh kedua belah pihak.',
        ];

        for (const item of p6Items) {
            const wrapped = wrapText(item, CONTENT_WIDTH, fontRegular, BODY_SIZE);
            wrapped.forEach(line => {
                checkPageBreak(20);
                drawRichText(page, line, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
                currentY += 16;
            });
        }
        currentY += 15;

        // === SIGNATURES ===
        checkPageBreak(120);
        // Use sign location and date from the form
        const signLoc = fields.sign_location || 'Jakarta';
        const signDt = fields.sign_date || '';
        const displaySignDate = `${signLoc}, ${signDt}`;
        drawRichText(page, displaySignDate, MARGIN_LEFT, ty(currentY), BODY_SIZE, fontRegular, fontBold);
        currentY += 30;

        // Two column layout for signatures
        const col1X = MARGIN_LEFT;
        const col2X = MARGIN_LEFT + CONTENT_WIDTH / 2 + 20;

        // PIHAK PERTAMA
        drawRichText(page, 'PIHAK PERTAMA', col1X, ty(currentY), 10, fontRegular, fontBold);

        // PIHAK KEDUA
        drawRichText(page, 'PIHAK KEDUA', col2X, ty(currentY), 10, fontRegular, fontBold);
        currentY += 15;

        // Signature Area (Slightly smaller signatures as requested)
        const actualSigBoxW = 200;
        const actualSigBoxH = 40;
        const sigYOffset = currentY + 5;

        // Party 1 signature (Bithour Production - from xf.png)
        try {
            const xfPath = path.join(process.cwd(), 'public', 'xf.png');
            if (fs.existsSync(xfPath)) {
                const xfBuffer = fs.readFileSync(xfPath);
                const trimmedXf = await sharp(xfBuffer).trim().toBuffer();
                const xfImage = await pdfDoc.embedPng(trimmedXf);
                const { width, height } = xfImage.scaleToFit(actualSigBoxW, actualSigBoxH);

                page.drawImage(xfImage, {
                    x: col1X,
                    y: ty(sigYOffset + (actualSigBoxH + height) / 2),
                    width,
                    height,
                });
            } else {
                console.warn('xf.png not found at', xfPath);
            }
        } catch (err) {
            console.error('Error embedding Xie Fenglin signature:', err);
        }

        // Party 2 signature (Creator)
        if (data.signature_party2_base64) {
            try {
                const base64Data = data.signature_party2_base64.replace(/^data:image\/png;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const trimmedBuffer = await sharp(buffer).trim().toBuffer();
                const sigImage = await pdfDoc.embedPng(trimmedBuffer);
                const { width, height } = sigImage.scaleToFit(actualSigBoxW, actualSigBoxH);

                page.drawImage(sigImage, {
                    x: col2X,
                    y: ty(sigYOffset + (actualSigBoxH + height) / 2),
                    width,
                    height,
                });
            } catch (err) {
                console.error('Error embedding party2 signature:', err);
            }
        }

        // Text below signatures
        const nameY = sigYOffset + actualSigBoxH + 25; // Increased from 10 to 25
        const titleY = nameY + 13;

        page.drawText('Bithour Production', {
            x: col1X,
            y: ty(nameY),
            size: 12,
            font: fontBold,
        });

        const party2DisplayName = fields.party2_name || '';

        page.drawText(party2DisplayName, {
            x: col2X,
            y: ty(nameY),
            size: 12,
            font: fontBold,
        });

        page.drawText('PT. Bithour Production Indonesia', {
            x: col1X,
            y: ty(titleY),
            size: 10,
            font: fontRegular,
        });

        page.drawText('Kreator Eksklusif', {
            x: col2X,
            y: ty(titleY),
            size: 10,
            font: fontRegular,
        });

        currentY = titleY + 20;

        // Save PDF to public folder
        const pdfBytes = await pdfDoc.save();
        const fileName = `${fields.mou_number}.pdf`;
        const filePath = path.join(process.cwd(), 'public', 'mou', fileName);

        // Ensure directory exists (though it should)
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, Buffer.from(pdfBytes));

        return NextResponse.json({
            pdf_url: `/mou/${fileName}`,
            mou_number: fields.mou_number
        });

    } catch (error: any) {
        console.error('MoU PDF Generation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
