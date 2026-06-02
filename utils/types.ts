export interface InvoiceItem {
    no: number;
    description: string;
    qty: number;
    unit_price: number;
    total: number;
}

export interface ClientDetails {
    name: string;
    address_lines: string[];
}

export interface PaymentDetails {
    bank_name: string;
    account_name: string;
    account_number: string;
    swift_code: string;
    kcp_kota: string;
}

export interface InvoiceData {
    invoice_no: string;
    invoice_date: string;
    from_name: string;
    from_username: string;
    to: ClientDetails;
    items: InvoiceItem[];
    payment_details: PaymentDetails;
    signature: {
        name: string;
        image_base64: string;
    };
    sub_total: number;
    total_due: number;
    is_dp?: boolean;
    dp_percentage?: number;
    done_payment?: number;
    remaining_payment?: number;
    // Reference number for filename
    ref_number: string; // 3 digits for internal tracking
    mou_reference?: string;
    nik?: string;
    npwp?: string;
    isRevision?: boolean;
    revisionCount?: number;
}
