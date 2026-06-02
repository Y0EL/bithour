'use client';

import React, { useState, useEffect } from 'react';
import {
    Search,
    FileText,
    ExternalLink,
    Calendar,
    Loader2,
    BookOpen,
    Trash2,
    CheckCircle,
    Download,
    MoreVertical,
    Filter,
    Plus,
    CheckSquare,
    Square,
    Archive,
    XCircle,
    Upload
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { groupItemsByDate, formatTimeHM } from '@/utils/dateUtils';

import { useSession } from 'next-auth/react';
import StatusModal from '@/components/StatusModal';
import { useTranslation } from 'react-i18next';

export default function AllDocumentsPage() {
    const { t } = useTranslation();
    const { data: session } = useSession();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; docId: string; reason: string; countdown: number }>({
        open: false,
        docId: '',
        reason: '',
        countdown: 5
    });
    const [batchDeleteModal, setBatchDeleteModal] = useState<{ open: boolean; reason: string; countdown: number }>({
        open: false,
        reason: '',
        countdown: 5
    });
    const [downloading, setDownloading] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [statusModal, setStatusModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false,
        title: '',
        message: '',
        type: 'info'
    });
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [markingFinished, setMarkingFinished] = useState<string | null>(null);
    const [uploadingSigned, setUploadingSigned] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const handleUploadSignedManual = async (docId: string, file: File) => {
        setUploadingSigned(docId);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('isManual', 'true');

            const res = await fetch(`/api/documents/${docId}/upload-signed/complete`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Upload failed');
            }

            await fetchDocuments();
            setStatusModal({
                open: true,
                title: 'Success',
                message: 'Signed document uploaded and marked as manual',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Upload failed', error);
            setStatusModal({ open: true, title: 'Error', message: error.message, type: 'error' });
        } finally {
            setUploadingSigned(null);
        }
    };
    const [appliedRange, setAppliedRange] = useState({ start: '', end: '' });
    const [showFilter, setShowFilter] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchDownloadProgress, setBatchDownloadProgress] = useState({ current: 0, total: 0 });

    const userRole = (session?.user as any)?.role;

    if (userRole === 'ANALYST') {
        return (
            <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff', borderRadius: '32px', border: '1px solid #f1f5f9', marginTop: '40px' }}>
                <div style={{ width: '80px', height: '80px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <XCircle size={40} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', marginBottom: '12px' }}>Akses Terbatas</h2>
                <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    Role <b>Analyst</b> tidak memiliki izin untuk melihat manajemen dokumen.
                </p>
            </div>
        );
    }

    const handleDownload = async (url: string, filename: string, docId?: string) => {
        const targetUrl = docId ? `/api/documents/${docId}/download` : url;

        if (!url && !docId) {
            setStatusModal({
                open: true,
                title: t('documents.error_title'),
                message: t('documents.no_file_available'),
                type: 'error'
            });
            return;
        }

        setDownloading(docId || url);
        try {
            const response = await fetch(targetUrl);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || t('documents.download_failed_msg'));
            }
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error: any) {
            console.error('Download failed', error);
            setStatusModal({
                open: true,
                title: t('documents.error_title'),
                message: error.message || t('documents.download_failed_msg'),
                type: 'error'
            });
        } finally {
            setDownloading(null);
        }
    };

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/documents/list');
            const data = await res.json();
            setDocuments(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.reason) {
            setStatusModal({ open: true, title: t('documents.reason_required'), message: t('documents.reason_required_msg'), type: 'error' });
            return;
        }

        setDeleting(true);
        try {
            const res = await fetch(`/api/documents/${deleteModal.docId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: deleteModal.reason })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete');
            }

            // Auto-refresh from database instead of relying on local state
            await fetchDocuments();
            setDeleteModal({ open: false, docId: '', reason: '', countdown: 5 });
            setStatusModal({ open: true, title: t('documents.deleted_title'), message: t('documents.deleted_msg'), type: 'success' });
        } catch (err: any) {
            setStatusModal({ open: true, title: t('documents.error_title'), message: err.message, type: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const handleMarkFinished = async (docId: string) => {
        setMarkingFinished(docId);
        try {
            const res = await fetch(`/api/documents/${docId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'COMPLETED' })
            });

            if (!res.ok) throw new Error('Failed to update status');

            setDocuments(documents.map(d => d.id === docId ? { ...d, status: 'COMPLETED' } : d));
            setStatusModal({ open: true, title: 'Success', message: 'Document marked as finished and reported to Sheets', type: 'success' });
        } catch (err: any) {
            setStatusModal({ open: true, title: 'Error', message: err.message, type: 'error' });
        } finally {
            setMarkingFinished(null);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!batchDeleteModal.reason) {
            setStatusModal({ open: true, title: 'Reason Required', message: 'Please provide a reason for batch deletion', type: 'error' });
            return;
        }

        setBatchProcessing(true);
        try {
            const res = await fetch('/api/documents/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, action: 'delete', reason: batchDeleteModal.reason })
            });

            if (!res.ok) throw new Error('Failed to delete some documents');

            // Auto-refresh from database instead of relying on local state
            await fetchDocuments();
            setSelectedIds([]);
            setBatchDeleteModal({ open: false, reason: '', countdown: 5 });
            setStatusModal({ open: true, title: 'Success', message: `Deleted ${selectedIds.length} documents successfully`, type: 'success' });
        } catch (err: any) {
            setStatusModal({ open: true, title: 'Error', message: err.message, type: 'error' });
        } finally {
            setBatchProcessing(false);
        }
    };

    const handleBatchDownload = async () => {
        if (selectedIds.length === 0) return;
        setBatchProcessing(true);
        setBatchDownloadProgress({ current: 0, total: selectedIds.length });

        try {
            const zip = new JSZip();
            const docsToDownload = documents.filter(d => selectedIds.includes(d.id));

            for (let i = 0; i < docsToDownload.length; i++) {
                const doc = docsToDownload[i];
                setBatchDownloadProgress({ current: i + 1, total: docsToDownload.length });

                try {
                    // Fix: Use the API handle download to avoid CORS issues with B2 URLs
                    const res = await fetch(`/api/documents/${doc.id}/download`);
                    if (!res.ok) throw new Error(`Failed to fetch ${doc.documentNo}`);
                    const blob = await res.blob();

                    const fileName = doc.documentNo.replace(/[/\\?%*:|"<>]/g, '-') + '.pdf';
                    zip.file(fileName, blob);
                } catch (err) {
                    console.error(`Skipping ${doc.documentNo}`, err);
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `Documents_Export_${new Date().toISOString().split('T')[0]}.zip`);

            setSelectedIds([]);
            setStatusModal({ open: true, title: 'Success', message: 'ZIP created and download started!', type: 'success' });
        } catch (err: any) {
            setStatusModal({ open: true, title: 'Error', message: 'Error creating ZIP: ' + err.message, type: 'error' });
        } finally {
            setBatchProcessing(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAllSelection = () => {
        if (selectedIds.length === filteredDocs.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredDocs.map((d: any) => d.id));
        }
    };

    useEffect(() => {
        setIsSearching(true);
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setIsSearching(false);
        }, 600); // 600ms debounce

        return () => clearTimeout(handler);
    }, [search]);

    const fetchDocumentsSilent = async () => {
        try {
            const res = await fetch('/api/documents/list');
            const data = await res.json();
            if (Array.isArray(data)) {
                setDocuments(data);
            }
        } catch (err) {
            console.error('Silent fetch failed:', err);
        }
    };

    // Countdown Logic for Delete Modals
    useEffect(() => {
        let timer: any;
        if (deleteModal.open && deleteModal.countdown > 0) {
            timer = setInterval(() => {
                setDeleteModal(prev => ({ ...prev, countdown: prev.countdown - 1 }));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [deleteModal.open, deleteModal.countdown]);

    useEffect(() => {
        let timer: any;
        if (batchDeleteModal.open && batchDeleteModal.countdown > 0) {
            timer = setInterval(() => {
                setBatchDeleteModal(prev => ({ ...prev, countdown: prev.countdown - 1 }));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [batchDeleteModal.open, batchDeleteModal.countdown]);

    useEffect(() => {
        fetchDocuments();
        const interval = setInterval(() => {
            fetchDocumentsSilent();
        }, 45000);

        const handleClickOutside = () => setActiveMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => {
            clearInterval(interval);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const filteredDocs = Array.isArray(documents) ? documents.filter((doc: any) => {
        const query = debouncedSearch.toLowerCase();
        const meta = doc.metadata || {};
        const metaName = (meta.party2_name || meta.from_name || '').toLowerCase();
        const metaUsername = (meta.party2_username || meta.from_username || '').toLowerCase();

        const matchesSearch = !query || (
            doc.documentNo?.toLowerCase().includes(query) ||
            doc.title?.toLowerCase().includes(query) ||
            doc.createdBy?.username?.toLowerCase().includes(query) ||
            metaName.includes(query) ||
            metaUsername.includes(query)
        );

        if (!matchesSearch) return false;

        // Date Filter
        if (appliedRange.start || appliedRange.end) {
            const docDate = new Date(doc.createdAt);
            docDate.setHours(0, 0, 0, 0);

            if (appliedRange.start) {
                const start = new Date(appliedRange.start);
                start.setHours(0, 0, 0, 0);
                if (docDate < start) return false;
            }
            if (appliedRange.end) {
                const end = new Date(appliedRange.end);
                end.setHours(0, 0, 0, 0);
                if (docDate > end) return false;
            }
        }

        return true;
    }) : [];

    const typeMap: any = {
        'PurchaseVideoTiktok': 'A',
        'VideoOwningContent': 'B',
        'PromotionalProductBonus': 'C',
        'ContractExclusive': 'D'
    };

    const parseRef = (doc: any) => {
        const ref = doc.documentNo;
        const meta = doc.metadata || doc.formData || {};

        // If it's a temp ID or "WAITING", try to get the real NO from metadata
        if (!ref || ref.startsWith('TEMP-') || ref === 'WAITING') {
            const metaNo = meta.invoice_no || meta.mou_number;
            if (metaNo) return metaNo;

            const typeValue = meta.type || meta.invType || 'B';
            return `${typeValue}-???`;
        }

        // Apply formatting for finalized numbers
        const parts = ref.split('-');
        if (doc.type === 'INVOICE') {
            // Cat-Ref-INV-... -> Cat-Ref
            if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
        } else if (doc.type === 'MOU') {
            // New format: Cat-Ref-MoU-DTI-YYYYMMDD-Seq
            // Example: B-093-MoU-DTI-20260123-0001
            // We want to display: Cat-Ref (B-093)
            if (parts.length >= 2) {
                return `${parts[0]}-${parts[1]}`;
            }
        }

        // For manual IDs, if they are too long (e.g. MANUAL-timestamp), truncate them
        if (ref && ref.startsWith('MANUAL-')) {
            const timestamp = ref.replace('MANUAL-', '');
            if (timestamp.length > 8) {
                return `M-${timestamp.substring(0, 8)}...`;
            }
        }

        return ref;
    };

    const getCleanUrl = (url: string) => {
        if (!url) return '';

        let clean = url;
        // Fix double-prepended protocol issues
        if (clean.includes('https://') && clean.lastIndexOf('https://') > 0) {
            clean = clean.substring(clean.lastIndexOf('https://'));
        }

        // B2 S3 Fix: Convert virtual-host style (bucket.s3...) to path-style (s3.../bucket)
        // From: https://crowncare.s3.us-east-005.backblazeb2.com/invoices/INV_...
        // To:   https://s3.us-east-005.backblazeb2.com/crowncare/invoices/INV_...
        if (clean.includes('.s3.') && clean.includes('.backblazeb2.com')) {
            try {
                const urlObj = new URL(clean);
                const hostname = urlObj.hostname;
                const parts = hostname.split('.');
                // Virtual-host style: bucket.s3.region.backblazeb2.com (parts[1] is 's3')
                // Path-style: s3.region.backblazeb2.com (parts[0] is 's3')
                if (parts.length >= 5 && parts[1] === 's3') {
                    const bucket = parts[0];
                    const newHostname = parts.slice(1).join('.');
                    return `https://${newHostname}/${bucket}${urlObj.pathname}`;
                }
            } catch (e) {
                console.error("URL Parsing failed for B2 cleanup", e);
            }
        }

        // If it's a relative path, ensure it has the origin
        if (clean.startsWith('/')) {
            if (typeof window !== 'undefined') {
                return `${window.location.origin}${clean}`;
            }
        }

        return clean;
    };

    const getUsername = (doc: any) => {
        const ref = doc.documentNo;
        const meta = doc.metadata || {};
        const username = meta.from_username || meta.username || meta.party2_username;
        if (username) return username.startsWith('@') ? username : `@${username}`;
        if (ref && ref.includes(' ')) {
            const parts = ref.split(' ');
            if (parts.length > 1) {
                const extracted = parts[1].split('-')[0];
                return extracted.startsWith('@') ? extracted : `@${extracted}`;
            }
        }
        return '';
    };

    return (
        <div style={{ position: 'relative' }}>
            {activeMenu && (
                <div
                    onClick={() => setActiveMenu(null)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'transparent' }}
                />
            )}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800, marginBottom: '4px', color: '#111' }}>{t('documents.title')}</h1>
                <p style={{ color: '#666', fontSize: '14px' }}>{t('documents.subtitle')}</p>
            </div>

            {/* Batch Action Bar */}
            {selectedIds.length > 0 && (
                <div style={{
                    position: 'sticky',
                    top: '12px',
                    zIndex: 50,
                    background: '#000',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: '16px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    animation: 'slideInTop 0.3s cubic-bezier(0, 0, 0.2, 1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => setSelectedIds([])}
                            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px' }}
                        >
                            <XCircle size={18} />
                        </button>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{selectedIds.length} Selected</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleBatchDownload}
                            disabled={batchProcessing}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            {batchProcessing ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                            Download ZIP
                        </button>

                        {['SYSTEM', 'MANAGER', 'FINANCE', 'BD_ASSISTANT_MANAGER', 'BD'].includes(userRole) && (
                            <button
                                onClick={() => setBatchDeleteModal({ open: true, reason: '', countdown: 5 })}
                                disabled={batchProcessing}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={16} />
                                Delete All
                            </button>
                        )}
                    </div>

                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                    <Search
                        style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: isSearching ? '#000' : '#888',
                            opacity: isSearching ? 1 : 0.5
                        }}
                        size={18}
                        className={isSearching ? 'animate-pulse' : ''}
                    />
                    <input
                        className="form-control"
                        placeholder={t('documents.search_placeholder') || 'Search ID, name, or title...'}
                        style={{ paddingLeft: '44px', height: '48px', borderRadius: '14px', fontSize: '14px', border: search ? '2px solid #000' : '1px solid #eee', transition: 'all 0.2s' }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {isSearching && (
                        <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', color: '#888', fontWeight: 700 }}>AI Thinking...</span>
                            <Loader2 size={14} className="animate-spin" />
                        </div>
                    )}
                    <button
                        onClick={() => setShowFilter(!showFilter)}
                        style={{
                            position: 'absolute',
                            right: isSearching ? '85px' : '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: showFilter ? '#000' : 'transparent',
                            color: showFilter ? '#fff' : '#666',
                            border: '1px solid #eee',
                            borderRadius: '10px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            zIndex: 10
                        }}
                    >
                        <Filter size={14} />
                        <span className="desktop-only">{showFilter ? 'Close Filter' : 'Filter by Date'}</span>
                        {(appliedRange.start || appliedRange.end) && !showFilter && (
                            <div style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%' }}></div>
                        )}
                    </button>
                </div>

                {showFilter && (
                    <div style={{
                        marginTop: '12px',
                        padding: '16px',
                        background: 'white',
                        borderRadius: '16px',
                        border: '2px solid #000',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        animation: 'slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '120px' }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Start Date</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    style={{ height: '42px', fontSize: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%' }}
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                />
                            </div>
                            <div style={{ padding: '20px 0 0 0', fontWeight: 800, color: '#e2e8f0', fontSize: '10px' }} className="hide-mobile">TO</div>
                            <div style={{ flex: 1, minWidth: '120px' }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>End Date</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    style={{ height: '42px', fontSize: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%' }}
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    setAppliedRange(dateRange);
                                    setShowFilter(false);
                                }}
                                style={{
                                    flex: 2,
                                    height: '42px',
                                    borderRadius: '10px',
                                    background: '#000',
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                Apply Filter
                            </button>
                            <button
                                onClick={() => {
                                    const reset = { start: '', end: '' };
                                    setDateRange(reset);
                                    setAppliedRange(reset);
                                    setShowFilter(false);
                                }}
                                style={{
                                    flex: 1,
                                    height: '42px',
                                    borderRadius: '10px',
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}

                {debouncedSearch && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#666', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={10} color="#16a34a" />
                        Showing results for: <span style={{ color: '#000' }}>"{debouncedSearch}"</span>
                    </div>
                )}
            </div>

            <div>
                <div className="glass-card" style={{ padding: '0', overflowX: 'hidden', borderRadius: '16px', border: '1px solid #eee', background: 'white' }}>
                    <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead style={{ background: '#fdfdfd', borderBottom: '1px solid #f0f0f0' }}>
                            <tr>
                                <th style={{ padding: '12px 16px', width: '45px' }}>
                                    <button
                                        onClick={toggleAllSelection}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                                    >
                                        {selectedIds.length === filteredDocs.length && filteredDocs.length > 0
                                            ? <CheckSquare size={18} color="#000" />
                                            : <Square size={18} />
                                        }
                                    </button>
                                </th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '38%' }}>{t('documents.doc_info')}</th>
                                <th className="desktop-only" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '12%' }}>{t('documents.created_by')}</th>
                                <th className="desktop-only" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '14%' }}>{t('documents.amount')}</th>
                                <th className="desktop-only" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '8%' }}>{t('documents.stamp')}</th>
                                <th className="desktop-only" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '8%' }}>{t('documents.time')}</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '20%' }}>{t('documents.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#000' }} /></td></tr>
                            ) : filteredDocs.length === 0 ? (
                                <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#999', fontSize: '14px' }}>{t('documents.no_docs')}</td></tr>
                            ) : groupItemsByDate(filteredDocs).map(([dateLabel, docs]: [string, any]) => (
                                <React.Fragment key={dateLabel}>
                                    <tr>
                                        <td colSpan={7} style={{ background: '#f8fafc', padding: '10px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', borderTop: '1px solid #eef2f6', borderBottom: '1px solid #eef2f6' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={14} />
                                                {dateLabel.toUpperCase()}
                                            </div>
                                        </td>
                                    </tr>
                                    {docs.map((doc: any) => (
                                        <tr
                                            key={doc.id}
                                            style={{
                                                borderBottom: '1px solid #f0f0f0',
                                                position: 'relative',
                                                zIndex: activeMenu === doc.id ? 100 : 1,
                                                background: selectedIds.includes(doc.id) ? '#f8fafc' : 'white'
                                            }}
                                            className="hover-row"
                                        >
                                            <td style={{ padding: '12px 16px' }}>
                                                <button
                                                    onClick={() => toggleSelection(doc.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedIds.includes(doc.id) ? '#000' : '#ddd' }}
                                                >
                                                    {selectedIds.includes(doc.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                            </td>
                                            <td style={{ padding: '12px 16px', overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        background: '#f8fafc',
                                                        borderRadius: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#000',
                                                        flexShrink: 0,
                                                        border: '1px solid #f1f5f9'
                                                    }}>
                                                        {doc.type === 'INVOICE' ? <FileText size={18} /> : <BookOpen size={18} />}
                                                    </div>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            flexWrap: 'wrap',
                                                            marginBottom: '2px'
                                                        }}>
                                                            <span style={{
                                                                fontSize: '13px',
                                                                fontWeight: 800,
                                                                color: '#000',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                maxWidth: '180px'
                                                            }} title={parseRef(doc)}>
                                                                {parseRef(doc)}
                                                            </span>
                                                            <span style={{
                                                                padding: '1px 5px',
                                                                background: '#000',
                                                                borderRadius: '4px',
                                                                fontSize: '8px',
                                                                color: '#fff',
                                                                fontWeight: 900,
                                                                letterSpacing: '0.5px'
                                                            }}>
                                                                {doc.type}
                                                            </span>
                                                            {doc.signedFileUrl && (
                                                                <span style={{
                                                                    padding: '1px 5px',
                                                                    background: doc.isManualSigned ? '#0ea5e9' : '#22c55e',
                                                                    borderRadius: '4px',
                                                                    fontSize: '8px',
                                                                    color: '#fff',
                                                                    fontWeight: 900,
                                                                    letterSpacing: '0.5px'
                                                                }}>
                                                                    {doc.isManualSigned ? 'MANUAL SIGNED' : 'SIGNED'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, marginBottom: '2px' }}>{getUsername(doc)}</div>
                                                        <div style={{
                                                            fontSize: '10px',
                                                            color: '#94a3b8',
                                                            whiteSpace: 'nowrap',
                                                            textOverflow: 'ellipsis',
                                                            overflow: 'hidden',
                                                            maxWidth: '100%',
                                                            fontWeight: 500
                                                        }}>
                                                            {doc.title}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="desktop-only" style={{ padding: '12px 16px', fontSize: '12px', color: '#444' }}>
                                                {doc.createdBy?.username || 'System'}
                                            </td>
                                            <td className="desktop-only" style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 800 }}>
                                                Rp {(doc.metadata?.total_due || doc.metadata?.compensation_amount || 0).toLocaleString()}
                                            </td>
                                            <td className="desktop-only" style={{ padding: '12px 16px' }}>
                                                {(doc.type === 'INVOICE' && (doc.metadata?.total_due || 0) >= 5000000) ? (
                                                    <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px', background: '#fee2e2', color: '#ef4444', fontWeight: 800, border: '1px solid #fecaca' }}>STAMP</span>
                                                ) : (
                                                    <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px', background: '#f0fdf4', color: '#16a34a', fontWeight: 800, border: '1px solid #bbf7d0' }}>SAFE</span>
                                                )}
                                            </td>
                                            <td className="desktop-only" style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                                {formatTimeHM(doc.createdAt)}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                <div className="desktop-only" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                    {doc.type === 'MOU' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/create-invoice?mouId=${doc.id}`; }}
                                                            className="btn"
                                                            style={{
                                                                padding: '4px 10px', height: '32px', fontSize: '11px', borderRadius: '8px',
                                                                background: '#000', color: '#fff', display: 'flex', alignItems: 'center',
                                                                gap: '6px', fontWeight: 800, border: 'none', cursor: 'pointer'
                                                            }}
                                                            title="Create Invoice from this MoU"
                                                        >
                                                            <Plus size={14} /> <span className="desktop-only">INV</span>
                                                        </button>
                                                    )}

                                                    {doc.status === 'DRAFT PDF' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleMarkFinished(doc.id); }}
                                                            disabled={markingFinished === doc.id}
                                                            className="btn"
                                                            style={{
                                                                padding: '4px 10px', height: '32px', fontSize: '11px', borderRadius: '8px',
                                                                border: '1px solid #10b981', color: '#10b981', background: 'transparent',
                                                                display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700
                                                            }}
                                                            title="Mark Finished & Report to Sheet"
                                                        >
                                                            {markingFinished === doc.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14} />}
                                                            REP
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(getCleanUrl(doc.fileUrl), (doc.fileUrl.split('/').pop() || 'document.pdf'), doc.id); }}
                                                        className="btn-icon"
                                                        style={{
                                                            width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9',
                                                            color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            border: 'none', cursor: 'pointer'
                                                        }}
                                                        title="Download Original"
                                                    >
                                                        {downloading === (doc.id || doc.fileUrl) ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); window.open(`/api/documents/${doc.id}/download?view=true`, '_blank'); }}
                                                        className="btn-icon"
                                                        style={{
                                                            width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4',
                                                            color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            border: 'none', cursor: 'pointer'
                                                        }}
                                                        title="View Document"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </button>

                                                    <label
                                                        style={{
                                                            width: '32px', height: '32px', borderRadius: '8px', background: '#f5f3ff',
                                                            color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            cursor: uploadingSigned === doc.id ? 'wait' : 'pointer'
                                                        }}
                                                        title="Upload Signed Version"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {uploadingSigned === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={16} />}
                                                        <input
                                                            type="file" hidden accept=".pdf,image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleUploadSignedManual(doc.id, file);
                                                            }}
                                                        />
                                                    </label>

                                                    {userRole === 'SYSTEM' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, docId: doc.id, reason: '', countdown: 5 }); }}
                                                            className="btn-icon"
                                                            style={{
                                                                width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2',
                                                                color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                border: 'none', cursor: 'pointer'
                                                            }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Mobile Action Menu (Three Dots) */}
                                                <div className="mobile-only" style={{ position: 'relative' }}>
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenu(activeMenu === doc.id ? null : doc.id);
                                                        }}
                                                        onTouchEnd={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setActiveMenu(activeMenu === doc.id ? null : doc.id);
                                                        }}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setActiveMenu(activeMenu === doc.id ? null : doc.id);
                                                        }}
                                                        className="compact-action-btn"
                                                        style={{
                                                            background: activeMenu === doc.id ? 'var(--primary)' : '#f3f4f6',
                                                            color: activeMenu === doc.id ? '#fff' : '#000',
                                                            cursor: 'pointer',
                                                            border: 'none',
                                                            outline: 'none',
                                                            WebkitTapHighlightColor: 'transparent',
                                                            padding: '12px'
                                                        }}
                                                    >
                                                        <MoreVertical size={24} />
                                                    </button>

                                                    {activeMenu === doc.id && (
                                                        <div className="compact-dropdown" style={{ display: 'block' }}>
                                                            <div className="dropdown-header">
                                                                <div className="dropdown-title">{parseRef(doc)}</div>
                                                                <div className="dropdown-subtitle">{doc.title}</div>
                                                            </div>

                                                            {doc.type === 'MOU' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        window.location.href = `/dashboard/create-invoice?mouId=${doc.id}`;
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="dropdown-item"
                                                                    style={{ color: 'var(--primary)', fontWeight: 700 }}
                                                                >
                                                                    <Plus size={16} /> Create Invoice
                                                                </button>
                                                            )}
                                                            {doc.status === 'DRAFT PDF' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleMarkFinished(doc.id);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="dropdown-item"
                                                                    style={{ color: '#10b981', fontWeight: 700 }}
                                                                >
                                                                    <CheckCircle size={16} /> Mark Finished & Report
                                                                </button>
                                                            )}
                                                            <label className="dropdown-item" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <Upload size={16} /> {doc.signedFileUrl ? 'Update Manual Signed' : 'Add Manual Signed'}
                                                                <input
                                                                    type="file"
                                                                    hidden
                                                                    accept=".pdf,image/*"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            handleUploadSignedManual(doc.id, file);
                                                                            setActiveMenu(null);
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    window.open(getCleanUrl(doc.fileUrl), '_blank');
                                                                    setActiveMenu(null);
                                                                }}
                                                                className="dropdown-item"
                                                            >
                                                                <ExternalLink size={16} /> {t('documents.view')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const cleanUrl = getCleanUrl(doc.fileUrl);
                                                                    const fileName = cleanUrl.split('/').pop() || 'document.pdf';
                                                                    handleDownload(cleanUrl, fileName, doc.id);
                                                                    setActiveMenu(null);
                                                                }}
                                                                disabled={downloading === doc.fileUrl}
                                                                className="dropdown-item"
                                                            >
                                                                {downloading === doc.fileUrl ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {t('documents.download')}
                                                            </button>
                                                            {['SYSTEM', 'MANAGER', 'FINANCE', 'BD_ASSISTANT_MANAGER', 'BD'].includes(userRole) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setDeleteModal({ open: true, docId: doc.id, reason: '', countdown: 5 });
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="dropdown-item text-error"
                                                                >
                                                                    <Trash2 size={16} /> {t('documents.delete')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <StatusModal
                open={statusModal.open}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
                onClose={() => setStatusModal({ ...statusModal, open: false })}
            />

            {/* Modal Delete */}
            {
                deleteModal.open && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
                        <div style={{
                            maxWidth: '440px',
                            width: '100%',
                            padding: '40px',
                            background: 'white',
                            borderRadius: '24px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                            textAlign: 'center'
                        }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', margin: '0 auto 24px' }}>
                                <Trash2 size={28} />
                            </div>

                            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px', color: '#111' }}>{t('documents.delete_confirm_title')}</h2>
                            <p style={{ color: '#ef4444', marginBottom: '24px', fontSize: '15px', fontWeight: 700 }}>
                                {t('documents.delete_confirm_subtitle')} (PERMANENT)
                            </p>

                            <div className="input-group" style={{ textAlign: 'left' }}>
                                <label className="input-label" style={{ color: '#111', fontWeight: 600 }}>{t('documents.delete_reason_label')}</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    placeholder={t('documents.delete_reason_placeholder')}
                                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '14px' }}
                                    value={deleteModal.reason}
                                    onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
                                />
                            </div>

                            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <input
                                    type="checkbox"
                                    id="confirmCheck"
                                    style={{ width: '18px', height: '18px' }}
                                    onChange={(e) => (window as any).deleteAccepted = e.target.checked}
                                />
                                <label htmlFor="confirmCheck" style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>
                                    I understand this will be deleted forever
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                <button
                                    onClick={() => setDeleteModal({ open: false, docId: '', reason: '', countdown: 5 })}
                                    className="btn"
                                    style={{ flex: 1, background: '#f3f4f6', color: '#4b5563', height: '48px', borderRadius: '12px', fontWeight: 700 }}
                                >
                                    {t('documents.cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        if ((window as any).deleteAccepted) handleDelete();
                                    }}
                                    disabled={deleting || !deleteModal.reason || deleteModal.countdown > 0}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        background: deleteModal.countdown > 0 ? '#999' : '#ef4444',
                                        color: 'white',
                                        height: '48px',
                                        fontWeight: 700,
                                        borderRadius: '12px',
                                        opacity: deleteModal.countdown > 0 ? 0.6 : 1
                                    }}
                                >
                                    {deleteModal.countdown > 0 ? `Wait ${deleteModal.countdown}s` : deleting ? t('documents.deleting') : t('documents.delete_forever')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Batch Delete */}
            {
                batchDeleteModal.open && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
                        <div style={{
                            maxWidth: '440px',
                            width: '100%',
                            padding: '40px',
                            background: 'white',
                            borderRadius: '24px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                            textAlign: 'center'
                        }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', margin: '0 auto 24px' }}>
                                <Archive size={28} />
                            </div>

                            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px', color: '#111' }}>Delete Batch</h2>
                            <p style={{ color: '#ef4444', marginBottom: '24px', fontSize: '15px', fontWeight: 700 }}>
                                {selectedIds.length} files selected will be DELETED FOREVER.
                            </p>

                            <div className="input-group" style={{ textAlign: 'left' }}>
                                <label className="input-label" style={{ color: '#111', fontWeight: 600 }}>Reason for deleting {selectedIds.length} files</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    placeholder="Enter reason..."
                                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '14px' }}
                                    value={batchDeleteModal.reason}
                                    onChange={(e) => setBatchDeleteModal({ ...batchDeleteModal, reason: e.target.value })}
                                />
                            </div>

                            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <input
                                    type="checkbox"
                                    id="batchConfirmCheck"
                                    style={{ width: '18px', height: '18px' }}
                                    onChange={(e) => (window as any).batchDeleteAccepted = e.target.checked}
                                />
                                <label htmlFor="batchConfirmCheck" style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>
                                    I confirm to delete {selectedIds.length} files permanently
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                <button
                                    onClick={() => setBatchDeleteModal({ open: false, reason: '', countdown: 5 })}
                                    className="btn"
                                    style={{ flex: 1, background: '#f3f4f6', color: '#4b5563', height: '48px', borderRadius: '12px', fontWeight: 700 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if ((window as any).batchDeleteAccepted) handleBatchDelete();
                                    }}
                                    disabled={batchProcessing || !batchDeleteModal.reason || batchDeleteModal.countdown > 0}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        background: batchDeleteModal.countdown > 0 ? '#999' : '#ef4444',
                                        color: 'white',
                                        height: '48px',
                                        fontWeight: 700,
                                        borderRadius: '12px',
                                        opacity: batchDeleteModal.countdown > 0 ? 0.6 : 1
                                    }}
                                >
                                    {batchDeleteModal.countdown > 0 ? `Wait ${batchDeleteModal.countdown}s` : batchProcessing ? "Deleting..." : "Delete Forever"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style jsx>{`
                @keyframes slideInTop {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .hover-row:hover {
                    background: #fcfcfc;
                }

                .compact-action-btn {
                    border: none;
                    padding: 8px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    cursor: pointer;
                    margin-left: auto;
                }

                .compact-dropdown {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    margin-top: 8px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    border: 1px solid #ddd;
                    z-index: 2000;
                    min-width: 180px;
                    overflow: visible;
                    animation: dropdownIn 0.2s ease-out;
                }

                @keyframes dropdownIn {
                    from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .dropdown-header {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f8f8f8;
                    background: #fafafa;
                    text-align: left;
                }

                .dropdown-title { font-weight: 800; font-size: 13px; color: #111; }
                .dropdown-subtitle { 
                    font-size: 11px; 
                    color: #888; 
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                }

                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    padding: 12px 16px;
                    border: none;
                    background: none;
                    font-size: 13px;
                    font-weight: 600;
                    color: #444;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.1s;
                }

                .dropdown-item:hover {
                    background: #f5f5f5;
                }

                .dropdown-item svg { color: #666; }
                .text-error { color: #ef4444 !important; }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    );
}
