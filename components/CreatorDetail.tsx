'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ChevronRight,
    CheckCircle2,
    Circle,
    User,
    MapPin,
    CreditCard,
    Package,
    Video,
    Send,
    Download,
    Upload,
    Loader2,
    Calendar,
    Hash,
    Phone,
    Copy,
    ExternalLink,
    MessageSquare,
    Trash2,
    ArrowLeftRight,
    AlertTriangle,
    FileText,
    Plus,
    ShieldCheck,
    Coins,
    Check,
    Eye
} from 'lucide-react';
import {
    Button,
    IconButton,
    TextField,
    Divider,
    Tooltip,
    CircularProgress
} from '@mui/material';
import { CreatorStatus } from '@prisma/client';
import SuccessModal from './SuccessModal';
import { useSession } from 'next-auth/react';

import { PRODUCT_OPTIONS } from '@/lib/constants';

interface CreatorDetailProps {
    creator: any;
    onClose: () => void;
    onUpdate: (updated: any) => void;
}

const statusSteps: { key: CreatorStatus; label: string; desc: string }[] = [
    { key: 'REACHOUT', label: 'Reachout', desc: 'Initial contact made' },
    { key: 'DEALING', label: 'Dealing', desc: 'MOU terms agreed' },
    { key: 'SAMPLING', label: 'Sampling', desc: 'Product sample sent' },
    { key: 'DRAFTING', label: 'Drafting', desc: 'Video production' },
    { key: 'FINANCING', label: 'Financing', desc: 'Payment process' },
    { key: 'FINISHED', label: 'Finished', desc: 'Project completed' },
    { key: 'MONITORING', label: 'Monitoring', desc: 'Long-term tracking' },
];

