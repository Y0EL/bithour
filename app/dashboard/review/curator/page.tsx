'use client';

import {
    Play,
    Search,
    Clock,
    CheckCircle,
    Activity,
    ChevronRight,
    Loader2,
    Calendar,
    TrendingUp,
    MessageCircle,
    X,
    XCircle,
    RotateCcw,
    Check,
    AlertCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

export default function CuratorResultsPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ todayCount: 0, weekCount: 0, monthCount: 0 });
    const [videos, setVideos] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVideo, setSelectedVideo] = useState<any>(null);
    const [feedback, setFeedback] = useState('');
    const [processing, setProcessing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/dashboard/review?status=UPLOADED`);
            const data = await res.json();
            if (res.ok) {
                setStats(data.stats);
                setVideos(data.videos);
            }
        } catch (err) {
            console.error('Failed to fetch curator results:', err);
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
                await fetchData();
                setSelectedVideo(null);
                setFeedback('');
            } else {
                const err = await res.json();
                alert(err.error || 'Action failed');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setProcessing(false);
        }
    };

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
            {/* Header */}
            <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#000', marginBottom: '4px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {t('sidebar.curator_results')} <span style={{ fontSize: '24px', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>{videos.length}</span>
                        </h1>
                        <p style={{ color: '#666', fontSize: '15px' }}>
                            View and review videos processed by the Curation team.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                    <StatCard icon={<TrendingUp size={20} />} label={t('review.stats.today')} value={stats.todayCount} color="#000" />
                    <StatCard icon={<Calendar size={20} />} label={t('review.stats.week')} value={stats.weekCount} color="#666" />
                    <StatCard icon={<Clock size={20} />} label={t('review.stats.month')} value={stats.monthCount} color="#888" />
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '32px' }}>
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Video List */}
            {filteredVideos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: '32px', border: '2px dashed #e5e7eb' }}>
                    <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '16px', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#000' }}>No Curator Edits found</h3>
                    <p style={{ color: '#666' }}>All curator videos have been reviewed or none are pending.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                    <AnimatePresence>
                        {filteredVideos.map((video) => (
                            <motion.div
                                key={video.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={() => setSelectedVideo(video)}
                                style={{
                                    background: '#fff',
                                    borderRadius: '24px',
                                    padding: '24px',
                                    border: '1px solid #f1f5f9',
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)' }}
                            >
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                                    <div style={{ position: 'relative', width: '80px', height: '110px', borderRadius: '12px', background: '#f8fafc', overflow: 'hidden', flexShrink: 0 }}>
                                        {video.videoThumbnailUrl ? (
                                            <img src={video.videoThumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Play size={24} style={{ color: '#cbd5e1' }} />
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '6px', padding: '2px 6px' }}>
                                            <span style={{ fontSize: '10px', color: '#fff', fontWeight: 700 }}>HD</span>
                                        </div>
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '2px 8px',
                                                background: 'rgba(139, 92, 246, 0.1)',
                                                color: '#8b5cf6',
                                                borderRadius: '20px',
                                                fontWeight: 800,
                                                letterSpacing: '0.02em',
                                                textTransform: 'uppercase'
                                            }}>
                                                Curator Edit 🎬
                                            </span>
                                        </div>
                                        <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#000', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {video.name}
                                        </h3>
                                        <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, marginBottom: '12px' }}>@{video.usernameTikTok}</p>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                                                <Calendar size={14} />
                                                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                                                    {video.videoUploadedAt ? new Date(video.videoUploadedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                                                <MessageCircle size={14} />
                                                <span style={{ fontSize: '12px', fontWeight: 600 }}>{video.reviewHistory?.length || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ChevronRight size={18} style={{ color: '#94a3b8' }} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Review Modal - COPIED FROM ReviewPage for consistency */}
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
                                position: 'relative'
                            }}
                        >
                            {/* Modal Header */}
                            <div style={{ padding: '24px 32px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#000', margin: 0 }}>Review Curator Edit: {selectedVideo.name}</h2>
                                    <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Reviewing video processed by curator</p>
                                </div>
                                <button onClick={() => !processing && setSelectedVideo(null)} style={{ background: '#f8fafc', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: isMobile ? 'auto' : 'hidden', padding: isMobile ? '16px' : '32px', gap: '32px' }}>
                                {/* Left: Video Player */}
                                <div style={{
                                    flex: isMobile ? 'none' : 1.5,
                                    width: '100%',
                                    position: 'relative'
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

                                {/* Right: Controls */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '20px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
                                                {t('review.modal.feedback_label')}
                                            </label>
                                            <button
                                                onClick={handleClearChat}
                                                style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <RotateCcw size={12} /> Reset Chat
                                            </button>
                                        </div>

                                        <div style={{ position: 'relative', height: isMobile ? '150px' : 'calc(100% - 30px)' }}>
                                            <textarea
                                                placeholder={t('review.modal.feedback_placeholder')}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    padding: '20px',
                                                    borderRadius: '24px',
                                                    border: '1px solid #e5e7eb',
                                                    background: '#f9fafb',
                                                    fontSize: '15px',
                                                    outline: 'none',
                                                    resize: 'none'
                                                }}
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
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
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
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
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
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px'
                                            }}
                                        >
                                            {processing ? <Loader2 size={24} className="animate-spin" /> : <><Check size={22} /> {t('review.modal.approve')}</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatCard({ icon, label, value, color }: any) {
    return (
        <div style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
        }}>
            <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                background: `#000`,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: '#000' }}>{value}</p>
            </div>
        </div>
    );
}
