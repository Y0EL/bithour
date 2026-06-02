'use client';

import { TrendingUp, FileText, Users, Activity, Clock, CheckCircle, FileSpreadsheet, Loader2, Search, X, ExternalLink, Settings, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import StatusModal from '@/components/StatusModal';

import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const user = session?.user as any;

    // Analyst no longer auto-redirected to review, they can see the dashboard too

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [reporting, setReporting] = useState(false);
    const [reportedToday, setReportedToday] = useState(false);
    const [hasNewDocs, setHasNewDocs] = useState(false);
    const [statusModal, setStatusModal] = useState({ open: false, title: '', message: '' as any, type: 'info' as any });

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const SHEET_URL = "https://docs.google.com/spreadsheets/d/1s2Gqhp21hdXEhsNro-kKxQgaqSuKmH7aG9oI6_YsFCo/edit?gid=0#gid=0";

    const handleGenerateReport = async () => {
        setReporting(true);
        try {
            const res = await fetch('/api/dashboard/report', { method: 'POST' });
            const data = await res.json();

            if (data.error === 'NO_NEW_DATA') {
                setReportedToday(true);
                setHasNewDocs(false);
                setStatusModal({
                    open: true,
                    title: t('dashboard.no_new_data') || 'Tidak Ada Data Baru',
                    message: (
                        <div>
                            <p style={{ marginBottom: '16px' }}>{t('dashboard.report_all_in') || 'Semua dokumen hari ini sudah masuk dalam laporan. Cek di sini:'}</p>
                            <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'underline' }}>
                                {t('dashboard.open_sheets') || 'Buka Google Sheets'}
                            </a>
                        </div>
                    ),
                    type: 'info'
                });
                return;
            }

            if (data.error) throw new Error(data.error);

            setReportedToday(true);
            setHasNewDocs(false);
            setStatusModal({
                open: true,
                title: t('dashboard.update_success') || 'Berhasil di-Update!',
                message: (
                    <div>
                        <p style={{ marginBottom: '16px' }}>{data.message || t('dashboard.report_updated') || 'Laporan berhasil diperbarui dengan dokumen terbaru.'}</p>
                        <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'underline' }}>
                            {t('dashboard.view_sheets') || 'Lihat di Google Sheets'}
                        </a>
                    </div>
                ),
                type: 'success'
            });
        } catch (err: any) {
            setStatusModal({
                open: true,
                title: t('dashboard.sync_failed') || 'Sinkronisasi Gagal',
                message: err.message,
                type: 'error'
            });
        } finally {
            setReporting(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        setShowResults(true);
        try {
            const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [statsRes, reportRes] = await Promise.all([
                    fetch('/api/dashboard/stats'),
                    fetch('/api/dashboard/report')
                ]);

                const statsJson = await statsRes.json();
                const reportJson = await reportRes.json();

                setData(statsJson);
                setReportedToday(reportJson.reported);
                setHasNewDocs(reportJson.hasNewDocs);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const isAnalyst = user?.role === 'ANALYST';

    const renderStats = () => {
        if (isAnalyst) {
            return [
                { icon: <CheckCircle size={28} />, label: 'Reviews Today', value: data?.stats?.todayCount || '0', color: '#10b981', bg: '#f0fdf4', border: '#dcfce7' },
                { icon: <TrendingUp size={28} />, label: 'Weekly Reviews', value: data?.stats?.weekCount || '0', color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe' },
                { icon: <Calendar size={28} />, label: 'Monthly Reviews', value: data?.stats?.monthCount || '0', color: '#8b5cf6', bg: '#f5f3ff', border: '#ede9fe' },
                { icon: <Activity size={28} />, label: 'Pending Task', value: data?.stats?.pendingCount || '0', color: '#f59e0b', bg: '#fffbeb', border: '#fef3c7' },
            ];
        }
        return [
            { icon: <FileText size={28} />, label: t('dashboard.total_invoices'), value: data?.stats?.totalInvoices || '0', color: '#000', bg: '#f5f5f5', border: '#e5e7eb' },
            { icon: <FileText size={28} />, label: t('dashboard.total_mous'), value: data?.stats?.totalMOUs || '0', color: '#1a1a1a', bg: '#fafafa', border: '#d1d5db' },
            { icon: <Activity size={28} />, label: t('dashboard.this_month'), value: data?.stats?.thisMonthCount || '0', color: '#333', bg: '#f9fafb', border: '#e5e7eb' },
            { icon: <TrendingUp size={28} />, label: t('dashboard.all_documents'), value: data?.stats?.totalDocuments || '0', color: '#000', bg: '#f5f5f5', border: '#d1d5db' },
        ];
    };

    const statsConfig = renderStats();

    const renderLogDetails = (details: string) => {
        if (!details) return null;
        try {
            const parsed = JSON.parse(details);
            if (parsed.documentNo) {
                return (
                    <span>
                        #{parsed.documentNo} {parsed.title ? `(${parsed.title})` : ''}
                    </span>
                );
            }
            if (parsed.message) return parsed.message;
            return details;
        } catch (e) {
            return details;
        }
    };

    return (
        <div>
            {/* Global Search Bar */}
            <div style={{ position: 'relative', marginBottom: '32px', maxWidth: '600px', zIndex: 100 }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={20} />
                    <input
                        className="form-control"
                        placeholder={t('dashboard.search_placeholder')}
                        style={{
                            paddingLeft: '48px',
                            height: '56px',
                            borderRadius: '16px',
                            background: 'white',
                            border: searchQuery ? '2px solid #000' : '1px solid #e2e8f0',
                            fontSize: '16px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                            width: '100%'
                        }}
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                            style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                    )}
                </div>

                {showResults && (
                    <div style={{
                        position: 'absolute',
                        top: '64px',
                        left: 0,
                        right: 0,
                        background: 'white',
                        borderRadius: '20px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                        border: '1px solid #f1f5f9',
                        overflow: 'hidden',
                        zIndex: 100
                    }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {isSearching ? t('dashboard.searching') : t('dashboard.found_results', { count: searchResults.length })}
                            </span>
                            <button onClick={() => setShowResults(false)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{t('dashboard.close')}</button>
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {isSearching && (
                                <div style={{ padding: '32px', textAlign: 'center' }}>
                                    <Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#000' }} />
                                </div>
                            )}
                            {!isSearching && searchResults.length === 0 && (
                                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                                    {t('dashboard.no_results')} "{searchQuery}"
                                </div>
                            )}
                            {searchResults.map((res: any, idx: number) => (
                                <div key={idx} style={{
                                    padding: '16px',
                                    borderBottom: idx === searchResults.length - 1 ? 'none' : '1px solid #f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'background 0.2s',
                                    cursor: 'pointer'
                                }}
                                    className="search-item-hover"
                                >
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '12px',
                                        background: res.itemType === 'DOCUMENT' ? '#f0fdf4' : '#eff6ff',
                                        color: res.itemType === 'DOCUMENT' ? '#16a34a' : '#2563eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {res.itemType === 'DOCUMENT' ? <FileText size={20} /> : <Clock size={20} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: 800, fontSize: '14px', color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.title || res.type}</div>
                                            <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>{res.docNo}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                            {t('dashboard.by')} {res.creator} • {new Date(res.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {res.itemType === 'DOCUMENT' ? (
                                            <button onClick={() => window.open(res.url, '_blank')} className="btn-icon" style={{ padding: '8px', background: '#f1f5f9', borderRadius: '8px', border: 'none' }}>
                                                <ExternalLink size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    const route = res.type === 'INVOICE' ? 'create-invoice' : 'create-mou';
                                                    window.location.href = `/dashboard/${route}?sessionId=${res.id}`;
                                                }}
                                                className="btn-icon"
                                                style={{ padding: '8px', background: '#f1f5f9', color: '#000', borderRadius: '8px', border: 'none' }}
                                                title={t('dashboard.edit_session')}
                                            >
                                                <Settings size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Welcome Header */}
            <div style={{ marginBottom: 'clamp(24px, 4vw, 32px)' }}>
                <h1 style={{
                    fontSize: 'clamp(24px, 5vw, 32px)',
                    fontWeight: 800,
                    color: '#1a1a1a',
                    marginBottom: '8px',
                }}>
                    {t('dashboard.welcome')}, {user?.name || 'User'}! 👋
                </h1>
                <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', color: '#666' }}>
                    {t('dashboard.greeting_detail')}
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '20px',
                marginBottom: '32px',
            }}>
                {statsConfig.map((stat, index) => (
                    <div
                        key={index}
                        style={{
                            background: 'white',
                            borderRadius: '24px',
                            padding: 'clamp(24px, 4vw, 28px)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            border: `1px solid ${stat.border}`,
                            transition: 'all 0.3s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '14px',
                                background: stat.bg,
                                border: `1px solid ${stat.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: stat.color,
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 'clamp(12px, 2vw, 14px)', color: '#666', marginBottom: '4px' }}>
                                    {stat.label}
                                </div>
                                <div style={{
                                    fontSize: 'clamp(24px, 5vw, 32px)',
                                    fontWeight: 800,
                                    color: stat.color,
                                }}>
                                    {loading ? '...' : stat.value}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
                <h2 style={{
                    fontSize: 'clamp(18px, 3vw, 22px)',
                    fontWeight: 700,
                    marginBottom: '20px',
                    color: '#1a1a1a'
                }}>
                    {t('dashboard.quick_actions')}
                </h2>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                }}>
                    {!isAnalyst && (
                        <>
                            <Link href="/dashboard/create-invoice" style={{
                                background: '#000', color: 'white', padding: '18px', borderRadius: '18px', textDecoration: 'none', fontWeight: 700, textAlign: 'center'
                            }}>{t('dashboard.create_invoice')}</Link>
                            <Link href="/dashboard/create-mou" style={{
                                background: '#333', color: 'white', padding: '18px', borderRadius: '18px', textDecoration: 'none', fontWeight: 700, textAlign: 'center'
                            }}>{t('dashboard.create_mou')}</Link>
                            <Link href="/dashboard/documents" style={{
                                background: 'white', color: '#000', padding: '18px', borderRadius: '18px', textDecoration: 'none', fontWeight: 700, textAlign: 'center', border: '2px solid #000'
                            }}>{t('dashboard.all_documents_btn')}</Link>
                        </>
                    )}

                    {isAnalyst && (
                        <Link href="/dashboard/review" style={{
                            background: '#000', color: 'white', padding: '18px', borderRadius: '18px', textDecoration: 'none', fontWeight: 700, textAlign: 'center'
                        }}>Go to Video Review</Link>
                    )}

                    {user?.role !== 'SYSTEM' && !isAnalyst && (
                        <button
                            onClick={handleGenerateReport}
                            disabled={reporting}
                            style={{
                                background: hasNewDocs ? '#16a34a' : (reportedToday ? '#9ca3af' : '#16a34a'),
                                color: 'white',
                                padding: '18px',
                                borderRadius: '18px',
                                border: 'none',
                                fontWeight: 700,
                                textAlign: 'center',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                opacity: reporting ? 0.7 : 1
                            }}
                        >
                            {reporting ? <Loader2 className="animate-spin" size={20} /> : <FileSpreadsheet size={20} />}
                            {reporting ? t('dashboard.reporting') : (hasNewDocs ? t('dashboard.report_today') : (reportedToday ? t('dashboard.reported_today') : t('dashboard.report_today')))}
                        </button>
                    )}
                    {user?.role === 'SYSTEM' && (
                        <div style={{ background: '#f8fafc', color: '#64748b', padding: '18px', borderRadius: '18px', textAlign: 'center', fontSize: '14px', fontWeight: 600, border: '1px dashed #cbd5e1' }}>
                            {t('dashboard.report_restricted')}
                        </div>
                    )}
                </div>
            </div>

            {/* System Activity Logs (Only for Sys / Managers) */}
            {user?.role === 'SYSTEM' && (
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: 'clamp(24px, 4vw, 36px)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    border: '1px solid #e5e7eb',
                    marginBottom: '48px'
                }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px', color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={24} color="#ef4444" /> {t('dashboard.activity_logs')}
                    </h2>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin" /></div>
                        ) : !data?.activityLogs?.length ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>{t('dashboard.no_logs')}</div>
                        ) : (
                            data.activityLogs.map((log: any, i: number) => (
                                <div key={i} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '13px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 800, color: '#0f172a' }}>{log.user}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>{new Date(log.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div style={{ color: '#475569', fontWeight: 600 }}>
                                        <span style={{ color: '#000' }}>{t(`dashboard.actions.${log.action}`) || log.action}</span>
                                    </div>
                                    {log.details && (
                                        <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px', fontStyle: 'italic' }}>
                                            {renderLogDetails(log.details)}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Recent Activity */}
            <div style={{
                background: 'white',
                borderRadius: '24px',
                padding: 'clamp(24px, 4vw, 36px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #e5e7eb',
            }}>
                <h2 style={{
                    fontSize: 'clamp(18px, 3vw, 22px)',
                    fontWeight: 700,
                    marginBottom: '24px',
                    color: '#1a1a1a',
                }}>
                    {t('dashboard.recent_activity')}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}><Clock className="animate-spin" /></div>
                    ) : !data?.recentActivity?.length ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
                            <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <p>{t('dashboard.no_activity')}</p>
                        </div>
                    ) : (
                        data.recentActivity.map((act: any, i: number) => (
                            <div key={i} style={{
                                display: 'flex',
                                gap: '14px',
                                padding: '16px',
                                background: 'white',
                                borderRadius: '18px',
                                border: '1px solid #f1f5f9',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '16px',
                                    background: act.status === 'SIGNED' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                    color: act.status === 'SIGNED' ? '#10b981' : '#3b82f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: '2px'
                                }}>
                                    {act.status === 'SIGNED' ? <CheckCircle size={24} /> : <Clock size={24} />}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ fontWeight: 800, fontSize: '16px', color: '#1a1a1a', lineHeight: '1.2' }}>
                                            {act.title}
                                        </div>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>
                                            #{act.docNo}
                                        </div>
                                    </div>

                                    <div>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '10px',
                                            fontWeight: 800,
                                            letterSpacing: '0.05em',
                                            background: act.status === 'SIGNED' ? '#10b981' : '#3b82f6',
                                            color: 'white',
                                            textTransform: 'uppercase'
                                        }}>
                                            {act.status}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Users size={14} />
                                        <span>{t('dashboard.by')} <span style={{ color: '#1a1a1a', fontWeight: 700 }}>{act.user}</span></span>
                                    </div>

                                    <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={12} />
                                        {new Date(act.createdAt).toLocaleString(i18n.language === 'id' ? 'id-ID' : (i18n.language === 'zh' ? 'zh-CN' : 'en-US'), {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <StatusModal
                open={statusModal.open}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
                onClose={() => setStatusModal({ ...statusModal, open: false })}
            />

            <style jsx>{`
                .search-item-hover:hover { background: #f8fafc; }
                .btn-icon:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
