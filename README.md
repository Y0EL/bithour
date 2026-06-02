# MOU Generator - PT. Decision Tree Indonesia

Sistem generator dokumen untuk Invoice dan MOU (Memorandum of Understanding) khusus content creator.

## Features

### 1. Invoice Generator
- Format invoice custom: `A/B-XXX-INV-DTI-YYYYMMDD-ZZZZ`
- Integrasi bank Indonesia dengan SWIFT code otomatis
- Signature capture digital
- Export ke PDF format A4
- Mobile responsive

### 2. MOU Generator
- Template DOCX dengan placeholder
- Auto-fill data creator
- Export ke DOCX (PDF conversion optional)
- Username creator sebagai judul konten

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript
- **PDF Generation**: pdf-lib + sharp
- **DOCX Generation**: docxtemplater + pizzip
- **Styling**: Vanilla CSS (Black & White Elegant Theme)
- **Signature**: react-signature-canvas

## Installation

```bash
npm install
```

## Setup MOU Template

1. Buat file `mou.docx` di folder `public/templates/`
2. Gunakan placeholder format: `{{ variable_name }}`
3. Lihat dokumentasi lengkap di `public/templates/README_TEMPLATE.md`

### Placeholders yang tersedia:
- `{{ nama }}` - Nama lengkap creator
- `{{ nomor_ktp }}` - Nomor KTP 16 digit
- `{{ alamat }}` - Alamat lengkap
- `{{ judul_konten }}` - Username creator (auto-filled)
- `{{ jenis_konten }}` - Jenis konten
- `{{ tanggal_pembuatan }}` - Tanggal pembuatan
- `{{ durasi }}` - Durasi konten

## Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── invoices/generate/    # Invoice PDF generator
│   │   └── mou/generate/          # MOU DOCX generator
│   ├── create/                    # Invoice form page
│   ├── mou/                       # MOU form page
│   └── page.tsx                   # Homepage
├── components/
│   ├── InvoiceForm.tsx           # Invoice form component
│   ├── MOUForm.tsx               # MOU form component
│   └── SignaturePad.tsx          # Signature capture
├── public/
│   ├── templates/
│   │   ├── mou.docx              # MOU template (user upload)
│   │   └── README_TEMPLATE.md    # Template documentation
│   ├── invoices/                 # Generated invoices
│   └── mou/                      # Generated MOU files
├── tmp/                          # Temporary files (gitignored)
└── utils/
    ├── types.ts                  # Invoice types
    └── mouTypes.ts               # MOU types
```

## Usage

### Invoice Generator
1. Akses `/create`
2. Pilih tipe invoice (A=Endorsement, B=Owning Content)
3. Isi ref number (3 digit)
4. Isi data creator dan payment details
5. Tanda tangan digital
6. Generate & Download PDF

### MOU Generator
1. Akses `/mou`
2. Isi data creator (nama, KTP, alamat, username)
3. Pilih jenis konten dan durasi
4. Generate & Download DOCX

## Bank List & SWIFT Codes

Sistem mendukung 10 bank utama Indonesia:
- Bank Mandiri (BMRIIDJA)
- BRI (BRINIDJA)
- BCA (CENAIDJA)
- BNI (BNINIDJA)
- BTN (BTANIDJA)
- BSI (BSMDIDJA)
- CIMB Niaga (BNIAIDJA)
- OCBC (NISPIDJA)
- Permata (BBBAIDJA)
- Danamon (BDINIDJA)

Jika bank tidak ada di list, user bisa input manual.

## PDF Conversion (Optional)

Saat ini MOU generator menghasilkan file DOCX. Untuk konversi ke PDF:

### Option 1: LibreOffice Headless
```bash
# Install LibreOffice
apt-get install libreoffice

# Convert command
soffice --headless --convert-to pdf --outdir ./tmp ./tmp/mou.docx
```

### Option 2: Cloud API
- Cloudmersive Document Conversion API
- Google Docs API
- Microsoft Graph API

## Environment Variables

Tidak ada environment variables yang diperlukan untuk development.

## Deployment

### Vercel (Recommended)
```bash
vercel deploy
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Notes

- Invoice format mengikuti standar PT. Decision Tree Indonesia
- SWIFT code otomatis terisi jika bank dipilih dari dropdown
- Signature date di PDF menggunakan bold font
- Template MOU harus disiapkan user (contoh struktur tersedia)
- Temporary files di folder `tmp/` otomatis dibersihkan

## Support

Untuk pertanyaan atau issue, hubungi tim development PT. Decision Tree Indonesia.

## License

Proprietary - PT. Decision Tree Indonesia © 2026
