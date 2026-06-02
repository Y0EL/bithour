'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
    CheckCircle2,
    MessageSquare,
    Send,
    Video,
    Check,
    Info,
    LayoutDashboard,
    Package,
    CreditCard,
    X,
    Sparkles,
    Edit,
    Phone,
    FileText,
    Upload,
    Download,
    Eye,
    ShieldCheck,
    ScrollText,
    ArrowRight,
    HandCoins,
    Calendar,
    Target,
    AlertTriangle

} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, TextField, IconButton, CircularProgress, Tooltip } from '@mui/material';
import SuccessModal from '@/components/SuccessModal';
import DirectUpload from '@/components/DirectUpload';


const statusSteps = [
    { key: 'REACHOUT', label: 'Pendekatan', desc: 'Tim mulai menghubungi' },
    { key: 'DEALING', label: 'Kesepakatan', desc: 'Pembuatan MOU' },
    { key: 'SAMPLING', label: 'Sampling', desc: 'Sampel Terkirim' },
    { key: 'DRAFTING', label: 'Drafting', desc: 'Produksi Konten' },
    { key: 'FINANCING', label: 'Financing', desc: 'Proses Pembayaran' },
    { key: 'FINISHED', label: 'Selesai', desc: 'Project Berhasil' },
    { key: 'MONITORING', label: 'Monitoring', desc: 'Pemantauan Aktif' },
];

interface VideoHistoryItem {
    url: string;
    uploadedAt: string;
}

