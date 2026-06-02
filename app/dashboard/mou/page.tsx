'use client';

import React, { useState, useEffect } from 'react';
import {
    Search,
    FileText,
    Download,
    ExternalLink,
    User,
    Calendar,
    Loader2,
    BookOpen,
    CheckCircle,
    Clock,
    AlertTriangle,
    Filter,
    XCircle
} from 'lucide-react';
import Link from 'next/link';
import { groupItemsByDate, formatTimeHM } from '@/utils/dateUtils';
import StatusModal from '@/components/StatusModal';
import { useSession } from 'next-auth/react';

export default function MOUPage() {
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role;

    if (userRole === 'ANALYST') {
        return (
            <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff', borderRadius: '32px', border: '1px solid #f1f5f9', marginTop: '40px' }}>
                <div style={{ width: '80px', height: '80px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <XCircle size={40} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', marginBottom: '12px' }}>Akses Terbatas</h2>
                <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    Role <b>Analyst</b> tidak memiliki izin untuk melihat manajemen MOU.
                </p>
            </div>
        );
    }
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [modal, setModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false,
        title: '',
        message: '',
        type: 'info'
    });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [appliedRange, setAppliedRange] = useState({ start: '', end: '' });
    const [showFilter, setShowFilter] = useState(false);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/documents/tracking?type=MOU');
            const json = await res.json();
            setData(Array.isArray(json) ? json : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setIsSearching(true);
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setIsSearching(false);
        }, 600);
        return () => clearTimeout(handler);
    }, [search]);

    const fetchDocumentsSilent = async () => {
        try {
            const res = await fetch('/api/documents/tracking?type=MOU');
            const data = await res.json();
            if (Array.isArray(data)) {
                setData(data);
            }
        } catch (err) {
            console.error('Silent fetch failed:', err);
        }
    };

    useEffect(() => {
        fetchDocuments();
        const interval = setInterval(() => {
            fetchDocumentsSilent();
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const getCleanUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('https://')) return url;
        if (url.startsWith('/')) return url;
        return `https://${url}`;
    };

    const handleDownload = async (url: string, filename: string, docId?: string) => {
        const targetUrl = docId ? `/api/documents/${docId}/download` : url;
        setDownloading(url);
        try {
            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed', error);
            window.open(targetUrl, '_blank');
        } finally {
            setDownloading(null);
        }
    };

    const filteredDocs = (Array.isArray(data) ? data : []).filter((doc: any) => {
        const query = debouncedSearch.toLowerCase();

        const meta = doc.metadata || doc.formData || {};
        const metaName = (meta.party2_name || meta.from_name || '').toLowerCase();
        const metaUsername = (meta.party2_username || meta.from_username || '').toLowerCase();

        const matchesSearch = !query || (
            doc.docNo?.toLowerCase().includes(query) ||
            doc.title?.toLowerCase().includes(query) ||
            (doc.createdBy || '').toLowerCase().includes(query) ||
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
    });

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Signed': return { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' };
            case 'Unsigned': return { background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' };
            case 'Expired': return { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' };
            default: return { background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' };
        }
    };

    const parseRef = (doc: any) => {
        const rawNo = doc.docNo;
        const meta = doc.metadata || doc.formData || {};

        // Final real number search
        const finalNo = (rawNo && rawNo !== 'WAITING') ? rawNo : (meta.invoice_no || meta.mou_number);

        if (!finalNo || finalNo === 'WAITING' || finalNo === 'MOU-???') {
            const typeValue = meta.type || meta.invType || meta.mouType || 'B';
            return `${typeValue}-???`;
        }

        // Format: CAT-REF-INV-DTI... or CAT-MoU-DTI-DATE-REF-SEQ
        const parts = finalNo.split('-');
        const cat = parts[0];

        if (finalNo.includes('-INV-')) {
            // CAT-REF-INV... -> parts[1] is REF
            return `${cat}-${parts[1]}`;
        } else if (finalNo.includes('-MoU-')) {
            // CAT-MoU-DTI-DATE-REF-SEQ -> parts[4] is REF
            // Or CAT-REF-MoU-DTI... -> parts[1] is REF
            if (parts[1]?.toLowerCase() === 'mou') return `${cat}-${parts[4]}`;
            if (parts[2]?.toLowerCase() === 'mou') return `${cat}-${parts[1]}`;
            return `${cat}-${parts[1] || '???'}`;
        }

        return finalNo;
    };

    const getUsername = (doc: any) => {
        const meta = doc.metadata || doc.formData || {};
        const username = meta.party2_username || meta.username || meta.from_username;
        if (username) return username.startsWith('@') ? username : `@${username}`;

        const ref = doc.docNo;
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
        <div>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800, marginBottom: '4px', color: '#111' }}>MOUs</h1>
                <p style={{ color: '#666', fontSize: '14px' }}>Track MOUs from drafting to signature</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: isSearching ? '#000' : '#888', opacity: isSearching ? 1 : 0.5 }} size={16} className={isSearching ? 'animate-pulse' : ''} />
                    <input
                        className="form-control"
                        placeholder="Search ID, name, or title..."
                        style={{ paddingLeft: '40px', height: '48px', borderRadius: '14px', fontSize: '14px', border: search ? '2px solid #000' : '1px solid #eee', transition: 'all 0.2s' }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {isSearching && (
                        <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', color: '#888', fontWeight: 700 }}>Thinking...</span>
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
                        <span className="hide-mobile">{showFilter ? 'Close' : 'Filter'}</span>
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
            </div>

            <div>
                <div className="glass-card" style={{ padding: '0', overflowX: 'hidden', borderRadius: '16px', border: '1px solid #eee', background: 'white' }}>
                    <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead style={{ background: '#fdfdfd', borderBottom: '1px solid #f0f0f0' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '35%' }}>DOC INFO</th>
                                <th className="hide-mobile" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '15%' }}>STATUS</th>
                                <th className="hide-mobile" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '15%' }}>CREATOR</th>
                                <th className="hide-mobile" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '10%' }}>TIME</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '11px', color: '#888', fontWeight: 700, width: '25%' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#000' }} /></td></tr>
                            ) : filteredDocs.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#999', fontSize: '14px' }}>No records found</td></tr>
                            ) : groupItemsByDate(filteredDocs).map(([dateLabel, docs]: [string, any[]]) => (
                                <React.Fragment key={dateLabel}>
                                    <tr>
                                        <td colSpan={6} style={{ background: '#f8fafc', padding: '10px 16px', fontSize: '11px', fontWeight: 800, color: '#64748b', borderTop: '1px solid #eef2f6', borderBottom: '1px solid #eef2f6' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={13} />
                                                {dateLabel.toUpperCase()}
                                            </div>
                                        </td>
                                    </tr>
                                    {docs.map((doc: any) => (
                                        <tr key={`${doc.itemType}-${doc.id}`} style={{ borderBottom: '1px solid #f8f8f8' }} className="hover-row">
                                            <td style={{ padding: '10px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                                        <BookOpen size={14} />
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontWeight: 800, fontSize: '12px', color: '#111' }}>
                                                            {parseRef(doc)}
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>
                                                            {doc.title}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hide-mobile" style={{ padding: '10px 16px' }}>
                                                <span style={{
                                                    fontSize: '9px',
                                                    fontWeight: 800,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    ...getStatusStyle(doc.status)
                                                }}>
                                                    {doc.status}
                                                </span>
                                            </td>
                                            <td className="hide-mobile" style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                                {doc.createdBy || 'Unknown'}
                                            </td>
                                            <td className="hide-mobile" style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b' }}>
                                                {formatTimeHM(doc.createdAt)}
                                            </td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                    {doc.status !== 'CANCELLED' && (
                                                        <button
                                                            onClick={() => handleDownload(getCleanUrl(doc.fileUrl), (doc.fileUrl.split('/').pop() || 'mou.pdf'), doc.id)}
                                                            className="btn-icon"
                                                            style={{ padding: '6px', background: '#f0f9ff', color: '#0369a1', borderRadius: '6px' }}
                                                            title="Download"
                                                        >
                                                            {downloading === doc.fileUrl ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => window.open(`/api/documents/${doc.id}/download?view=true`, '_blank')}
                                                        className="btn-icon"
                                                        style={{ padding: '6px', background: '#f8fafc', color: '#475569', borderRadius: '6px' }}
                                                        title="View"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </button>
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
                open={modal.open}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onClose={() => setModal({ ...modal, open: false })}
            />

            <style jsx>{`
                .hide-mobile { display: table-cell; }
                .show-mobile { display: none; }
                
                @media (max-width: 768px) {
                    .hide-mobile { display: none !important; }
                    .show-mobile { display: block !important; }
                    span.show-mobile { display: inline !important; }
                }

                .hover-row:hover {
                    background: #fafafa;
                }
            `}</style>
        </div>
    );
}
