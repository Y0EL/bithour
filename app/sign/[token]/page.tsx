'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SignaturePad from '@/components/SignaturePad';
import { Loader2, CheckCircle2, AlertCircle, FileText, Info, User, AtSign, CreditCard, Home, Hash, Download, Plus, Trash2, Settings, Users, Sparkles, Link as LinkIcon, Clipboard, CheckCircle } from 'lucide-react';
import React from 'react';
import { terbilang, normalizeBankName } from '@/utils/numberUtils';

export default function PublicSignPage() {
    const params = useParams();
    const token = params?.token as string;

    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState(false);
    const [session, setSession] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState<any>(null);
    const [signature, setSignature] = useState<string | null>(null);

    useEffect(() => {
        document.title = "Crowncare Sign";
    }, []);

    useEffect(() => {
        const fetchSession = async () => {
            if (!token) return;
            try {
                const res = await fetch(`/api/sessions/${token}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setSession(data);
                setFormData(data.formData);
                if (data.status === 'COMPLETED') {
                    setSuccess(true);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
    }, [token]);

    // Auto-normalize and auto-fill
    useEffect(() => {
        if (!formData) return;

        let hasChanges = false;
        const updates: any = {};

        // 1. MOU Compensation Auto-fill
        if (session?.type === 'MOU' && formData.compensation_amount) {
            const amount = parseInt(formData.compensation_amount.toString().replace(/[^0-9]/g, ''));
            if (!isNaN(amount)) {
                const inWords = terbilang(amount) + ' Rupiah';
                if (formData.compensation_in_words !== inWords) {
                    updates.compensation_in_words = inWords;
                    hasChanges = true;
                }
            }
        }

        // 2. Bank Name Normalization
        if (session?.type === 'INVOICE') {
            if (formData.payment_details?.bank_name) {
                const normalized = normalizeBankName(formData.payment_details.bank_name);
                if (formData.payment_details.bank_name !== normalized) {
                    updates.payment_details = { ...formData.payment_details, bank_name: normalized };
                    hasChanges = true;
                }
            }
        } else if (session?.type === 'MOU') {
            if (formData.bank_name) {
                const normalized = normalizeBankName(formData.bank_name);
                if (formData.bank_name !== normalized) {
                    updates.bank_name = normalized;
                    hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            setFormData((prev: any) => ({ ...prev, ...updates }));
        }
    }, [formData, session?.type]);

    const handleSign = async () => {
        let finalSignature = signature;

        // Auto-capture logic: if no signature drawn, generate one from name
        if (!finalSignature) {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = 'italic bold 48px "Dancing Script", cursive, "Times New Roman"';
                ctx.fillStyle = 'black';
                const nameToSign = formData.from_name || formData.party2_name || 'Creator';
                ctx.textAlign = 'center';
                ctx.fillText(nameToSign, canvas.width / 2, canvas.height / 2 + 10);
                finalSignature = canvas.toDataURL('image/png');
            }
        }

        if (!finalSignature) {
            alert('Could not capture signature. Please try drawing it.');
            return;
        }

        setSigning(true);
        setError(null);

        try {
            const res = await fetch(`/api/sessions/${token}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formData,
                    signature: finalSignature,
                    invType: session.formData.invType || (session.type === 'MOU' ? 'MOU' : 'B'),
                    refNum: session.formData.refNum || '001'
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSigning(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)' }}>
                <Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} size={48} />
            </div>
        );
    }

    if (error && !success) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', padding: '24px', textAlign: 'center' }}>
                <AlertCircle size={64} style={{ color: 'var(--error)', marginBottom: '16px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Oops! Something went wrong</h1>
                <p style={{ color: 'var(--muted)', maxWidth: '400px' }}>{error}</p>
            </div>
        );
    }

    if (success) {
        const isManuallyCompleted = session?.status === 'COMPLETED';
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
                </div>
                <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
                    {isManuallyCompleted ? 'Dokumen dinyatakan selesai' : 'Terimakasih!'}
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: '18px' }}>
                    {isManuallyCompleted
                        ? 'Dokumen ini Ditandai selesai dan tidak perlu ditandatangani lagi.'
                        : 'Dokumen berhasil ditandatangani dan diproses.'}
                </p>
                <p style={{ color: 'var(--muted)', marginTop: '16px', fontSize: '14px' }}>Kamu bisa menutup jendela ini sekarang.</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '20px', color: 'var(--foreground)' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '100px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--accent)', fontSize: '10px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <FileText size={12} /> Sesi Tanda Tangan {session.type}
                    </div>
                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, marginBottom: '10px', lineHeight: 1.2 }}>Kontrak Eksklusif</h1>
                    <p style={{ color: 'var(--muted)', fontSize: 'clamp(13px, 2.5vw, 15px)', margin: '0 auto', lineHeight: 1.5 }}>Silahkan periksa informasi Anda di bawah ini. Jika ada kesalahan, Anda dapat mengeditnya sebelum menandatangani.</p>
                </div>

                {/* Content Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="glass-card animate-in" style={{ padding: '16px' }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                            <Info size={16} style={{ color: 'var(--accent)' }} /> Informasi Anda
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {session.type === 'INVOICE' ? (
                                <>
                                    <div className="input-group">
                                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} /> Nama Lengkap</label>
                                        <input
                                            className="form-control"
                                            value={formData.from_name}
                                            placeholder="Masukkan Nama Lengkap"
                                            onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AtSign size={14} /> TikTok Username</label>
                                        <input
                                            className="form-control"
                                            value={formData.from_username}
                                            placeholder="Masukkan Username TikTok"
                                            onChange={(e) => setFormData({ ...formData, from_username: e.target.value })}
                                        />
                                    </div>
                                    {/* HIDE ADDRESS FOR INVOICE - FILLED BY TEAM */}
                                    <div className="grid grid-cols-2">
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={14} /> Nama Bank</label>
                                            <input
                                                className="form-control"
                                                value={formData.payment_details.bank_name}
                                                placeholder="Nama Bank (BCA, Mandiri, dll)"
                                                onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, bank_name: e.target.value } })}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Hash size={14} /> Nomor Rekening</label>
                                            <input
                                                className="form-control"
                                                value={formData.payment_details.account_number}
                                                placeholder="Nomor Rekening"
                                                onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_number: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} /> Nama Penerima (Atas Nama)</label>
                                            <input
                                                className="form-control"
                                                value={formData.payment_details.account_name}
                                                placeholder="Nama Penerima (Atas Nama)"
                                                onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_name: e.target.value } })}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Home size={14} /> Cabang Bank / Kota</label>
                                            <input
                                                className="form-control"
                                                value={formData.payment_details.kcp_kota}
                                                placeholder="KCP / Kota"
                                                onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, kcp_kota: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2">
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} /> Nama Lengkap</label>
                                            <input
                                                className="form-control"
                                                value={formData.party2_name}
                                                placeholder="Masukkan Nama Lengkap"
                                                onChange={(e) => setFormData({ ...formData, party2_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AtSign size={14} /> TikTok Username</label>
                                            <input
                                                className="form-control"
                                                value={formData.party2_username}
                                                placeholder="Username TikTok"
                                                onChange={(e) => setFormData({ ...formData, party2_username: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Hash size={14} /> No. KTP</label>
                                        <input
                                            className="form-control"
                                            value={formData.party2_ktp}
                                            placeholder="Masukkan 16 Digit NIK KTP"
                                            onChange={(e) => setFormData({ ...formData, party2_ktp: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Home size={14} /> Alamat</label>
                                        <textarea
                                            rows={3}
                                            className="form-control"
                                            placeholder="Masukkan Alamat Lengkap Sesuai KTP"
                                            style={{ minHeight: '100px', resize: 'vertical' }}
                                            value={formData.party2_address}
                                            onChange={(e) => setFormData({ ...formData, party2_address: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={14} /> Nama Bank</label>
                                            <input
                                                className="form-control"
                                                value={formData.bank_name}
                                                placeholder="Nama Bank (BCA, Mandiri, dll)"
                                                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Hash size={14} /> No. Rekening</label>
                                            <input
                                                className="form-control"
                                                value={formData.account_number}
                                                placeholder="Nomor Rekening"
                                                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} /> Nama Penerima (Atas Nama)</label>
                                            <input
                                                className="form-control"
                                                value={formData.account_holder}
                                                placeholder="Nama Penerima (Atas Nama)"
                                                onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Home size={14} /> Cabang Bank / Kota</label>
                                            <input
                                                className="form-control"
                                                value={formData.kcp_kota}
                                                placeholder="KCP / Kota"
                                                onChange={(e) => setFormData({ ...formData, kcp_kota: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="glass-card animate-in" style={{ padding: '16px', animationDelay: '0.1s' }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '15px', fontWeight: 700 }}>Tanda Tangan</h3>
                        <SignaturePad onSave={setSignature} />
                        <p style={{ marginTop: '12px', color: 'var(--muted)', fontSize: '12px', lineHeight: 1.4 }}>
                            Dengan menandatangani, kamu menyetujui bahwa informasi yang diberikan benar dan kamu mengizinkan pembuatan dokumen ini.
                        </p>
                    </div>

                    <button
                        onClick={handleSign}
                        disabled={signing}
                        className="btn btn-primary animate-in"
                        style={{ width: '100%', height: '52px', fontSize: '15px', animationDelay: '0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 700 }}
                    >
                        {signing ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                Mengirim...
                            </>
                        ) : (
                            'Kirim dokumen'
                        )}
                    </button>
                </div>
            </div>

            <footer style={{ marginTop: '64px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                Powered by Crowncare Document Signing System &copy; {new Date().getFullYear()}
            </footer>
        </div>
    );
}
