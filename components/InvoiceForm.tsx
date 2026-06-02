'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash, FileText, Download, Loader2, Settings, Users, Sparkles, Link as LinkIcon, Clipboard, CreditCard, Info, Hash, Calendar, Layers, ShieldCheck, RefreshCw } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { InvoiceData, InvoiceItem } from '@/utils/types';
import { useMediaQuery, useTheme } from '@mui/material';
import SessionSuccessModal from './SessionSuccessModal';
import SequenceSetupModal from './SequenceSetupModal';
import SkippedNumberModal from './SkippedNumberModal';
import SuccessModal from './SuccessModal';
import { useTranslation } from 'react-i18next';
import { normalizeBankName } from '@/utils/numberUtils';
import { useJobStatus } from '@/lib/useJobStatus';

const BANKS: Record<string, string> = {
    "Mandiri": "BMRIIDJA",
    "BRI": "BRINIDJA",
    "BCA": "CENAIDJA",
    "BNI": "BNINIDJA",
    "BTN": "BTANIDJA",
    "BSI": "BSMDIDJA",
    "CIMB Niaga": "BNIAIDJA",
    "OCBC NISP": "NISPIDJA",
    "Permata": "BBBAIDJA",
    "Danamon": "BDINIDJA",
    "DANA": "DANAIDJA",
    "Virtual Account": "VA"
};

const INITIAL_DATA: InvoiceData = {
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    from_name: '',
    from_username: '',
    to: {
        name: 'PT. BITHOUR PRODUCTION INDONESIA',
        address_lines: [
            'JL. PLUIT KARANG AYU BARAT BLOK. A1 U NO. 48',
            'PLUIT, PENJARINGAN',
            'JAKARTA UTARA',
            'DKI JAKARTA'
        ]
    },
    items: [
        { no: 1, description: 'PURCHASE OWNING CONTENT (1st COLLABORATION) ', qty: 1, unit_price: 100000, total: 100000 }
    ],
    payment_details: {
        bank_name: '',
        account_name: '',
        account_number: '',
        swift_code: '',
        kcp_kota: ''
    },
    signature: {
        name: '',
        image_base64: ''
    },
    sub_total: 0,
    total_due: 0,
    ref_number: '',
    mou_reference: '',
    nik: '',
    npwp: ''
};

