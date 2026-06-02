'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Database,
    Table,
    Trash2,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Search,
    FileText,
    Users,
    Clock,
    Hash,
    Loader2
} from 'lucide-react';

const TABLES = [
    { id: 'SigningSession', label: 'Signing Sessions', icon: Clock, description: 'Pending & completed signing sessions' },
    { id: 'Document', label: 'Documents', icon: FileText, description: 'All signed documents (Invoice/MOU)' },
    { id: 'UserSequence', label: 'User Sequences', icon: Hash, description: 'Reference number sequences per user' },
    { id: 'User', label: 'Users', icon: Users, description: 'All registered users' }
];

export default function DbLookupPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [selectedTable, setSelectedTable] = useState('SigningSession');
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const isSystem = (session?.user as any)?.role === 'SYSTEM';

    useEffect(() => {
        if (status === 'authenticated' && !isSystem) {
            router.push('/dashboard');
        }
    }, [status, isSystem, router]);

    const fetchData = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/db-lookup?table=${selectedTable}&limit=100`);
            const result = await res.json();
            if (result.error) throw new Error(result.error);
            setData(result.data);
            setTotal(result.total);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSystem) {
            fetchData();
        }
    }, [selectedTable, isSystem]);

    const handleDelete = async (id: string) => {
        if (!confirm(`Are you sure you want to delete this record?\nID: ${id}`)) return;

        setDeleting(id);
        try {
            const res = await fetch('/api/admin/db-lookup', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table: selectedTable, id })
            });
            const result = await res.json();
            if (result.error) throw new Error(result.error);
            setMessage({ type: 'success', text: result.message });
            fetchData(); // Refresh
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setDeleting(null);
        }
    };

    const isAnomalous = (row: any) => {
        // Detect anomalous data
        const ref = parseInt(row.refNum) || 0;
        const seq = parseInt(row.sequence) || 0;
        return ref > 200 || seq > 500;
    };

    if (status === 'loading') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <Loader2 className="animate-spin" size={40} />
            </div>
        );
    }

    if (!isSystem) {
        return (
            <div style={{ padding: '60px', textAlign: 'center' }}>
                <AlertTriangle size={60} style={{ color: '#ef4444', marginBottom: '16px' }} />
                <h2>Access Denied</h2>
                <p>This page is only accessible to SYSTEM administrators.</p>
            </div>
        );
    }

    const tableConfig = TABLES.find(t => t.id === selectedTable);

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Database size={28} />
                    DB Lookup
                </h1>
                <p style={{ color: '#666', marginTop: '4px' }}>
                    View and manage database records directly. Use with caution!
                </p>
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Table Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {TABLES.map(table => (
                    <button
                        key={table.id}
                        onClick={() => setSelectedTable(table.id)}
                        style={{
                            padding: '16px',
                            borderRadius: '12px',
                            border: selectedTable === table.id ? '2px solid #000' : '1px solid #e5e7eb',
                            background: selectedTable === table.id ? '#f5f5f5' : 'white',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <table.icon size={18} />
                            <span style={{ fontWeight: 700 }}>{table.label}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{table.description}</p>
                    </button>
                ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700 }}>
                        {tableConfig?.label} ({total} records)
                    </span>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600
                    }}
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Data Table */}
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {data[0] && Object.keys(data[0]).map(key => (
                                <th key={key} style={{
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    fontWeight: 700,
                                    borderBottom: '1px solid #e5e7eb',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {key}
                                </th>
                            ))}
                            <th style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={100} style={{ textAlign: 'center', padding: '40px' }}>
                                    <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={100} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                    No records found
                                </td>
                            </tr>
                        ) : (
                            data.map((row, idx) => (
                                <tr
                                    key={row.id || idx}
                                    style={{
                                        background: isAnomalous(row) ? '#fef2f2' : (idx % 2 === 0 ? 'white' : '#f9fafb'),
                                        borderLeft: isAnomalous(row) ? '3px solid #ef4444' : 'none'
                                    }}
                                >
                                    {Object.entries(row).map(([key, value]: [string, any]) => (
                                        <td key={key} style={{
                                            padding: '10px 16px',
                                            borderBottom: '1px solid #f0f0f0',
                                            maxWidth: '200px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {typeof value === 'boolean' ? (value ? '✅' : '❌') : String(value)}
                                        </td>
                                    ))}
                                    <td style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0' }}>
                                        {selectedTable !== 'User' && (
                                            <button
                                                onClick={() => handleDelete(row.id)}
                                                disabled={deleting === row.id}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: '#fee2e2',
                                                    color: '#991b1b',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontSize: '12px',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {deleting === row.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '12px', color: '#666' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '2px' }} />
                    Anomalous Data (Ref &gt; 200 or Seq &gt; 500)
                </div>
            </div>

            <style jsx>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
