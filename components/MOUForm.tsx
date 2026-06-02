'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Download, Plus, Trash2, Settings, Users, Info, CreditCard, Sparkles, Link as LinkIcon, Clipboard, CheckCircle, Calendar, Hash, ShieldCheck, Layers, RefreshCw } from 'lucide-react';
import { MOUFormData, SignatureData } from '@/utils/mouTypes';
import SignaturePad from './SignaturePad';
import { useMediaQuery, useTheme } from '@mui/material';
import SessionSuccessModal from './SessionSuccessModal';
import SequenceSetupModal from './SequenceSetupModal';
import SkippedNumberModal from './SkippedNumberModal';
import SuccessModal from './SuccessModal';
import { useTranslation } from 'react-i18next';
import { terbilang, normalizeBankName } from '@/utils/numberUtils';
import { useJobStatus } from '@/lib/useJobStatus';

const CONTENT_TYPE_MAP: Record<string, string> = {
    'Video pendek untuk keperluan promosi (platform TikTok, Instagram, dll.)': 'VIDEO',
    'Video panjang untuk keperluan promosi (platform YouTube, dll.)': 'VIDEO',
    'Konten foto untuk keperluan promosi (platform Instagram, Facebook, dll.)': 'FOTO',
    'Konten artikel/blog untuk keperluan promosi': 'ARTIKEL'
};

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

const INITIAL_MOU_DATA: MOUFormData = {
    mou_number: '',
    agreement_date: '',
    agreement_date_short: new Date().toISOString().split('T')[0],
    party1_name: 'Bithour Production',
    party1_company: 'PT. Bithour Production Indonesia',
    party1_position: 'Direktur',
    party1_address: 'Jl. Pluit Karang Utara Blok A1u Nomor 48 RT. 000 RW.000, Pluit, Penjaringan, Kota Adm. Jakarta Utara, DKI Jakarta',
    party2_name: '',
    party2_ktp: '',
    party2_address: '',
    party2_username: '',
    content_title: '',
    content_type: 'Video pendek untuk keperluan promosi (platform TikTok, Instagram, dll.)',
    content_type_code: 'VIDEO',
    creation_date: '',
    duration: '1-5 menit',
    platform_accounts: ['crowncare.id'],
    is_paid: true,
    compensation_amount: '100,000',
    compensation_in_words: 'Seratus Ribu Rupiah',
    bank_name: '',
    account_holder: '',
    account_number: '',
    kcp_kota: '',
    sign_date: '',
    sign_location: 'Jakarta',
    ref_number: '001',
    npwp: '',
    signature_party1: { dataUrl: '', isEmpty: true },
    signature_party2: { dataUrl: '', isEmpty: true },
};

