'use client';

import React, { useState, useEffect } from 'react';
import {
    Link as LinkIcon,
    RefreshCw,
    Copy,
    ExternalLink,
    Search,
    Filter,
    Clock,
    CheckCircle,
    AlertTriangle,
    Monitor,
    Shield,
    Archive as ArchiveIcon,
    XCircle,
    ChevronDown,
    Calendar,
    Loader2,
    Users,
    Download,
    Trash2
} from 'lucide-react';
import StatusModal from '@/components/StatusModal';
import { useSession } from 'next-auth/react';
import { groupItemsByDate, formatTimeHM } from '@/utils/dateUtils';

export default function SessionsPage() {
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
                    Role <b>Analyst</b> tidak memiliki izin untuk melihat manajemen sesi.
                </p>
            </div>
        );
    } const isSystem = userRole === 'SYSTEM';

    const [viewArchived, setViewArchived] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [appliedRange, setAppliedRange] = useState({ start: '', end: '' });
    const [showFilter, setShowFilter] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [modal, setModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'confirm';
        onConfirm?: () => void;
        loading?: boolean;
    }>({
        open: false,
        title: '',
        message: '',
        type: 'info'
    });

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sessions/list?archived=${viewArchived}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setSessions(data);
            } else {
                console.error('API returned non-array data:', data);
                setSessions([]);
                if (data.error) {
                    setModal({
                        open: true,
                        title: 'Error',
                        message: data.error,
                        type: 'error'
                    });
                }
            }
        } catch (err) {
            console.error(err);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        // Polling for realtime updates (every 15 seconds)
        const interval = setInterval(() => {
            fetchSessionsSilent();
        }, 45000);
        return () => clearInterval(interval);
    }, [viewArchived]);

    const fetchSessionsSilent = async () => {
        try {
            const res = await fetch(`/api/sessions/list?archived=${viewArchived}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setSessions(data);
            }
        } catch (err) {
            console.error('Silent fetch failed:', err);
        }
    };

    const handleRegenerate = async (id: string) => {
        setModal({
            open: true,
            title: 'Regenerate Link?',
            message: 'This will reset the expiration to another 24 hours. The old link might become invalid if regenerated multiple times.',
            type: 'confirm',
            onConfirm: async () => {
                setModal(prev => ({ ...prev, loading: true }));
                try {
                    const res = await fetch(`/api/sessions/regenerate/${id}`, { method: 'POST' });
                    if (res.ok) {
                        fetchSessions();
                        setModal({
                            open: true,
                            title: 'Success!',
                            message: 'The signing link has been regenerated successfully.',
                            type: 'success'
                        });
                    } else {
                        throw new Error('Failed to regenerate');
                    }
                } catch (err) {
                    setModal({
                        open: true,
                        title: 'Error',
                        message: 'Could not regenerate the link. Please try again.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const copyToClipboard = (token: string, id: string) => {
        const url = `${window.location.origin}/sign/${token}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);

        // Show simplified popup for copy confirmation
        setModal({
            open: true,
            title: 'Link Copied!',
            message: 'The signing link has been copied to your clipboard. You can now share it with the creator.',
            type: 'success'
        });

        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleMarkFinished = async (id: string) => {
        setModal({
            open: true,
            title: 'Mark as Finished?',
            message: 'This will manually set the status to COMPLETED. Use this if the document has been signed outside the link or if you want to close the link permanently.',
            type: 'confirm',
            onConfirm: async () => {
                setModal(prev => ({ ...prev, loading: true }));
                try {
                    const res = await fetch(`/api/sessions/manage/${id}`, { method: 'PATCH' });
                    if (res.ok) {
                        fetchSessions();
                        setModal({
                            open: true,
                            title: 'Success!',
                            message: 'Session marked as complete.',
                            type: 'success'
                        });
                    } else {
                        const data = await res.json();
                        throw new Error(data.error || 'Failed to update');
                    }
                } catch (err: any) {
                    setModal({
                        open: true,
                        title: 'Error',
                        message: err.message || 'Could not update the session.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleRestore = async (id: string) => {
        setModal({
            open: true,
            title: 'Restore Session?',
            message: 'This will move the session back to the active list.',
            type: 'confirm',
            onConfirm: async () => {
                setModal(prev => ({ ...prev, loading: true }));
                try {
                    const res = await fetch(`/api/sessions/manage/${id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ action: 'restore' }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (res.ok) {
                        fetchSessions();
                        setModal({
                            open: true,
                            title: 'Success!',
                            message: 'Session restored successfully.',
                            type: 'success'
                        });
                    } else {
                        const data = await res.json();
                        throw new Error(data.error || 'Failed to restore');
                    }
                } catch (err: any) {
                    setModal({
                        open: true,
                        title: 'Error',
                        message: err.message || 'Could not restore the session.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleDelete = async (id: string) => {
        const isPermanent = isSystem || viewArchived;
        setModal({
            open: true,
            title: isPermanent ? 'Delete Permanently?' : 'Archive Session?',
            message: isPermanent
                ? 'Are you sure you want to delete this session? This action is permanent and cannot be undone.'
                : 'This will move the session to archives and hide it from the active list.',
            type: 'confirm',
            onConfirm: async () => {
                setModal(prev => ({ ...prev, loading: true }));
                try {
                    const res = await fetch(`/api/sessions/manage/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        fetchSessions();
                        setModal({
                            open: true,
                            title: 'Success!',
                            message: isSystem ? 'Session deleted permanently.' : 'Session moved to archives.',
                            type: 'success'
                        });
                    } else {
                        const data = await res.json();
                        throw new Error(data.error || 'Failed to delete');
                    }
                } catch (err: any) {
                    setModal({
                        open: true,
                        title: 'Error',
                        message: err.message || 'Could not delete the session.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const filteredSessions = (Array.isArray(sessions) ? sessions : []).filter(session => {
        const query = search.toLowerCase();
        const name = (session.formData?.from_name || session.formData?.party2_name || '').toLowerCase();
        const username = (session.formData?.from_username || session.formData?.party2_username || '').toLowerCase();

        const matchesSearch = !query || (
            name.includes(query) ||
            username.includes(query) ||
            session.id.toLowerCase().includes(query) ||
            session.type.toLowerCase().includes(query)
        );

        if (!matchesSearch) return false;

        // Date Filter
        if (appliedRange.start || appliedRange.end) {
            const sessionDate = new Date(session.createdAt);
            sessionDate.setHours(0, 0, 0, 0);

            if (appliedRange.start) {
                const start = new Date(appliedRange.start);
                start.setHours(0, 0, 0, 0);
                if (sessionDate < start) return false;
            }
            if (appliedRange.end) {
                const end = new Date(appliedRange.end);
                end.setHours(0, 0, 0, 0);
                if (sessionDate > end) return false;
            }
        }

        return true;
    });

    return (
        <div>
            <div style={{ marginBottom: '24px', marginTop: '32px' }}>
                <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800, marginBottom: '4px' }}>Signing Sessions</h1>
                <p style={{ color: '#666', fontSize: '14px' }}>Manage creator signing links</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} size={16} />
                    <input
                        className="form-control"
                        placeholder="Search sessions..."
                        style={{ paddingLeft: '40px', height: '48px', borderRadius: '14px', fontSize: '14px', border: search ? '2px solid #000' : '1px solid #eee', transition: 'all 0.2s' }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                        onClick={() => setShowFilter(!showFilter)}
                        style={{
                            position: 'absolute',
                            right: '14px',
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
                        <span className="hide-mobile">{showFilter ? 'Close Filter' : 'Filter by Date'}</span>
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

            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => setViewArchived(false)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        border: 'none',
                        background: !viewArchived ? '#000' : '#f1f5f9',
                        color: !viewArchived ? '#fff' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Active Sessions
                </button>
                <button
                    onClick={() => setViewArchived(true)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        border: 'none',
                        background: viewArchived ? '#ef4444' : '#f1f5f9',
                        color: viewArchived ? '#fff' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Archived
                </button>
            </div>

            <div>
                <div className="glass-card" style={{ padding: '0', overflowX: 'hidden', borderRadius: '16px', border: '1px solid #eee', background: 'white' }}>
                    <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead style={{ background: '#fdfdfd', borderBottom: '1px solid #f0f0f0' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#666', fontWeight: 700, width: '40%' }}>DOC & CREATOR</th>
                                <th className="hide-mobile" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#666', fontWeight: 700, width: '15%' }}>STATUS</th>
                                <th className="hide-mobile" style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#666', fontWeight: 700, width: '15%' }}>EXPIRATION</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '11px', color: '#666', fontWeight: 700, width: '30%' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                            ) : filteredSessions.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#999', fontSize: '14px' }}>No sessions found</td></tr>
                            ) : groupItemsByDate(filteredSessions.sort((a, b) => {
                                if (a.status === 'COMPLETED') return 1;
                                if (b.status === 'COMPLETED') return -1;
                                const aExp = new Date() > new Date(a.expiresAt);
                                const bExp = new Date() > new Date(b.expiresAt);
                                if (aExp && !bExp) return 1;
                                if (!aExp && bExp) return -1;
                                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                            })).map(([dateLabel, sList]: [string, any[]]) => (
                                <React.Fragment key={dateLabel}>
                                    <tr>
                                        <td colSpan={4} style={{ background: '#f8fafc', padding: '10px 16px', fontSize: '11px', fontWeight: 800, color: '#64748b', borderTop: '1px solid #eef2f6', borderBottom: '1px solid #eef2f6' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={13} />
                                                {dateLabel.toUpperCase()}
                                            </div>
                                        </td>
                                    </tr>
                                    {sList.map((session: any) => {
                                        const isExpired = new Date() > new Date(session.expiresAt);
                                        const isCompleted = session.status === 'COMPLETED';
                                        const needsRegen = isExpired && !isCompleted;

                                        const sData = session.formData || {};
                                        const name = sData.from_name || sData.party2_name || 'N/A';
                                        const username = sData.from_username || sData.party2_username || 'N/A';

                                        return (
                                            <tr key={session.id} style={{
                                                borderBottom: '1px solid #f8f8f8',
                                                background: needsRegen ? 'rgba(153, 27, 27, 0.01)' : 'transparent'
                                            }} className="hover-row">
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ fontWeight: 800, color: '#111', fontSize: '13px' }}>{name}</div>
                                                            <div style={{ padding: '1px 5px', borderRadius: '3px', background: '#000', color: 'white', fontSize: '8px', fontWeight: 900 }}>{session.type}</div>
                                                        </div>

                                                        <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Users size={11} />
                                                            {username.startsWith('@') ? username : `@${username}`}
                                                        </div>

                                                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, fontFamily: 'monospace', marginTop: '4px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                                            {sData.invoice_no || sData.mou_number || 'NO-REF'}
                                                        </div>

                                                        <div className="show-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                            {isCompleted ? (
                                                                <span style={{ fontSize: '9px', color: '#059669', fontWeight: 800 }}>SIGNED</span>
                                                            ) : (
                                                                <span style={{ fontSize: '9px', color: needsRegen ? '#dc2626' : '#2563eb', fontWeight: 800 }}>{needsRegen ? 'EXPIRED' : 'WAITING'}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="hide-mobile" style={{ padding: '12px 16px' }}>
                                                    {isCompleted ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#059669', fontSize: '11px', fontWeight: 800 }}>
                                                            <div style={{ width: '6px', height: '6px', background: '#059669', borderRadius: '50%' }}></div>
                                                            SIGNED
                                                        </div>
                                                    ) : needsRegen ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#dc2626', fontSize: '11px', fontWeight: 800 }}>
                                                            <div style={{ width: '6px', height: '6px', background: '#dc2626', borderRadius: '50%' }}></div>
                                                            EXPIRED
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#2563eb', fontSize: '11px', fontWeight: 800 }}>
                                                            <div style={{ width: '6px', height: '6px', background: '#2563eb', borderRadius: '50%' }}></div>
                                                            WAITING
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="hide-mobile" style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontSize: '11px', color: needsRegen ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                                                        {isCompleted ? 'Finished' : isExpired ? 'Expired' : new Date(session.expiresAt).toLocaleDateString()}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{formatTimeHM(session.createdAt)}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                        {/* Actions Area */}
                                                        {!isCompleted && !isExpired && (
                                                            <>
                                                                <button
                                                                    onClick={() => copyToClipboard(session.token, session.id)}
                                                                    className="btn-icon"
                                                                    style={{ padding: '6px', borderRadius: '6px', background: '#f8fafc', color: '#6366f1', border: 'none', cursor: 'pointer' }}
                                                                    title="Copy Link"
                                                                >
                                                                    {copiedId === session.id ? <CheckCircle size={14} /> : <Copy size={14} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => window.open(`/sign/${session.token}`, '_blank')}
                                                                    className="btn-icon"
                                                                    style={{ padding: '6px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer' }}
                                                                    title="Open"
                                                                >
                                                                    <ExternalLink size={14} />
                                                                </button>
                                                            </>
                                                        )}

                                                        {needsRegen && (
                                                            <button
                                                                onClick={() => handleRegenerate(session.id)}
                                                                className="btn"
                                                                style={{ padding: '4px 8px', height: '28px', fontSize: '10px', borderRadius: '6px', background: '#000', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}
                                                            >
                                                                <RefreshCw size={12} /> REGEN
                                                            </button>
                                                        )}

                                                        {isCompleted && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        const path = session.type === 'INVOICE' ? '/dashboard/create-invoice' : '/dashboard/create-mou';
                                                                        window.location.href = `${path}?sessionId=${session.id}`;
                                                                    }}
                                                                    className="btn"
                                                                    style={{ padding: '4px 8px', height: '28px', fontSize: '10px', borderRadius: '6px', background: '#000000ff', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}
                                                                    title="Revise Document"
                                                                >
                                                                    <RefreshCw size={12} />
                                                                </button>
                                                                {session.documentId && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => window.open(`/api/documents/${session.documentId}/download?view=true`, '_blank')}
                                                                            className="btn-icon"
                                                                            style={{ padding: '6px', borderRadius: '6px', background: '#f8fafc', color: '#475569', border: 'none', cursor: 'pointer' }}
                                                                            title="View PDF"
                                                                        >
                                                                            <ExternalLink size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                // Documents list has direct download/view
                                                                                window.open(`/api/documents/${session.documentId}/download`, '_blank');
                                                                            }}
                                                                            className="btn-icon"
                                                                            style={{ padding: '6px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', border: 'none', cursor: 'pointer' }}
                                                                            title="Download PDF"
                                                                        >
                                                                            <Download size={14} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}

                                                        {viewArchived && (
                                                            <button
                                                                onClick={() => handleRestore(session.id)}
                                                                className="btn"
                                                                style={{ padding: '4px 8px', height: '28px', fontSize: '10px', borderRadius: '6px', background: '#475569', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}
                                                            >
                                                                <RefreshCw size={12} /> RESTORE
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => handleDelete(session.id)}
                                                            className="btn-icon"
                                                            style={{ padding: '6px', borderRadius: '6px', background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}
                                                            title={viewArchived ? "Delete Permanently" : "Archive"}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                loading={modal.loading}
                onClose={() => setModal({ ...modal, open: false })}
                onConfirm={modal.onConfirm}
            />

            <style jsx>{`
                .hide-mobile { display: table-cell; }
                .show-mobile { display: none; }
                
                @media (max-width: 768px) {
                    .hide-mobile { display: none !important; }
                    .show-mobile { display: block !important; }
                }

                .btn-icon:hover {
                    opacity: 0.8;
                }
            `}</style>
        </div >
    );
}
