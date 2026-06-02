'use client';

import {
    Download,
    Upload,
    CheckCircle,
    XCircle,
    Loader2,
    Search,
    Archive,
    Check,
    AlertCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function CuratorDashboard() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [videos, setVideos] = useState<any[]>([]);
    const [stats, setStats] = useState({ PENDING_CURATION: 0, ENDORSED: 0, TOTAL: 0 });
    const [currentTab, setCurrentTab] = useState<'PENDING_CURATION' | 'ENDORSED'>('PENDING_CURATION');
    const [searchQuery, setSearchQuery] = useState('');

    // Batch download state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

    // Upload Endorsement state
    const [uploadModal, setUploadModal] = useState<{ open: boolean, creator: any | null }>({ open: false, creator: null });
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Video Player state
    const [selectedVideo, setSelectedVideo] = useState<any | null>(null);

    // Confirm Modal state
    const [confirmModal, setConfirmModal] = useState<{ open: boolean, type: string, payload: any }>({ open: false, type: '', payload: null });

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        fetchData();
    }, [currentTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/curator/videos?status=${currentTab}`);
            const data = await res.json();
            if (res.ok) {
                setVideos(data.videos);
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch curator data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(videos.map(v => v.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
        );
    };

    const executeBatchDownload = async () => {
        if (selectedIds.length === 0) return;
        setBatchProcessing(true);
        setBatchProgress({ current: 0, total: selectedIds.length });

        try {
            const zip = new JSZip();
            const docsToDownload = videos.filter(v => selectedIds.includes(v.id));

            for (let i = 0; i < docsToDownload.length; i++) {
                const doc = docsToDownload[i];
                try {
                    const res = await fetch(`/api/creator/video/download?creatorId=${doc.id}`);
                    if (res.ok) {
                        const blob = await res.blob();
                        const fileName = `${doc.usernameTikTok}-draft.mp4`;
                        zip.file(fileName, blob);
                    }
                } catch (err) {
                    console.error(`Failed to download ${doc.usernameTikTok}:`, err);
                }
                setBatchProgress({ current: i + 1, total: docsToDownload.length });
            }

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `Curator-Batch-${new Date().toISOString().split('T')[0]}.zip`);

            setSelectedIds([]);
        } catch (error) {
            alert('Failed to download batch. Some files might be restricted.');
        } finally {
            setBatchProcessing(false);
        }
    };

    const executeSingleDownload = async (video: any, isEndorsed = false) => {
        const url = `/api/creator/video/download?creatorId=${video.id}${isEndorsed ? '&isEndorsed=true' : ''}`;
        window.location.href = url;
    };

    const executeMarkAsFinished = async (id: string) => {
        try {
            const res = await fetch('/api/curator/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creatorId: id })
            });
            if (res.ok) {
                alert('Video marked as Finished!');
                await fetchData();
            } else {
                alert('Failed to mark as finished.');
            }
        } catch (err) {
            alert('Error communicating with server.');
        }
    };

    const handleConfirmAction = () => {
        const { type, payload } = confirmModal;
        if (type === 'download_batch') executeBatchDownload();
        if (type === 'download_draft') executeSingleDownload(payload.video, false);
        if (type === 'download_final') executeSingleDownload(payload.video, true);
        if (type === 'finish') executeMarkAsFinished(payload.id);

        setConfirmModal({ open: false, type: '', payload: null });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (confirmModal.open) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmAction();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setConfirmModal({ open: false, type: '', payload: null });
                }
            } else if (uploadModal.open && e.key === 'Escape') {
                e.preventDefault();
                setUploadModal({ open: false, creator: null });
            } else if (selectedVideo && e.key === 'Escape') {
                e.preventDefault();
                setSelectedVideo(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [confirmModal, uploadModal.open, selectedVideo]);

    const handleBatchDownload = () => {
        if (selectedIds.length === 0) return;
        setConfirmModal({ open: true, type: 'download_batch', payload: null });
    };

    const handleSingleDownload = (video: any, e: any, isEndorsed = false) => {
        e.stopPropagation();
        setConfirmModal({ open: true, type: isEndorsed ? 'download_final' : 'download_draft', payload: { video } });
    };

    const handleMarkAsFinished = (id: string, e: any) => {
        e.stopPropagation();
        setConfirmModal({ open: true, type: 'finish', payload: { id } });
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile || !uploadModal.creator) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('creatorId', uploadModal.creator.id);
            formData.append('file', uploadFile);

            const res = await fetch('/api/curator/endorse', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                setUploadModal({ open: false, creator: null });
                setUploadFile(null);
                await fetchData();
                alert('Video endorsed successfully!');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to endorse video');
            }
        } catch (err) {
            alert('Network error during upload');
        } finally {
            setUploading(false);
        }
    };

    const filteredVideos = videos.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.usernameTikTok.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groupedEndorsed = Object.entries(filteredVideos.reduce((acc, video) => {
        const dateObj = new Date(video.videoUploadedAt || video.updatedAt);
        const dateStr = dateObj.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(video);
        return acc;
    }, {} as { [key: string]: any[] })) as [string, any[]][];

    if (loading && videos.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: '#000', marginBottom: '16px' }} />
                <p style={{ fontWeight: 600, color: '#666' }}>{t('common.loading')}...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '120px' }}>
            <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#000', marginBottom: '4px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {t('curator.title')} <span style={{ fontSize: '24px', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>{stats.TOTAL}</span>
                        </h1>
                        <p style={{ color: '#666', fontSize: '15px' }}>
                            {t('curator.subtitle')}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                    <StatCard icon={<Download size={20} />} label={t('curator.stats.pending')} value={stats.PENDING_CURATION} color="#f59e0b" />
                    <StatCard icon={<CheckCircle size={20} />} label={t('curator.stats.endorsed')} value={stats.ENDORSED} color="#10b981" />
                </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px', marginBottom: '32px', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setCurrentTab('PENDING_CURATION')}
                        style={{
                            padding: '12px 20px', borderRadius: '12px',
                            background: currentTab === 'PENDING_CURATION' ? '#000' : '#fff',
                            color: currentTab === 'PENDING_CURATION' ? '#fff' : '#64748b',
                            border: currentTab === 'PENDING_CURATION' ? 'none' : '1px solid #e5e7eb',
                            fontWeight: 700, fontSize: '14px', cursor: 'pointer'
                        }}
                    >
                        {t('curator.tabs.pending')} ({stats.PENDING_CURATION})
                    </button>
                    <button
                        onClick={() => setCurrentTab('ENDORSED')}
                        style={{
                            padding: '12px 20px', borderRadius: '12px',
                            background: currentTab === 'ENDORSED' ? '#000' : '#fff',
                            color: currentTab === 'ENDORSED' ? '#fff' : '#64748b',
                            border: currentTab === 'ENDORSED' ? 'none' : '1px solid #e5e7eb',
                            fontWeight: 700, fontSize: '14px', cursor: 'pointer'
                        }}
                    >
                        {t('curator.tabs.history')} ({stats.ENDORSED})
                    </button>
                </div>

                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                    <input
                        placeholder={t('curator.search')}
                        style={{
                            paddingLeft: '48px', height: '48px', borderRadius: '12px',
                            background: '#fff', border: '1px solid #e5e7eb',
                            fontSize: '15px', width: '100%', outline: 'none'
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
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#000' }}>{t('curator.empty.title')}</h3>
                    <p style={{ color: '#666' }}>{t('curator.empty.subtitle')}</p>
                </div>
            ) : (
                <>
                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                            type="checkbox"
                            id="selectAll"
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            checked={videos.length > 0 && selectedIds.length === videos.length}
                            onChange={handleSelectAll}
                        />
                        <label htmlFor="selectAll" style={{ fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>{t('curator.batch.select_all')}</label>
                    </div>

                    {currentTab === 'ENDORSED' ? (
                        groupedEndorsed.map(([date, dateVideos]) => (
                            <div key={date} style={{ marginBottom: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{date}</h4>
                                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', background: '#f8fafc', padding: '4px 12px', borderRadius: '100px', border: '1px solid #e2e8f0' }}>{dateVideos.length} Videos</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                                    {dateVideos.map((video) => (
                                        <VideoCard
                                            key={video.id}
                                            video={video}
                                            selectedIds={selectedIds}
                                            handleSelectOne={handleSelectOne}
                                            setSelectedVideo={setSelectedVideo}
                                            currentTab={currentTab}
                                            handleSingleDownload={handleSingleDownload}
                                            setUploadModal={setUploadModal}
                                            handleMarkAsFinished={handleMarkAsFinished}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                            {filteredVideos.map((video) => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    selectedIds={selectedIds}
                                    handleSelectOne={handleSelectOne}
                                    setSelectedVideo={setSelectedVideo}
                                    currentTab={currentTab}
                                    handleSingleDownload={handleSingleDownload}
                                    setUploadModal={setUploadModal}
                                    handleMarkAsFinished={handleMarkAsFinished}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}


            {/* Batch Action Footer */}
            <AnimatePresence>
                {selectedIds.length > 0 && currentTab === 'PENDING_CURATION' && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        style={{
                            position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                            background: '#000', color: '#fff', padding: '16px 32px', borderRadius: '100px',
                            display: 'flex', alignItems: 'center', gap: '24px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)', zIndex: 100
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ width: '28px', height: '28px', background: '#fff', color: '#000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                                {selectedIds.length}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '15px' }}>{t('curator.batch.selected', { count: selectedIds.length })}</span>
                        </div>

                        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleBatchDownload}
                                disabled={batchProcessing}
                                style={{ padding: '10px 20px', borderRadius: '100px', border: 'none', background: '#fff', color: '#000', fontWeight: 800, cursor: batchProcessing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {batchProcessing ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                                {batchProcessing ? t('curator.batch.zipping', { current: batchProgress.current, total: batchProgress.total }) : t('curator.batch.download_zip')}
                            </button>
                            <button
                                onClick={() => setSelectedIds([])}
                                style={{ padding: '10px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Video Player Modal */}
            <AnimatePresence>
                {selectedVideo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSelectedVideo(null);
                        }}
                    >
                        <div
                            style={{ background: '#000', borderRadius: '24px', width: '100%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                                <div>
                                    <h3 style={{ color: '#fff', margin: 0, fontSize: '16px', fontWeight: 700 }}>{selectedVideo.name}</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '13px' }}>@{selectedVideo.usernameTikTok}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedVideo(null)}
                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                            <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
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
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Modal */}
            <AnimatePresence>
                {uploadModal.open && uploadModal.creator && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                        onClick={() => !uploading && setUploadModal({ open: false, creator: null })}
                    >
                        <div
                            style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: '32px' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0' }}>{t('curator.upload.title')}</h2>
                            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
                                {t('curator.confirm.endorse')} <strong>@{uploadModal.creator?.usernameTikTok}</strong>
                            </p>

                            <form onSubmit={handleUploadSubmit}>
                                <div style={{ border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', marginBottom: '24px', background: '#f8fafc', position: 'relative' }}>
                                    <input
                                        type="file"
                                        accept="video/*"
                                        required
                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                    />
                                    {uploadFile ? (
                                        <div>
                                            <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
                                            <p style={{ fontWeight: 700, margin: 0, color: '#0f172a' }}>{uploadFile.name}</p>
                                            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload size={32} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                                            <p style={{ fontWeight: 700, margin: 0, color: '#0f172a' }}>{t('curator.upload.drag_drop')}</p>
                                            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{t('curator.upload.format')}</p>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setUploadModal({ open: false, creator: null })}
                                        disabled={uploading}
                                        style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#f1f5f9', color: '#0f172a', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={uploading || !uploadFile}
                                        style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#000', color: '#fff', fontWeight: 800, border: 'none', cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                        {uploading ? t('curator.upload.uploading') : t('curator.upload.submit')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirm Modal */}
            <AnimatePresence>
                {confirmModal.open && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}
                        onClick={() => setConfirmModal({ open: false, type: '', payload: null })}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '32px', textAlign: 'center' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <AlertCircle size={48} color="#f59e0b" style={{ margin: '0 auto 16px auto', display: 'block' }} />
                            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 12px 0', color: '#000' }}>{t('curator.confirm.title')}</h2>
                            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
                                {t(`curator.confirm.${confirmModal.type}`)}
                            </p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setConfirmModal({ open: false, type: '', payload: null })}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f1f5f9', color: '#0f172a', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                                >
                                    {t('curator.confirm.no')}
                                </button>
                                <button
                                    onClick={handleConfirmAction}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#000', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                                >
                                    {t('curator.confirm.yes')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}

function VideoCard({ video, selectedIds, handleSelectOne, setSelectedVideo, currentTab, handleSingleDownload, setUploadModal, handleMarkAsFinished }: any) {
    const { t } = useTranslation();
    return (
        <div
            style={{
                background: '#fff', borderRadius: '24px', border: selectedIds.includes(video.id) ? '2px solid #000' : '1px solid #e5e7eb',
                overflow: 'hidden', position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                display: 'flex', flexDirection: 'column'
            }}
            onClick={(e) => {
                if (video.status === 'FAIL') {
                    e.stopPropagation();
                    return;
                }
            }}
        >
            <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10 }}>
                {video.status !== 'FAIL' && (
                    <input
                        type="checkbox"
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        checked={selectedIds.includes(video.id)}
                        onChange={() => handleSelectOne(video.id)}
                    />
                )}
            </div>

            {/* Video Thumbnail / Player stub */}
            <div
                style={{ height: '200px', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: video.status === 'FAIL' ? 'not-allowed' : 'pointer' }}
                onClick={() => video.status === 'FAIL' ? null : setSelectedVideo(video)}
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

                    // 1. If Drive Link, try live thumbnail first (HD)
                    const driveThumb = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : null;

                    // 2. Fallback to cached thumbnail
                    const cachedThumb = video.videoThumbnailUrl;

                    return (
                        <>
                            <img
                                src={driveThumb || cachedThumb || `https://api.dicebear.com/7.x/notionists/svg?seed=${video.id}&backgroundColor=000000`}
                                alt=""
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    height: '100%',
                                    width: '100%',
                                    objectFit: 'cover',
                                    opacity: 0.5
                                }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src === driveThumb && cachedThumb) {
                                        target.src = cachedThumb;
                                    } else {
                                        target.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${video.id}&backgroundColor=000000`;
                                    }
                                }}
                            />
                        </>
                    );
                })()}
            </div>

            <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontWeight: 800, fontSize: '16px', color: '#000', margin: '0 0 4px 0' }}>{video.name}</h3>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, margin: '0 0 16px 0' }}>@{video.usernameTikTok}</p>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentTab === 'PENDING_CURATION' && (
                        <>
                            {video.videoReviewStatus === 'REVISION' && (
                                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '16px', fontSize: '12px', marginBottom: '8px', border: '1px solid #fee2e2' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <AlertCircle size={14} /> {t('curator.card.re_edit')}
                                        </div>
                                        <div style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>Terjemahan AI ✨</div>
                                    </div>
                                    <p style={{ margin: 0, fontWeight: 700, lineHeight: '1.4', fontSize: '13px', color: '#991b1b' }}>
                                        "{video.reviewNotes || 'No notes provided'}"
                                    </p>
                                    {video.reviewHistory && (video.reviewHistory as any[]).length > 0 && (
                                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #fecaca', fontSize: '11px', color: '#b91c1c', opacity: 0.8 }}>
                                            <strong>Reviewer:</strong> {(video.reviewHistory[video.reviewHistory.length - 1] as any).reviewerName}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={(e) => handleSingleDownload(video, e)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <Download size={14} /> {t('curator.card.draft')}
                                </button>
                                <button
                                    onClick={() => setUploadModal({ open: true, creator: video })}
                                    style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: '#000', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <Upload size={14} /> {t('curator.card.endorse')}
                                </button>
                            </div>
                            <button
                                onClick={(e) => handleMarkAsFinished(video.id, e)}
                                style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #10b981', background: '#ecfdf5', color: '#059669', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <CheckCircle size={14} /> {t('curator.card.finish')}
                            </button>
                        </>
                    )}
                    {currentTab === 'ENDORSED' && (
                        <>
                            {video.videoReviewStatus === 'APPROVED' ? (
                                <div style={{ background: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, textAlign: 'center', marginBottom: '4px' }}>
                                    <Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', marginTop: '-2px' }} />
                                    {t('curator.card.finished')}
                                </div>
                            ) : (
                                <div style={{ background: '#f1f5f9', color: '#64748b', padding: '10px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, textAlign: 'center', marginBottom: '4px' }}>
                                    <Loader2 size={14} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px', marginTop: '-2px' }} />
                                    {t('curator.card.waiting')}
                                </div>
                            )}

                            {(video.endorsedVideoUrl || video.videoUrl) && (
                                <button
                                    onClick={(e) => handleSingleDownload(video, e, true)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '2px solid #000', background: '#fff', color: '#000', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <Download size={14} /> {t('curator.card.download_final')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* FAIL Overlay */}
            {video.status === 'FAIL' && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 20,
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
        </div>
    );
}

function StatCard({ icon, label, value, color }: any) {
    return (
        <div style={{
            background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}>
            <div style={{
                width: '56px', height: '56px', borderRadius: '18px', background: color, display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: `0 8px 16px ${color}40`
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
