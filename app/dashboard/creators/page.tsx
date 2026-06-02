'use client';

import { useState, useEffect } from 'react';
import {
    Search,
    UserPlus,
    Sparkles,
    Loader2,
    ArrowLeftRight,
    ArrowRight,
    Trash2,
    CheckCircle2,
    FileSpreadsheet,
    ExternalLink,
    AlertCircle
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Button,
    TextField,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    CircularProgress
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import CreatorCard from '@/components/CreatorCard';
import CreatorDetail from '@/components/CreatorDetail';
import NotificationToast from '@/components/NotificationToast';
import { PRODUCT_OPTIONS } from '@/lib/constants';

export default function CreatorsPage() {
    const { t } = useTranslation();
    const { data: session } = useSession();
    const [creators, setCreators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const user = session?.user as any;

    if (user?.role === 'ANALYST') {
        return (
            <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff', borderRadius: '32px', border: '1px solid #f1f5f9', marginTop: '40px' }}>
                <div style={{ width: '80px', height: '80px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <AlertCircle size={40} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', marginBottom: '12px' }}>Akses Terbatas</h2>
                <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    Role <b>Analyst</b> tidak diperbolehkan untuk mengelola atau menambahkan kreator baru.
                </p>
                <Button
                    onClick={() => window.location.href = '/dashboard/review'}
                    style={{ background: '#000', color: '#fff', padding: '12px 32px', borderRadius: '14px', fontWeight: 700, textTransform: 'none' }}
                >
                    Ke Halaman Review Video
                </Button>
            </div>
        );
    }
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [isSmartSearch, setIsSmartSearch] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addModalTab, setAddModalTab] = useState<'manual' | 'paste'>('manual');
    const [isAIParsing, setIsAIParsing] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [isManualSubmitting, setIsManualSubmitting] = useState(false);
    const emptyManualForm = {
        name: '', usernameTikTok: '', phoneNumber: '', followers: '',
        productDescription: '', ktpNumber: '', address: '',
        bankName: '', accountNumber: '', accountName: '', kcpCity: '',
    };
    const [manualForm, setManualForm] = useState(emptyManualForm);
    const [selectedCreator, setSelectedCreator] = useState<any>(null);
    const [toast, setToast] = useState({ show: false, message: '', title: '', type: 'success' as any });
    const [isMobile, setIsMobile] = useState(false);

    // New states for Quick Actions on Card
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
    const [transferCreator, setTransferCreator] = useState<any>(null);
    const [isTransferring, setIsTransferring] = useState(false);

    // Deletion states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteCreator, setDeleteCreator] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Batch selection states
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

    // Old Creator Confirmation
    const [isConfirmOldModalOpen, setIsConfirmOldModalOpen] = useState(false);
    const [tempParsedData, setTempParsedData] = useState<any>(null);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsAddModalOpen(false);
                setManualForm(emptyManualForm);
                setPasteText('');
                setAddModalTab('manual');
                setSelectedCreator(null);
                setShowDeleteModal(false);
                setShowBatchDeleteModal(false);
                setIsConfirmOldModalOpen(false);
                setShowTransferModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTerm(searchTerm);
            setIsSmartSearch(searchTerm.length > 2);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchCreators();

        // Add polling so notification badges update automatically every 30 seconds
        const interval = setInterval(fetchCreators, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchCreators = async () => {
        try {
            const res = await fetch('/api/creator');

            if (!res.ok) {
                // Handle non-OK responses
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Failed to fetch creators:', errorData);
                setToast({
                    show: true,
                    title: 'Error',
                    message: errorData.error || 'Failed to fetch creators',
                    type: 'error'
                });
                return;
            }

            const data = await res.json();
            setCreators(data);
        } catch (error) {
            console.error('Failed to fetch creators:', error);
            setToast({
                show: true,
                title: 'Error',
                message: 'Network error or invalid response',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = async (isOld: boolean) => {
        if (!manualForm.name || !manualForm.usernameTikTok) return;
        setIsManualSubmitting(true);
        try {
            const payload = {
                ...manualForm,
                followers: manualForm.followers ? parseInt(manualForm.followers) : undefined,
                isOldCreator: isOld,
            };
            const res = await fetch('/api/creator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const newCreator = await res.json();
            if (res.ok) {
                setCreators([newCreator, ...creators]);
                setIsAddModalOpen(false);
                setManualForm(emptyManualForm);
                setToast({ show: true, title: 'Sukses', message: 'Creator berhasil ditambahkan!', type: 'success' });
                setSelectedCreator(newCreator);
            } else {
                setToast({ show: true, title: 'Error', message: newCreator.error || 'Gagal menambahkan creator', type: 'error' });
            }
        } catch {
            setToast({ show: true, title: 'Error', message: 'Network error', type: 'error' });
        } finally {
            setIsManualSubmitting(false);
        }
    };

    const handleAIParse = async () => {
        if (!pasteText.trim()) return;
        setIsAIParsing(true);
        try {
            const res = await fetch('/api/ai/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: pasteText, type: 'CREATOR' })
            });
            const parsedData = await res.json();
            if (res.ok) {
                setTempParsedData(parsedData);
                setIsConfirmOldModalOpen(true);
            } else {
                setToast({ show: true, title: 'Error', message: parsedData.error || 'Failed to parse text', type: 'error' });
            }
        } catch (error) {
            setToast({ show: true, title: 'Error', message: 'Network error', type: 'error' });
        } finally {
            setIsAIParsing(false);
        }
    };

    const confirmAddCreator = async (isOld: boolean) => {
        if (!tempParsedData) return;
        setIsAIParsing(true);
        try {
            const createRes = await fetch('/api/creator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...tempParsedData, isOldCreator: isOld })
            });
            const newCreator = await createRes.json();
            if (createRes.ok) {
                setCreators([newCreator, ...creators]);
                setIsAddModalOpen(false);
                setIsConfirmOldModalOpen(false);
                setTempParsedData(null);
                setPasteText('');
                setToast({ show: true, title: 'Success', message: isOld ? 'Data Kreator Lama Berhasil Disinkron. (Laporan Spreadsheet Akan Ditunda)' : 'Creator added successfully!', type: 'success' });
                setSelectedCreator(newCreator);
            } else {
                setToast({ show: true, title: 'Error', message: newCreator.error || 'Failed to create creator', type: 'error' });
            }
        } catch (err) {
            setToast({ show: true, title: 'Error', message: 'Network error', type: 'error' });
        } finally {
            setIsAIParsing(false);
        }
    };

    const handleDeleteClick = (creator: any) => {
        setDeleteCreator(creator);
        setCountdown(3);
        setShowDeleteModal(true);
    };

    const handleBatchDeleteClick = () => {
        setCountdown(3);
        setShowBatchDeleteModal(true);
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if ((showDeleteModal || showBatchDeleteModal) && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [showDeleteModal, showBatchDeleteModal, countdown]);

    const handleDeleteCreator = async () => {
        if (!deleteCreator) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/creator?id=${deleteCreator.id}`, { method: 'DELETE' });
            if (res.ok) {
                setCreators(creators.filter(c => c.id !== deleteCreator.id));
                setShowDeleteModal(false);
                setToast({ show: true, title: 'Sukses', message: 'Kreator berhasil dihapus permanen', type: 'success' });
            }
        } catch (error) {
            setToast({ show: true, title: 'Error', message: 'Gagal menghapus kreator', type: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    const performBatchDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/creator?ids=${selectedIds.join(',')}`, { method: 'DELETE' });
            const result = await res.json();
            if (res.ok) {
                setCreators(creators.filter(c => !selectedIds.includes(c.id)));
                setSelectedIds([]);
                setShowBatchDeleteModal(false);
                setToast({ show: true, title: 'Sukses', message: `${result.count} kreator berhasil dihapus permanen`, type: 'success' });
            }
        } catch (error) {
            setToast({ show: true, title: 'Error', message: 'Gagal menghapus kreator terpilih', type: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleTransferClick = (creator: any) => {
        setTransferCreator(creator);
        fetch('/api/users/bd').then(res => res.json()).then(setEligibleUsers);
        setShowTransferModal(true);
    };

    const performTransfer = async (newUserId: string) => {
        if (!transferCreator) return;
        setIsTransferring(true);
        try {
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transferCreator.id, createdById: newUserId })
            });

            if (res.ok) {
                fetchCreators();
                setShowTransferModal(false);
                setToast({ show: true, title: 'Sukses', message: 'Data berhasil dioper ke user lain', type: 'success' });
            }
        } catch (error) {
            setToast({ show: true, title: 'Error', message: 'Gagal mengoper data', type: 'error' });
        } finally {
            setIsTransferring(false);
        }
    };

    const handleCopyLink = (creator: any) => {
        const link = `${window.location.origin}/creator/s/${creator.usernameTikTok}/${creator.sessionToken}`;
        navigator.clipboard.writeText(link);
        setToast({
            show: true,
            title: 'Berhasil',
            message: 'Link sesi telah disalin ke clipboard',
            type: 'success'
        });
    };

    const filteredCreators = creators.filter(c => {
        const s = debouncedTerm.toLowerCase();
        if (!s) return true;

        const nameMatch = c.name?.toLowerCase().includes(s);
        const userMatch = c.usernameTikTok?.toLowerCase().includes(s);
        const addressMatch = c.address?.toLowerCase().includes(s) || c.patokanAddress?.toLowerCase().includes(s);

        const statusMap: Record<string, string[]> = {
            REACHOUT: ['reachout', 'pendekatan', 'awal', 'kontak'],
            DEALING: ['dealing', 'kesepakatan', 'mou', 'deal'],
            SAMPLING: ['sampling', 'sampel', 'kirim sampel'],
            DRAFTING: ['drafting', 'produksi', 'konten', 'bikin video'],
            FINANCING: ['financing', 'pembayaran', 'bayar', 'duit', 'invoice'],
            FINISHED: ['finished', 'selesai', 'beres', 'done'],
            MONITORING: ['monitoring', 'pantau', 'aktif'],
        };

        const keywords = statusMap[c.status] || [];
        const statusMatch = keywords.some(k => k.includes(s)) || c.status.toLowerCase().includes(s);

        return nameMatch || userMatch || addressMatch || statusMatch;
    });

    return (
        <div style={{ padding: '0 0 40px 0', width: '100%', maxWidth: '100%' }}>
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    marginBottom: '32px',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}
            >
                <div style={{ minWidth: isMobile ? '100%' : '200px' }}>
                    <h1 style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Creators</h1>
                    <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '14px' }}>Track and manage collaborations</p>
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, auto)',
                    gap: '10px',
                    width: isMobile ? '100%' : 'auto'
                }}>
                    <Button
                        variant="outlined"
                        startIcon={<FileSpreadsheet size={16} />}
                        onClick={() => window.open('https://docs.google.com/spreadsheets/d/1iuiU-9f4TIFaBYOKfNmrPCPPBF_eM_rH-g53I4MQdzw/edit', '_blank')}
                        style={{
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 700,
                            borderColor: 'rgba(0,0,0,0.1)',
                            color: '#000',
                            height: '48px',
                            fontSize: isMobile ? '12px' : '14px'
                        }}
                    >
                        Shipment
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<FileSpreadsheet size={16} />}
                        onClick={() => window.open('https://docs.google.com/spreadsheets/d/17ZN35lcQ9X0bGXzu3QEYMDHZ5NgUJCNhH8L9jGOLGUs/edit', '_blank')}
                        style={{
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 700,
                            borderColor: 'rgba(0,0,0,0.1)',
                            color: '#000',
                            height: '48px',
                            fontSize: isMobile ? '12px' : '14px'
                        }}
                    >
                        OC Sheet
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<UserPlus size={18} />}
                        onClick={() => setIsAddModalOpen(true)}
                        style={{
                            gridColumn: isMobile ? 'span 2' : 'auto',
                            background: '#000',
                            color: '#fff',
                            borderRadius: '12px',
                            padding: '12px 24px',
                            textTransform: 'none',
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            height: '48px',
                            width: '100%'
                        }}
                    >
                        Add Creator
                    </Button>
                </div>
            </motion.div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <TextField
                    placeholder="Search by name, status, or address..."
                    fullWidth
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search size={18} color={isSmartSearch ? '#000' : 'var(--muted)'} />
                            </InputAdornment>
                        ),
                        endAdornment: searchTerm && (
                            <InputAdornment position="end">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        background: isSmartSearch ? '#000' : 'rgba(0,0,0,0.05)',
                                        color: isSmartSearch ? '#fff' : 'rgba(0,0,0,0.3)',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Sparkles size={10} />
                                    {isSmartSearch ? 'SMART SEARCH ON' : 'SEARCHING...'}
                                </motion.div>
                            </InputAdornment>
                        )
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '16px',
                            background: '#fff',
                            height: '56px',
                            '& fieldset': { borderColor: 'rgba(0,0,0,0.1)' },
                            '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.2)' },
                            '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '1.5px' },
                        }
                    }}
                />
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
                    <CircularProgress size={32} thickness={5} style={{ color: '#000' }} />
                </div>
            ) : creators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px', background: '#fff', borderRadius: '24px', border: '2px dashed rgba(0,0,0,0.05)' }}>
                    <UserPlus size={40} style={{ opacity: 0.1, marginBottom: '20px' }} />
                    <h3 style={{ margin: 0 }}>No creators yet</h3>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: isMobile ? '16px' : '20px'
                }}>
                    {filteredCreators.map((creator) => (
                        <CreatorCard
                            key={creator.id}
                            creator={creator}
                            onClick={() => setSelectedCreator(creator)}
                            onDelete={() => handleDeleteClick(creator)}
                            onOper={() => handleTransferClick(creator)}
                            onShare={() => handleCopyLink(creator)}
                            isSelected={selectedIds.includes(creator.id)}
                            onSelect={() => toggleSelection(creator.id)}
                        />
                    ))}
                </div>
            )}

            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        style={{
                            position: 'fixed',
                            bottom: '24px',
                            left: '50%',
                            translate: '-50% 0',
                            zIndex: 1500,
                            padding: '16px 24px',
                            background: '#000',
                            borderRadius: '24px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '24px',
                            color: '#fff',
                            minWidth: isMobile ? 'calc(100% - 32px)' : '400px',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                {selectedIds.length}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>Selected</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setSelectedIds([])} style={{ height: '40px', padding: '0 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>Batal</button>
                            <button onClick={handleBatchDeleteClick} style={{ height: '40px', padding: '0 20px', borderRadius: '12px', border: 'none', background: '#ff4444', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                <Trash2 size={14} /> Hapus
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Creator Modal */}
            <Dialog
                open={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setManualForm(emptyManualForm); setPasteText(''); setAddModalTab('manual'); }}
                maxWidth="sm" fullWidth
                PaperProps={{ style: { borderRadius: '24px', maxHeight: '90vh' } }}
            >
                <DialogTitle style={{ fontWeight: 800, paddingBottom: '8px' }}>Tambah Creator Baru</DialogTitle>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: '8px', padding: '0 24px 16px' }}>
                    {(['manual', 'paste'] as const).map(tab => (
                        <button key={tab} onClick={() => setAddModalTab(tab)} style={{
                            flex: 1, padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                            background: addModalTab === tab ? '#000' : '#f1f5f9',
                            color: addModalTab === tab ? '#fff' : '#64748b',
                            transition: 'all 0.15s',
                        }}>
                            {tab === 'manual' ? 'Form Manual' : 'AI Paste'}
                        </button>
                    ))}
                </div>

                <DialogContent style={{ paddingTop: 0 }}>
                    {addModalTab === 'manual' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Required */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                                        Nama Lengkap <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        value={manualForm.name}
                                        onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Nama creator"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                                        Username TikTok <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        value={manualForm.usernameTikTok}
                                        onChange={e => setManualForm(f => ({ ...f, usernameTikTok: e.target.value.replace('@', '') }))}
                                        placeholder="tanpa @"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>No. HP</label>
                                    <input
                                        value={manualForm.phoneNumber}
                                        onChange={e => setManualForm(f => ({ ...f, phoneNumber: e.target.value }))}
                                        placeholder="08xxxxxxxxxx"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>Followers</label>
                                    <input
                                        type="number"
                                        value={manualForm.followers}
                                        onChange={e => setManualForm(f => ({ ...f, followers: e.target.value }))}
                                        placeholder="e.g. 50000"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>Produk</label>
                                <select
                                    value={manualForm.productDescription}
                                    onChange={e => setManualForm(f => ({ ...f, productDescription: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none', background: '#fff' }}
                                >
                                    <option value="">— Pilih produk —</option>
                                    {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                                <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Identitas &amp; Pengiriman</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <input
                                        value={manualForm.ktpNumber}
                                        onChange={e => setManualForm(f => ({ ...f, ktpNumber: e.target.value }))}
                                        placeholder="No. KTP (16 digit)"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                    <textarea
                                        value={manualForm.address}
                                        onChange={e => setManualForm(f => ({ ...f, address: e.target.value }))}
                                        placeholder="Alamat lengkap"
                                        rows={2}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                                    />
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                                <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Bank / Pembayaran</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <input
                                        value={manualForm.bankName}
                                        onChange={e => setManualForm(f => ({ ...f, bankName: e.target.value }))}
                                        placeholder="Nama bank / e-wallet"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                    <input
                                        value={manualForm.kcpCity}
                                        onChange={e => setManualForm(f => ({ ...f, kcpCity: e.target.value }))}
                                        placeholder="KCP / Kota cabang"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                    <input
                                        value={manualForm.accountNumber}
                                        onChange={e => setManualForm(f => ({ ...f, accountNumber: e.target.value }))}
                                        placeholder="No. rekening"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                    <input
                                        value={manualForm.accountName}
                                        onChange={e => setManualForm(f => ({ ...f, accountName: e.target.value }))}
                                        placeholder="Nama pemilik rekening"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>
                                Paste data creator dari chat/form apapun. AI akan memparse otomatis. <br />
                                <span style={{ fontWeight: 700, color: '#f59e0b' }}>Butuh OpenAI API Key di .env.local</span>
                            </p>
                            <TextField
                                multiline rows={8} fullWidth
                                placeholder="Paste creator data here..."
                                value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', background: 'rgba(0,0,0,0.02)', '& fieldset': { border: 'none' } } }}
                            />
                        </div>
                    )}
                </DialogContent>

                <DialogActions style={{ padding: '16px 24px 24px', gap: '10px' }}>
                    <Button
                        onClick={() => { setIsAddModalOpen(false); setManualForm(emptyManualForm); setPasteText(''); setAddModalTab('manual'); }}
                        style={{ background: '#f8f8f8', color: '#666', borderRadius: '12px', padding: '10px 20px', fontWeight: 700, textTransform: 'none' }}
                    >
                        Batal
                    </Button>

                    {addModalTab === 'manual' ? (
                        <>
                            <Button
                                disabled={!manualForm.name.trim() || !manualForm.usernameTikTok.trim() || isManualSubmitting}
                                onClick={() => handleManualSubmit(true)}
                                style={{ background: '#f8f8f8', color: '#374151', borderRadius: '12px', padding: '10px 16px', fontWeight: 700, textTransform: 'none', fontSize: '13px' }}
                            >
                                {isManualSubmitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Creator Lama'}
                            </Button>
                            <Button
                                disabled={!manualForm.name.trim() || !manualForm.usernameTikTok.trim() || isManualSubmitting}
                                onClick={() => handleManualSubmit(false)}
                                style={{ background: (!manualForm.name.trim() || !manualForm.usernameTikTok.trim()) ? '#eee' : '#000', color: (!manualForm.name.trim() || !manualForm.usernameTikTok.trim()) ? '#888' : '#fff', borderRadius: '12px', padding: '10px 24px', fontWeight: 800, textTransform: 'none' }}
                            >
                                {isManualSubmitting ? 'Menyimpan...' : 'Tambah Creator'}
                            </Button>
                        </>
                    ) : (
                        <Button
                            disabled={!pasteText.trim() || isAIParsing}
                            onClick={handleAIParse}
                            style={{ background: isAIParsing ? '#eee' : '#000', color: isAIParsing ? '#888' : '#fff', borderRadius: '12px', padding: '10px 24px', fontWeight: 800, textTransform: 'none' }}
                        >
                            {isAIParsing ? 'Parsing...' : 'Parse & Tambah'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Old Creator Confirmation Modal */}
            <Dialog open={isConfirmOldModalOpen} onClose={() => setIsConfirmOldModalOpen(false)} PaperProps={{ style: { borderRadius: '24px', padding: '8px' } }}>
                <DialogTitle style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertCircle color="#f59e0b" />
                    Konfirmasi Kreator
                </DialogTitle>
                <DialogContent>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '15px' }}>Apakah kreator <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{tempParsedData?.name || `@${tempParsedData?.usernameTikTok}`}</span> ini adalah kreator yang sudah ada sebelumnya (Old Creator)?</p>
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--muted)' }}>Jika <b>YA</b>, data ini tidak akan dikirim ke Spreadsheet lagi untuk menghindari duplikasi laporan.</p>
                </DialogContent>
                <DialogActions style={{ padding: '24px', gap: '12px' }}>
                    <Button
                        disabled={isAIParsing}
                        onClick={() => confirmAddCreator(true)}
                        style={{ flex: 1, background: '#f8f8f8', color: '#666', borderRadius: '12px', padding: '14px', fontWeight: 700, textTransform: 'none' }}
                    >
                        {isAIParsing ? <CircularProgress size={20} /> : 'Iya, Kreator Lama'}
                    </Button>
                    <Button
                        disabled={isAIParsing}
                        onClick={() => confirmAddCreator(false)}
                        style={{ flex: 1, background: '#000', color: '#fff', borderRadius: '12px', padding: '14px', fontWeight: 700, textTransform: 'none' }}
                    >
                        {isAIParsing ? <CircularProgress size={20} /> : 'Tidak, Kreator Baru'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Modal (Single) */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}
                        onClick={() => !isDeleting && setShowDeleteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            style={{ background: '#fff', borderRadius: '32px', padding: '32px', width: '90%', maxWidth: '400px', textAlign: 'center' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <Trash2 size={48} color="#ff4444" style={{ marginBottom: '20px' }} />
                            <h3 style={{ margin: 0, fontWeight: 800 }}>Hapus Kreator?</h3>
                            <p style={{ color: 'rgba(0,0,0,0.5)', margin: '12px 0 24px 0' }}>Data <b>{deleteCreator?.name}</b> akan dihapus permanen dari database.</p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Batal</button>
                                <button
                                    onClick={handleDeleteCreator} disabled={countdown > 0 || isDeleting}
                                    style={{ flex: 2, padding: '16px', borderRadius: '16px', background: countdown > 0 ? '#eee' : '#000', color: countdown > 0 ? '#888' : '#fff', cursor: 'pointer', fontWeight: 800 }}
                                >
                                    {isDeleting ? 'Deleting...' : (countdown > 0 ? `Tunggu ${countdown}s` : 'Hapus Sekarang')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Batch Delete Modal */}
            <AnimatePresence>
                {showBatchDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}
                        onClick={() => !isDeleting && setShowBatchDeleteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            style={{ background: '#fff', borderRadius: '32px', padding: '32px', width: '90%', maxWidth: '400px', textAlign: 'center' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <Trash2 size={48} color="#ff4444" style={{ marginBottom: '20px' }} />
                            <h3 style={{ margin: 0, fontWeight: 800 }}>Hapus {selectedIds.length} Kreator?</h3>
                            <p style={{ color: 'rgba(0,0,0,0.5)', margin: '12px 0 24px 0' }}>Seluruh data terpilih akan dihapus permanen dari database.</p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setShowBatchDeleteModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Batal</button>
                                <button
                                    onClick={performBatchDelete} disabled={countdown > 0 || isDeleting}
                                    style={{ flex: 2, padding: '16px', borderRadius: '16px', background: countdown > 0 ? '#eee' : '#000', color: countdown > 0 ? '#888' : '#fff', cursor: 'pointer', fontWeight: 800 }}
                                >
                                    {isDeleting ? 'Deleting...' : (countdown > 0 ? `Tunggu ${countdown}s` : 'Hapus Masal')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Creator Detail */}
            <AnimatePresence>
                {selectedCreator && (
                    <CreatorDetail
                        creator={selectedCreator} onClose={() => setSelectedCreator(null)}
                        onUpdate={(updated) => {
                            setCreators(creators.map(c => c.id === updated.id ? updated : c));
                            setSelectedCreator(updated);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Transfer Modal */}
            <Dialog open={showTransferModal} onClose={() => setShowTransferModal(false)} PaperProps={{ style: { borderRadius: '24px' } }}>
                <DialogTitle style={{ fontWeight: 800 }}>Oper Data Kreator</DialogTitle>
                <DialogContent>
                    <p style={{ color: 'rgba(0,0,0,0.5)', marginBottom: '20px' }}>Pilih BD penerima untuk <b>{transferCreator?.name}</b></p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {eligibleUsers.filter(u => u.id !== transferCreator?.createdById).map(user => (
                            <button
                                key={user.id} onClick={() => performTransfer(user.id)} disabled={isTransferring}
                                style={{ padding: '16px', borderRadius: '12px', border: '1px solid #eee', background: '#f9f9f9', textAlign: 'left', cursor: 'pointer' }}
                            >
                                <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                                <div style={{ fontSize: '12px', color: '#888' }}>{user.role}</div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <NotificationToast
                show={toast.show} title={toast.title} message={toast.message} type={toast.type}
                onClose={() => setToast({ ...toast, show: false })}
            />
        </div>
    );
}