const MOUForm = ({ sessionId }: { sessionId?: string }) => {
    // MUI Responsive Hooks
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [formData, setFormData] = useState<MOUFormData>(INITIAL_MOU_DATA);
    const [mouType, setMouType] = useState<'A' | 'B' | 'C' | 'D'>('B');
    const [mouSequence, setMouSequence] = useState<string>('0001');
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
    const [refOwnership, setRefOwnership] = useState<{ owner: string, docNo: string, source: string } | null>(null);
    const [checkingRef, setCheckingRef] = useState(false);
    const [isOtherBank, setIsOtherBank] = useState(false);
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

    // Fetch session data if sessionId exists
    useEffect(() => {
        if (sessionId && !sessionFetched.current) {
            const fetchSession = async () => {
                setSessionLoading(true);
                try {
                    const res = await fetch(`/api/sessions/search?id=${sessionId}`);
                    if (!res.ok) throw new Error('Session not found');
                    const data = await res.json();
                    if (data && data.formData) {
                        setFormData(data.formData);
                        if (data.formData.mouType) setMouType(data.formData.mouType);
                        if (data.formData.mouSequence) setMouSequence(data.formData.mouSequence);

                        // Check if session is already completed/signed
                        if (data.status === 'COMPLETED') {
                            setIsSignedData(true);
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
    }, [sessionId]);

    const fetchNextRef = async () => {
        if (sessionId) return;
        try {
            const res = await fetch(`/api/documents/next-ref?type=MOU&category=${mouType}`);
            const data = await res.json();

            if (data.setup_needed) {
                setShowSetup(true);
            } else {
                setShowSetup(false);

                // Detection of gaps
                if (data.skippedRefs?.length > 0 || data.skippedSeqs?.length > 0) {
                    setSkippedData({
                        refs: data.skippedRefs || [],
                        seqs: data.skippedSeqs || [],
                        smartRef: data.nextRef,
                        smartSeq: data.nextSeq,
                        absRef: data.absoluteNextRef,
                        absSeq: data.absoluteNextSeq
                    });
                    setShowSkippedModal(true);
                }

                if (data.nextRef) setFormData(prev => ({ ...prev, ref_number: data.nextRef }));
                if (data.nextSeq) setMouSequence(data.nextSeq);
            }
        } catch (err) {
            console.error('Failed to fetch next MOU ref', err);
        }
    };

    const resetForm = () => {
        setFormData({
            ...INITIAL_MOU_DATA,
            agreement_date_short: new Date().toISOString().split('T')[0]
        });
        setPasteText('');
        setPdfUrl('');
        fetchNextRef();
    };

    // Fetch next reference number
    useEffect(() => {
        // Skip if we are loading a session
        if (sessionId) return;

        fetchNextRef();
    }, [mouType, sessionId]);

    // REAL-TIME Ref Ownership Check (Debounced)
    useEffect(() => {
        if (!formData.ref_number || formData.ref_number.length < 2 || isRevision) {
            setRefOwnership(null);
            return;
        }

        const timer = setTimeout(async () => {
            setCheckingRef(true);
            try {
                const res = await fetch(`/api/documents/check-ref?type=MOU&category=${mouType}&refNum=${formData.ref_number}`);
                const data = await res.json();
                if (!data.available) {
                    setRefOwnership({ owner: data.owner, docNo: data.docNo, source: data.source });
                } else {
                    setRefOwnership(null);
                }
            } catch (err) {
                console.error('Failed to check MOU ref ownership', err);
            } finally {
                setCheckingRef(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [formData.ref_number, mouType, isRevision]);

    // Auto-generate fields based on inputs
    useEffect(() => {
        const updates: Partial<MOUFormData> = {};
        let hasChanges = false;

        const expectedTitle = formData.party2_username ? `Video (${formData.party2_username})` : '';
        if (expectedTitle && formData.content_title !== expectedTitle) {
            updates.content_title = expectedTitle;
            hasChanges = true;
        }

        if (formData.agreement_date_short) {
            const date = new Date(formData.agreement_date_short);
            if (!isNaN(date.getTime())) {
                const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                const formatted = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;

                if (formData.agreement_date !== formatted) {
                    updates.agreement_date = formatted;
                    updates.creation_date = formatted;
                    updates.sign_date = formatted;
                    hasChanges = true;
                }
            }
        }

        const dateStr = formData.agreement_date_short.replace(/-/g, '');
        const paddedSeq = mouSequence.padStart(4, '0');
        const paddedRef = formData.ref_number.toString().padStart(3, '0');

        // NEW MOU FORMAT: CAT-MoU-DTI-YYYYMMDD-REF-SEQ
        // Example: B-MoU-DTI-20260124-001-0001
        let expectedMouNum = `${mouType}-MoU-DTI-${dateStr}-${paddedRef}-${paddedSeq}`;

        if (isRevision && revisionCount > 0) {
            expectedMouNum += `-R${revisionCount}`;
        }

        if (formData.mou_number !== expectedMouNum) {
            updates.mou_number = expectedMouNum;
            updates.isRevision = isRevision;
            updates.revisionCount = revisionCount;
            hasChanges = true;
        }

        // Auto-fill terbilang for compensation
        if (formData.compensation_amount) {
            const amount = parseInt(formData.compensation_amount.toString().replace(/[^0-9]/g, ''));
            if (!isNaN(amount)) {
                const inWords = terbilang(amount) + ' Rupiah';
                if (formData.compensation_in_words !== inWords) {
                    updates.compensation_in_words = inWords;
                    hasChanges = true;
                }
            }
        }

        // Normalize bank name
        if (formData.bank_name) {
            const normalized = normalizeBankName(formData.bank_name);
            if (formData.bank_name !== normalized) {
                updates.bank_name = normalized;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            setFormData(prev => ({ ...prev, ...updates }));
        }
    }, [formData.party2_username, formData.agreement_date_short, formData.content_type_code, mouType, formData.ref_number, mouSequence, formData.compensation_amount, formData.bank_name]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (name === 'content_type') {
            setFormData(prev => ({
                ...prev,
                [name]: value,
                content_type_code: CONTENT_TYPE_MAP[value] || 'VIDEO'
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === "OTHER") {
            setIsOtherBank(true);
            setFormData(prev => ({
                ...prev,
                bank_name: ''
            }));
        } else {
            setIsOtherBank(false);
            setFormData(prev => ({
                ...prev,
                bank_name: value
            }));
        }
    };

    const handlePlatformAccountChange = (index: number, value: string) => {
        const newAccounts = [...formData.platform_accounts];
        newAccounts[index] = value;
        setFormData(prev => ({ ...prev, platform_accounts: newAccounts }));
    };

    const addPlatformAccount = () => {
        setFormData(prev => ({
            ...prev,
            platform_accounts: [...prev.platform_accounts, '']
        }));
    };

    const removePlatformAccount = (index: number) => {
        if (formData.platform_accounts.length > 1) {
            const newAccounts = formData.platform_accounts.filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, platform_accounts: newAccounts }));
        }
    };

    const handleSignature2Save = (signature: string | null) => {
        setFormData(prev => ({
            ...prev,
            signature_party2: {
                dataUrl: signature || '',
                isEmpty: !signature
            }
        }));
    };

    const handleAIParse = async () => {
        if (!pasteText.trim()) return;
        setParsingLoading(true);
        try {
            const res = await fetch('/api/ai/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: pasteText, type: 'MOU' })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setFormData(prev => ({
                ...prev,
                party2_name: data.party2_name || prev.party2_name,
                party2_username: data.party2_username || prev.party2_username,
                party2_ktp: data.party2_ktp || prev.party2_ktp,
                party2_address: data.party2_address || prev.party2_address,
                bank_name: data.bank_name || prev.bank_name,
                account_number: data.account_number || prev.account_number,
                account_holder: data.account_holder || prev.account_holder,
                kcp_kota: data.kcp_kota || prev.kcp_kota
            }));
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
                    type: 'MOU',
                    formData: { ...formData, mouType, mouSequence, isRevision, revisionCount }
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
                body: JSON.stringify({ formData: { ...formData, mouType, mouSequence, isRevision, revisionCount }, type: 'MOU' })
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
                            message: 'Your MOU has been generated successfully and auto-download has been triggered.'
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
            } else {
                setSuccessModal({
                    show: true,
                    title: 'Error',
                    message: data.error || t('notifications.error_msg'),
                });
                setLoading(false);
            }
        } catch (error) {
            console.error('Submit Error:', error);
            setSuccessModal({
                show: true,
                title: 'Error',
                message: t('notifications.error_msg'),
            });
            setLoading(false);
        } finally {
            // NOTE: We don't set loading to false here because pollJobStatus is async 
            // and we want to keep the spinner while polling. 
            // BUT we should add a timeout or error handler to useJobStatus if it fails.
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="grid gap-8 animate-in" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                <div style={{ padding: isMobile ? '20px 16px' : '0 0 48px' }}>
                    <div className="form-header" style={{ borderBottom: '2px solid #000', paddingBottom: '32px', marginBottom: '48px' }}>
                        <div className="form-header-title">
                            <h2 style={{ fontSize: '36px' }}>Create New MOU</h2>
                            <p style={{ fontSize: '14px', fontWeight: 600 }}>Draft exclusive creator agreements in seconds</p>
                        </div>
                        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 900, color: '#000', fontFamily: 'monospace', background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>{formData.mou_number}</div>
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
                                    placeholder="Paste the broadcast text here..."
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

                    {/* REDESIGNED DOCUMENT SETTINGS */}
                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className="form-section-icon">
                                    <Settings size={18} className="text-primary" />
                                </div>
                                <h3 className="form-section-title" style={{ marginLeft: '6px' }}>Document Settings</h3>
                            </div>
                        </div>

                        <div className="settings-container" style={{ background: 'transparent', border: 'none', padding: isMobile ? '0' : '8px 0' }}>
                            <div className="settings-row">
                                <div className="input-group" style={{ flex: 2 }}>
                                    <label className="input-label">
                                        <Layers size={14} style={{ marginRight: '6px' }} /> MOU Type
                                    </label>
                                    <select
                                        value={mouType}
                                        onChange={(e) => setMouType(e.target.value as any)}
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
                                        <Calendar size={14} style={{ marginRight: '6px' }} /> Agreement Date
                                    </label>
                                    <input
                                        type="date"
                                        name="agreement_date_short"
                                        value={formData.agreement_date_short}
                                        onChange={handleInputChange}
                                        className="form-control"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="settings-row" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #eee' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label">
                                        <Hash size={14} style={{ marginRight: '6px' }} /> Ref Num
                                    </label>
                                    <input
                                        type="text"
                                        name="ref_number"
                                        value={formData.ref_number}
                                        onChange={handleInputChange}
                                        className="form-control"
                                        placeholder="e.g. 0078"
                                        maxLength={4}
                                        required
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
                                        value={mouSequence}
                                        onChange={(e) => setMouSequence(e.target.value)}
                                        className="form-control"
                                        placeholder="e.g. 0014"
                                        maxLength={4}
                                        required
                                        style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <Info size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Pihak Pertama (PT. DTI)</h3>
                        </div>

                        <div className="grid grid-cols-2">
                            <div className="input-group">
                                <label className="input-label">Nama</label>
                                <input
                                    type="text"
                                    name="party1_name"
                                    value={formData.party1_name}
                                    className="form-control"
                                    style={{ background: 'var(--background)', cursor: 'not-allowed', color: '#64748b' }}
                                    readOnly
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Jabatan</label>
                                <input
                                    type="text"
                                    name="party1_position"
                                    value={formData.party1_position}
                                    className="form-control"
                                    style={{ background: 'var(--background)', cursor: 'not-allowed', color: '#64748b' }}
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <Users size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Pihak Kedua (Creator)</h3>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Nama Lengkap</label>
                            <input
                                type="text"
                                name="party2_name"
                                value={formData.party2_name}
                                onChange={handleInputChange}
                                className="form-control"
                                placeholder="Masukkan Nama Lengkap Sesuai KTP"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2">
                            <div className="input-group">
                                <label className="input-label">Nomor KTP (16 digit)</label>
                                <input
                                    type="text"
                                    name="party2_ktp"
                                    value={formData.party2_ktp}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    placeholder="Masukkan 16 Digit NIK KTP"
                                    maxLength={16}
                                    pattern="[0-9]{16}"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Username Creator</label>
                                <div style={{ position: 'relative' }}>                                    <input
                                    type="text"
                                    name="party2_username"
                                    value={formData.party2_username}
                                    onChange={handleInputChange}
                                    className="form-control"
                                    style={{ paddingLeft: '32px' }}
                                    placeholder="username"
                                    required
                                />
                                </div>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Alamat Lengkap</label>
                            <textarea
                                name="party2_address"
                                value={formData.party2_address}
                                onChange={handleInputChange}
                                className="form-control"
                                style={{ minHeight: '100px', resize: 'none' }}
                                placeholder="Masukkan Alamat Lengkap Sesuai KTP"
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">NPWP (Optional)</label>
                            <input
                                type="text"
                                name="npwp"
                                value={formData.npwp || ''}
                                onChange={handleInputChange}
                                className="form-control"
                                placeholder="Masukkan NPWP jika ada"
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <FileText size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Detail Konten</h3>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Jenis Konten</label>
                            <select
                                name="content_type"
                                value={formData.content_type}
                                onChange={handleInputChange}
                                className="form-control"
                                required
                                style={{ fontWeight: 600 }}
                            >
                                <option value="Video pendek untuk keperluan promosi (platform TikTok, Instagram, dll.)">Video pendek (TikTok, Instagram, dll.)</option>
                                <option value="Video panjang untuk keperluan promosi (platform YouTube, dll.)">Video panjang (YouTube, dll.)</option>
                                <option value="Konten foto untuk keperluan promosi (platform Instagram, Facebook, dll.)">Konten foto</option>
                                <option value="Konten artikel/blog untuk keperluan promosi">Konten artikel/blog</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Durasi Konten</label>
                            <select
                                name="duration"
                                value={formData.duration}
                                onChange={handleInputChange}
                                className="form-control"
                                required
                            >
                                <option value="1-5 menit">1-5 menit</option>
                                <option value="5-10 menit">5-10 menit</option>
                                <option value="10-30 menit">10-30 menit</option>
                                <option value="30-60 menit">30-60 menit</option>
                                <option value="Lebih dari 60 menit">Lebih dari 60 menit</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <ShieldCheck size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Platform Accounts</h3>
                        </div>

                        {formData.platform_accounts.map((account, index) => (
                            <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    value={account}
                                    onChange={(e) => handlePlatformAccountChange(index, e.target.value)}
                                    className="form-control"
                                    placeholder="e.g. crowncare.id"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => removePlatformAccount(index)}
                                    className="btn-icon-red"
                                    disabled={formData.platform_accounts.length === 1}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addPlatformAccount}
                            className="btn-add-item"
                        >
                            <Plus size={18} /> Add Platform Account
                        </button>
                    </div>

                    <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
                        <div className="form-section-header">
                            <div className="form-section-icon">
                                <CreditCard size={18} className="text-primary" />
                            </div>
                            <h3 className="form-section-title">Payment Details</h3>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <input
                                type="checkbox"
                                name="is_paid"
                                checked={formData.is_paid}
                                onChange={handleInputChange}
                                style={{ width: '20px', height: '20px', accentColor: '#000' }}
                            />
                            <span style={{ fontWeight: 700 }}>Berbayar (Paid Agreement)</span>
                        </label>

                        {formData.is_paid && (
                            <div className="animate-in" style={{ display: 'grid', gap: '24px' }}>
                                <div className="grid grid-cols-2">
                                    <div className="input-group">
                                        <label className="input-label">Jumlah (Rp)</label>
                                        <input
                                            type="text"
                                            name="compensation_amount"
                                            value={formData.compensation_amount}
                                            onChange={handleInputChange}
                                            className="form-control"
                                            required={formData.is_paid}
                                            style={{ fontWeight: 700 }}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Terbilang</label>
                                        <input
                                            type="text"
                                            name="compensation_in_words"
                                            value={formData.compensation_in_words}
                                            onChange={handleInputChange}
                                            className="form-control"
                                            required={formData.is_paid}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2">
                                    <div className="input-group">
                                        <label className="input-label">Bank Name</label>
                                        <select
                                            value={isOtherBank ? "OTHER" : formData.bank_name}
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
                                                name="bank_name"
                                                value={formData.bank_name}
                                                onChange={handleInputChange}
                                                className="form-control"
                                                required={formData.is_paid}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2">
                                    <div className="input-group">
                                        <label className="input-label">Nama Penerima</label>
                                        <input
                                            type="text"
                                            name="account_holder"
                                            value={formData.account_holder}
                                            onChange={handleInputChange}
                                            className="form-control"
                                            placeholder="Nama Penerima (Atas Nama)"
                                            required={formData.is_paid}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">
                                            {['DANA', 'VIRTUAL ACCOUNT'].includes((formData.bank_name || '').toUpperCase()) ? 'Virtual Account' : 'Account Number'}
                                        </label>
                                        <input
                                            type="text"
                                            name="account_number"
                                            value={formData.account_number}
                                            onChange={handleInputChange}
                                            className="form-control"
                                            placeholder="Nomor Rekening"
                                            required={formData.is_paid}
                                            style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '16px' }}
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label className="input-label">KCP / Kota</label>
                                    <input
                                        type="text"
                                        name="kcp_kota"
                                        value={formData.kcp_kota}
                                        onChange={handleInputChange}
                                        className="form-control"
                                        placeholder="Masukkan KCP / Kota"
                                        required={formData.is_paid}
                                    />
                                </div>
                            </div>
                        )}
                    </div>



                    {/* Signature pad hidden from internal form as per user request */}
                    {/* <div style={{ marginBottom: '48px' }}>
                        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Signatures</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <CheckCircle size={16} style={{ color: '#059669' }} />
                                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>Director Signature Pre-filled</span>
                            </div>
                        </div>

                        <div>
                            <p style={{ fontWeight: 700, marginBottom: '16px', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PIHAK KEDUA ({formData.party2_name || 'CREATOR'})</p>
                            <SignaturePad onSave={handleSignature2Save} />
                        </div>
                    </div> */}

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
                                        style={{ flex: 1.5, height: '64px', borderRadius: '16px', background: '#f59e0b' }}
                                    >
                                        <RefreshCw size={20} />
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '15px', fontWeight: 800 }}>REVISE DOCUMENT</div>
                                            <div style={{ fontSize: '11px', opacity: 0.8 }}>Unlock & Create Revision</div>
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
                                    href={documentId ? `/api/documents/${documentId}/download?view=true` : (pdfUrl || '#')}
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
                    &copy; {new Date().getFullYear()} Crowncare MOU System
                </p>
            </form>

            <SessionSuccessModal
                open={showModal}
                onClose={() => setShowModal(false)}
                url={sessionUrl}
                creatorName={formData.party2_name || 'Creator'}
            />

            <SequenceSetupModal
                open={showSetup}
                type="MOU"
                category={mouType}
                onSuccess={(ref, seq) => {
                    setFormData(prev => ({ ...prev, ref_number: ref }));
                    setMouSequence(seq);
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
                    setFormData(prev => ({ ...prev, ref_number: ref }));
                    setShowSkippedModal(false);
                }}
                onSelectSeq={(seq) => {
                    setMouSequence(seq);
                    setShowSkippedModal(false);
                }}
                onUseLatest={() => {
                    setFormData(prev => ({ ...prev, ref_number: skippedData.absRef }));
                    setMouSequence(skippedData.absSeq);
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
                    .glass-card { border-radius: 24px; padding: 24px 16px !important; }
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
                    transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
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

                .form-actions-bar {
                    margin-top: 40px;
                    padding-top: 40px;
                    border-top: 1px solid var(--border);
                    display: flex;
                    gap: 16px;
                }
                @media (max-width: 600px) {
                    .form-actions-bar { flex-direction: column; }
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

export default MOUForm;
