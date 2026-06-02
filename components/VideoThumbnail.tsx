'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, Image as ImageIcon } from 'lucide-react';

interface VideoThumbnailProps {
    src: string;
    thumbnailUrl?: string | null;
}

export default function VideoThumbnail({ src, thumbnailUrl }: VideoThumbnailProps) {
    const [thumbnail, setThumbnail] = useState<string | null>(thumbnailUrl || null);
    const [loading, setLoading] = useState(!thumbnailUrl);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // If we already have a pre-generated thumbnail, don't do client-side extraction
        if (thumbnailUrl) {
            setThumbnail(thumbnailUrl);
            setLoading(false);
            return;
        }

        const video = videoRef.current;
        if (!video) return;

        const handleCanPlay = () => {
            video.currentTime = 1;
        };

        const handleSeeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    setThumbnail(canvas.toDataURL('image/jpeg', 0.8));
                }
            } catch (err) {
                console.error('Failed to capture frame:', err);
            } finally {
                setLoading(false);
            }
        };

        const handleError = () => {
            setLoading(false);
        };

        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('seeked', handleSeeked);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('error', handleError);
        };
    }, [src, thumbnailUrl]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a0a0a', overflow: 'hidden' }}>
            {/* Minimal hidden video element for client-side fallback */}
            {!thumbnailUrl && (
                <video
                    ref={videoRef}
                    src={src}
                    preload="metadata"
                    muted
                    playsInline
                    style={{ display: 'none' }}
                />
            )}

            {thumbnail ? (
                <img
                    src={thumbnail}
                    alt="Preview"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        animation: 'fadeIn 0.4s ease'
                    }}
                />
            ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                    {loading ? (
                        <Loader2 className="animate-spin" size={24} color="rgba(255,255,255,0.2)" />
                    ) : (
                        <ImageIcon size={32} color="rgba(255,255,255,0.1)" />
                    )}
                </div>
            )}

            {/* Premium Hover Overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(2px)'
            }} className="thumbnail-overlay">
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'scale(0.8)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }} className="play-btn">
                    <Play size={24} fill="#000" color="#000" style={{ marginLeft: '4px' }} />
                </div>
            </div>

            <style jsx>{`
                div:hover .thumbnail-overlay { opacity: 1; }
                div:hover .play-btn { transform: scale(1); }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