export default function CreatorPublicPage() {
    const params = useParams();
    const { username, token } = params;
    const [creator, setCreator] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const lastDataHash = useRef<string>('');
    const isFetching = useRef<boolean>(false);
    const pollerRef = useRef<any>(null);
    const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '' });
    const [isRevising, setIsRevising] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isUploadingSigned, setIsUploadingSigned] = useState<string | null>(null);
    const [viewingMoU, setViewingMoU] = useState<any>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 900);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (username && token) {
            // Save session to memory for "Remember Me" logic
            localStorage.setItem('last_creator_username', username as string);
            localStorage.setItem('last_creator_token', token as string);
        }
    }, [username, token]);

    useEffect(() => {
        if (!isChatOpen && messages.length > 0) {
            setHasUnread(true);
        }
    }, [messages.length, isChatOpen]);

    useEffect(() => {
        const fetchAll = async () => {
            if (document.visibilityState !== 'visible' || isFetching.current) return;
            isFetching.current = true;

            try {
                const [creatorRes, msgRes, docsRes] = await Promise.all([
                    fetch(`/api/creator/session?token=${token}`),
                    fetch(`/api/creator/messages?token=${token}`),
                    fetch(`/api/creator/documents?token=${token}`)
                ]);

                if (creatorRes.ok && msgRes.ok && docsRes.ok) {
                    const [creatorData, msgData, docsData] = await Promise.all([
                        creatorRes.json(),
                        msgRes.json(),
                        docsRes.json()
                    ]);
                    const newDataHash = JSON.stringify({ creatorData, msgData, docsData });
                    if (newDataHash === lastDataHash.current) return;

                    lastDataHash.current = newDataHash;
                    setCreator(creatorData);
                    setMessages(msgData);
                    setDocuments(docsData);
                }
            } catch (error) {
                console.error('Smart fetch failed:', error);
            } finally {
                isFetching.current = false;
                setLoading(false);
            }
        };

        (window as any).refreshData = fetchAll;
        fetchAll();

        if (!pollerRef.current) {
            pollerRef.current = setInterval(fetchAll, 15000); // Polling every 15 seconds for snappier feedback
        }

        const handleVisibility = () => { if (document.visibilityState === 'visible') fetchAll(); };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (pollerRef.current) {
                clearInterval(pollerRef.current);
                pollerRef.current = null;
            }
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [token]);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isEditingProfile) setIsEditingProfile(false);
                else if (isChatOpen) setIsChatOpen(false);
                else if (showHistory) setShowHistory(false);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isEditingProfile, isChatOpen, showHistory, viewingMoU]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleProfileKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleUpdateProfile();
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        try {
            const res = await fetch('/api/creator/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newMessage, token })
            });
            if (res.ok) {
                const msg = await res.json();
                setMessages([...messages, msg]);
                setNewMessage('');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };


    const handleApproveDraft = async () => {
        try {
            const res = await fetch(`/api/creator/session?token=${token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDraftApproved: true, status: 'FINANCING' })
            });
            if (res.ok) {
                const updated = await res.json();
                setCreator({ ...creator, ...updated });
                setSuccessModal({ show: true, title: 'Draft Terkirim!', message: 'Terima kasih! Produksi final kamu sudah masuk. Tim kami akan melanjutkan ke proses pembayaran.' });
            }
        } catch (error) {
            console.error('Failed to approve draft');
        }
    };

    const handleUploadSigned = async (docId: string, file: File) => {
        setIsUploadingSigned(docId);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('token', token as string);

            const res = await fetch(`/api/documents/${docId}/upload-signed/complete`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Gagal mengunggah dokumen');
            }

            const docsRes = await fetch(`/api/creator/documents?token=${token}`);
            if (docsRes.ok) setDocuments(await docsRes.json());

            setSuccessModal({
                show: true,
                title: 'Dokumen Berhasil Diunggah!',
                message: 'Terima kasih! Dokumen bertanda tangan kamu sudah kami simpan di sistem dan akan segera divalidasi oleh tim kami.'
            });
        } catch (error: any) {
            console.error('Upload signed document failed:', error);
            alert(`Error: ${error.message || 'Gagal mengunggah dokumen'}`);
        } finally {
            setIsUploadingSigned(null);
        }
    };

    const handleUpdateProfile = async () => {
        setIsSavingProfile(true);
        try {
            const res = await fetch(`/api/creator/session?token=${token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                const updated = await res.json();
                setCreator({ ...creator, ...updated });
                setIsEditingProfile(false);
                setSuccessModal({ show: true, title: 'Profil Diperbarui!', message: 'Data kamu sudah berhasil diperbarui dan tersinkronisasi dengan tim kami.' });
            }
        } catch (error) {
            console.error('Failed to update profile');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const startEditing = () => {
        setEditForm({
            name: creator.name,
            address: creator.address,
            phoneNumber: creator.phoneNumber,
            ktpNumber: creator.ktpNumber,
            bankName: creator.bankName,
            accountNumber: creator.accountNumber,
            accountName: creator.accountName,
            hairCombColor: creator.hairCombColor,
            patokanAddress: creator.patokanAddress,
            isLongHair: creator.isLongHair
        });
        setIsEditingProfile(true);
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7f6' }}>
            <CircularProgress style={{ color: '#000' }} />
        </div>
    );

    if (!creator) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f4f7f6', color: '#000' }}>
            <X size={48} color="#ef4444" />
            <h1 style={{ marginTop: '20px', fontWeight: 800 }}>Sesi Tidak Ditemukan</h1>
            <p style={{ color: 'rgba(0,0,0,0.4)' }}>Link ini mungkin sudah kadaluarsa atau tidak valid.</p>
        </div>
    );

    const currentStepIdx = statusSteps.findIndex(s => s.key === creator.status);
    const draftingStepIdx = statusSteps.findIndex(s => s.key === 'DRAFTING');

    // On mobile, only show current and next step
    const visibleSteps = isMobile
        ? statusSteps.slice(currentStepIdx, Math.min(currentStepIdx + 2, statusSteps.length))
        : statusSteps;

    return (
        <div style={{ minHeight: '100vh', background: '#f4f7f6', color: '#000', fontFamily: 'Inter, sans-serif' }}>
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar,
                html::-webkit-scrollbar,
                body::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar,
                html,
                body {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                html, body {
                    overflow-x: hidden;
                    overflow-y: auto;
                    height: 100%;
                }
            `}</style>
            {/* Header */}
            <header style={{
                padding: isMobile ? '16px 20px' : '24px',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fff',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px' }}>
                    <div style={{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', background: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: isMobile ? '22px' : '28px' }} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 800 }}>Portal Kreator</h2>
                        {!isMobile && <p style={{ margin: 0, fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>Ruang Kerja Kolaborasi</p>}
                    </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.05)', padding: '6px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                    @{creator.usernameTikTok}
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '16px 12px' : '40px 20px', position: 'relative' }}>
                {/* FAIL Overlay for Creator */}
                {creator.status === 'FAIL' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 2000,
                            background: 'rgba(244, 247, 246, 0.85)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px 24px',
                            textAlign: 'center',
                            minHeight: '600px'
                        }}
                    >
                        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.15)' }}>
                            <AlertTriangle size={40} color="#ef4444" />
                        </div>
                        <h2 style={{ color: '#000', fontWeight: 900, fontSize: '28px', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>Project Dihentikan</h2>
                        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '16px', maxWidth: '450px', lineHeight: 1.6, marginBottom: '32px' }}>
                            Mohon maaf, kolaborasi ini telah dihentikan oleh tim Bithour Production. Jika ada pertanyaan, silakan hubungi admin kami melalui WhatsApp.
                        </p>

                        {creator.failedReason && (
                            <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid #fee2e2', maxWidth: '400px', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                <p style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Pesan Tim Bithour</p>
                                <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.6 }}>"{creator.failedReason}"</p>
                            </div>
                        )}

                        <Button
                            variant="contained"
                            onClick={() => window.open('https://wa.me/62xxxxxxxxxxx', '_blank')}
                            style={{ marginTop: '40px', background: '#000', color: '#fff', borderRadius: '16px', textTransform: 'none', fontWeight: 800, padding: '12px 24px' }}
                        >
                            Hubungi Admin via WA
                        </Button>
                    </motion.div>
                )}
                {/* Progress Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: '#fff', borderRadius: isMobile ? '20px' : '24px', padding: isMobile ? '20px 16px' : '32px', border: '1px solid rgba(0,0,0,0.05)', marginBottom: isMobile ? '16px' : '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '24px' : '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <LayoutDashboard size={20} color="#000" />
                            <h3 style={{ margin: 0, fontSize: isMobile ? '18px' : '20px', fontWeight: 800 }}>Tahapan Proyek</h3>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: isMobile ? 'center' : 'space-between',
                        position: 'relative',
                        gap: isMobile ? '40px' : '0'
                    }}>
                        {!isMobile && (
                            <>
                                <div style={{ position: 'absolute', top: '20px', left: '30px', right: '30px', height: '2px', background: 'rgba(0,0,0,0.05)', zIndex: 1 }} />
                                <div style={{
                                    position: 'absolute',
                                    top: '20px',
                                    left: '30px',
                                    width: `${(currentStepIdx / (statusSteps.length - 1)) * 100}%`,
                                    height: '2px',
                                    background: '#000',
                                    zIndex: 1,
                                    transition: 'width 0.8s'
                                }} />
                            </>
                        )}

                        {visibleSteps.map((step, idx) => {
                            const globalIdx = statusSteps.findIndex(s => s.key === step.key);
                            const isCompleted = globalIdx < currentStepIdx;
                            const isActive = globalIdx === currentStepIdx;

                            return (
                                <div key={step.key} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: isMobile ? '36px' : '40px',
                                        height: isMobile ? '36px' : '40px',
                                        borderRadius: '50%',
                                        background: isCompleted ? '#000' : (isActive ? '#000' : '#fff'),
                                        border: isActive ? '4px solid #fff' : '2px solid rgba(0,0,0,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isCompleted || isActive ? '#fff' : 'rgba(0,0,0,0.2)',
                                        boxShadow: isActive ? '0 0 0 2px #000' : 'none',
                                        transition: 'all 0.4s'
                                    }}>
                                        {isCompleted ? <Check size={20} strokeWidth={3} /> : <div style={{ fontSize: '14px', fontWeight: 800 }}>{globalIdx + 1}</div>}
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: isActive ? '#000' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {isActive ? 'Sekarang' : (globalIdx > currentStepIdx ? 'Nanti' : 'Selesai')}
                                        </span>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 700, color: isActive ? '#000' : 'rgba(0,0,0,0.3)' }}>{step.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '40px', alignItems: 'flex-start' }}>
                    <div style={{ flex: isMobile ? '1' : '1.3', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '32px', width: '100%' }}>
                        {/* Details View - NOW FIRST */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            style={{ background: '#fff', borderRadius: isMobile ? '20px' : '24px', padding: isMobile ? '20px 16px' : '32px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '16px' : '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Info size={20} color="#000" />
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Detail Profil</h3>
                                </div>
                                {currentStepIdx < 2 ? (
                                    <Button
                                        size="small"
                                        startIcon={<Edit size={14} />}
                                        onClick={startEditing}
                                        style={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', color: '#000' }}
                                    >
                                        Ubah Data
                                    </Button>
                                ) : (
                                    <Tooltip title="Data sudah terkunci untuk keperluan pengiriman sampel & produksi.">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(0,0,0,0.3)', cursor: 'help' }}>
                                            <CheckCircle2 size={14} color="#22c55e" />
                                            <span style={{ fontSize: '11px', fontWeight: 700 }}>Data Terkunci</span>
                                        </div>
                                    </Tooltip>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: isMobile ? '16px' : '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '20px', gridColumn: isMobile ? 'span 2' : 'auto' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr', gap: isMobile ? '16px' : '0' }}>
                                        <PublicInfoField label="Nama Sesuai KTP" value={creator.name} />
                                        {isMobile && <PublicInfoField label={['DANA', 'VIRTUAL ACCOUNT'].includes((creator.bankName || '').toUpperCase()) ? 'Virtual Account' : 'Rekening'} value={`${creator.bankName} - ${creator.accountNumber}`} />}
                                    </div>
                                    <PublicInfoField label="Alamat Pengiriman" value={creator.address} />
                                    {creator.patokanAddress && <PublicInfoField label="Patokan Alamat" value={creator.patokanAddress} />}
                                    <PublicInfoField label="WhatsApp" value={creator.phoneNumber} />
                                </div>
                                {!isMobile && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <PublicInfoField label="Pilihan Sisir" value={creator.hairCombColor} />
                                        <PublicInfoField label={['DANA', 'VIRTUAL ACCOUNT'].includes((creator.bankName || '').toUpperCase()) ? 'Virtual Account' : 'Rekening Bank'} value={`${creator.bankName} - ${creator.accountNumber}`} />
                                        <PublicInfoField label="Nama Pemilik Rekening" value={creator.accountName} />
                                    </div>
                                )}
                                {isMobile && (
                                    <>
                                        <PublicInfoField label="Pilihan Sisir" value={creator.hairCombColor} />
                                        <PublicInfoField label="Nama Pemilik" value={creator.accountName} />
                                    </>
                                )}
                            </div>
                        </motion.div>

                        {/* Documents Section - NEW */}
                        {documents.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15 }}
                                style={{ background: '#fff', borderRadius: isMobile ? '20px' : '24px', padding: isMobile ? '20px 16px' : '32px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                                    <FileText size={20} color="#000" />
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Dokumen Kerjasama</h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {documents.map((doc) => {
                                        const isCompleted = doc.status === 'COMPLETED' || doc.signedFileUrl;
                                        return (
                                            <div key={doc.id} style={{
                                                padding: '16px',
                                                background: '#fcfcfc',
                                                borderRadius: '16px',
                                                border: '1px solid rgba(0,0,0,0.03)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                flexWrap: isMobile ? 'wrap' : 'nowrap',
                                                gap: '12px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '40px', height: '40px', background: isCompleted ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0,0,0,0.03)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <FileText size={20} color={isCompleted ? '#16a34a' : '#000'} />
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{doc.title}</p>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 800,
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                background: isCompleted ? '#dcfce7' : '#fff7ed',
                                                                color: isCompleted ? '#166534' : '#9a3412',
                                                                border: isCompleted ? '1px solid #bbf7d0' : '1px solid #ffedd5'
                                                            }}>
                                                                {isCompleted ? 'SIGNED' : 'WAITING SIGNATURE'}
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>
                                                                {new Date(doc.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                                                    <Tooltip title="Lihat Isi MoU">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                if (doc.type === 'MOU') {
                                                                    setViewingMoU(doc);
                                                                } else {
                                                                    window.open(`/api/documents/${doc.id}/download?view=true&token=${token}`, '_blank');
                                                                }
                                                            }}
                                                            style={{ background: 'rgba(0,0,0,0.03)' }}
                                                        >
                                                            <Eye size={16} />
                                                        </IconButton>
                                                    </Tooltip>

                                                    {isCompleted ? (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() => window.open(doc.signedFileUrl || doc.fileUrl, '_blank')}
                                                            startIcon={<Download size={14} />}
                                                            style={{
                                                                textTransform: 'none',
                                                                borderRadius: '10px',
                                                                fontWeight: 700,
                                                                borderColor: 'rgba(0,0,0,0.1)',
                                                                color: '#000'
                                                            }}
                                                        >
                                                            Download
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            onClick={() => window.open(`/sign/${doc.signingToken}`, '_blank')}
                                                            startIcon={<Edit size={14} />}
                                                            style={{
                                                                textTransform: 'none',
                                                                borderRadius: '10px',
                                                                fontWeight: 700,
                                                                background: '#000',
                                                                color: '#fff'
                                                            }}
                                                        >
                                                            Tanda Tangan
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {documents.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(0,0,0,0.01)', borderRadius: '16px', border: '1px dashed rgba(0,0,0,0.05)' }}>
                                            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Tidak ada dokumen untuk saat ini.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Video Upload Section - NOW SECOND */}
                        {currentStepIdx >= draftingStepIdx && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                style={{ background: '#fff', borderRadius: '24px', padding: isMobile ? '24px 20px' : '32px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Video size={20} color="#000" />
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Pengiriman Konten</h3>
                                    </div>
                                </div>

                                {creator.videoUrl && !isRevising ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{
                                            flex: 1,
                                            background: '#000',
                                            borderRadius: '20px',
                                            overflow: 'hidden',
                                            aspectRatio: isMobile ? '9/16' : '16/9',
                                            marginBottom: '16px',
                                            position: 'relative'
                                        }}>
                                            {(() => {
                                                const url = creator.videoUrl || '';
                                                const isDrive = url.includes('drive.google.com');

                                                if (isDrive) {
                                                    let fileId = '';
                                                    if (url.includes('/file/d/')) {
                                                        fileId = url.split('/file/d/')[1].split('/')[0];
                                                    } else if (url.includes('/folders/')) {
                                                        fileId = url.split('/folders/')[1].split('/')[0].split('?')[0];
                                                    } else if (url.includes('id=')) {
                                                        fileId = url.split('id=')[1].split('&')[0];
                                                    }

                                                    if (fileId) {
                                                        return (
                                                            <iframe
                                                                src={`https://drive.google.com/file/d/${fileId}/preview`}
                                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                                allow="autoplay"
                                                            />
                                                        );
                                                    }
                                                }

                                                return (
                                                    <video
                                                        src={`/api/creator/video/view?token=${token}`}
                                                        controls
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    />
                                                );
                                            })()}
                                        </div>

                                        {/* File Card Info */}
                                        <div style={{
                                            background: '#fcfcfc',
                                            border: '1px solid rgba(0,0,0,0.05)',
                                            borderRadius: '20px',
                                            padding: isMobile ? '16px' : '20px',
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            alignItems: isMobile ? 'flex-start' : 'center',
                                            justifyContent: 'space-between',
                                            gap: isMobile ? '16px' : '12px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '48px', height: '48px', background: '#000', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                                    <Video size={22} />
                                                </div>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Draf Konten Video</p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                        <CheckCircle2 size={12} color="#22c55e" />
                                                        <p style={{ margin: 0, fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>{creator.isDraftApproved ? 'Disetujui Final' : 'Link Sudah Dikirim'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    fullWidth={isMobile}
                                                    onClick={() => setIsRevising(true)}
                                                    disabled={creator.isDraftApproved}
                                                    style={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, color: '#000', borderColor: 'rgba(0,0,0,0.1)', height: isMobile ? '40px' : 'auto' }}
                                                >
                                                    Kirim Ulang / Revisi
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    fullWidth={isMobile}
                                                    onClick={() => window.open(creator.videoUrl.includes('drive.google.com') ? creator.videoUrl : `/api/creator/video/view?token=${token}`, '_blank')}
                                                    style={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, background: '#000', color: '#fff', height: isMobile ? '40px' : 'auto' }}
                                                >
                                                    Link Full
                                                </Button>
                                            </div>
                                        </div>

                                        {(creator.videoHistory as VideoHistoryItem[])?.length > 0 && (

                                            <div>
                                                <Button
                                                    size="small"
                                                    onClick={() => setShowHistory(!showHistory)}
                                                    style={{ textTransform: 'none', color: 'rgba(0,0,0,0.4)', fontSize: '12px', fontWeight: 600 }}
                                                >
                                                    {showHistory ? 'Sembunyikan Versi Sebelumnya' : `Lihat Versi Sebelumnya (${(creator.videoHistory as VideoHistoryItem[]).length})`}

                                                </Button>
                                                <AnimatePresence>
                                                    {showHistory && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}
                                                        >
                                                            {(creator.videoHistory as VideoHistoryItem[]).map((h, i) => (

                                                                <div key={i} style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>Revisi #{i + 1}</div>
                                                                    <Button
                                                                        size="small"
                                                                        // History juga lewat proxy Crowncare, pakai historyIdx
                                                                        onClick={() => window.open(`/api/creator/video/view?token=${token}&historyIdx=${i}`, '_blank')}
                                                                        style={{ textTransform: 'none' }}
                                                                    >
                                                                        Lihat
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <DirectUpload
                                        token={token as string}
                                        isMobile={isMobile}
                                        onSuccess={(videoUrl: string) => {
                                            setCreator({ ...creator, videoUrl, videoUploadedAt: new Date(), isDraftApproved: false });
                                            setIsRevising(false);
                                            setSuccessModal({
                                                show: true,
                                                title: 'Video Berhasil Dikirim!',
                                                message: 'Video kamu sudah diterima oleh tim produksi. Kami akan segera mengeceknya!'
                                            });
                                        }}
                                        onError={(error: string) => {
                                            console.error('Upload error:', error);
                                        }}
                                    />
                                )}
                            </motion.div>
                        )}

                        {/* Payment Proof Section */}
                        {creator.paymentProofUrl && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                style={{ background: '#fff', borderRadius: '24px', padding: isMobile ? '24px 20px' : '32px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginTop: isMobile ? '16px' : '32px' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                                    <CreditCard size={20} color="#000" />
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Bukti Pembayaran</h3>
                                </div>
                                <div
                                    style={{ position: 'relative', cursor: 'pointer', borderRadius: '16px', overflow: 'hidden' }}
                                    onClick={() => window.open(`/api/creator/video/view?token=${token}&type=proof`, '_blank')}
                                >
                                    <img
                                        src={`/api/creator/video/view?token=${token}&type=proof`}
                                        alt="Payment Proof"
                                        style={{ width: '100%', display: 'block' }}
                                    />
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(0,0,0,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: 0,
                                            transition: 'opacity 0.2s',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                    >
                                        <Button variant="contained" style={{ background: '#000', color: '#fff', borderRadius: '100px', textTransform: 'none', fontWeight: 800 }}>Buka Full</Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Chat Section */}
                    <AnimatePresence>
                        {(!isMobile || isChatOpen) && (
                            <motion.div
                                initial={isMobile ? { y: '100%' } : { opacity: 0, x: 20 }}
                                animate={isMobile ? { y: 0 } : { opacity: 1, x: 0 }}
                                exit={isMobile ? { y: '100%' } : { opacity: 0, x: 20 }}
                                transition={{ type: 'tween', duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                style={{
                                    height: isMobile ? 'calc(100% - 60px)' : 'calc(100vh - 160px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: '#fff',
                                    borderRadius: isMobile ? '24px 24px 0 0' : '24px',
                                    border: '1px solid rgba(0,0,0,0.05)',
                                    overflow: 'hidden',
                                    position: isMobile ? 'fixed' : 'sticky',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    top: isMobile ? 'auto' : '100px',
                                    flex: isMobile ? 'none' : '0 0 380px',
                                    boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
                                    zIndex: 1000,
                                    boxSizing: 'border-box'
                                }}
                            >
                                <div style={{ padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <MessageSquare size={18} color="#000" />
                                        <h4 style={{ margin: 0, fontWeight: 800 }}>Update Bithour</h4>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isMobile && (
                                            <IconButton size="small" onClick={() => setIsChatOpen(false)}>
                                                <X size={20} color="#000" />
                                            </IconButton>
                                        )}
                                    </div>
                                </div>
                                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fcfcfc', minHeight: 0 }} className="no-scrollbar">
                                    {messages.map((msg) => {
                                        // Hide system-ish upload notifications from creator side
                                        // (old records may exist in DB, but we don't want to show them to creators)
                                        if (!msg.senderId) {
                                            const c = (msg.content || '').trim();
                                            if (c.startsWith('🎥 Video uploaded') || c.startsWith('Video uploaded:') || c.startsWith('🎥 Video uploaded:')) {
                                                return null;
                                            }
                                        }
                                        const isFeedback = msg.content.startsWith('📢 [MASUKAN]') ||
                                            msg.content.startsWith('📢 [FEEDBACK]') ||
                                            msg.content.startsWith('📢 [REVISI VIDEO]') ||
                                            msg.content.startsWith('❌ [VIDEO DITOLAK]') ||
                                            msg.content.startsWith('✅ [CATATAN]');

                                        let feedbackMarker = '';
                                        if (msg.content.startsWith('📢 [MASUKAN]')) feedbackMarker = '📢 [MASUKAN]';
                                        else if (msg.content.startsWith('📢 [FEEDBACK]')) feedbackMarker = '📢 [FEEDBACK]';
                                        else if (msg.content.startsWith('📢 [REVISI VIDEO]')) feedbackMarker = '📢 [REVISI VIDEO]';
                                        else if (msg.content.startsWith('❌ [VIDEO DITOLAK]')) feedbackMarker = '❌ [VIDEO DITOLAK]';
                                        else if (msg.content.startsWith('✅ [CATATAN]')) feedbackMarker = '✅ [CATATAN]';

                                        const displayContent = isFeedback ? msg.content.replace(feedbackMarker, '').replace(':', '').trim() : msg.content;

                                        if (isFeedback) {
                                            return (
                                                <div key={msg.id} style={{
                                                    alignSelf: 'center',
                                                    width: '90%',
                                                    background: '#f8fafc',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    border: '1px solid #e2e8f0',
                                                    textAlign: 'center',
                                                    margin: '10px 0'
                                                }}>
                                                    <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Masukan Team Analis</p>
                                                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#000', fontWeight: 600 }}>
                                                        {displayContent}
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={msg.id} style={{
                                                alignSelf: !msg.senderId ? 'flex-end' : 'flex-start',
                                                maxWidth: '85%'
                                            }}>
                                                <div style={{
                                                    padding: '12px 14px',
                                                    borderRadius: !msg.senderId ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                                    background: !msg.senderId ? '#000' : '#ececec',
                                                    color: !msg.senderId ? '#fff' : '#000',
                                                    fontSize: '13px',
                                                    lineHeight: 1.5,
                                                    fontWeight: 500
                                                }}>
                                                    {msg.content}
                                                </div>
                                                <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.3)', marginTop: '4px', textAlign: !msg.senderId ? 'right' : 'left', fontWeight: 600 }}>
                                                    {!msg.senderId ? 'Kamu' : 'Tim Crowncare'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={chatEndRef} />
                                </div>
                                <div style={{ padding: isMobile ? '12px 16px' : '16px', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#fff', paddingBottom: isMobile ? '24px' : '16px', position: 'relative', zIndex: 10 }}>
                                    <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto', alignItems: 'center' }}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            placeholder="Ketik pesan..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                            autoComplete="off"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px',
                                                    background: 'rgba(0,0,0,0.03)',
                                                    color: '#000',
                                                    '& fieldset': { border: 'none' },
                                                }
                                            }}
                                        />
                                        <IconButton
                                            onClick={handleSendMessage}
                                            disabled={!newMessage.trim()}
                                            style={{
                                                background: newMessage.trim() ? '#000' : '#f3f4f6',
                                                color: newMessage.trim() ? '#fff' : '#9ca3af',
                                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                                borderRadius: '14px',
                                                width: '44px',
                                                height: '44px',
                                                boxShadow: newMessage.trim() ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                pointerEvents: 'auto'
                                            }}
                                        >
                                            <Send
                                                size={20}
                                                style={{
                                                    transform: newMessage.trim() ? 'translate(1px, -1px) rotate(-10deg)' : 'none',
                                                    transition: 'transform 0.2s'
                                                }}
                                            />
                                        </IconButton>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Chat Backdrop for Mobile */}
                    <AnimatePresence>
                        {isMobile && isChatOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => setIsChatOpen(false)}
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.4)',
                                    backdropFilter: 'blur(4px)',
                                    zIndex: 999
                                }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Floating Chat Bubble for Mobile */}
                    <AnimatePresence>
                        {isMobile && !isChatOpen && (
                            <motion.button
                                initial={{ scale: 0, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0, opacity: 0, y: 20 }}
                                onClick={() => {
                                    setIsChatOpen(true);
                                    setHasUnread(false);
                                }}
                                style={{
                                    position: 'fixed',
                                    bottom: '24px',
                                    right: '24px',
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '30px',
                                    background: '#000',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: 'none',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                    zIndex: 998,
                                    cursor: 'pointer'
                                }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: 'tween', duration: 0.2 }}
                            >
                                <MessageSquare size={24} />
                                {hasUnread && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        width: '14px',
                                        height: '14px',
                                        background: '#ff4b4b',
                                        borderRadius: '50%',
                                        border: '2px solid #fff'
                                    }} />
                                )}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {(creator.status === 'FINISHED' || creator.status === 'MONITORING') && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ marginTop: '40px', textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                    >
                        <div style={{ width: '64px', height: '64px', background: '#f0fdf4', color: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <Sparkles size={32} />
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 800 }}>Campaign Successfully Completed!</h3>
                        <p style={{ fontSize: '15px', color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
                            Terimakasih kerjasama telah selesai! Kami akan terus memantau progressnya untuk potensi kolaborasi lebih lanjut di masa depan. Stay tuned!
                        </p>
                    </motion.div>
                )}
            </main>
            <SuccessModal
                show={successModal.show}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, show: false })}
            />

            {/* Edit Profile Modal */}
            <AnimatePresence>
                {isEditingProfile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                        onClick={() => !isSavingProfile && setIsEditingProfile(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '500px', padding: isMobile ? '24px' : '32px', maxHeight: '90vh', overflowY: 'auto' }}
                            className="no-scrollbar"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Ubah Informasi Profil</h3>
                                <IconButton onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile}>
                                    <X size={20} />
                                </IconButton>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <TextField
                                    label="Nama Sesuai KTP"
                                    fullWidth
                                    value={editForm.name || ''}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    onKeyDown={handleProfileKeyDown}
                                    variant="outlined"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                                />
                                <TextField
                                    label="Nomor KTP"
                                    fullWidth
                                    value={editForm.ktpNumber || ''}
                                    onChange={(e) => setEditForm({ ...editForm, ktpNumber: e.target.value })}
                                    onKeyDown={handleProfileKeyDown}
                                    variant="outlined"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                                />
                                <TextField
                                    label="Nomor WhatsApp"
                                    fullWidth
                                    value={editForm.phoneNumber || ''}
                                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                    onKeyDown={handleProfileKeyDown}
                                    variant="outlined"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                                />
                                <TextField
                                    label="Alamat Lengkap"
                                    multiline
                                    rows={3}
                                    fullWidth
                                    value={editForm.address || ''}
                                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                    variant="outlined"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                                />
                                <TextField
                                    label="Patokan Alamat"
                                    fullWidth
                                    value={editForm.patokanAddress || ''}
                                    onChange={(e) => setEditForm({ ...editForm, patokanAddress: e.target.value })}
                                    onKeyDown={handleProfileKeyDown}
                                    variant="outlined"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                                />

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <TextField
                                        label="Nama Bank"
                                        fullWidth
                                        value={editForm.bankName || ''}
                                        onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                                        onKeyDown={handleProfileKeyDown}
                                        variant="outlined"
                                        placeholder="Contoh: BCA / DANA"
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                                    />
                                    <TextField
                                        label="Nomor Rekening"
                                        fullWidth
                                        value={editForm.accountNumber || ''}
                                        onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                                        onKeyDown={handleProfileKeyDown}
                                        variant="outlined"
                                        helperText={['dana', 'gopay', 'ovo', 'shopee', 'linkaja', 'astra', 'isaku'].some(kw => (editForm.bankName || '').toLowerCase().includes(kw)) ? "Virtual Account akan otomatis ditambahkan prefix saat dokumen dibuat." : ""}
                                        sx={{
                                            '& .MuiOutlinedInput-root': { borderRadius: '14px' },
                                            '& .MuiFormHelperText-root': { color: 'rgba(0,0,0,0.4)', fontSize: '11px', fontWeight: 600 }
                                        }}
                                    />
                                </div>
                                <TextField
                                    label="Nama Pemilik Rekening"
                                    fullWidth
                                    value={editForm.accountName || ''}
                                    onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })}
                                    onKeyDown={handleProfileKeyDown}
                                    variant="outlined"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                                />

                                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        onClick={() => setIsEditingProfile(false)}
                                        disabled={isSavingProfile}
                                        style={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, color: '#000', borderColor: 'rgba(0,0,0,0.1)' }}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={handleUpdateProfile}
                                        disabled={isSavingProfile}
                                        style={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, background: '#000', color: '#fff' }}
                                    >
                                        {isSavingProfile ? <CircularProgress size={20} color="inherit" /> : 'Simpan Perubahan'}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MoU Reader Overlay */}
            <AnimatePresence>
                {viewingMoU && (
                    <MoUReader
                        doc={viewingMoU}
                        creator={creator}
                        isMobile={isMobile}
                        onClose={() => setViewingMoU(null)}
                        onEdit={() => {
                            startEditing();
                        }}
                        onSign={() => {
                            window.open(`/sign/${viewingMoU.signingToken}`, '_blank');
                            setViewingMoU(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function MoUReader({ doc, creator, onClose, onSign, onEdit, isMobile }: { doc: any; creator: any; onClose: () => void; onSign: () => void; onEdit: () => void; isMobile: boolean }) {
    const meta = doc.metadata || {};
    // Use creator profile data if available (live preview), otherwise fallback to document snapshot
    const isSigned = doc.status === 'COMPLETED' || doc.signedFileUrl;

    const displayData = {
        name: isSigned ? meta.party2_name : (creator.name || meta.party2_name),
        username: isSigned ? meta.party2_username : (creator.usernameTikTok || meta.party2_username),
        bank: isSigned ? meta.bank_name : (creator.bankName || meta.bank_name),
        accountNumber: isSigned ? meta.account_number : (creator.accountNumber || meta.account_number),
        accountName: isSigned ? meta.account_holder : (creator.accountName || meta.account_holder)
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : '40px' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 50, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 50, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#fff', width: '100%', maxWidth: '900px', height: isMobile ? '100%' : '90vh', borderRadius: isMobile ? 0 : '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
            >
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: '#000', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ScrollText size={20} color="#fff" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Draft Perjanjian Kerjasama (MoU)</h2>
                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Nomor: {doc.documentNo}</p>
                        </div>
                    </div>
                    <IconButton onClick={onClose} size="small" style={{ background: '#f5f5f5' }}>
                        <X size={20} />
                    </IconButton>
                </div>

                {/* Content */}
                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '24px 20px' : '40px 60px', background: '#fcfcfc' }}>

                    {/* Key Highlights Card */}
                    <div style={{ background: '#000', borderRadius: '24px', padding: '32px', color: '#fff', marginBottom: '40px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '32px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                                <HandCoins size={14} />
                                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Imbalan Jasa</span>
                            </div>
                            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: '#fff' }}>Rp {meta.compensation_amount || '100.000'}</h1>
                            <p style={{ margin: 0, fontSize: '13px', color: '#fff', fontWeight: 600 }}>Akan dibayarkan setelah konten diposting & divalidasi.</p>
                        </div>
                        <div style={{ width: isMobile ? '100%' : '1px', height: isMobile ? '1px' : 'auto', background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                                <Target size={14} />
                                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tugas Kamu</span>
                            </div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>1 Video Konten Kreatif</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#fff', fontWeight: 600 }}>Sesuai dengan brief & arahan tim produksi Bithour Production.</p>
                        </div>
                    </div>

                    {/* Legal Content */}
                    <div style={{ color: '#333', lineHeight: 1.6, fontSize: '14px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>SURAT PERJANJIAN KERJASAMA</h3>
                            <p style={{ margin: '4px 0 0 0', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Tanggal Efektif: {meta.agreement_date || meta.creation_date}</p>
                        </div>

                        <Section title="Para Pihak">
                            <p>Perjanjian ini dibuat antara <strong>PT. BITHOUR PRODUCTION INDONESIA</strong> (selanjutnya disebut "Pihak Pertama") dan
                                <strong style={{ margin: '0 4px', borderBottom: isSigned ? 'none' : '1px dashed #000', cursor: isSigned ? 'default' : 'pointer' }} onClick={!isSigned ? onEdit : undefined}>
                                    {displayData.name} <span style={{ opacity: 0.4, fontWeight: 400 }}>(Edit)</span>
                                </strong>
                                dengan akun TikTok <strong>@{displayData.username}</strong> (selanjutnya disebut "Pihak Kedua").</p>
                        </Section>

                        <Section title="Ruang Lingkup Kerjasama">
                            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Pihak Kedua setuju untuk memproduksi konten video kreatif untuk mempromosikan produk/jasa Pihak Pertama.</li>
                                <li>Hak atas konten yang diproduksi menjadi milik Pihak Pertama untuk kepentingan promosi.</li>
                                <li>Konten harus tetap diposting (tidak boleh dihapus) selamanya kecuali ada kesepakatan lain.</li>
                            </ol>
                        </Section>

                        <Section title="Pembayaran & Pajak">
                            <p>Pihak Pertama akan membayar sebesar <strong>Rp {meta.compensation_amount}</strong> kepada Pihak Kedua melalui transfer bank ke rekening atas nama
                                <strong style={{ margin: '0 4px', borderBottom: isSigned ? 'none' : '1px dashed #000', cursor: isSigned ? 'default' : 'pointer' }} onClick={!isSigned ? onEdit : undefined}>
                                    {displayData.accountName} <span style={{ opacity: 0.4, fontWeight: 400 }}>(Edit)</span>
                                </strong>
                                ({displayData.bank} - {displayData.accountNumber}). Pajak yang timbul akan ditanggung masing-masing pihak sesuai ketentuan hukum.</p>
                        </Section>

                        <Section title="Kerahasiaan">
                            <p>Kedua belah pihak dilarang membocorkan isi perjanjian ini dan informasi rahasia lainnya terkait kerjasama ini kepada pihak ketiga.</p>
                        </Section>
                    </div>
                </div>

                {/* Footer Actions */}
                <div style={{ padding: '24px 32px', borderTop: '1px solid #f0f0f0', background: '#fff', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {!isMobile && (
                        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(0,0,0,0.4)', fontWeight: 600, flex: 1 }}>
                            Dengan mengklik "Tanda Tangan", Anda akan diarahkan ke halaman penandatanganan digital.
                        </p>
                    )}
                    <Button
                        variant="outlined"
                        onClick={onClose}
                        style={{ textTransform: 'none', borderRadius: '14px', height: '54px', padding: '0 24px', fontWeight: 700, borderColor: '#f0f0f0', color: '#666' }}
                    >
                        Tutup
                    </Button>
                    <Button
                        variant="contained"
                        onClick={onSign}
                        endIcon={<ArrowRight size={18} />}
                        style={{ flex: isMobile ? 1 : 'unset', minWidth: isMobile ? 'unset' : '220px', textTransform: 'none', borderRadius: '14px', height: '54px', padding: '0 32px', fontWeight: 800, background: '#000', color: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                    >
                        Tanda Tangan
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: '#000', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '4px', height: '14px', background: '#000', borderRadius: '2px' }} />
                {title}
            </h4>
            <div style={{ color: 'rgba(0,0,0,0.6)', fontWeight: 500 }}>{children}</div>
        </div>
    );
}

function PublicInfoField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', letterSpacing: '0.05em' }}>{label}</span>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 700 }}>{value || '-'}</p>
        </div>
    );
}