export default function CreatorDetail({ creator, onClose, onUpdate }: CreatorDetailProps) {
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role;

    const [activeTab, setActiveTab] = useState('progress');
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '' });
    const chatEndRef = useRef<HTMLDivElement>(null);
    const lastDataHash = useRef<string>('');
    const creatorRef = useRef(creator); // always latest creator data for stale closures
    useEffect(() => { creatorRef.current = creator; }, [creator]);
    const isFetching = useRef<boolean>(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // New states for Transfer and Delete
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
    const [isTransferring, setIsTransferring] = useState(false);

    // Fail logic
    const [showFailModal, setShowFailModal] = useState(false);
    const [failReason, setFailReason] = useState('');
    const [isFailing, setIsFailing] = useState(false);

    // Sampling form states
    const [showSamplingForm, setShowSamplingForm] = useState(false);
    const [samplingData, setSamplingData] = useState({
        deliveryDate: '',
        trackingNumber: ''
    });
    const [pendingStatus, setPendingStatus] = useState<CreatorStatus | null>(null);
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'MOU' | 'INVOICE' | null>(null);
    const [showInvoiceConfirmModal, setShowInvoiceConfirmModal] = useState(false);
    const [pendingInvoiceCategory, setPendingInvoiceCategory] = useState('B');
    const [pendingCompanionType, setPendingCompanionType] = useState<'MOU' | 'INVOICE'>('INVOICE');
    const [isUploadingManual, setIsUploadingManual] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [showDeleteProofConfirm, setShowDeleteProofConfirm] = useState(false);
    const [showDriveErrorModal, setShowDriveErrorModal] = useState(false);
    const [isDeletingSession, setIsDeletingSession] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<{ id: string, type: string } | null>(null);

    useEffect(() => {
        if (showTransferModal) {
            fetch('/api/users/bd').then(res => res.json()).then(setEligibleUsers);
        }
    }, [showTransferModal]);

    useEffect(() => {
        if (creator.reviewNotes?.includes('DRIVE PERMISSION ERROR')) {
            setShowDriveErrorModal(true);
        }
    }, [creator.reviewNotes]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showFailModal) {
                    setShowFailModal(false);
                } else if (showTransferModal) {
                    setShowTransferModal(false);
                } else if (showInvoiceConfirmModal) {
                    setShowInvoiceConfirmModal(false);
                } else if (showSamplingForm) {
                    setShowSamplingForm(false);
                } else if (successModal.show) {
                    setSuccessModal({ ...successModal, show: false });
                } else if (viewingImage) {
                    setViewingImage(null);
                } else if (showDeleteProofConfirm) {
                    setShowDeleteProofConfirm(false);
                } else if (showDriveErrorModal) {
                    setShowDriveErrorModal(false);
                } else if (sessionToDelete) {
                    setSessionToDelete(null);
                } else {
                    onClose();
                }
            } else if (e.key === 'Enter') {
                if (showFailModal && failReason.trim() && !isFailing) {
                    e.preventDefault();
                    handleFail();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        onClose, showFailModal, showTransferModal, showInvoiceConfirmModal,
        showSamplingForm, successModal, viewingImage, showDeleteProofConfirm,
        showDriveErrorModal, sessionToDelete, failReason, isFailing
    ]);

    useEffect(() => {
        const fetchAll = async () => {
            if (document.visibilityState !== 'visible' || isFetching.current) return;
            isFetching.current = true;

            try {
                const [msgRes, creatorRes] = await Promise.all([
                    fetch(`/api/creator/messages?creatorId=${creator.id}`),
                    fetch(`/api/creator/session?token=${creator.sessionToken}`)
                ]);

                if (msgRes.ok && creatorRes.ok) {
                    const [msgData, creatorData] = await Promise.all([msgRes.json(), creatorRes.json()]);
                    const newDataHash = JSON.stringify({ msgData, creatorData });
                    if (newDataHash === lastDataHash.current) return;

                    lastDataHash.current = newDataHash;
                    setMessages(msgData);
                    onUpdate({ ...creator, ...creatorData });
                }
            } catch (error) {
                console.error('Smart fetching error:', error);
            } finally {
                isFetching.current = false;
            }
        };

        (window as any).refreshCreatorData = fetchAll;
        fetchAll();
        markAsRead();

        const interval = setInterval(fetchAll, 600000);
        document.addEventListener('visibilitychange', fetchAll);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', fetchAll);
        };
    }, [creator.id, creator.sessionToken]);

    const markAsRead = async () => {
        try {
            const res = await fetch('/api/creator/messages/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creatorId: creator.id })
            });

            if (res.ok) {
                onUpdate({ ...creator, unreadCount: 0 });
            }
        } catch (err) {
            console.error('Failed to mark read:', err);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        try {
            const res = await fetch('/api/creator/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newMessage, creatorId: creator.id })
            });
            if (res.ok) {
                const msg = await res.json();
                setMessages([...messages, msg]);
                setNewMessage('');
                markAsRead();
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };


    const updateStatus = async (newStatus: CreatorStatus) => {
        const statusOrder: CreatorStatus[] = ['REACHOUT', 'DEALING', 'SAMPLING', 'DRAFTING', 'FINANCING', 'FINISHED', 'MONITORING'];
        const currentIndex = statusOrder.indexOf(creator.status);
        const newIndex = statusOrder.indexOf(newStatus);

        // Allow sequential progression (+1) OR one-step rollback (-1)
        const isForward = newIndex === currentIndex + 1;
        const isRollback = newIndex === currentIndex - 1;

        if (!isForward && !isRollback) {
            setSuccessModal({
                show: true,
                title: 'Invalid Status Change',
                message: 'Please follow the workflow step by step. You can only move to the next status or go back one step.'
            });
            return;
        }

        // If changing to DRAFTING (forward), show sampling form first
        if (newStatus === 'DRAFTING' && isForward) {
            setPendingStatus(newStatus);
            setShowSamplingForm(true);
            return;
        }

        setIsUpdatingStatus(true);
        try {
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: creator.id, status: newStatus })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleFail = async () => {
        if (!failReason.trim()) return;
        setIsFailing(true);
        try {
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: creator.id,
                    status: 'FAIL',
                    failedReason: failReason.trim(),
                    failedAt: new Date().toISOString()
                })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                setShowFailModal(false);
                onClose(); // Optional: close detail after failing
            }
        } catch (error) {
            console.error('Failed to mark as failed:', error);
        } finally {
            setIsFailing(false);
        }
    };

    const handleUpdateProductDesc = async (val: string) => {
        setIsUpdatingProduct(true);
        try {
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: creator.id, productDescription: val })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
            }
        } catch (error) {
            console.error('Failed to update product:', error);
        } finally {
            setIsUpdatingProduct(false);
        }
    };

    const handleSamplingSubmit = async () => {
        if (!pendingStatus) return;

        setIsUpdatingStatus(true);
        try {
            // Update creator with sampling data AND status
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: creator.id,
                    status: pendingStatus,
                    sampleDeliveryDate: samplingData.deliveryDate ? new Date(samplingData.deliveryDate).toISOString() : null,
                    sampleTrackingNumber: samplingData.trackingNumber || null
                })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                setShowSamplingForm(false);
                setSamplingData({ deliveryDate: '', trackingNumber: '' });
                setPendingStatus(null);
                setSuccessModal({ show: true, title: 'Sampling Data Saved', message: 'Sample delivery information has been recorded.' });
            }
        } catch (error) {
            console.error('Failed to submit sampling data:', error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleSamplingSkip = async () => {
        if (!pendingStatus) return;

        setIsUpdatingStatus(true);
        try {
            // Just update status without sampling data
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: creator.id, status: pendingStatus })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                setShowSamplingForm(false);
                setSamplingData({ deliveryDate: '', trackingNumber: '' });
                setPendingStatus(null);
                setSuccessModal({ show: true, title: 'Status Updated', message: 'Sampling data can be added later if needed.' });
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleTransfer = async (newUserId: string) => {
        if (!confirm('Apakah Anda yakin ingin memindahkan data kreator ini ke user lain?')) return;
        setIsTransferring(true);
        try {
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: creator.id, createdById: newUserId })
            });

            if (res.ok) {
                onClose(); // Close the detail view as user no longer owns it or it's moved
            }
        } catch (error) {
            console.error('Transfer failed:', error);
        } finally {
            setIsTransferring(false);
            setShowTransferModal(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('PERINGATAN: Menghapus kreator akan menghapus seluruh data secara permanen. Lanjutkan?')) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/creator?id=${creator.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                onClose();
            }
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownloadVideo = async () => {
        window.open(`/api/creator/video/download?creatorId=${creator.id}`, '_blank');
    };

    const handleUploadPaymentProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`/api/creator/video/upload/direct?creatorId=${creator.id}&type=proof`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const { videoUrl } = await res.json();
                await fetch('/api/creator', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: creator.id, paymentProofUrl: videoUrl, status: 'FINISHED' })
                });
                onUpdate({ ...creator, paymentProofUrl: videoUrl, status: 'FINISHED' });
                setSuccessModal({ show: true, title: 'Payment Sent', message: 'Payment proof has been successfully uploaded for this creator.' });
            }
        } catch (error) {
            console.error('Upload failed', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemovePaymentProof = async () => {
        setIsUploading(true);
        try {
            await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: creator.id, paymentProofUrl: null, status: 'FINANCING' })
            });
            onUpdate({ ...creator, paymentProofUrl: null, status: 'FINANCING' });
            setSuccessModal({ show: true, title: 'Bukti Dihapus', message: 'Bukti pembayaran telah dihapus. Silahkan upload ulang bukti yang benar.' });
        } catch (error) {
            console.error('Remove failed', error);
        } finally {
            setIsUploading(false);
            setShowDeleteProofConfirm(false);
        }
    };

    const handleGenerateQuickDoc = async (docType: 'MOU' | 'INVOICE', category: string = 'B') => {
        if (isGeneratingDoc) return; // prevent double click
        setIsGeneratingDoc(true);
        setGeneratingDocType(docType);
        try {
            const res = await fetch('/api/creator/session/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creatorId: creator.id, docType, category })
            });
            const data = await res.json();
            if (res.ok) {
                // Poll for completion — keep loading spinner until worker finishes
                const pollInterval = setInterval(async () => {
                    try {
                        const pollRes = await fetch(`/api/jobs/${data.requestId}`);
                        const job = await pollRes.json();
                        if (job.status === 'completed' || job.status === 'failed') {
                            clearInterval(pollInterval);
                            setIsGeneratingDoc(false);
                            setGeneratingDocType(null);
                            (window as any).refreshCreatorData?.();
                            // After completion, offer companion doc — but only if it doesn't already exist
                            if (job.status === 'completed') {
                                const companion = docType === 'MOU' ? 'INVOICE' : 'MOU';
                                const sessions = (creatorRef.current.SigningSessions as any[]) || [];
                                const companionExists = sessions.some((s: any) => s.type === companion);
                                if (!companionExists) {
                                    setPendingCompanionType(companion);
                                    setPendingInvoiceCategory(category);
                                    setShowInvoiceConfirmModal(true);
                                }
                            }
                        }
                    } catch (e) {
                        // silently ignore polling errors
                    }
                }, 2000);
                // Safety timeout — max 30s
                setTimeout(() => {
                    clearInterval(pollInterval);
                    setIsGeneratingDoc(false);
                    setGeneratingDocType(null);
                    (window as any).refreshCreatorData?.();
                    // Safety timeout: also show confirm if companion doesn't exist
                    const companion = docType === 'MOU' ? 'INVOICE' : 'MOU';
                    const sessions = (creatorRef.current.SigningSessions as any[]) || [];
                    const companionExists = sessions.some((s: any) => s.type === companion);
                    if (!companionExists) {
                        setPendingCompanionType(companion);
                        setPendingInvoiceCategory(category);
                        setShowInvoiceConfirmModal(true);
                    }
                }, 30000);
            } else {
                alert(data.error || 'Failed to generate document');
                setIsGeneratingDoc(false);
                setGeneratingDocType(null);
            }
        } catch (error) {
            alert('Network error while generating document');
            setIsGeneratingDoc(false);
            setGeneratingDocType(null);
        }
    };

    const handleConfirmInvoice = (confirm: boolean) => {
        setShowInvoiceConfirmModal(false);
        if (confirm) {
            handleGenerateQuickDoc(pendingCompanionType, pendingInvoiceCategory);
        }
    };

    const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'MOU' | 'INVOICE') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Find suggested docNo from existing sessions
        const targetSession = (creator.SigningSessions as any[])?.find(s => s.type === type);
        const mouSession = (creator.SigningSessions as any[])?.find(s => s.type === 'MOU');

        const suggestedNo = targetSession?.formData?.mou_number ||
            targetSession?.formData?.invoice_no ||
            targetSession?.formData?.docNo ||
            (type === 'INVOICE' ? (mouSession?.formData?.mou_number || mouSession?.formData?.docNo) : '') ||
            '';

        let docNo = suggestedNo;

        if (!docNo) {
            docNo = prompt(
                `Masukkan Nomor Dokumen (${type === 'INVOICE' ? 'Bisa pakai nomor MoU' : 'Nomor MoU'}):`,
                ''
            ) || '';
        }

        if (!docNo) return; // User cancelled or empty

        setIsUploadingManual(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('creatorId', creator.id);
        formData.append('type', type);
        formData.append('docNo', docNo);

        try {
            const res = await fetch('/api/creator/document/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                const displayType = type === 'MOU' ? 'MoU' : 'Invoice';
                setSuccessModal({
                    show: true,
                    title: 'Upload Success!',
                    message: `${displayType} manual "${docNo}" berhasil diunggah dan disimpan.`
                });
                (window as any).refreshCreatorData?.();
            } else {
                alert(data.error || 'Failed to upload document');
            }
        } catch (error) {
            console.error('Manual upload error:', error);
            alert('Network error during manual upload');
        } finally {
            setIsUploadingManual(false);
            if (e.target) e.target.value = ''; // Reset input
        }
    };

    const handleDeleteSession = async () => {
        if (!sessionToDelete) return;

        setIsDeletingSession(true);
        try {
            const res = await fetch(`/api/creator/session?id=${sessionToDelete.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setSuccessModal({
                    show: true,
                    title: 'Sesi Dihapus',
                    message: `Sesi ${sessionToDelete.type} dan dokumen terkait berhasil dihapus.`
                });
                setSessionToDelete(null);
                (window as any).refreshCreatorData?.();
            } else {
                const data = await res.json();
                alert(data.error || 'Gagal menghapus sesi');
            }
        } catch (error) {
            console.error('Delete session error:', error);
            alert('Gagal menghubungi server');
        } finally {
            setIsDeletingSession(false);
        }
    };

    const copySessionLink = () => {
        const url = `${window.location.origin}/creator/s/${creator.usernameTikTok}/${creator.sessionToken}`;
        navigator.clipboard.writeText(url);
        setSuccessModal({ show: true, title: 'Link Copied!', message: 'Collaboration session link has been copied to your clipboard. You can now share it with the creator.' });
    };

    const handleRequestRevision = async () => {
        setIsUpdatingStatus(true);
        try {
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: creator.id, internalAction: 'REQUEST_REVISION' })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                setSuccessModal({ show: true, title: 'Revision Requested', message: 'The creator will now be able to upload a new version of the video. The old version has been moved to history.' });
            }
        } catch (error) {
            console.error('Failed to request revision:', error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleApproveDraft = async () => {
        setIsUpdatingStatus(true);
        try {
            const res = await fetch('/api/creator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: creator.id, isDraftApproved: true, status: 'FINANCING' })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                setSuccessModal({ show: true, title: 'Draft Approved!', message: 'Video draft has been approved. The project is now moving to the Financing stage.' });
            }
        } catch (error) {
            console.error('Failed to approve draft:', error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const currentStepIdx = statusSteps.findIndex(s => s.key === creator.status);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: isMobile ? 'none' : 'blur(8px)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '0' : '24px'
            }}
        >
            <motion.div
                transition={{ duration: 0.2 }}
                style={{
                    width: '100%',
                    maxWidth: '1200px',
                    height: isMobile ? '100%' : '90vh',
                    background: '#f8f9fa',
                    borderRadius: isMobile ? '0' : '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
                    position: 'relative'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: isMobile ? '16px' : '24px 32px',
                    background: '#fff',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexShrink: 0
                }}>
                    <div style={{
                        width: isMobile ? '48px' : '56px',
                        height: isMobile ? '48px' : '56px',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        background: '#f8f8f8',
                        border: '1px solid rgba(0,0,0,0.03)',
                        flexShrink: 0
                    }}>
                        <img src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${creator.usernameTikTok}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`} alt="" style={{ width: '100%', height: '100%' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: isMobile ? '18px' : '24px',
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>{creator.name}</h2>
                        <p style={{ margin: 0, color: 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: '13px' }}>@{creator.usernameTikTok}</p>
                    </div>

                    <IconButton onClick={onClose} size="medium" style={{ background: '#f8f8f8', borderRadius: '14px' }}>
                        <X size={20} />
                    </IconButton>
                </div>

                {/* FAIL Banner */}
                {creator.status === 'FAIL' && (
                    <div style={{
                        background: '#fef2f2',
                        padding: '12px 32px',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <AlertTriangle size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 800, color: '#b91c1c', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proyek Dibatalkan</span>
                                {creator.failedAt && <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>• {new Date(creator.failedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                            </div>
                            {creator.failedReason && <p style={{ margin: 0, fontSize: '12px', color: '#7f1d1d', fontWeight: 600, fontStyle: 'italic' }}>"{creator.failedReason}"</p>}
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', position: 'relative' }}>
                    {/* Left: Progress & Info - Hidden on mobile if chat is expanded */}
                    <div style={{
                        flex: 1,
                        padding: isMobile ? '20px' : '32px',
                        overflowY: 'auto',
                        display: (isMobile && isChatExpanded) ? 'none' : 'block'
                    }} className="no-scrollbar">
                        {/* Progress Stepper */}
                        <div style={{ marginBottom: isMobile ? '24px' : '40px', background: isMobile ? '#fff' : 'transparent', padding: isMobile ? '20px' : '0', borderRadius: isMobile ? '24px' : '0', border: isMobile ? '1px solid rgba(0,0,0,0.03)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '20px' : '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', margin: 0, letterSpacing: '0.05em' }}>Journey</h3>
                                    {creator.isOldCreator && (
                                        <div style={{ background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 800 }}>OLD CREATOR</div>
                                    )}
                                </div>
                                <IconButton size="small" onClick={() => (window as any).refreshCreatorData?.()}>
                                    <Loader2 size={14} className={isFetching.current ? 'animate-spin' : ''} />
                                </IconButton>
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: isMobile ? 'center' : 'space-between',
                                position: 'relative',
                                gap: isMobile ? '40px' : '0',
                                paddingBottom: isMobile ? '10px' : '0',
                                alignItems: 'center'
                            }}>
                                {/* Desktop connecting line */}
                                {!isMobile && (
                                    <>
                                        <div style={{ position: 'absolute', top: '15px', left: '20px', right: '20px', height: '2px', background: 'rgba(0,0,0,0.05)', zIndex: 1 }} />
                                        <div style={{
                                            position: 'absolute',
                                            top: '15px',
                                            left: '20px',
                                            width: `${(currentStepIdx / (statusSteps.length - 1)) * 100}%`,
                                            height: '2px',
                                            background: '#000',
                                            zIndex: 1,
                                            transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }} />
                                    </>
                                )}

                                {/* Mobile connecting line */}
                                {isMobile && (
                                    <div style={{ position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '2px', background: 'rgba(0,0,0,0.05)', zIndex: 1 }} />
                                )}

                                <AnimatePresence mode="popLayout" initial={false}>
                                    {statusSteps.map((step, idx) => {
                                        const isCompleted = idx < currentStepIdx;
                                        const isCurrent = idx === currentStepIdx;
                                        const isNext = idx === currentStepIdx + 1;
                                        const isPrev = idx === currentStepIdx - 1;

                                        // On mobile, show PREV, CURRENT, and NEXT (3 steps total)
                                        if (isMobile && !isCurrent && !isPrev && !isNext) return null;

                                        return (
                                            <motion.div
                                                key={step.key}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.1 }}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    zIndex: 2,
                                                    width: isMobile ? '80px' : '80px',
                                                    position: 'relative'
                                                }}
                                            >
                                                {/* Pulse Effect for Current Step */}
                                                {isCurrent && (
                                                    <motion.div
                                                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                        style={{
                                                            position: 'absolute',
                                                            top: isMobile ? '0px' : '0px',
                                                            width: isMobile ? '32px' : '32px',
                                                            height: isMobile ? '32px' : '32px',
                                                            borderRadius: '50%',
                                                            background: '#000',
                                                            zIndex: -1
                                                        }}
                                                    />
                                                )}

                                                <motion.div
                                                    whileHover={!isUpdatingStatus ? { scale: 1.1 } : {}}
                                                    whileTap={!isUpdatingStatus ? { scale: 0.95 } : {}}
                                                    onClick={() => !isUpdatingStatus && updateStatus(step.key)}
                                                    style={{
                                                        width: isMobile ? '32px' : '32px',
                                                        height: isMobile ? '32px' : '32px',
                                                        borderRadius: '50%',
                                                        background: isCurrent ? '#000' : (isCompleted ? '#f0f0f0' : '#fff'),
                                                        border: isCurrent ? 'none' : `2px solid ${isCompleted ? '#f0f0f0' : 'rgba(0,0,0,0.05)'}`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                                                        boxShadow: isCurrent ? '0 8px 16px rgba(0,0,0,0.2)' : 'none',
                                                        position: 'relative',
                                                        opacity: isUpdatingStatus ? 0.6 : 1,
                                                        transition: 'opacity 0.2s'
                                                    }}
                                                >
                                                    {isCompleted ? (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                                                            <CheckCircle2 size={isMobile ? 16 : 16} color="#000" />
                                                        </motion.div>
                                                    ) : (
                                                        isCurrent ? (
                                                            isUpdatingStatus ? <CircularProgress size={16} color="inherit" style={{ color: '#fff' }} /> :
                                                                <motion.span
                                                                    key={`idx-${idx}`}
                                                                    initial={{ y: 5, opacity: 0 }}
                                                                    animate={{ y: 0, opacity: 1 }}
                                                                    style={{ color: '#fff', fontSize: '11px', fontWeight: 800 }}
                                                                >
                                                                    {idx + 1}
                                                                </motion.span>
                                                        ) : (
                                                            <Circle size={isMobile ? 16 : 16} color="rgba(0,0,0,0.2)" />
                                                        )
                                                    )}
                                                </motion.div>
                                                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                                                    <motion.p
                                                        animate={{ color: isCurrent ? '#000' : 'rgba(0,0,0,0.3)' }}
                                                        style={{
                                                            margin: 0,
                                                            fontSize: '8px',
                                                            fontWeight: 800,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.05em',
                                                        }}
                                                    >
                                                        {isPrev ? 'PREV' : (isCurrent ? 'CURRENT' : (isNext ? 'NEXT' : ''))}
                                                    </motion.p>
                                                    <motion.p
                                                        animate={{
                                                            fontWeight: isCurrent ? 800 : 600,
                                                            color: isCurrent ? '#000' : 'rgba(0,0,0,0.4)',
                                                            scale: isCurrent ? 1.05 : 1
                                                        }}
                                                        style={{
                                                            margin: '1px 0 0 0',
                                                            fontSize: '11px',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {step.label}
                                                    </motion.p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '24px' }}>
                            {/* Biodata */}
                            <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.03)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <User size={18} />
                                    <h4 style={{ margin: 0, fontWeight: 700 }}>Personal Info</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <InfoField label="MOU Name" value={creator.name} icon={<User size={14} />} />
                                    <InfoField label="TikTok" value={`@${creator.usernameTikTok}`} icon={<Hash size={14} />} />
                                    <InfoField label="KTP" value={creator.ktpNumber} icon={<CreditCard size={14} />} />
                                    <InfoField label="Phone" value={creator.phoneNumber} icon={<Phone size={14} />} />
                                    <InfoField label="Address" value={creator.address} />
                                    <InfoField label="Patokan" value={creator.patokanAddress} />
                                </div>
                            </div>

                            {/* Product & Bank */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.03)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Package size={18} />
                                            <h4 style={{ margin: 0, fontWeight: 700 }}>Product Choice</h4>
                                        </div>
                                        {isUpdatingProduct && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Description (Reporting)</span>
                                            <select
                                                value={creator.productDescription || ''}
                                                onChange={(e) => handleUpdateProductDesc(e.target.value)}
                                                disabled={isUpdatingProduct || !['REACHOUT', 'DEALING'].includes(creator.status)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '12px',
                                                    border: '1px solid rgba(0,0,0,0.1)',
                                                    background: '#fcfcfc',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="">-- PILIH PRODUK --</option>
                                                {PRODUCT_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <InfoField label="Hair Comb Color" value={creator.hairCombColor} />
                                        <InfoField label="Long Hair" value={creator.isLongHair ? 'Yes' : 'No'} />
                                    </div>
                                </div>
                                <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.03)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <CreditCard size={18} />
                                        <h4 style={{ margin: 0, fontWeight: 700 }}>Payment Details</h4>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <InfoField label="Bank" value={creator.bankName} />
                                        <InfoField label={['DANA', 'VIRTUAL ACCOUNT'].includes((creator.bankName || '').toUpperCase()) ? 'Virtual Account' : 'No Rekening'} value={creator.accountNumber} />
                                        <InfoField label="Atas Nama" value={creator.accountName} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Legal & Billing Section */}
                        <div style={{ marginTop: '24px', background: '#fff', padding: isMobile ? '20px' : '24px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '36px', height: '36px', background: 'rgba(0,0,0,0.03)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>Legal & Billing</h4>
                                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Generate or upload documents</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
                                        {/* MoU Row - Only if NO MoU exists */}
                                        {!((creator.SigningSessions as any[]) || []).some(s => s.type === 'MOU') && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <Button
                                                    variant="contained"
                                                    onClick={() => handleGenerateQuickDoc('MOU', 'B')}
                                                    disabled={isGeneratingDoc || isUploadingManual}
                                                    startIcon={isGeneratingDoc ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                                    style={{
                                                        background: '#000',
                                                        color: '#fff',
                                                        textTransform: 'none',
                                                        borderRadius: '12px',
                                                        height: '40px',
                                                        padding: '0 12px',
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        flex: 1
                                                    }}
                                                >
                                                    MoU
                                                </Button>
                                                <label style={{ flex: 1 }}>
                                                    <input type="file" hidden onChange={(e) => handleManualUpload(e, 'MOU')} accept="application/pdf,image/*" />
                                                    <Button
                                                        fullWidth
                                                        component="span"
                                                        variant="outlined"
                                                        disabled={isUploadingManual || isGeneratingDoc}
                                                        startIcon={<Upload size={14} />}
                                                        style={{
                                                            textTransform: 'none',
                                                            fontSize: '12px',
                                                            fontWeight: 700,
                                                            borderRadius: '12px',
                                                            height: '40px',
                                                            borderColor: 'rgba(0,0,0,0.1)',
                                                            color: '#000'
                                                        }}
                                                    >
                                                        Upload
                                                    </Button>
                                                </label>
                                            </div>
                                        )}
                                        {/* Invoice Row - Only if NO Invoice exists */}
                                        {!((creator.SigningSessions as any[]) || []).some(s => s.type === 'INVOICE') && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <Button
                                                    variant="contained"
                                                    onClick={() => handleGenerateQuickDoc('INVOICE', 'B')}
                                                    disabled={isGeneratingDoc || isUploadingManual}
                                                    startIcon={isGeneratingDoc ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                                    style={{
                                                        background: '#22c55e',
                                                        color: '#fff',
                                                        textTransform: 'none',
                                                        borderRadius: '12px',
                                                        height: '40px',
                                                        padding: '0 12px',
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        flex: 1
                                                    }}
                                                >
                                                    Invoice
                                                </Button>
                                                <label style={{ flex: 1 }}>
                                                    <input type="file" hidden onChange={(e) => handleManualUpload(e, 'INVOICE')} accept="application/pdf,image/*" />
                                                    <Button
                                                        fullWidth
                                                        component="span"
                                                        variant="outlined"
                                                        disabled={isUploadingManual || isGeneratingDoc}
                                                        startIcon={<Upload size={14} />}
                                                        style={{
                                                            textTransform: 'none',
                                                            fontSize: '12px',
                                                            fontWeight: 700,
                                                            borderRadius: '12px',
                                                            height: '40px',
                                                            borderColor: 'rgba(0,0,0,0.1)',
                                                            color: '#000'
                                                        }}
                                                    >
                                                        Upload
                                                    </Button>
                                                </label>
                                            </div>
                                        )}

                                        {((creator.SigningSessions as any[]) || []).length > 0 && (
                                            <div style={{
                                                marginTop: '4px',
                                                padding: '12px',
                                                background: '#f8fafc',
                                                borderRadius: '14px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '12px',
                                                color: '#64748b',
                                                fontWeight: 600,
                                                textAlign: 'center'
                                            }}>
                                                Dokumen sudah tersedia. Hapus sesi di bawah jika ingin revisi atau upload ulang.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {/* Skeleton card while generating */}
                                {isGeneratingDoc && generatingDocType && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{
                                            background: '#fcfcfc',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                            borderRadius: '18px',
                                            padding: '14px 16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '14px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Icon skeleton */}
                                        <div style={{
                                            width: '42px', height: '42px', flexShrink: 0,
                                            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                            backgroundSize: '200% 100%',
                                            borderRadius: '12px',
                                            animation: 'skeleton-shimmer 1.5s infinite'
                                        }} />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{
                                                height: '12px', width: '60%',
                                                background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                backgroundSize: '200% 100%',
                                                borderRadius: '6px',
                                                animation: 'skeleton-shimmer 1.5s infinite'
                                            }} />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    height: '10px', width: '20%',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    borderRadius: '4px',
                                                    animation: 'skeleton-shimmer 1.5s infinite'
                                                }} />
                                                <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', fontWeight: 700 }}>
                                                    Membuat {generatingDocType === 'MOU' ? 'MoU' : 'Invoice'}...
                                                </span>
                                                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', color: 'rgba(0,0,0,0.3)' }} />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                {(creator.SigningSessions as any[])?.length > 0 ? (
                                    (creator.SigningSessions as any[]).map((session) => (
                                        <div key={session.id} style={{
                                            background: '#fcfcfc',
                                            border: '1px solid rgba(0,0,0,0.04)',
                                            borderRadius: '18px',
                                            padding: '14px 16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'all 0.2s ease'
                                        }} className="document-item-hover">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                                                <div style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    background: session.type === 'MOU' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(34, 197, 94, 0.08)',
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {session.type === 'MOU' ? <FileText size={20} /> : <Coins size={20} color="#16a34a" />}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '13px',
                                                        fontWeight: 800,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {session.formData?.mou_number || session.formData?.invoice_no || 'Document'}
                                                    </p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                                                        <div style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: session.status === 'COMPLETED' ? '#dcfce7' : (session.status === 'PENDING' ? '#fef3c7' : '#f1f5f9'),
                                                            color: session.status === 'COMPLETED' ? '#166534' : (session.status === 'PENDING' ? '#92400e' : '#64748b'),
                                                            fontSize: '10px',
                                                            fontWeight: 800,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.02em'
                                                        }}>
                                                            {session.status}
                                                        </div>
                                                        <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>{new Date(session.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                                                {/* Download button — always through API, never raw S3 URL */}
                                                {session.Document?.id && (session.Document?.fileUrl || session.Document?.signedFileUrl) && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => window.open(`/api/documents/${session.Document.id}/download`, '_blank')}
                                                        style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '10px' }}
                                                        title="Download PDF"
                                                    >
                                                        <Download size={16} />
                                                    </IconButton>
                                                )}
                                                {/* Review / delete buttons */}
                                                {session.status !== 'COMPLETED' ? (
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <Button
                                                            variant="text"
                                                            size="small"
                                                            onClick={() => {
                                                                const url = `${window.location.origin}/sign/${session.token}`;
                                                                window.open(url, '_blank');
                                                            }}
                                                            style={{
                                                                textTransform: 'none',
                                                                fontWeight: 700,
                                                                borderRadius: '10px',
                                                                fontSize: '12px',
                                                                color: '#000',
                                                                background: 'rgba(0,0,0,0.03)',
                                                                padding: '4px 12px'
                                                            }}
                                                        >
                                                            Review
                                                        </Button>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSessionToDelete({ id: session.id, type: session.type });
                                                            }}
                                                            style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px' }}
                                                        >
                                                            <X size={14} />
                                                        </IconButton>
                                                    </div>
                                                ) : (
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSessionToDelete({ id: session.id, type: session.type });
                                                        }}
                                                        style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px' }}
                                                    >
                                                        <X size={14} />
                                                    </IconButton>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '30px 20px', textAlign: 'center', border: '1px dashed rgba(0,0,0,0.06)', borderRadius: '20px', background: 'rgba(0,0,0,0.01)' }}>
                                        <FileText size={32} style={{ marginBottom: '10px', opacity: 0.1, margin: '0 auto' }} />
                                        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Belum ada MoU yang dibuat.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Video Section */}
                        {(creator.videoUrl || currentStepIdx >= statusSteps.findIndex(s => s.key === 'DRAFTING')) && (
                            <div style={{ marginTop: '24px', background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.03)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Video size={18} />
                                        <h4 style={{ margin: 0, fontWeight: 700 }}>Video Content</h4>
                                    </div>
                                </div>
                                {creator.videoUrl ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Premium File Card for Video - Responsive Stack for Mobile */}
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
                                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        Video Content
                                                    </p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                        <CheckCircle2 size={12} color="#22c55e" />
                                                        <p style={{ margin: 0, fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>{creator.isDraftApproved ? 'Final Approved' : 'Ready'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    fullWidth={isMobile}
                                                    // Always view via Crowncare proxy (avoid direct Backblaze links)
                                                    onClick={() => window.open(`/api/creator/video/view?creatorId=${creator.id}`, '_blank')}
                                                    style={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, borderColor: 'rgba(0,0,0,0.1)', color: '#000', height: isMobile ? '40px' : 'auto' }}
                                                >
                                                    View
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    fullWidth={isMobile}
                                                    onClick={handleDownloadVideo}
                                                    style={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, background: '#000', color: '#fff', height: isMobile ? '40px' : 'auto' }}
                                                >
                                                    Download
                                                </Button>
                                            </div>
                                        </div>

                                        {creator.videoUrl?.includes('http') && (
                                            <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Suggested Filename for Download</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <code style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                                        {`${creator.usernameTikTok}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.mp4`}
                                                    </code>
                                                    <Button
                                                        size="small"
                                                        onClick={() => navigator.clipboard.writeText(`${creator.usernameTikTok}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.mp4`)}
                                                        style={{ textTransform: 'none', fontSize: '10px', minWidth: 'auto', padding: '2px 8px' }}
                                                    >
                                                        Copy Name
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {creator.status === 'DRAFTING' && !creator.isDraftApproved && (
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    disabled={isUpdatingStatus}
                                                    onClick={handleRequestRevision}
                                                    style={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, borderColor: '#000', color: '#000' }}
                                                >
                                                    Revision
                                                </Button>
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    disabled={isUpdatingStatus}
                                                    onClick={handleApproveDraft}
                                                    style={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, background: '#000', color: '#fff' }}
                                                >
                                                    {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : 'Approve'}
                                                </Button>
                                            </div>
                                        )}

                                        {(creator.videoHistory as any[])?.length > 0 && (
                                            <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                                                <p style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>History & Previous Revisions</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {(creator.videoHistory as any[]).map((h, i) => (
                                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.03)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <Video size={14} color="rgba(0,0,0,0.3)" />
                                                                <span style={{ fontSize: '13px', fontWeight: 700 }}>Revision #{i + 1}</span>
                                                            </div>
                                                            <Button
                                                                size="small"
                                                                onClick={() => window.open(`/api/creator/video/view?creatorId=${creator.id}&historyIdx=${i}`, '_blank')}
                                                                style={{ textTransform: 'none', minWidth: 'auto', fontWeight: 700 }}
                                                            >
                                                                View
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ padding: '40px', border: '2px dashed rgba(0,0,0,0.05)', borderRadius: '16px', textAlign: 'center' }}>
                                        <p style={{ color: 'var(--muted)', margin: 0 }}>Waiting for creator to upload the video...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Financing & Proof Section - PREMIUM REDESIGN */}
                        {(creator.status === 'FINANCING' || creator.status === 'FINISHED') && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    marginTop: '32px',
                                    background: '#fff',
                                    padding: '28px',
                                    borderRadius: '32px',
                                    border: '1px solid rgba(0,0,0,0.04)',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.02)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            background: '#000',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}>
                                            <CreditCard size={20} color="#fff" />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontWeight: 800, fontSize: '16px', letterSpacing: '-0.3px' }}>Bukti Pembayaran</h4>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Payment & Transaction History</p>
                                        </div>
                                    </div>
                                    {creator.paymentProofUrl && (
                                        <div style={{
                                            background: '#f0fdf4',
                                            color: '#166534',
                                            padding: '6px 14px',
                                            borderRadius: '100px',
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            border: '1px solid #bbf7d0'
                                        }}>
                                            <CheckCircle2 size={13} strokeWidth={2.5} /> COMPLETED
                                        </div>
                                    )}
                                </div>

                                {creator.paymentProofUrl ? (
                                    <div style={{
                                        position: 'relative',
                                        borderRadius: '24px',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(0,0,0,0.04)',
                                        background: '#f8f9fa',
                                        padding: '16px'
                                    }}>
                                        <div
                                            style={{
                                                position: 'relative',
                                                borderRadius: '16px',
                                                overflow: 'hidden',
                                                aspectRatio: '16/10',
                                                background: '#f1f5f9',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setViewingImage(`/api/creator/video/view?creatorId=${creator.id}&type=proof`)}
                                        >
                                            <img
                                                src={`/api/creator/video/view?creatorId=${creator.id}&type=proof`}
                                                alt="Payment Proof"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                background: 'rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'background 0.3s'
                                            }}>
                                                <div style={{
                                                    background: 'rgba(255,255,255,0.9)',
                                                    backdropFilter: 'blur(10px)',
                                                    padding: '8px 16px',
                                                    borderRadius: '100px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                    fontWeight: 700,
                                                    fontSize: '12px'
                                                }}>
                                                    <Eye size={14} /> Klik untuk memperbesar
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<X size={14} />}
                                                onClick={() => setShowDeleteProofConfirm(true)}
                                                disabled={isUploading}
                                                style={{
                                                    borderRadius: '14px',
                                                    textTransform: 'none',
                                                    fontWeight: 800,
                                                    background: '#fff',
                                                    color: '#ef4444',
                                                    border: '1px solid rgba(239, 68, 68, 0.1)',
                                                    boxShadow: 'none',
                                                    fontSize: '13px',
                                                    height: '44px'
                                                }}
                                            >
                                                Hapus & Upload Ulang
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '48px 24px',
                                        border: '2px dashed rgba(0,0,0,0.06)',
                                        borderRadius: '28px',
                                        textAlign: 'center',
                                        background: 'rgba(0,0,0,0.005)',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            background: '#fff',
                                            borderRadius: '20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 20px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                                            border: '1px solid rgba(0,0,0,0.02)'
                                        }}>
                                            <Upload size={28} color="rgba(0,0,0,0.15)" />
                                        </div>
                                        <p style={{ color: 'rgba(0,0,0,0.5)', fontWeight: 600, fontSize: '14px', margin: '0 0 24px 0', maxWidth: '280px', marginLeft: 'auto', marginRight: 'auto' }}>
                                            Kreator sudah mencapai tahap Financing. Silakan unggah bukti transfer untuk menyelesaikan project.
                                        </p>
                                        <input type="file" id="proof-upload" hidden onChange={handleUploadPaymentProof} accept="image/*" />
                                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                            <Button
                                                component="label"
                                                htmlFor="proof-upload"
                                                variant="contained"
                                                disabled={isUploading}
                                                startIcon={isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                                style={{
                                                    background: '#000',
                                                    color: '#fff',
                                                    borderRadius: '16px',
                                                    textTransform: 'none',
                                                    fontWeight: 800,
                                                    padding: '12px 32px',
                                                    fontSize: '14px',
                                                    boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                                                    height: '48px'
                                                }}
                                            >
                                                {isUploading ? 'Mengunggah...' : 'Unggah Bukti Transfer'}
                                            </Button>
                                        </motion.div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Danger Zone: Fail Project (Only BD and Admin) */}
                        {['BD', 'BD_ASSISTANT_MANAGER', 'SYSTEM'].includes(userRole) && creator.status !== 'FAIL' && (
                            <div style={{ marginTop: '24px', background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: '#fef2f2' }}>
                                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: 800, color: '#b91c1c' }}>Hentikan Project</h4>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#991b1b', marginTop: '4px', fontWeight: 600 }}>Tandai project ini sebagai selesai karena gagal (Mark as Finished with reason). Data tidak akan bisa di-endorse oleh Kurator/Analis.</p>
                                    </div>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        onClick={() => setShowFailModal(true)}
                                        style={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800, background: '#ef4444', color: '#fff', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)', width: isMobile ? '100%' : 'auto' }}
                                    >
                                        Mark as Finished (Fail)
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Message/Chat - Overlay on mobile if expanded, sidebar on desktop */}
                    <div style={{
                        width: isMobile ? '100%' : '400px',
                        height: isMobile ? '100%' : 'auto',
                        background: '#fff',
                        borderLeft: isMobile ? 'none' : '1px solid rgba(0,0,0,0.05)',
                        display: (isMobile && !isChatExpanded) ? 'none' : 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        position: isMobile ? 'absolute' : 'relative',
                        top: 0,
                        left: 0,
                        zIndex: 10
                    }}>
                        <div style={{ padding: isMobile ? '16px 20px' : '24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isMobile && (
                                    <IconButton size="small" onClick={() => setIsChatExpanded(false)} style={{ marginRight: '8px' }}>
                                        <X size={18} />
                                    </IconButton>
                                )}
                                <h4 style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <MessageSquare size={18} /> Chat
                                </h4>
                            </div>
                            <IconButton size="small" onClick={() => (window as any).refreshCreatorData?.()}>
                                <Loader2 size={14} className={isFetching.current ? 'animate-spin' : ''} />
                            </IconButton>
                        </div>
                        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }} className="no-scrollbar">
                            {messages.map((msg) => {
                                const isFeedback = msg.content.startsWith('📢 [MASUKAN]') || msg.content.startsWith('📢 [FEEDBACK]');
                                const feedbackMarker = msg.content.startsWith('📢 [MASUKAN]') ? '📢 [MASUKAN]' : '📢 [FEEDBACK]';
                                const displayContent = isFeedback ? msg.content.replace(feedbackMarker, '').trim() : msg.content;

                                if (isFeedback) {
                                    return (
                                        <div key={msg.id} style={{
                                            alignSelf: 'center',
                                            width: '90%',
                                            background: '#f8fafc',
                                            padding: '10px 14px',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            textAlign: 'center',
                                            margin: '4px 0'
                                        }}>
                                            <p style={{ margin: '0 0 2px 0', fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Masukan Team Analis</p>
                                            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.4, color: '#000', fontWeight: 600 }}>
                                                {displayContent}
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={msg.id} style={{
                                        alignSelf: msg.senderId ? 'flex-end' : 'flex-start',
                                        maxWidth: '85%'
                                    }}>
                                        <div style={{
                                            padding: isMobile ? '12px 16px' : '10px 14px',
                                            borderRadius: msg.senderId ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                            background: msg.senderId ? '#000' : '#f0f0f0',
                                            color: msg.senderId ? '#fff' : '#000',
                                            fontSize: isMobile ? '14px' : '13px',
                                            lineHeight: 1.5
                                        }}>
                                            {msg.content}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', textAlign: msg.senderId ? 'right' : 'left' }}>
                                            {msg.senderId ? 'You' : creator.usernameTikTok} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    placeholder="Type a note..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '12px',
                                            background: 'rgba(0,0,0,0.03)',
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
                                        justifyContent: 'center'
                                    }}
                                    className="send-button-hover"
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
                    </div>

                    {/* Mobile Floating Chat Bubble */}
                    {
                        isMobile && !isChatExpanded && (
                            <motion.button
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                onClick={() => setIsChatExpanded(true)}
                                style={{
                                    position: 'absolute',
                                    bottom: '24px',
                                    right: '24px',
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '28px',
                                    background: '#000',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: 'none',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                    zIndex: 5,
                                    cursor: 'pointer'
                                }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <MessageSquare size={24} />
                                {messages.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        background: '#ff4b4b',
                                        color: '#fff',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        border: '2px solid #fff'
                                    }}>
                                        !
                                    </div>
                                )}
                            </motion.button>
                        )
                    }
                </div >
            </motion.div >
            <SuccessModal
                show={successModal.show}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, show: false })}
            />

            {/* Transfer Modal */}
            <AnimatePresence>
                {showTransferModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '20px'
                        }}
                        onClick={() => setShowTransferModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: '#fff',
                                borderRadius: '32px',
                                padding: '32px',
                                width: '100%',
                                maxWidth: '400px',
                                boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    background: '#f8f8f8',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    <ArrowLeftRight size={32} color="#000" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Oper Data Kreator</h3>
                                <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', marginTop: '8px' }}>
                                    Pilih user yang akan menerima data ini.
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }} className="no-scrollbar">
                                {eligibleUsers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', opacity: 0.3 }} />
                                    </div>
                                ) : (
                                    eligibleUsers.filter(u => u.id !== creator.createdById).map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleTransfer(user.id)}
                                            disabled={isTransferring}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '16px',
                                                borderRadius: '20px',
                                                border: '1px solid rgba(0,0,0,0.05)',
                                                background: '#fcfcfc',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.2s',
                                                width: '100%'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '14px' }}>{user.fullName}</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', marginTop: '2px', fontWeight: 600 }}>
                                                    {user.username} • {user.role === 'BD_ASSISTANT_MANAGER' ? 'BD AM' : 'BD'}
                                                </div>
                                            </div>
                                            <ChevronRight size={16} color="rgba(0,0,0,0.2)" />
                                        </button>
                                    ))
                                )}
                            </div>

                            <button
                                onClick={() => setShowTransferModal(false)}
                                style={{
                                    width: '100%',
                                    marginTop: '24px',
                                    padding: '16px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    background: '#000',
                                    color: '#fff',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Batal
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sampling Form Modal */}
            <AnimatePresence>
                {showSamplingForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 3500,
                            padding: '24px'
                        }}
                        onClick={() => !isUpdatingStatus && setShowSamplingForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                background: '#fff',
                                borderRadius: '32px',
                                padding: '32px',
                                width: '90%',
                                maxWidth: '500px'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                <div style={{ width: '48px', height: '48px', background: '#000', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '20px' }}>Sample Delivery Info</h3>
                                    <p style={{ margin: '4px 0 0 0', color: 'rgba(0,0,0,0.5)', fontSize: '13px' }}>When did you send the sample? (Optional)</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        Delivery Date
                                    </label>
                                    <input
                                        type="date"
                                        value={samplingData.deliveryDate}
                                        onChange={(e) => setSamplingData({ ...samplingData, deliveryDate: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: '16px',
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            background: '#fcfcfc',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        Tracking Number
                                    </label>
                                    <input
                                        type="text"
                                        value={samplingData.trackingNumber}
                                        onChange={(e) => setSamplingData({ ...samplingData, trackingNumber: e.target.value })}
                                        placeholder="Enter tracking/resi number"
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: '16px',
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            background: '#fcfcfc',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={handleSamplingSkip}
                                    disabled={isUpdatingStatus}
                                    style={{
                                        flex: 1,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: '#fff',
                                        cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                                        fontWeight: 700,
                                        fontSize: '14px',
                                        opacity: isUpdatingStatus ? 0.5 : 1
                                    }}
                                >
                                    Skip for Now
                                </button>
                                <button
                                    onClick={handleSamplingSubmit}
                                    disabled={isUpdatingStatus}
                                    style={{
                                        flex: 2,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        background: isUpdatingStatus ? '#eee' : '#000',
                                        color: isUpdatingStatus ? '#888' : '#fff',
                                        cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                                        fontWeight: 800,
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {isUpdatingStatus ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save & Continue'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Drive Permission Error Modal */}
            <AnimatePresence>
                {showDriveErrorModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 6000,
                            padding: '24px'
                        }}
                        onClick={() => setShowDriveErrorModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                background: '#fff',
                                borderRadius: '32px',
                                padding: '32px',
                                maxWidth: '500px',
                                width: '100%',
                                textAlign: 'center'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <AlertTriangle size={32} color="#ef4444" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>⚠️ Link Drive Bermasalah</h3>
                            <div style={{
                                marginTop: '20px',
                                background: '#fef2f2',
                                padding: '16px',
                                borderRadius: '16px',
                                border: '1px solid #fee2e2',
                                textAlign: 'left'
                            }}>
                                <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', lineHeight: 1.6, fontWeight: 600 }}>
                                    Link Drive kreator publik, tapi opsi <b>"Batasi Download/Copy"</b> menyala. Sistem AI kami tidak bisa menduplikat video secara otomatis.
                                </p>
                            </div>

                            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '12px', marginTop: '20px', lineHeight: 1.6, textAlign: 'left' }}>
                                <b>Cara Fix:</b> Minta kreator buka Share &gt; Settings (Gear) &gt; Centang "Viewers can download/copy" agar AKTIF. Pesan instruksi ini juga sudah otomatis dikirim ke chat kreator.
                            </p>

                            <button
                                onClick={() => setShowDriveErrorModal(false)}
                                style={{
                                    width: '100%',
                                    marginTop: '28px',
                                    padding: '16px',
                                    borderRadius: '16px',
                                    border: 'none',
                                    background: '#000',
                                    color: '#fff',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Oke, Saya Mengerti
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Image Viewer Modal */}
            <AnimatePresence>
                {viewingImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.95)',
                            backdropFilter: 'blur(20px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 5000,
                            padding: isMobile ? '20px' : '40px'
                        }}
                        onClick={() => setViewingImage(null)}
                    >
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                                position: 'absolute',
                                top: '32px',
                                right: '32px',
                                width: '48px',
                                height: '48px',
                                borderRadius: '24px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                zIndex: 5001
                            }}
                        >
                            <X size={24} />
                        </motion.button>

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'relative',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={viewingImage}
                                alt="High Resolution Preview"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '90vh',
                                    objectFit: 'contain',
                                    borderRadius: '12px',
                                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                                }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal for Delete Proof */}
            <AnimatePresence>
                {showDeleteProofConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 4000,
                            padding: '24px'
                        }}
                        onClick={() => !isUploading && setShowDeleteProofConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                background: '#fff',
                                borderRadius: '32px',
                                padding: '32px',
                                maxWidth: '400px',
                                width: '100%',
                                textAlign: 'center'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <AlertTriangle size={32} color="#ef4444" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Hapus Bukti Transfer?</h3>
                            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', marginTop: '12px', lineHeight: 1.5 }}>
                                Tindakan ini akan menghapus bukti transfer dan mengembalikan status kreator ke <b>FINANCING</b>. Data tidak bisa dikembalikan.
                            </p>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                <button
                                    onClick={() => setShowDeleteProofConfirm(false)}
                                    disabled={isUploading}
                                    style={{
                                        flex: 1,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: '#fff',
                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                        fontWeight: 700,
                                        fontSize: '14px'
                                    }}
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleRemovePaymentProof}
                                    disabled={isUploading}
                                    style={{
                                        flex: 2,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        background: '#ef4444',
                                        color: '#fff',
                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                        fontWeight: 800,
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : 'Ya, Hapus Bukti'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal for Session Deletion */}
            <AnimatePresence>
                {sessionToDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 6000,
                            padding: '24px'
                        }}
                        onClick={() => !isDeletingSession && setSessionToDelete(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                background: '#fff',
                                borderRadius: '32px',
                                padding: '32px',
                                maxWidth: '400px',
                                width: '100%',
                                textAlign: 'center'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <AlertTriangle size={32} color="#ef4444" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Hapus Sesi Dokumen?</h3>
                            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', marginTop: '12px', lineHeight: 1.5 }}>
                                Sesi {sessionToDelete.type} dan file yang diunggah akan dihapus secara permanen. Anda perlu membuat sesi baru untuk mengunggah revisi.
                            </p>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                <button
                                    onClick={() => setSessionToDelete(null)}
                                    disabled={isDeletingSession}
                                    style={{
                                        flex: 1,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: '#fff',
                                        cursor: isDeletingSession ? 'not-allowed' : 'pointer',
                                        fontWeight: 700,
                                        fontSize: '14px'
                                    }}
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleDeleteSession}
                                    disabled={isDeletingSession}
                                    style={{
                                        flex: 2,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        background: '#ef4444',
                                        color: '#fff',
                                        cursor: isDeletingSession ? 'not-allowed' : 'pointer',
                                        fontWeight: 800,
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {isDeletingSession ? <Loader2 size={16} className="animate-spin" /> : 'Ya, Hapus Sesi'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Fail Modal */}
            <AnimatePresence>
                {showFailModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 6000,
                            padding: '24px'
                        }}
                        onClick={() => !isFailing && setShowFailModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                background: '#fff',
                                borderRadius: '32px',
                                padding: '32px',
                                maxWidth: '400px',
                                width: '100%',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px'
                                }}>
                                    <AlertTriangle size={32} color="#ef4444" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Mark as Finished</h3>
                                <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '13px', marginTop: '8px', lineHeight: 1.5, fontWeight: 600 }}>
                                    Apakah Anda yakin ingin menghentikan kontrak ini? Status kreator akan menjadi FAIL dan data menjadi mati (tidak bisa di-endorse).
                                </p>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                    Alasan Kegagalan
                                </label>
                                <textarea
                                    value={failReason}
                                    onChange={(e) => setFailReason(e.target.value)}
                                    placeholder="Tulis alasan kenapa kerjasama ini batal/selesai..."
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: '#fcfcfc',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        outline: 'none',
                                        minHeight: '100px',
                                        resize: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setShowFailModal(false)}
                                    disabled={isFailing}
                                    style={{
                                        flex: 1,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: '#fff',
                                        cursor: isFailing ? 'not-allowed' : 'pointer',
                                        fontWeight: 700,
                                        fontSize: '14px'
                                    }}
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleFail}
                                    disabled={isFailing || !failReason.trim()}
                                    style={{
                                        flex: 2,
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        background: (!failReason.trim() || isFailing) ? '#f87171' : '#ef4444',
                                        color: '#fff',
                                        cursor: (!failReason.trim() || isFailing) ? 'not-allowed' : 'pointer',
                                        fontWeight: 800,
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {isFailing ? <Loader2 size={16} className="animate-spin" /> : 'Yakin, Mark as Finished'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invoice Confirm Modal — muncul setelah MoU selesai */}
            <AnimatePresence>
                {showInvoiceConfirmModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 7000, padding: '24px'
                        }}
                        onClick={() => handleConfirmInvoice(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.85, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                            style={{
                                background: '#fff',
                                borderRadius: '32px',
                                padding: '36px 32px',
                                maxWidth: '420px',
                                width: '100%',
                                textAlign: 'center',
                                boxShadow: '0 32px 80px rgba(0,0,0,0.2)'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Emoji tanpa kotak */}
                            <div style={{ fontSize: '48px', margin: '0 auto 16px', lineHeight: 1 }}>🎉</div>

                            <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px' }}>
                                {pendingCompanionType === 'INVOICE' ? 'MoU-nya udah jadi!' : 'Invoice-nya udah jadi!'}
                            </h3>
                            <p style={{ margin: '0 0 28px 0', fontSize: '14px', color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, fontWeight: 500 }}>
                                Sekalian bikin <b>{pendingCompanionType === 'INVOICE' ? 'Invoice' : 'MoU'}</b> juga?
                            </p>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => handleConfirmInvoice(false)}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#000'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#000'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.5)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.1)'; }}
                                    style={{
                                        flex: 1, padding: '14px',
                                        borderRadius: '14px',
                                        border: '1.5px solid rgba(0,0,0,0.1)',
                                        background: '#fff', cursor: 'pointer',
                                        fontWeight: 700, fontSize: '14px',
                                        color: 'rgba(0,0,0,0.5)',
                                        transition: 'all 0.18s'
                                    }}
                                >
                                    gak
                                </button>
                                <button
                                    onClick={() => handleConfirmInvoice(true)}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#000'; (e.currentTarget as HTMLButtonElement).style.border = '1.5px solid #000'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#000'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.border = 'none'; }}
                                    style={{
                                        flex: 2, padding: '14px',
                                        borderRadius: '14px',
                                        border: 'none',
                                        background: '#000',
                                        color: '#fff', cursor: 'pointer',
                                        fontWeight: 800, fontSize: '14px',
                                        transition: 'all 0.18s'
                                    }}
                                >
                                    mau {pendingCompanionType === 'INVOICE' ? 'invoice' : 'mou'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div >
    );
};

function InfoField({ label, value, icon }: { label: string; value: any; icon?: any }) {
    if (!value) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>{label}</span>
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {icon}
                {value}
            </div>
        </div>
    );
}