const InvoiceForm = ({ sessionId, mouId }: { sessionId?: string, mouId?: string }) => {
    // MUI Responsive Hooks
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    const [formData, setFormData] = useState<InvoiceData>(INITIAL_DATA);
    const [invType, setInvType] = useState<'A' | 'B' | 'C' | 'D'>('B');
    const [refNum, setRefNum] = useState<string>('081');
    const [invSequence, setInvSequence] = useState<string>('0014');
    const [isOtherBank, setIsOtherBank] = useState(false);
    const [loading, setLoading] = useState(false);
    const [parsingLoading, setParsingLoading] = useState(false);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [sessionUrl, setSessionUrl] = useState<string | null>(null);
    const [pasteText, setPasteText] = useState('');
    const [showPaste, setShowPaste] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [showSkippedModal, setShowSkippedModal] = useState(false);
    const [skippedData, setSkippedData] = useState<{ refs: string[], seqs: string[], smartRef: string, smartSeq: string, absRef: string, absSeq: string }>({
        refs: [], seqs: [], smartRef: '', smartSeq: '', absRef: '', absSeq: ''
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [mous, setMous] = useState<any[]>([]);
    const [refOwnership, setRefOwnership] = useState<{ owner: string, docNo: string, source: string } | null>(null);
    const [checkingRef, setCheckingRef] = useState(false);
    const [isRevision, setIsRevision] = useState(false);
    const [revisionCount, setRevisionCount] = useState(0);
    const [isSignedData, setIsSignedData] = useState(false);
    const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '' });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: jobStatus, error: jobError, pollJobStatus } = useJobStatus();

    const getProgressMessage = (progress: number) => {
        if (progress <= 15) return "Setting up...";
        if (progress <= 30) return "Smart Numbering...";
        if (progress <= 50) return "Generating PDF...";
        if (progress <= 75) return "Database update...";
        if (progress <= 90) return "Sheet sync...";
        return "Finalizing...";
    };

    const isInitialLoad = React.useRef(true);
    const sessionFetched = React.useRef(false);

    const { t } = useTranslation();

    const fetchNextRef = async (manualRef?: string, currentType?: string, manualSeq?: string) => {
        const typeToUse = currentType || invType;
        try {
            const refRes = await fetch(`/api/documents/next-ref?type=INVOICE&category=${typeToUse}`);
            const refData = await refRes.json();

            if (refData.setup_needed) {
                setShowSetup(true);
            } else {
                setShowSetup(false);

                // Detection of gaps
                if ((refData.skippedRefs?.length > 0 || refData.skippedSeqs?.length > 0) && !manualRef && !manualSeq) {
                    setSkippedData({
                        refs: refData.skippedRefs || [],
                        seqs: refData.skippedSeqs || [],
                        smartRef: refData.nextRef,
                        smartSeq: refData.nextSeq,
                        absRef: refData.absoluteNextRef,
                        absSeq: refData.absoluteNextSeq
                    });
                    setShowSkippedModal(true);
                }

                if (manualRef) {
                    setRefNum(manualRef);
                } else if (refData.nextRef) {
                    setRefNum(refData.nextRef);
                }

                if (manualSeq) {
                    setInvSequence(manualSeq);
                } else if (refData.nextSeq) {
                    setInvSequence(refData.nextSeq);
                }
            }
        } catch (err) {
            console.error('Failed to fetch reference data', err);
        }
    };

    const resetForm = () => {
        setFormData({
            ...INITIAL_DATA,
            invoice_date: new Date().toISOString().split('T')[0]
        });
        setPasteText('');
        setPdfUrl(null);
        fetchNextRef();
    };

    // Fetch next reference number and MOUs
    useEffect(() => {
        const fetchMous = async () => {
            try {
                const mouRes = await fetch('/api/documents/list?type=MOU');
                const mouData = await mouRes.json();
                setMous(mouData);
            } catch (err) {
                console.error('Failed to fetch MOUs', err);
            }
        };
        fetchMous();

        // If sessionId is provided, fetch session data to pre-fill
        if (sessionId && !sessionFetched.current) {
            const fetchSession = async () => {
                setSessionLoading(true);
                try {
                    const res = await fetch(`/api/sessions/search?id=${sessionId}`);
                    const data = await res.json();
                    if (data && data.formData) {
                        setFormData(data.formData);
                        if (data.formData.invType) setInvType(data.formData.invType);
                        if (data.formData.refNum) setRefNum(data.formData.refNum);
                        if (data.formData.invSequence) setInvSequence(data.formData.invSequence);

                        // Check if session is already completed/signed
                        if (data.status === 'COMPLETED') {
                            setIsSignedData(true);
                        }

                        if (data.formData.payment_details?.bank_name && !BANKS[data.formData.payment_details.bank_name]) {
                            setIsOtherBank(true);
                        }
                        sessionFetched.current = true;
                    }
                } catch (err) {
                    console.error('Failed to fetch session data', err);
                } finally {
                    setSessionLoading(false);
                }
            };
            fetchSession();
        }

        // 3. If mouId is provided, fetch MOU to pre-fill
        if (mouId && !sessionFetched.current) {
            const fetchMou = async () => {
                setSessionLoading(true);
                try {
                    const res = await fetch(`/api/documents/${mouId}`);
                    const doc = await res.json();
                    if (doc && doc.metadata) {
                        const mouMeta = doc.metadata;
                        setFormData(prev => ({
                            ...prev,
                            from_name: mouMeta.party2_name || '',
                            from_username: (mouMeta.party2_username || '').replace(/^@/, ''),
                            nik: mouMeta.party2_ktp || '',
                            mou_reference: doc.documentNo || '',
                            payment_details: {
                                ...prev.payment_details,
                                bank_name: mouMeta.bank_name || '',
                                account_number: mouMeta.account_number || '',
                                account_name: mouMeta.account_holder || '',
                                kcp_kota: mouMeta.kcp_kota || '',
                            },
                            items: [
                                {
                                    no: 1,
                                    description: 'PURCHASE OWNING CONTENT (1st COLLABORATION)',
                                    qty: 1,
                                    unit_price: 100000,
                                    total: 100000
                                }
                            ],
                            signature: {
                                ...prev.signature,
                                name: mouMeta.party2_name || ''
                            }
                        }));

                        const parts = doc.documentNo ? doc.documentNo.split('-') : [];
                        // NEW MOU Format: Cat-MoU-DTI-YYYYMMDD-REF-SEQ
                        // Example: B-MoU-DTI-20260124-001-0001
                        let mouRef = '';
                        let mouSeq = '';

                        if (parts[1]?.toLowerCase() === 'mou') {
                            mouRef = parts[4] || ''; // Reference Number
                            mouSeq = parts[5] || ''; // Sequence Number
                        } else {
                            // Support old format if needed
                            mouRef = parts[1] || '';
                            mouSeq = parts[5] || '';
                        }

                        const mType = mouMeta.mouType || 'B';

                        setInvType(mType);
                        fetchNextRef(mouRef, mType, mouSeq);
                        sessionFetched.current = true;
                    }
                } catch (err) {
                    console.error('Failed to pre-fill from MOU', err);
                } finally {
                    setSessionLoading(false);
                }
            };
            fetchMou();
        }
    }, [sessionId, mouId]);

    // Fetch Next Ref Number and Seq when invType changes
    useEffect(() => {
        // Skip auto-fetch if we are editing a session
        if (sessionId || mouId) return;

        fetchNextRef();
    }, [invType, sessionId, mouId]);

    // REAL-TIME Ref Ownership Check (Debounced)
    useEffect(() => {
        if (!refNum || refNum.length < 2 || isRevision) {
            setRefOwnership(null);
            return;
        }

        const timer = setTimeout(async () => {
            setCheckingRef(true);
            try {
                const res = await fetch(`/api/documents/check-ref?type=INVOICE&category=${invType}&refNum=${refNum}`);
                const data = await res.json();
                if (!data.available) {
                    setRefOwnership({ owner: data.owner, docNo: data.docNo, source: data.source });
                } else {
                    setRefOwnership(null);
                }
            } catch (err) {
                console.error('Failed to check ref ownership', err);
            } finally {
                setCheckingRef(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [refNum, invType, isRevision]);

    // Auto-generate Invoice Number
    useEffect(() => {
        const dateStr = formData.invoice_date.replace(/-/g, '');
        const paddedSeq = invSequence.padStart(4, '0');
        const paddedRef = refNum.toString().padStart(3, '0');
        // User requested: Invoice No should NOT have revision suffix (-R1)
        // Only filename and dashboard title should have it.
        // Auto-generate invoice number based on fetched data
        // User requested: Cat-Ref-INV-DTI-YYYYMMDD-Seq
        // Example: B-086-INV-DTI-20260120-0019
        const invoiceNo = `${invType}-${paddedRef}-INV-DTI-${dateStr}-${paddedSeq}${isRevision ? ` REV${revisionCount + 1}` : ''}`;

        setFormData(prev => ({
            ...prev,
            invoice_no: invoiceNo,
            ref_number: refNum,
            isRevision: isRevision,
            revisionCount: revisionCount
        }));
    }, [invType, refNum, invSequence, formData.invoice_date, isRevision, revisionCount]);

    // Recalculate totals
    useEffect(() => {
        const subTotal = formData.items.reduce((sum, item) => sum + item.total, 0);
        let donePayment = subTotal;
        let remainingPayment = 0;

        if (invType === 'A' && formData.is_dp && formData.dp_percentage) {
            donePayment = Math.round(subTotal * (formData.dp_percentage / 100));
            remainingPayment = subTotal - donePayment;
        }

        setFormData(prev => ({
            ...prev,
            sub_total: subTotal,
            total_due: subTotal,
            done_payment: donePayment,
            remaining_payment: remainingPayment
        }));
    }, [formData.items, invType, formData.is_dp, formData.dp_percentage]);

    // Auto-normalize bank name
    useEffect(() => {
        if (formData.payment_details.bank_name) {
            const normalized = normalizeBankName(formData.payment_details.bank_name);
            if (formData.payment_details.bank_name !== normalized) {
                setFormData(prev => ({
                    ...prev,
                    payment_details: { ...prev.payment_details, bank_name: normalized }
                }));
            }
        }
    }, [formData.payment_details.bank_name]);

    // Handle Invoice Type Changes (Auto-fill)
    useEffect(() => {
        // DO NOT auto-fill items if we are in session edit mode or initial load
        if (sessionId || sessionFetched.current) return;

        if (invType === 'B') {
            setFormData(prev => ({
                ...prev,
                is_dp: false,
                items: [
                    { no: 1, description: 'PURCHASE OWNING CONTENT (1st COLLABORATION)', qty: 1, unit_price: 100000, total: 100000 }
                ]
            }));
        } else if (invType === 'A') {
            setFormData(prev => ({
                ...prev,
                is_dp: true,
                dp_percentage: 70,
                items: [
                    { no: 1, description: 'Purchase TikTok Video', qty: 1, unit_price: 0, total: 0 }
                ]
            }));
        }
    }, [invType, sessionId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...(prev as any)[parent],
                    [child]: value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'qty' || field === 'unit_price') {
            item.total = Number(item.qty) * Number(item.unit_price);
        }

        newItems[index] = item;
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { no: prev.items.length + 1, description: '', qty: 1, unit_price: 0, total: 0 }]
        }));
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, no: i + 1 }));
            setFormData(prev => ({ ...prev, items: newItems }));
        }
    };

    const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === "OTHER") {
            setIsOtherBank(true);
            setFormData(prev => ({
                ...prev,
                payment_details: { ...prev.payment_details, bank_name: '', swift_code: '' }
            }));
        } else {
            setIsOtherBank(false);
            setFormData(prev => ({
                ...prev,
                payment_details: { ...prev.payment_details, bank_name: value, swift_code: BANKS[value] || '' }
            }));
        }
    };

    const handleAIParse = async () => {
        if (!pasteText.trim()) return;
        setParsingLoading(true);
        try {
            const res = await fetch('/api/ai/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: pasteText, type: 'INVOICE' })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const aiBankName = data.bank_name || '';
            const matchedBank = Object.keys(BANKS).find(b =>
                b.toLowerCase().includes(aiBankName.toLowerCase()) ||
                aiBankName.toLowerCase().includes(b.toLowerCase())
            );

            if (aiBankName && !matchedBank) {
                setIsOtherBank(true);
            } else if (matchedBank) {
                setIsOtherBank(false);
            }

            setFormData(prev => ({
                ...prev,
                from_name: data.from_name || prev.from_name,
                from_username: data.from_username || prev.from_username,
                payment_details: {
                    ...prev.payment_details,
                    bank_name: matchedBank || aiBankName || prev.payment_details.bank_name,
                    account_number: data.account_number || prev.payment_details.account_number,
                    account_name: data.account_name || prev.payment_details.account_name,
                    kcp_kota: data.kcp_kota || prev.payment_details.kcp_kota,
                    swift_code: matchedBank ? BANKS[matchedBank] : prev.payment_details.swift_code
                }
            }));

            if (data.from_username) {
                setFormData(prev => ({
                    ...prev,
                    from_username: data.from_username.replace(/^@/, '')
                }));
            }
            setShowPaste(false);
        } catch (err: any) {
            alert('AI Error: ' + err.message);
        } finally {
            setParsingLoading(false);
        }
    };

    const handleCreateSession = async () => {
        setSessionLoading(true);
        setSessionUrl(null);
        try {
            const endpoint = sessionId
                ? `/api/sessions/update/${sessionId}`
                : '/api/sessions/create';

            const method = sessionId ? 'PATCH' : 'POST';

            const res = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'INVOICE',
                    formData: { ...formData, invType, refNum, invSequence, isRevision, revisionCount }
                })
            });
            const data = await res.json();

            if (data.signUrl || (sessionId && data.success)) {
                const baseUrl = window.location.origin;
                const token = data.token || (data.session && data.session.token);
                let finalUrl = data.signUrl || `${baseUrl}/sign/${token}`;

                // Force current origin if API returns localhost in production
                if (finalUrl.includes('localhost') && !window.location.host.includes('localhost')) {
                    finalUrl = `${baseUrl}/sign/${token}`;
                }

                setSessionUrl(finalUrl);
                setShowModal(true);
                // Blank the form after success
                resetForm();
            } else {
                alert(data.error || t('notifications.error_msg'));
            }
        } catch (error) {
            alert(t('notifications.error_msg'));
        } finally {
            setSessionLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setPdfUrl(null);
        setDocumentId(null);
        try {
            const response = await fetch('/api/sessions/direct-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formData: { ...formData, invType, refNum, invSequence, isRevision, revisionCount }, type: 'INVOICE' })
            });
            const data = await response.json();

            if (data.job_id) {
                // Poll for background job completion
                pollJobStatus(data.job_id, (result) => {
                    const jobResult = result as { pdf_url: string; document_id?: string };
                    if (jobResult && jobResult.pdf_url) {
                        setPdfUrl(jobResult.pdf_url);
                        if (jobResult.document_id) setDocumentId(jobResult.document_id);

                        // Auto-download (open in new tab)
                        const downloadUrl = jobResult.document_id
                            ? `/api/documents/${jobResult.document_id}/download?view=true`
                            : jobResult.pdf_url;
                        window.open(downloadUrl, '_blank');

                        setSuccessModal({
                            show: true,
                            title: t('notifications.pdf_generated_title'),
                            message: 'Your Invoice has been generated successfully and auto-download has been triggered.'
                        });
                        resetForm();
                        setLoading(false);
                    }
                }, (err) => {
                    console.error('Polling Error:', err);
                    setSuccessModal({
                        show: true,
                        title: 'Error',
                        message: 'Failed to generate PDF. Please try again or contact support.',
                    });
                    setLoading(false);
                });
            } else if (data.error) {
                setSuccessModal({
                    show: true,
                    title: 'Error',
                    message: data.error || t('notifications.error_msg'),
                });
                setLoading(false);
            }
        } catch (error) {
            setSuccessModal({
                show: true,
                title: 'Error',
                message: t('notifications.error_msg'),
            });
            setLoading(false);
        }
        // Note: setLoading(false) is handled inside pollJobStatus callback for success,
        // but we might want a timeout or manual cancel if it hangs.
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="grid gap-8 animate-in" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                <div style={{ padding: isMobile ? '20px 16px' : '0 0 48px' }}>
                    <div className="form-header" style={{ borderBottom: '2px solid #000', paddingBottom: '32px', marginBottom: '48px' }}>
                        <div className="form-header-title">
                            <h2 style={{ fontSize: '36px' }}>Create New Invoice</h2>
                            <p style={{ fontSize: '14px', fontWeight: 600 }}>Generate professional invoice with ease</p>
                        </div>
                        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 900, color: '#000', fontFamily: 'monospace', letterSpacing: '1px', background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>{formData.invoice_no}</div>
                            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px', fontWeight: 700 }}>{formData.invoice_date}</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
                        <button
                            type="button"
                            onClick={() => setShowPaste(!showPaste)}
                            className="btn btn-outline"
                            style={{ width: '100%', borderStyle: 'dashed', gap: '8px', height: isMobile ? '48px' : '56px', borderRadius: '16px', fontSize: isMobile ? '13px' : '15px' }}
                        >
                            <Clipboard size={18} /> {showPaste ? 'Hide Paste Area' : 'Paste Data from Broadcast'}
                        </button>

                        {showPaste && (
                            <div className="animate-in" style={{ marginTop: '16px', background: 'var(--background-alt)', padding: isMobile ? '16px' : '24px', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                <textarea
                                    value={pasteText}
                                    onChange={(e) => setPasteText(e.target.value)}
                                    className="form-control"
                                    placeholder="Paste the broadcast text here... Our AI will automatically extract Name and Bank Info."
                                    rows={isMobile ? 6 : 8}
                                    style={{ marginBottom: '16px', resize: 'none', fontSize: '14px' }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAIParse}
                                    disabled={parsingLoading}
                                    className="btn btn-accent"
                                    style={{ width: '100%', height: '48px' }}
                                >
                                    {parsingLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                                    {parsingLoading ? 'PARSING...' : 'PARSE WITH AI'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RE-DESIGNED INVOICE SETTINGS SECTION */}
                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className="form-section-icon">
                                    <Settings size={18} className="text-primary" />
                                </div>
                                <h3 className="form-section-title" style={{ marginLeft: '6px' }}>Invoice Settings</h3>
                            </div>
                        </div>

                        <div className="settings-container" style={{ background: 'transparent', border: 'none', padding: isMobile ? '0' : '8px 0' }}>
                            <div className="settings-row">
                                <div className="input-group" style={{ flex: 2 }}>
                                    <label className="input-label">
                                        <Layers size={14} style={{ marginRight: '6px' }} /> Invoice Type
                                    </label>
                                    <select
                                        value={invType}
                                        onChange={(e) => setInvType(e.target.value as any)}
                                        className="form-control"
                                        style={{ fontWeight: 600 }}
                                    >
                                        <option value="B">B - Owning Content</option>
                                        <option value="A">A - Endorsement</option>
                                        <option value="C">C - Digital Assets</option>
                                        <option value="D">D - Exclusive</option>
                                    </select>
                                </div>
                                <div className="input-group" style={{ flex: 1.5 }}>
                                    <label className="input-label">
                                        <Calendar size={14} style={{ marginRight: '6px' }} /> Invoice Date
                                    </label>
                                    <input
                                        type="date"
                                        name="invoice_date"
                                        value={formData.invoice_date}
                                        onChange={handleInputChange}
                                        className="form-control"
                                    />
                                </div>
                            </div>

                            <div className="settings-row" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #eee', flexDirection: isMobile ? 'column' : 'row' }}>
                                <div style={{ flex: isMobile ? 'none' : 2, display: 'flex', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label className="input-label">
                                            <Hash size={14} style={{ marginRight: '6px' }} /> Ref Num
                                        </label>
                                        <input
                                            type="text"
                                            value={refNum}
                                            onChange={(e) => setRefNum(e.target.value)}
                                            className="form-control"
                                            maxLength={4}
                                            style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, borderColor: refOwnership ? '#ef4444' : undefined, boxShadow: refOwnership ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : undefined }}
                                        />
                                        {checkingRef && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>{t('common.loading')}</div>}
                                        {refOwnership && (
                                            <div className="animate-in" style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px', fontWeight: 700, padding: '8px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                                {t('notifications.ref_used_by', { owner: refOwnership.owner })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="input-group" style={{ flex: 1.5 }}>
                                        <label className="input-label">
                                            <ShieldCheck size={14} style={{ marginRight: '6px' }} /> Sequence
                                        </label>
                                        <input
                                            type="text"
                                            value={invSequence}
                                            onChange={(e) => setInvSequence(e.target.value)}
                                            className="form-control"
                                            maxLength={4}
                                            style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}
                                        />
                                    </div>
                                </div>

                                {invType === 'A' && (
                                    <div className="input-group animate-in" style={{ flex: 1.5 }}>
                                        <label className="input-label">Payment Mode</label>
                                        <div className="payment-mode-box">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_dp}
                                                    onChange={(e) => setFormData(p => ({ ...p, is_dp: e.target.checked }))}
                                                    style={{ width: '20px', height: '20px', accentColor: '#000' }}
                                                />
                                                Use DP
                                            </label>
                                            {formData.is_dp && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <input
                                                        type="number"
                                                        value={formData.dp_percentage}
                                                        onChange={(e) => setFormData(p => ({ ...p, dp_percentage: Number(e.target.value) }))}
                                                        className="form-control"
                                                        style={{ width: '60px', height: '36px', textAlign: 'center', padding: '0 4px', fontSize: '13px' }}
                                                    />
                                                    <span style={{ fontSize: '12px', fontWeight: 800 }}>%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <Users size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Sender Information</h3>
                        </div>

                        <div className="grid grid-cols-2" style={{ gap: isMobile ? '0px' : '24px' }}>
                            <div className="input-group">
                                <label className="input-label">Full Name</label>
                                <input
                                    type="text"
                                    name="from_name"
                                    value={formData.from_name}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    placeholder="Nama Lengkap"
                                    style={{ height: isMobile ? '48px' : '56px' }}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">TikTok Username</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        name="from_username"
                                        value={formData.from_username}
                                        onChange={handleInputChange}
                                        className="form-control"
                                        style={{ paddingLeft: '32px', height: isMobile ? '48px' : '56px' }}
                                        placeholder="username"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">MoU Reference (Link to MOU)</label>
                            <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
                                <select
                                    className="form-control"
                                    style={{ flex: isMobile ? 'none' : 1, fontWeight: 600, height: isMobile ? '48px' : '56px' }}
                                    onChange={(e) => {
                                        const selectedMou = mous.find(m => m.documentNo === e.target.value);
                                        if (selectedMou) {
                                            const meta = selectedMou.metadata || {};
                                            setFormData(p => ({
                                                ...p,
                                                mou_reference: selectedMou.documentNo,
                                                from_name: meta.party2_name || p.from_name,
                                                from_username: meta.party2_username || p.from_username,
                                                nik: meta.party2_ktp || p.nik,
                                                npwp: meta.npwp || p.npwp
                                            }));
                                        }
                                    }}
                                    value={mous.find(m => m.documentNo === formData.mou_reference) ? formData.mou_reference : ''}
                                >
                                    <option value="">-- Auto-select from MoU --</option>
                                    {mous.map((m, i) => (
                                        <option key={m.id} value={m.documentNo}>
                                            [{m.documentNo}] - {m.metadata?.party2_name || 'No Name'} {i === 0 ? '🔥' : ''}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    name="mou_reference"
                                    value={formData.mou_reference}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    style={{ flex: isMobile ? 'none' : 1, height: isMobile ? '48px' : '56px' }}
                                    placeholder="Type manually..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2" style={{ gap: isMobile ? '0px' : '24px' }}>
                            <div className="input-group">
                                <label className="input-label">NIK (ID Card Num)</label>
                                <input
                                    type="text"
                                    name="nik"
                                    value={formData.nik}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    placeholder="16 digits"
                                    maxLength={16}
                                    style={{ height: isMobile ? '48px' : '56px' }}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">NPWP (Tax Num)</label>
                                <input
                                    type="text"
                                    name="npwp"
                                    value={formData.npwp}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    placeholder="NPWP Number"
                                    style={{ height: isMobile ? '48px' : '56px' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <FileText size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Invoice Items</h3>
                        </div>

                        <div className="table-responsive-container">
                            <table className="responsive-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>No</th>
                                        <th>Description</th>
                                        <th style={{ width: '80px' }}>Qty</th>
                                        <th style={{ width: '150px' }}>Price</th>
                                        <th style={{ width: '150px' }}>Total</th>
                                        <th style={{ width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, index) => (
                                        <tr key={index}>
                                            <td data-label="No">{item.no}</td>
                                            <td data-label="Description">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                    className="form-control-item"
                                                    placeholder="Item description"
                                                />
                                            </td>
                                            <td data-label="Qty">
                                                <input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                                                    className="form-control-item"
                                                />
                                            </td>
                                            <td data-label="Unit Price">
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: '0px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', fontWeight: 700 }}>Rp</span>
                                                    <input
                                                        type="number"
                                                        value={item.unit_price}
                                                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                                                        className="form-control-item"
                                                        style={{ paddingLeft: '22px' }}
                                                    />
                                                </div>
                                            </td>
                                            <td data-label="Total">
                                                <span style={{ fontWeight: 800 }}>Rp {item.total.toLocaleString()}</span>
                                            </td>
                                            <td className="remove-btn-container">
                                                <button type="button" onClick={() => removeItem(index)} className="btn-icon-red">
                                                    <Trash size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button type="button" onClick={addItem} className="btn-add-item">
                            <Plus size={18} /> Add New Item
                        </button>
                    </div>

                    <div style={{ marginBottom: '48px', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '320px', background: 'rgba(0,0,0,0.02)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '14px', fontWeight: 600 }}>Sub Total</span>
                                <span style={{ fontWeight: 700 }}>Rp {formData.sub_total.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: '12px', marginTop: '12px' }}>
                                <span style={{ fontWeight: 800, fontSize: '16px' }}>Total Due</span>
                                <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '20px' }}>Rp {formData.total_due.toLocaleString()}</span>
                            </div>

                            {invType === 'A' && formData.is_dp && (
                                <div className="animate-in" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #ccc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#059669', fontSize: '12px', fontWeight: 800 }}>PAYMENT 1 (DP {formData.dp_percentage}%)</span>
                                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>Rp {formData.done_payment?.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 800 }}>PAYMENT 2 (REMAINING)</span>
                                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#dc2626' }}>Rp {formData.remaining_payment?.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <CreditCard size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Payment Details</h3>
                        </div>

                        <div className="grid grid-cols-2">
                            <div className="input-group">
                                <label className="input-label">Bank Name</label>
                                <select
                                    value={isOtherBank ? "OTHER" : formData.payment_details.bank_name}
                                    onChange={handleBankChange}
                                    className="form-control"
                                    style={{ fontWeight: 600 }}
                                >
                                    <option value="">Select Bank</option>
                                    {Object.keys(BANKS).sort().map(bank => (
                                        <option key={bank} value={bank}>{bank}</option>
                                    ))}
                                    <option value="OTHER">Other Bank (Manual Info)</option>
                                </select>
                            </div>
                            {isOtherBank && (
                                <div className="input-group animate-in">
                                    <label className="input-label">Other Bank Name</label>
                                    <input
                                        type="text"
                                        name="payment_details.bank_name"
                                        value={formData.payment_details.bank_name}
                                        onChange={handleInputChange}
                                        className="form-control"
                                        required
                                    />
                                </div>
                            )}
                            <div className="input-group">
                                <label className="input-label">
                                    {['DANA', 'VIRTUAL ACCOUNT'].includes((formData.payment_details.bank_name || '').toUpperCase()) ? 'Virtual Account' : 'Account Number'}
                                </label>
                                <input
                                    type="text"
                                    name="payment_details.account_number"
                                    value={formData.payment_details.account_number}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    placeholder="Account Number"
                                    style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700 }}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2">
                            <div className="input-group">
                                <label className="input-label">Account Holder Name</label>
                                <input
                                    type="text"
                                    name="payment_details.account_name"
                                    value={formData.payment_details.account_name}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    placeholder="Receiving Name"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">KCP / City</label>
                                <input
                                    type="text"
                                    name="payment_details.kcp_kota"
                                    value={formData.payment_details.kcp_kota}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    placeholder="e.g. Jakarta"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions-bar">
                        {!pdfUrl ? (
                            <>
                                {isSignedData && !isRevision ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentRev = formData.revisionCount || 0;
                                            setIsRevision(true);
                                            setRevisionCount(currentRev + 1);
                                        }}
                                        className="btn btn-primary"
                                        style={{ flex: 1.5, height: '64px', borderRadius: '16px', background: '#e71616ff' }}
                                    >
                                        <RefreshCw size={20} />
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '15px', fontWeight: 800 }}>REVISE</div>
                                        </div>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleCreateSession}
                                        className="btn btn-primary"
                                        style={{ flex: 1.5, height: '64px', borderRadius: '16px' }}
                                        disabled={sessionLoading}
                                    >
                                        {sessionLoading ? <Loader2 className="animate-spin" /> : <LinkIcon size={20} />}
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '15px', fontWeight: 800 }}>
                                                {isRevision ? 'UPDATE REVISION' : (sessionId ? 'UPDATE SESSION' : 'CREATE SESSION')}
                                            </div>
                                        </div>
                                    </button>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-outline"
                                    style={{ flex: 1, height: '64px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <Loader2 className="animate-spin" size={18} />
                                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {jobStatus ? getProgressMessage(jobStatus.progress) : 'ENQUEUING...'}
                                            </div>
                                            {jobStatus && (
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', background: 'var(--primary)', width: `${jobStatus.progress}%`, transition: 'width 0.3s' }} />
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <FileText size={20} />
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontSize: '15px', fontWeight: 800 }}>DRAFT PDF</div>
                                            </div>
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                <a
                                    href={documentId ? `/api/documents/${documentId}/download?view=true` : pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary"
                                    style={{ flex: 2, height: '64px', borderRadius: '16px' }}
                                >
                                    <Download size={22} />
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '16px', fontWeight: 800 }}>DOWNLOAD PDF</div>
                                    </div>
                                </a>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setPdfUrl(null);
                                        setDocumentId(null);
                                    }}
                                    className="btn btn-outline"
                                    style={{ flex: 1, height: '64px', borderRadius: '16px' }}
                                >
                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>Edit Again</div>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginTop: '24px', fontWeight: 600 }}>
                    &copy; {new Date().getFullYear()} Crowncare Invoice System
                </p>
            </form>

            <SessionSuccessModal
                open={showModal}
                onClose={() => setShowModal(false)}
                url={sessionUrl}
                creatorName={formData.from_name || 'Creator'}
            />

            <SequenceSetupModal
                open={showSetup}
                type="INVOICE"
                category={invType}
                onSuccess={(ref, seq) => {
                    setRefNum(ref);
                    setInvSequence(seq);
                    setShowSetup(false);
                }}
            />

            <SkippedNumberModal
                open={showSkippedModal}
                onClose={() => setShowSkippedModal(false)}
                skippedRefs={skippedData.refs}
                skippedSeqs={skippedData.seqs}
                nextRef={skippedData.absRef}
                nextSeq={skippedData.absSeq}
                onSelectRef={(ref) => {
                    setRefNum(ref);
                    setShowSkippedModal(false);
                }}
                onSelectSeq={(seq) => {
                    setInvSequence(seq);
                    setShowSkippedModal(false);
                }}
                onUseLatest={() => {
                    setRefNum(skippedData.absRef);
                    setInvSequence(skippedData.absSeq);
                    setShowSkippedModal(false);
                }}
            />

            <SuccessModal
                show={successModal.show}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, show: false })}
            />

            <style jsx>{`
                .glass-card {
                    background: white;
                    border-radius: 40px;
                    border: 1px solid var(--border);
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                }
                @media (max-width: 768px) {
                    .glass-card { border-radius: 24px; }
                }
                .settings-container {
                    background: #f9fafb;
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    padding: 16px;
                }
                .settings-row {
                    display: flex;
                    gap: 16px;
                }
                @media (max-width: 768px) {
                    .settings-row { flex-direction: column; gap: 0; }
                    .settings-container { padding: 12px; }
                }
                .payment-mode-box {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: white;
                    border: 1px solid var(--border);
                    height: 44px;
                    padding: 0 12px;
                    border-radius: 12px;
                }
                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-bottom: 16px;
                }
                .input-label {
                    font-size: 11px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    display: flex;
                    align-items: center;
                }
                .form-control {
                    width: 100%;
                    height: 44px;
                    padding: 0 16px;
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    background: white;
                    font-size: 16px;
                    transition: border-color 0.2s ease, box-shadow 0.3s ease, background-color 0.2s ease;
                }
                .form-control-item {
                    width: 100%;
                    height: 36px;
                    padding: 0 8px;
                    border-radius: 8px;
                    border: 1px solid transparent;
                    background: transparent;
                    font-size: 16px;
                    transition: background-color 0.2s ease, border-color 0.2s ease;
                }
                .form-control-item:focus {
                    background: white;
                    border-color: var(--border);
                    outline: none;
                }
                
                tr:hover .form-control-item {
                    background: rgba(0,0,0,0.02);
                }

                .form-control:focus {
                    outline: none;
                    border-color: #000;
                    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.04);
                }
                textarea.form-control {
                    height: auto;
                    padding: 12px 16px;
                }
                .grid { display: grid; }
                .grid-cols-2 { grid-template-columns: repeat(2, 1fr); gap: 20px; }
                @media (max-width: 600px) {
                    .grid-cols-2 { grid-template-columns: 1fr; gap: 0px; }
                }
                .btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 0 20px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                .btn:hover { transform: translateY(-2px); }
                .btn:active { transform: translateY(0); }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                
                .btn-primary { background: #000; color: white; }
                .btn-accent { background: #f8fafc; color: #000; border: 1px solid var(--border); }
                .btn-outline { background: white; color: #000; border: 1px solid var(--border); }
                
                .btn-icon-red {
                    background: #fff1f2;
                    color: #e11d48;
                    border: none;
                    padding: 8px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-icon-red:hover { background: #fee2e2; transform: scale(1.1); }
                
                .btn-add-item {
                    width: 100%;
                    margin-top: 12px;
                    height: 40px;
                    background: #f9fafb;
                    border: 1px dashed var(--border);
                    border-radius: 12px;
                    color: var(--muted);
                    font-weight: 700;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                }
                .btn-add-item:hover { background: rgba(0,0,0,0.02); border-color: #000; color: #000; }

                .table-responsive-container {
                    overflow-x: auto;
                    border-radius: 16px;
                    border: 1px solid var(--border);
                    background: #fff;
                }

                .responsive-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .responsive-table th {
                    background: #f8fafc;
                    padding: 12px 16px;
                    text-align: left;
                    font-size: 11px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    border-bottom: 1px solid var(--border);
                }

                .responsive-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .form-actions-bar {
                    margin-top: 40px;
                    padding-top: 40px;
                    border-top: 1px solid var(--border);
                    display: flex;
                    gap: 16px;
                    flex-direction: column;
                }
                @media (min-width: 600px) {
                    .form-actions-bar {
                        flex-direction: row;
                    }
                }

                @media (max-width: 768px) {
                    .responsive-table thead { display: none; }
                    .responsive-table tr { 
                        display: block; 
                        padding: 16px; 
                        border-bottom: 1px solid var(--border);
                        position: relative;
                        background: #fff;
                        border-radius: 12px;
                        margin-bottom: 12px;
                    }
                    .responsive-table td {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 0;
                        border-bottom: 1px dashed #f1f5f9;
                    }
                    .responsive-table td:last-child { border-bottom: none; }
                    .responsive-table td::before {
                        content: attr(data-label);
                        font-weight: 800;
                        font-size: 11px;
                        color: #94a3b8;
                        text-transform: uppercase;
                    }
                    .responsive-table .remove-btn-container {
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        border: none;
                        padding: 0;
                    }
                    .form-control-item {
                        text-align: right;
                        width: 60%;
                        background: #f8fafc;
                        border-color: #f1f5f9;
                    }
                }

                .flex-responsive { display: flex; align-items: center; gap: 24px; }
                @media (max-width: 600px) {
                    .flex-responsive { flex-direction: column; align-items: flex-start; }
                    .settings-row { flex-direction: column; gap: 0; }
                }
                .animate-in {
                    animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    will-change: transform, opacity;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
};

export default InvoiceForm;
