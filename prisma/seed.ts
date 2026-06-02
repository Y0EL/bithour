import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function randomId() {
    return crypto.randomBytes(16).toString('hex');
}

function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function dateStr(d: Date) {
    return d.toISOString().split('T')[0].replace(/-/g, '');
}

async function main() {
    console.log('Starting database seed...');

    const pw = await bcrypt.hash('crowncare123', 10);

    // ============ GROUPS ============
    const groupBD = await prisma.group.upsert({
        where: { name: 'BD Team Alpha' },
        update: {},
        create: { name: 'BD Team Alpha', description: 'Business Development Team Alpha' },
    });

    const groupBDBeta = await prisma.group.upsert({
        where: { name: 'BD Team Beta' },
        update: {},
        create: { name: 'BD Team Beta', description: 'Business Development Team Beta' },
    });

    const groupSystem = await prisma.group.upsert({
        where: { name: 'System' },
        update: {},
        create: { name: 'System', description: 'System group', isSystem: true },
    });

    console.log('+ Groups created');

    // ============ USERS (all roles) ============
    const usersData = [
        { username: 'system', email: 'system@crowncare.local', role: 'SYSTEM', fullName: 'System Account', groupId: groupSystem.id },
        { username: 'bd_andi', email: 'andi@crowncare.local', role: 'BD', fullName: 'Andi Prasetyo', groupId: groupBD.id },
        { username: 'bd_siti', email: 'siti@crowncare.local', role: 'BD', fullName: 'Siti Rahayu', groupId: groupBD.id },
        { username: 'bd_budi', email: 'budi@crowncare.local', role: 'BD', fullName: 'Budi Santoso', groupId: groupBDBeta.id },
        { username: 'tl_dewi', email: 'dewi@crowncare.local', role: 'TEAM_LEADER', fullName: 'Dewi Lestari', groupId: groupBD.id },
        { username: 'finance_rina', email: 'rina@crowncare.local', role: 'FINANCE', fullName: 'Rina Wulandari', groupId: null },
        { username: 'bd_am_yoel', email: 'yoel@crowncare.local', role: 'BD_ASSISTANT_MANAGER', fullName: 'Yoel Tanujaya', groupId: null },
        { username: 'manager_david', email: 'david@crowncare.local', role: 'MANAGER', fullName: 'David Wijaya', groupId: null },
        { username: 'analyst_putri', email: 'putri@crowncare.local', role: 'ANALYST', fullName: 'Putri Handayani', groupId: null },
        { username: 'curator_maya', email: 'maya@crowncare.local', role: 'CURATOR', fullName: 'Maya Kusuma', groupId: null },
    ];

    const users: Record<string, any> = {};
    for (const u of usersData) {
        const created = await prisma.user.upsert({
            where: { username: u.username },
            update: {},
            create: { ...u, password: pw } as any,
        });
        users[u.username] = created;
        console.log(`  + User: ${created.fullName} (${created.role})`);
    }

    // ============ CREATORS (covering all statuses) ============
    const creatorsData = [
        {
            name: 'Ratna Dewi',
            usernameTikTok: 'ratna_dewi_beauty',
            status: 'REACHOUT',
            phoneNumber: '081234567890',
            followers: 15200,
            createdById: users.bd_andi.id,
        },
        {
            name: 'Ahmad Fauzi',
            usernameTikTok: 'fauzi_haircare',
            status: 'DEALING',
            phoneNumber: '081234567891',
            followers: 32500,
            createdById: users.bd_andi.id,
            productDescription: 'hair color comb black',
        },
        {
            name: 'Lina Marlina',
            usernameTikTok: 'lina_glow_up',
            status: 'SAMPLING',
            phoneNumber: '081234567892',
            followers: 48000,
            createdById: users.bd_siti.id,
            productDescription: 'Comb-On Hair Color Cream 200ml Black',
            sampleTrackingNumber: 'JNE1234567890',
            sampleDeliveryDate: daysAgo(3),
            isReportedToShipment: true,
        },
        {
            name: 'Dimas Kurniawan',
            usernameTikTok: 'dimas_style_id',
            status: 'DRAFTING',
            phoneNumber: '081234567893',
            followers: 67000,
            createdById: users.bd_siti.id,
            productDescription: 'hair color comb dark brown',
            ktpNumber: '3275012345670001',
            address: 'Jl. Merdeka No. 10, Jakarta Selatan',
            bankName: 'BCA',
            accountNumber: '1234567890',
            accountName: 'Dimas Kurniawan',
            isDraftApproved: false,
            videoReviewStatus: 'PENDING',
        },
        {
            name: 'Mega Putri',
            usernameTikTok: 'mega_beauty_tips',
            status: 'DRAFTING',
            phoneNumber: '081234567894',
            followers: 125000,
            createdById: users.bd_budi.id,
            productDescription: '500ml shampoo dark brown',
            ktpNumber: '3275012345670002',
            address: 'Jl. Sudirman No. 25, Bandung',
            bankName: 'BNI',
            accountNumber: '0987654321',
            accountName: 'Mega Putri',
            isDraftApproved: true,
            videoReviewStatus: 'APPROVED',
            reviewedById: users.tl_dewi.id,
            reviewedAt: daysAgo(2),
            reviewNotes: 'Video bagus, pencahayaan cukup baik.',
        },
        {
            name: 'Rendi Saputra',
            usernameTikTok: 'rendi_hairhacks',
            status: 'FINANCING',
            phoneNumber: '081234567895',
            followers: 89000,
            createdById: users.bd_andi.id,
            productDescription: 'hair color comb chestnut brown',
            ktpNumber: '3275012345670003',
            address: 'Jl. Gatot Subroto No. 5, Surabaya',
            bankName: 'Mandiri',
            accountNumber: '1122334455',
            accountName: 'Rendi Saputra',
            kcpCity: 'Surabaya',
            isDraftApproved: true,
            videoReviewStatus: 'APPROVED',
            reviewedById: users.tl_dewi.id,
            reviewedAt: daysAgo(5),
        },
        {
            name: 'Fitri Anggraini',
            usernameTikTok: 'fitri_haircolor',
            status: 'FINISHED',
            phoneNumber: '081234567896',
            followers: 210000,
            createdById: users.bd_siti.id,
            productDescription: 'Hair Shadow Natural Black',
            ktpNumber: '3275012345670004',
            address: 'Jl. Asia Afrika No. 15, Yogyakarta',
            bankName: 'BRI',
            accountNumber: '6677889900',
            accountName: 'Fitri Anggraini',
            kcpCity: 'Yogyakarta',
            isDraftApproved: true,
            videoReviewStatus: 'APPROVED',
            reviewedById: users.tl_dewi.id,
            reviewedAt: daysAgo(14),
            isReportedToShipment: true,
            isReportedToOCSheet: true,
            ocSheetRowNumber: 42,
        },
        {
            name: 'Bayu Pratama',
            usernameTikTok: 'bayu_grooming',
            status: 'MONITORING',
            phoneNumber: '081234567897',
            followers: 95000,
            createdById: users.bd_budi.id,
            productDescription: 'refill dark brown',
            ktpNumber: '3275012345670005',
            address: 'Jl. Pemuda No. 30, Semarang',
            bankName: 'BCA',
            accountNumber: '5566778899',
            accountName: 'Bayu Pratama',
            kcpCity: 'Semarang',
            isDraftApproved: true,
            videoReviewStatus: 'APPROVED',
            reviewedById: users.tl_dewi.id,
            reviewedAt: daysAgo(21),
            isReportedToShipment: true,
            isReportedToOCSheet: true,
            ocSheetRowNumber: 38,
        },
        {
            name: 'Citra Purnama',
            usernameTikTok: 'citra_makeupid',
            status: 'FAIL',
            phoneNumber: '081234567898',
            followers: 5000,
            createdById: users.bd_andi.id,
            productDescription: 'hair color comb black',
            failedReason: 'Creator tidak responsif setelah 14 hari',
            failedAt: daysAgo(7),
        },
        {
            name: 'Nadia Safitri',
            usernameTikTok: 'nadia_hairjourney',
            status: 'FAIL',
            phoneNumber: '081234567899',
            followers: 12000,
            createdById: users.bd_siti.id,
            productDescription: 'Comb-On Hair Color Cream 200ml chestnut brown',
            failedReason: 'Harga tidak sesuai budget',
            failedAt: daysAgo(10),
        },
        {
            name: 'Eko Setiawan',
            usernameTikTok: 'eko_hairstyle',
            status: 'DRAFTING',
            phoneNumber: '081234567801',
            followers: 43000,
            createdById: users.bd_budi.id,
            productDescription: 'hair color comb black+hair oil',
            ktpNumber: '3275012345670006',
            address: 'Jl. Diponegoro No. 12, Malang',
            bankName: 'CIMB Niaga',
            accountNumber: '7788990011',
            accountName: 'Eko Setiawan',
            isDraftApproved: true,
            videoReviewStatus: 'REVISION',
            reviewedById: users.tl_dewi.id,
            reviewedAt: daysAgo(1),
            reviewNotes: 'Perlu revisi: durasi terlalu pendek, tambahkan demo produk.',
        },
        {
            name: 'Wulan Pertiwi',
            usernameTikTok: 'wulan_cantik',
            status: 'FINISHED',
            phoneNumber: '081234567802',
            followers: 178000,
            createdById: users.bd_andi.id,
            productDescription: '500ml shampoo dark brown',
            ktpNumber: '3275012345670007',
            address: 'Jl. Thamrin No. 45, Jakarta Pusat',
            bankName: 'BCA',
            accountNumber: '2233445566',
            accountName: 'Wulan Pertiwi',
            kcpCity: 'Jakarta',
            isDraftApproved: true,
            videoReviewStatus: 'APPROVED',
            reviewedById: users.tl_dewi.id,
            reviewedAt: daysAgo(10),
            isReportedToShipment: true,
            isReportedToOCSheet: true,
            ocSheetRowNumber: 40,
            endorsedByCuratorId: users.curator_maya.id,
            isEndorsementReview: true,
        },
    ];

    const creators: Record<string, any> = {};
    for (const c of creatorsData) {
        const created = await prisma.creator.upsert({
            where: { usernameTikTok: c.usernameTikTok },
            update: {},
            create: c as any,
        });
        creators[c.usernameTikTok] = created;
        console.log(`  + Creator: ${created.name} (${created.status})`);
    }

    // ============ DOCUMENTS ============
    const today = dateStr(new Date());

    const documentsData = [
        {
            type: 'INVOICE',
            documentNo: `A-001-INV-DTI-${today}-0001`,
            title: 'Invoice - Fitri Anggraini - Hair Shadow Natural Black',
            fileUrl: 'documents/invoices/invoice-fitri-001.pdf',
            status: 'COMPLETED',
            createdById: users.bd_siti.id,
            signedFileUrl: 'documents/invoices/invoice-fitri-001-signed.pdf',
            signedAt: daysAgo(12),
            metadata: {
                creatorName: 'Fitri Anggraini',
                amount: 500000,
                items: [{ description: 'Hair Shadow Natural Black', quantity: 1, price: 500000 }],
            },
        },
        {
            type: 'MOU',
            documentNo: `A-MoU-DTI-${today}-001-0001`,
            title: 'MOU - Fitri Anggraini - Endorsement Agreement',
            fileUrl: 'documents/mou/mou-fitri-001.docx',
            status: 'COMPLETED',
            createdById: users.bd_siti.id,
            signedFileUrl: 'documents/mou/mou-fitri-001-signed.docx',
            signedAt: daysAgo(15),
            metadata: {
                creatorName: 'Fitri Anggraini',
                platform: 'TikTok',
                compensation: 500000,
            },
        },
        {
            type: 'INVOICE',
            documentNo: `A-002-INV-DTI-${today}-0002`,
            title: 'Invoice - Rendi Saputra - Hair Color Comb',
            fileUrl: 'documents/invoices/invoice-rendi-002.pdf',
            status: 'PENDING_SIGN',
            createdById: users.bd_andi.id,
            metadata: {
                creatorName: 'Rendi Saputra',
                amount: 750000,
                items: [
                    { description: 'hair color comb chestnut brown', quantity: 1, price: 500000 },
                    { description: 'Jasa endorsement TikTok', quantity: 1, price: 250000 },
                ],
            },
        },
        {
            type: 'MOU',
            documentNo: `B-MoU-DTI-${today}-003-0003`,
            title: 'MOU - Rendi Saputra - Endorsement Agreement',
            fileUrl: 'documents/mou/mou-rendi-003.docx',
            status: 'PENDING_SIGN',
            createdById: users.bd_andi.id,
            metadata: {
                creatorName: 'Rendi Saputra',
                platform: 'TikTok',
                compensation: 750000,
            },
        },
        {
            type: 'INVOICE',
            documentNo: `B-004-INV-DTI-${today}-0004`,
            title: 'Invoice - Bayu Pratama - Refill Dark Brown',
            fileUrl: 'documents/invoices/invoice-bayu-004.pdf',
            status: 'COMPLETED',
            createdById: users.bd_budi.id,
            signedFileUrl: 'documents/invoices/invoice-bayu-004-signed.pdf',
            signedAt: daysAgo(18),
            metadata: {
                creatorName: 'Bayu Pratama',
                amount: 350000,
                items: [{ description: 'refill dark brown', quantity: 2, price: 175000 }],
            },
        },
        {
            type: 'INVOICE',
            documentNo: `A-005-INV-DTI-${today}-0005`,
            title: 'Invoice - Wulan Pertiwi - 500ml Shampoo',
            fileUrl: 'documents/invoices/invoice-wulan-005.pdf',
            status: 'COMPLETED',
            createdById: users.bd_andi.id,
            signedFileUrl: 'documents/invoices/invoice-wulan-005-signed.pdf',
            signedAt: daysAgo(8),
            metadata: {
                creatorName: 'Wulan Pertiwi',
                amount: 1200000,
                items: [
                    { description: '500ml shampoo dark brown', quantity: 2, price: 450000 },
                    { description: 'Jasa endorsement TikTok', quantity: 1, price: 300000 },
                ],
            },
        },
        {
            type: 'INVOICE',
            documentNo: `B-006-INV-DTI-${today}-0006`,
            title: 'Invoice - Mega Putri - 500ml Shampoo',
            fileUrl: 'documents/invoices/invoice-mega-006.pdf',
            status: 'DRAFT',
            createdById: users.bd_budi.id,
            metadata: {
                creatorName: 'Mega Putri',
                amount: 650000,
                items: [{ description: '500ml shampoo dark brown', quantity: 1, price: 650000 }],
            },
        },
    ];

    const documents: Record<string, any> = {};
    for (const d of documentsData) {
        const created = await prisma.document.upsert({
            where: { documentNo: d.documentNo },
            update: {},
            create: d as any,
        });
        documents[d.documentNo] = created;
        console.log(`  + Document: ${created.documentNo} (${created.status})`);
    }

    // ============ SIGNING SESSIONS ============
    const signingSessionsData = [
        {
            token: crypto.randomBytes(32).toString('hex'),
            type: 'INVOICE',
            formData: {
                creator_name: 'Rendi Saputra',
                payment_details: {
                    bank_name: 'Mandiri',
                    account_number: '1122334455',
                    account_name: 'Rendi Saputra',
                    kcp_kota: 'Surabaya',
                },
                items: [
                    { description: 'hair color comb chestnut brown', quantity: 1, price: 500000 },
                    { description: 'Jasa endorsement TikTok', quantity: 1, price: 250000 },
                ],
            },
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            createdById: users.bd_andi.id,
            creatorId: creators.rendi_hairhacks.id,
        },
        {
            token: crypto.randomBytes(32).toString('hex'),
            type: 'MOU',
            formData: {
                creator_name: 'Rendi Saputra',
                platform: 'TikTok',
                party2_ktp: '3275012345670003',
                bank_name: 'Mandiri',
                account_number: '1122334455',
                account_holder: 'Rendi Saputra',
                compensation: 750000,
            },
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            createdById: users.bd_andi.id,
            creatorId: creators.rendi_hairhacks.id,
        },
        {
            token: crypto.randomBytes(32).toString('hex'),
            type: 'INVOICE',
            formData: {
                creator_name: 'Fitri Anggraini',
                payment_details: {
                    bank_name: 'BRI',
                    account_number: '6677889900',
                    account_name: 'Fitri Anggraini',
                    kcp_kota: 'Yogyakarta',
                },
                items: [{ description: 'Hair Shadow Natural Black', quantity: 1, price: 500000 }],
            },
            status: 'COMPLETED',
            expiresAt: daysAgo(-5),
            createdById: users.bd_siti.id,
            creatorId: creators.fitri_haircolor.id,
        },
        {
            token: crypto.randomBytes(32).toString('hex'),
            type: 'INVOICE',
            formData: { creator_name: 'Citra Purnama' },
            status: 'EXPIRED',
            expiresAt: daysAgo(3),
            createdById: users.bd_andi.id,
            creatorId: creators.citra_makeupid.id,
        },
    ];

    for (const s of signingSessionsData) {
        await prisma.signingSession.create({ data: s as any });
        console.log(`  + SigningSession: ${s.type} for ${(s.formData as any).creator_name} (${s.status})`);
    }

    // ============ CREATOR MESSAGES ============
    const messagesData = [
        { creatorId: creators.dimas_style_id.id, senderId: users.bd_siti.id, content: 'Hi Dimas, sudah selesai shooting videonya?' },
        { creatorId: creators.dimas_style_id.id, senderId: null, content: 'Sudah kak, tinggal editing lagi ya. Besok bisa kirim.', isReadByInternal: false },
        { creatorId: creators.rendi_hairhacks.id, senderId: users.bd_andi.id, content: 'Rendi, invoice sudah dikirim ya. Mohon di-sign di link yang sudah dikirim.' },
        { creatorId: creators.rendi_hairhacks.id, senderId: null, content: 'Siap kak, nanti malam saya cek.', isReadByInternal: true },
        { creatorId: creators.mega_beauty_tips.id, senderId: users.bd_budi.id, content: 'Mega, videonya sudah approved! Sebentar lagi kita proses pembayaran.' },
        { creatorId: creators.mega_beauty_tips.id, senderId: null, content: 'Terima kasih kak! Ditunggu ya.', isReadByInternal: false },
        { creatorId: creators.lina_glow_up.id, senderId: users.bd_siti.id, content: 'Lina, sample produknya sudah dikirim ya. Nomor resi: JNE1234567890' },
        { creatorId: creators.lina_glow_up.id, senderId: null, content: 'Makasih kak, saya tunggu ya paketnya!', isReadByInternal: true },
        { creatorId: creators.eko_hairstyle.id, senderId: users.tl_dewi.id, content: 'Eko, videonya perlu revisi. Durasi min 30 detik & tambahkan demo pakai produk.' },
        { creatorId: creators.eko_hairstyle.id, senderId: null, content: 'Oke kak, saya revisi dulu. Kapan deadline-nya?', isReadByInternal: false },
    ];

    for (const m of messagesData) {
        await prisma.creatorMessage.create({ data: m as any });
    }
    console.log(`  + ${messagesData.length} creator messages`);

    // ============ NOTIFICATIONS ============
    const notificationsData = [
        { userId: users.bd_andi.id, title: 'Invoice Ditandatangani', content: 'Invoice untuk Fitri Anggraini telah ditandatangani.', type: 'INFO', isRead: true },
        { userId: users.bd_andi.id, title: 'Session Kedaluwarsa', content: 'Signing session untuk Citra Purnama telah kedaluwarsa.', type: 'ALERT', isRead: false },
        { userId: users.bd_siti.id, title: 'Video Baru', content: 'Creator Mega Putri telah mengupload video baru.', type: 'INFO', isRead: false },
        { userId: users.tl_dewi.id, title: 'Review Diperlukan', content: 'Video dari Dimas Kurniawan menunggu review.', type: 'SYSTEM', isRead: false },
        { userId: users.finance_rina.id, title: 'Pembayaran Pending', content: '3 invoice menunggu proses pembayaran.', type: 'ALERT', isRead: false },
        { userId: users.bd_budi.id, title: 'Creator Baru', content: 'Eko Setiawan berhasil ditambahkan ke pipeline.', type: 'INFO', isRead: true },
        { userId: users.manager_david.id, title: 'Laporan Mingguan', content: 'Laporan mingguan tersedia. 12 creator aktif, 5 invoice completed.', type: 'SYSTEM', isRead: false },
        { userId: users.curator_maya.id, title: 'Video Endorsement', content: 'Video Wulan Pertiwi siap untuk endorsement review.', type: 'INFO', isRead: true },
    ];

    for (const n of notificationsData) {
        await prisma.notification.create({ data: n as any });
    }
    console.log(`  + ${notificationsData.length} notifications`);

    // ============ ACTIVITY LOGS ============
    const activitiesData = [
        { userId: users.bd_andi.id, action: 'CREATE_CREATOR', details: 'Created creator: Ratna Dewi (@ratna_dewi_beauty)', creatorId: creators.ratna_dewi_beauty.id },
        { userId: users.bd_andi.id, action: 'CREATE_CREATOR', details: 'Created creator: Ahmad Fauzi (@fauzi_haircare)', creatorId: creators.fauzi_haircare.id },
        { userId: users.bd_siti.id, action: 'CREATE_CREATOR', details: 'Created creator: Lina Marlina (@lina_glow_up)', creatorId: creators.lina_glow_up.id },
        { userId: users.bd_siti.id, action: 'UPDATE_STATUS', details: 'Status changed: REACHOUT -> DEALING for Lina Marlina', creatorId: creators.lina_glow_up.id },
        { userId: users.bd_siti.id, action: 'UPDATE_STATUS', details: 'Status changed: DEALING -> SAMPLING for Lina Marlina', creatorId: creators.lina_glow_up.id },
        { userId: users.bd_siti.id, action: 'GENERATE_INVOICE', details: 'Generated invoice for Fitri Anggraini: A-001-INV-DTI', creatorId: creators.fitri_haircolor.id },
        { userId: users.bd_andi.id, action: 'GENERATE_INVOICE', details: 'Generated invoice for Rendi Saputra: A-002-INV-DTI', creatorId: creators.rendi_hairhacks.id },
        { userId: users.tl_dewi.id, action: 'REVIEW_VIDEO', details: 'Approved video for Mega Putri', creatorId: creators.mega_beauty_tips.id },
        { userId: users.tl_dewi.id, action: 'REVIEW_VIDEO', details: 'Requested revision for Eko Setiawan: durasi terlalu pendek', creatorId: creators.eko_hairstyle.id },
        { userId: users.bd_budi.id, action: 'GENERATE_INVOICE', details: 'Generated invoice for Bayu Pratama: B-004-INV-DTI', creatorId: creators.bayu_grooming.id },
        { userId: users.curator_maya.id, action: 'ENDORSE_VIDEO', details: 'Endorsed video for Wulan Pertiwi', creatorId: creators.wulan_cantik.id },
        { userId: users.finance_rina.id, action: 'PROCESS_PAYMENT', details: 'Processed payment for Fitri Anggraini: Rp 500.000' },
        { userId: users.finance_rina.id, action: 'PROCESS_PAYMENT', details: 'Processed payment for Bayu Pratama: Rp 350.000' },
        { userId: users.manager_david.id, action: 'VIEW_REPORT', details: 'Viewed weekly report' },
        { userId: users.bd_andi.id, action: 'CREATE_SESSION', details: 'Created signing session for Rendi Saputra (INVOICE)', creatorId: creators.rendi_hairhacks.id },
    ];

    for (const a of activitiesData) {
        await prisma.activityLog.create({ data: a as any });
    }
    console.log(`  + ${activitiesData.length} activity logs`);

    // ============ USER SEQUENCES ============
    const sequencesData = [
        { userId: users.bd_andi.id, docType: 'INVOICE', category: 'A', lastRef: 5, lastSeq: 5 },
        { userId: users.bd_andi.id, docType: 'MOU', category: 'A', lastRef: 2, lastSeq: 2 },
        { userId: users.bd_siti.id, docType: 'INVOICE', category: 'A', lastRef: 3, lastSeq: 3 },
        { userId: users.bd_siti.id, docType: 'MOU', category: 'A', lastRef: 1, lastSeq: 1 },
        { userId: users.bd_budi.id, docType: 'INVOICE', category: 'B', lastRef: 6, lastSeq: 6 },
        { userId: users.bd_budi.id, docType: 'MOU', category: 'B', lastRef: 3, lastSeq: 3 },
    ];

    for (const s of sequencesData) {
        await prisma.userSequence.upsert({
            where: {
                userId_docType_category: {
                    userId: s.userId,
                    docType: s.docType as any,
                    category: s.category,
                },
            },
            update: {},
            create: s as any,
        });
    }
    console.log(`  + ${sequencesData.length} user sequences`);

    // ============ REPORT LOCK (singleton) ============
    await prisma.reportLock.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton', isLocked: false },
    });
    console.log('  + ReportLock singleton');

    // ============ CHANGE REQUESTS ============
    await prisma.changeRequest.create({
        data: {
            userId: users.bd_andi.id,
            type: 'NAME',
            requestedValue: 'Andi Prasetyo Wijaya',
            status: 'PENDING',
        },
    });
    await prisma.changeRequest.create({
        data: {
            userId: users.bd_budi.id,
            type: 'USERNAME',
            requestedValue: 'budi_santoso',
            status: 'APPROVED',
            approvedById: users.bd_am_yoel.id,
        },
    });
    console.log('  + 2 change requests');

    // ============ SUMMARY ============
    console.log('\n=== Seed completed! ===\n');
    console.log('Test Credentials (password for all: crowncare123):');
    console.log('-'.repeat(65));
    console.log('Role                   | Username          | Full Name');
    console.log('-'.repeat(65));
    for (const u of usersData) {
        console.log(`${u.role.padEnd(22)} | ${u.username.padEnd(17)} | ${u.fullName}`);
    }
    console.log('-'.repeat(65));
    console.log('\nCreators seeded: 12 (all statuses covered)');
    console.log('Documents seeded: 7 (DRAFT, PENDING_SIGN, COMPLETED)');
    console.log('Signing sessions: 4 (PENDING, COMPLETED, EXPIRED)');
    console.log(`Messages: ${messagesData.length}, Notifications: ${notificationsData.length}, Activities: ${activitiesData.length}`);
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
