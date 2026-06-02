'use client';

import {
    Play,
    Search,
    Clock,
    CheckCircle,
    XCircle,
    MessageSquare,
    TrendingUp,
    Calendar,
    Activity,
    ChevronRight,
    Loader2,
    AlertCircle,
    Check,
    X,
    MessageCircle,
    Globe,
    RotateCcw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';


export default function ReviewPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ todayCount: 0, weekCount: 0, monthCount: 0 });
    const [tabCounts, setTabCounts] = useState({ PENDING: 0, UPLOADED: 0, APPROVED: 0, REVISION: 0, REJECTED: 0, TOTAL: 0 });
    const [videos, setVideos] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVideo, setSelectedVideo] = useState<any>(null);
    const [feedback, setFeedback] = useState('');
    const [processing, setProcessing] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<'PENDING' | 'UPLOADED' | 'APPROVED' | 'REVISION' | 'REJECTED'>('PENDING');
    const [videoLoaded, setVideoLoaded] = useState(false);

    useEffect(() => {
        fetchData();
    }, [currentStatus]);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/dashboard/review?status=${currentStatus}`);
            const data = await res.json();
            if (res.ok) {
                setStats(data.stats);
                setVideos(data.videos);
                setTabCounts(data.tabCounts || { PENDING: 0, UPLOADED: 0, APPROVED: 0, REVISION: 0, REJECTED: 0, TOTAL: 0 });
            }
        } catch (err) {
            console.error('Failed to fetch review data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClearChat = async () => {
        if (!selectedVideo || !confirm('Yakin ingin menghapus seluruh riwayat chat untuk kreator ini?')) return;
        setProcessing(true);
        try {
            const res = await fetch(`/api/creator/messages?creatorId=${selectedVideo.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                alert('Riwayat chat berhasil dibersihkan.');
            } else {
                alert('Gagal membersihkan chat.');
            }
        } catch (err) {
            alert('Kesalahan jaringan');
        } finally {
            setProcessing(false);
        }
    };

    const handleReview = async (action: 'APPROVE' | 'REJECT' | 'REVISION') => {
        if (!selectedVideo) return;
        setProcessing(true);
        try {
            const res = await fetch('/api/dashboard/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: selectedVideo.id,
                    action,
                    feedback
                })
            });

            if (res.ok) {
                // Success - refresh data and close modal
                await fetchData();
                setSelectedVideo(null);
                setFeedback('');
                setVideoLoaded(false); // Reset video state
            } else {
                const err = await res.json();
                alert(err.error || 'Review failed');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setProcessing(false);
        }
    };

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const filteredVideos = videos.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.usernameTikTok.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: '#000', marginBottom: '16px' }} />
                <p style={{ fontWeight: 600, color: '#666' }}>{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header with Stats */}
            <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#000', marginBottom: '4px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            Creator <span style={{ fontSize: '24px', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>{tabCounts.TOTAL}</span>
                        </h1>
                        <p style={{ color: '#666', fontSize: '15px' }}>
                            {t('review.subtitle')}
                        </p>
                    </div>
                    <div style={{ background: '#000', color: '#fff', padding: '12px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={18} />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{tabCounts.PENDING} {t('review.stats.pending')}</span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                    <StatCard icon={<TrendingUp size={20} />} label={t('review.stats.today')} value={stats.todayCount} color="#000" />
                    <StatCard icon={<Calendar size={20} />} label={t('review.stats.week')} value={stats.weekCount} color="#666" />
                    <StatCard icon={<Clock size={20} />} label={t('review.stats.month')} value={stats.monthCount} color="#888" />
                </div>
            </div>

            {/* Search & Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                <div style={{ position: 'relative', maxWidth: '600px' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                    <input
                        placeholder={t('review.search')}
                        style={{
                            paddingLeft: '48px',
                            height: '56px',
                            borderRadius: '16px',
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            fontSize: '15px',
                            width: '100%',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                            outline: 'none'
                        }}
                        className="focus-ring"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }} className="no-scrollbar">
                    {[
                        { id: 'PENDING', label: t('review.tabs.pending'), color: '#3b82f6', count: tabCounts.PENDING },
                        { id: 'APPROVED', label: t('review.tabs.approved'), color: '#10b981', count: tabCounts.APPROVED },
                        { id: 'REVISION', label: t('review.tabs.revision'), color: '#f59e0b', count: tabCounts.REVISION },
                        { id: 'REJECTED', label: t('review.tabs.rejected'), color: '#ef4444', count: tabCounts.REJECTED }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setCurrentStatus(tab.id as any)}
                            style={{
                                padding: '12px 20px',
                                borderRadius: '12px',
                                background: currentStatus === tab.id ? '#000' : '#fff',
                                color: currentStatus === tab.id ? '#fff' : '#64748b',
                                border: currentStatus === tab.id ? 'none' : '1px solid #e5e7eb',
                                fontWeight: 700,
                                fontSize: '14px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span style={{
                                    marginLeft: '8px',
                                    padding: '2px 8px',
                                    borderRadius: '20px',
                                    background: currentStatus === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                                    fontSize: '11px',
                                    fontWeight: 800
                                }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Video List */}
            {filteredVideos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: '32px', border: '2px dashed #e5e7eb' }}>
                    <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '16px', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#000' }}>{t('review.empty.title')}</h3>
                    <p style={{ color: '#666' }}>{t('review.empty.subtitle')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                    {(() => {
                        // Group videos by date (either reviewedAt for history or videoUploadedAt for pending)
                        const groups = filteredVideos.reduce((acc: any, video) => {
                            const dateKey = video.reviewedAt
                                ? new Date(video.reviewedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                                : (video.videoUploadedAt ? new Date(video.videoUploadedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown Date');

                            if (!acc[dateKey]) acc[dateKey] = [];
                            acc[dateKey].push(video);
                            return acc;
                        }, {});

                        return Object.entries(groups).map(([date, groupVideos]: [string, any]) => (
                            <div key={date}>
                                {/* Date Divider */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, #e5e7eb)' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', background: '#f8fafc', padding: '4px 12px', borderRadius: '20px', border: '1px solid #e5e7eb' }}>
                                        {date}
                                    </span>
                                    <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to left, transparent, #e5e7eb)' }} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                                    {groupVideos.map((video: any) => (
                                        <motion.div
                                            key={video.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            whileTap={isMobile && video.status !== 'FAIL' ? { scale: 0.98 } : undefined}
                                            whileHover={!isMobile && video.status !== 'FAIL' ? { y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' } : undefined}
                                            onClick={() => video.status === 'FAIL' ? null : setSelectedVideo(video)}
                                            style={{
                                                background: '#fff',
                                                borderRadius: '32px',
                                                border: '1px solid #e5e7eb',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                                                aspectRatio: '1/1',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                position: 'relative'
                                            }}
                                            className="video-card"
                                        >
                                            {(() => {
                                                const url = (video.isEndorsementReview && video.endorsedVideoUrl) ? video.endorsedVideoUrl : (video.videoUrl || '');
                                                let fileId = '';
                                                if (url.includes('drive.google.com')) {
                                                    if (url.includes('/file/d/')) {
                                                        fileId = url.split('/file/d/')[1].split('/')[0];
                                                    } else if (url.includes('/folders/')) {
                                                        fileId = url.split('/folders/')[1].split('/')[0].split('?')[0];
                                                    } else if (url.includes('id=')) {
                                                        fileId = url.split('id=')[1].split('&')[0];
                                                    }
                                                }

                                                const driveThumb = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : null;
                                                const cachedThumb = video.videoThumbnailUrl;

                                                return (
                                                    <img
                                                        src={driveThumb || cachedThumb || `https://api.dicebear.com/7.x/notionists/svg?seed=${video.id}&backgroundColor=f1f5f9`}
                                                        alt=""
                                                        style={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            zIndex: 0,
                                                            height: '100%',
                                                            width: '100%',
                                                            objectFit: 'cover',
                                                            transition: 'transform 0.5s ease'
                                                        }}
                                                        className="card-image"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            if (target.src === driveThumb && cachedThumb) {
                                                                target.src = cachedThumb;
                                                            } else {
                                                                target.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${video.id}&backgroundColor=f1f5f9`;
                                                            }
                                                        }}
                                                    />
                                                );
                                            })()}

                                            <div style={{
                                                marginTop: 'auto',
                                                padding: '32px 24px 24px 24px',
                                                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)',
                                                position: 'relative',
                                                zIndex: 1,
                                                width: '100%'
                                            }}>
                                                <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#fff', margin: '0 0 2px 0', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{video.name}</h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 600, margin: 0 }}>@{video.usernameTikTok}</p>
                                                    <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: '11px', color: '#fff', fontWeight: 800 }}>
                                                        {video.followers || 'N/A'}
                                                    </span>
                                                </div>

                                                <div style={{
                                                    marginTop: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '11px',
                                                    color: 'rgba(255,255,255,0.6)',
                                                    fontWeight: 700
                                                }}>
                                                    <Clock size={12} />
                                                    {getTimeDifference(video.videoUploadedAt)}
                                                </div>
                                            </div>

                                            {video.isEndorsementReview && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '20px',
                                                    left: '20px',
                                                    padding: '6px 12px',
                                                    borderRadius: '10px',
                                                    background: '#8b5cf6',
                                                    color: '#fff',
                                                    fontSize: '10px',
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    zIndex: 2,
                                                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                                                }}>
                                                    {t('review.card.endorsed_edit')}
                                                </div>
                                            )}

                                            {video.videoReviewStatus !== 'PENDING' && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '20px',
                                                    right: '20px',
                                                    padding: '6px 12px',
                                                    borderRadius: '10px',
                                                    background: video.videoReviewStatus === 'APPROVED' ? '#dcfce7' : (video.videoReviewStatus === 'REVISION' ? '#fef3c7' : '#fee2e2'),
                                                    color: video.videoReviewStatus === 'APPROVED' ? '#166534' : (video.videoReviewStatus === 'REVISION' ? '#92400e' : '#991b1b'),
                                                    fontSize: '10px',
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    zIndex: 2,
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                                }}>
                                                    {t(`review.tabs.${video.videoReviewStatus.toLowerCase()}`)}
                                                </div>
                                            )}

                                            {/* FAIL Overlay */}
                                            {video.status === 'FAIL' && (
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    zIndex: 10,
                                                    background: 'rgba(255,255,255,0.85)',
                                                    backdropFilter: 'blur(2px)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '24px',
                                                    textAlign: 'center'
                                                }}>
                                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                                        <XCircle size={24} color="#ef4444" />
                                                    </div>
                                                    <h3 style={{ color: '#ef4444', fontWeight: 900, fontSize: '20px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('curator.card.failed')}</h3>
                                                    {video.failedAt && <p style={{ color: '#991b1b', fontWeight: 800, fontSize: '12px', margin: '0 0 8px 0' }}>{new Date(video.failedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                                                    {video.failedReason && <p style={{ color: '#7f1d1d', fontWeight: 600, fontSize: '11px', margin: 0, fontStyle: 'italic', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '8px', wordBreak: 'break-word' }}>"{video.failedReason}"</p>}
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            )}

            {/* Review Modal */}
            <AnimatePresence>
                {selectedVideo && (
                    <motion.div
                        initial={isMobile ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={isMobile ? { opacity: 1 } : { opacity: 0 }}
                        transition={{ duration: isMobile ? 0 : 0.2 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: isMobile ? 'none' : 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: isMobile ? '0' : '20px' }}
                        onClick={(e) => {
                            if (processing) return;
                            if (e.target === e.currentTarget) setSelectedVideo(null);
                        }}
                    >
                        <motion.div
                            initial={isMobile ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={isMobile ? { y: 0, opacity: 0 } : { y: 20, opacity: 0 }}
                            transition={isMobile ? { duration: 0 } : { duration: 0.2 }}
                            style={{
                                background: '#fff',
                                borderRadius: isMobile ? '32px 32px 0 0' : '32px',
                                width: isMobile ? '100%' : '95%',
                                maxWidth: '1100px',
                                height: isMobile ? '100%' : 'min(850px, 90vh)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                                position: isMobile ? 'absolute' : 'relative',
                                bottom: isMobile ? 0 : 'auto'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header - Fixed */}
                            <div style={{ padding: isMobile ? '16px 20px' : '20px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff', zIndex: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px' }}>
                                    <div style={{ width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', borderRadius: '12px', background: 'rgba(0,0,0,0.03)', border: '1px solid #eee', overflow: 'hidden' }}>
                                        <img
                                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${selectedVideo.id}`}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h2 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: 800, color: '#000', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('review.modal.title')} {selectedVideo.name}</h2>
                                        <p style={{ color: '#666', fontSize: isMobile ? '11px' : '13px', fontWeight: 600, margin: 0 }}>@{selectedVideo.usernameTikTok}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (!processing) {
                                            setSelectedVideo(null);
                                            setVideoLoaded(false);
                                        }
                                    }}
                                    style={{ background: '#f3f4f6', border: 'none', borderRadius: '12px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Content - Scrollable if needed but optimized to stay within view */}
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: isMobile ? '16px' : '24px 32px',
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '20px' : '32px'
                            }}>
                                {/* Left/Top: Video Player */}
                                <div style={{
                                    flex: isMobile ? 'none' : '1.2',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    maxHeight: isMobile ? '45vh' : 'none'
                                }}>
                                    <div style={{
                                        background: '#000',
                                        borderRadius: '24px',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        height: '100%',
                                        minHeight: isMobile ? '40vh' : '400px',
                                        maxHeight: isMobile ? '45vh' : 'none',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <div style={{ width: '100%', height: '100%' }}>
                                            {(() => {
                                                const url = (selectedVideo.isEndorsementReview && selectedVideo.endorsedVideoUrl) ? selectedVideo.endorsedVideoUrl : (selectedVideo.videoUrl || '');
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
                                                        src={`/api/creator/video/view?creatorId=${selectedVideo.id}`}
                                                        controls
                                                        autoPlay
                                                        preload="metadata"
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Right/Bottom: Review Controls */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: isMobile ? '16px' : '20px',
                                    paddingBottom: isMobile ? '80px' : '0'
                                }}>
                                    <div style={{ flex: isMobile ? 'none' : 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
                                                {t('review.modal.feedback_label')}
                                            </label>
                                            <button
                                                onClick={handleClearChat}
                                                style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <RotateCcw size={12} /> Reset Chat History
                                            </button>
                                        </div>

                                        {/* INTERNAL REVIEW HISTORY */}
                                        {selectedVideo.reviewHistory && (selectedVideo.reviewHistory as any[]).length > 0 && (
                                            <div style={{
                                                marginBottom: '16px',
                                                background: '#f8fafc',
                                                borderRadius: '16px',
                                                border: '1px solid #e2e8f0',
                                                padding: '16px',
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '12px'
                                            }}>
                                                <div style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Feedback History (Internal Only)
                                                </div>
                                                {([...(selectedVideo.reviewHistory as any[])].reverse()).map((item: any, idx: number) => (
                                                    <div key={idx} style={{ padding: '8px 12px', background: '#fff', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#000' }}>
                                                                Revision {item.rev} ({item.action})
                                                            </span>
                                                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                                {new Date(item.timestamp).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p style={{ fontSize: '12px', color: '#475569', margin: 0, fontStyle: 'italic', fontWeight: 500 }}>
                                                            "{item.originalFeedback}"
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ position: 'relative', flex: isMobile ? 'none' : 1 }}>
                                            <textarea
                                                placeholder={t('review.modal.feedback_placeholder')}
                                                style={{
                                                    width: '100%',
                                                    height: isMobile ? '100px' : '100%',
                                                    minHeight: isMobile ? '100px' : '150px',
                                                    maxHeight: isMobile ? '100px' : '300px',
                                                    padding: '20px',
                                                    borderRadius: '24px',
                                                    border: '1px solid #e5e7eb',
                                                    background: '#f9fafb',
                                                    fontSize: '15px',
                                                    fontFamily: '"Outfit", "Inter", sans-serif',
                                                    fontWeight: 500,
                                                    lineHeight: '1.6',
                                                    outline: 'none',
                                                    resize: 'none',
                                                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.02)',
                                                    transition: 'all 0.2s'
                                                } as any}
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                disabled={processing}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            onClick={() => handleReview('REJECT')}
                                            disabled={processing}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '16px',
                                                background: '#fff',
                                                border: '1px solid #fecaca',
                                                color: '#ef4444',
                                                fontWeight: 700,
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                                            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                        >
                                            <XCircle size={16} /> {t('review.modal.reject')}
                                        </button>
                                        <button
                                            onClick={() => handleReview('REVISION')}
                                            disabled={processing}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '16px',
                                                background: '#fff',
                                                border: '2px solid #000',
                                                color: '#000',
                                                fontWeight: 800,
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                        >
                                            <MessageCircle size={16} /> {t('review.modal.revision')}
                                        </button>
                                        <button
                                            onClick={() => handleReview('APPROVE')}
                                            disabled={processing}
                                            style={{
                                                gridColumn: 'span 2',
                                                padding: '16px',
                                                borderRadius: '20px',
                                                background: '#000',
                                                color: '#fff',
                                                border: 'none',
                                                fontWeight: 800,
                                                fontSize: '15px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 10px 20px rgba(0,0,0,0.15)'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            {processing ? <Loader2 size={24} className="animate-spin" /> : <><Check size={22} /> {t('review.modal.approve')}</>}
                                        </button>
                                    </div>

                                    {/* Quick Note - Compact */}
                                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '16px', display: 'flex', gap: '10px', alignItems: 'center', border: '1px solid #f1f5f9' }}>
                                        <AlertCircle size={16} color="#64748b" />
                                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 500 }}>
                                            {t('review.modal.notice')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .focus-ring:focus { border-color: #000 !important; box-shadow: 0 0 0 4px rgba(0,0,0,0.05) !important; }
                .video-card:hover .card-image { transform: scale(1.1); }
            `}</style>
        </div >
    );
}

function StatCard({ icon, label, value, color }: any) {
    return (
        <div style={{
            background: '#fff',
            padding: '24px',
            borderRadius: '24px',
            border: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '100px',
                height: '100px',
                background: `radial-gradient(circle at top right, ${color}05, transparent 70%)`
            }} />
            <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
            }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <p style={{ fontSize: '32px', fontWeight: 800, color: '#000', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
                </div>
            </div>
        </div>
    );
}

function getTimeDifference(dateString: string) {
    const uploaded = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diffInMs = now - uploaded;

    const minutes = Math.floor(diffInMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ago`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    return `${minutes}m ago`;
}
