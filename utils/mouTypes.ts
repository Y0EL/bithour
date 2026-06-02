export interface MOUData {
    // Document Metadata
    mou_number: string; // e.g., "MoU-DTI-VIDEO-_IRENENOTHERE-20251107"
    agreement_date: string; // e.g., "7 November 2025"
    agreement_date_short: string; // e.g., "2025-11-07" for filename

    // Party 1 (PT. Bithour Production Indonesia) - Usually pre-filled
    party1_name: string; // "Bithour Production"
    party1_company: string; // "PT. Bithour Production Indonesia"
    party1_position: string; // "Direktur"
    party1_address: string; // Full company address

    // Party 2 (Creator)
    party2_name: string; // e.g., "Irene Tamariska Limbong"
    party2_ktp: string; // 16 digits, e.g., "5371044105030003"
    party2_address: string; // Full address
    party2_username: string; // e.g., "_irenenothere"

    // Content Details
    content_title: string; // e.g., "Video (_irenenothere)"
    content_type: string; // e.g., "Video pendek untuk keperluan promosi (platform TikTok, Instagram, dll.)"
    content_type_code: string; // "VIDEO", "FOTO", "ARTIKEL"
    creation_date: string; // e.g., "7 November 2025"
    duration: string; // e.g., "1-5 menit"

    // Platform Accounts (array for loop)
    platform_accounts: string[]; // e.g., ["crowncare.id", "crowncare_sisirpewarna", ...]

    // Payment Details
    is_paid: boolean; // true = show payment section, false = show unpaid section
    compensation_amount: string; // e.g., "100.000"
    compensation_in_words: string; // e.g., "seratus ribu rupiah"
    bank_name: string; // e.g., "BRI"
    account_holder: string; // e.g., "Irene Tamariska Limbong"
    account_number: string; // e.g., "748501019318530"
    kcp_kota: string; // e.g., "Kota Bandung"

    // Signature Date
    sign_date: string; // e.g., "7 November 2025"
    sign_location: string; // e.g., "Jakarta"

    // Reference number for filename
    ref_number: string; // 3 digits for internal tracking
    npwp?: string;
    isRevision?: boolean;
    revisionCount?: number;
}

export interface SignatureData {
    dataUrl: string; // base64 PNG with transparency
    isEmpty: boolean;
}

export interface MOUFormData extends MOUData {
    signature_party1: SignatureData;
    signature_party2: SignatureData;
}

// Helper type for API request
export interface MOURenderRequest {
    fields: MOUData;
    signature_party1_base64?: string;
    signature_party2_base64?: string;
}

