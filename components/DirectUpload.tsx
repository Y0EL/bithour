'use client';

import { useState, useRef } from 'react';
import { Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react';
import { Button, TextField } from '@mui/material';
import { motion } from 'framer-motion';

interface DirectUploadProps {
    token: string;
    onSuccess: (videoUrl: string) => void;
    onError?: (error: string) => void;
    isMobile?: boolean;
}

export default function DirectUpload({ token, onSuccess, onError, isMobile = false }: DirectUploadProps) {
    const [driveLink, setDriveLink] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const submitDriveLink = async () => {
        if (!driveLink.trim()) return;

        setUploading(true);
        setError('');

        try {
            const res = await fetch(`/api/creator/session?token=${token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl: driveLink })
            });

            if (!res.ok) {
                throw new Error('Gagal mengirim link');
            }

            const updated = await res.json();
            onSuccess(updated.videoUrl);
            setDriveLink('');
            setUploading(false);

        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan');
            setUploading(false);
            onError?.(err.message);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px' }}>
                        <LinkIcon size={18} />
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700 }}>Google Drive Video Link</span>
                </div>

                <TextField
                    fullWidth
                    placeholder="https://drive.google.com/file/d/..."
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    disabled={uploading}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '16px',
                            background: '#fff',
                        }
                    }}
                />

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                    <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: 1.5 }}>
                        💡 <b>Tips:</b> Kamu bisa mengirimkan <b>link file video</b> atau <b>link folder</b>. Jika link folder, sistem akan otomatis memilih video terbaru. Pastikan akses sudah di-set ke <b>"Anyone with the link / Siapa saja yang memiliki link"</b>.
                    </p>
                </div>

                {error && (
                    <div style={{ padding: '12px', background: '#fee', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={16} color="#c00" />
                        <span style={{ fontSize: '13px', color: '#c00', fontWeight: 600 }}>{error}</span>
                    </div>
                )}

                <Button
                    fullWidth
                    variant="contained"
                    disabled={uploading || !driveLink.trim()}
                    onClick={submitDriveLink}
                    style={{
                        borderRadius: '16px',
                        padding: '14px',
                        background: driveLink.trim() ? '#000' : '#f3f4f6',
                        color: driveLink.trim() ? '#fff' : '#9ca3af',
                        fontWeight: 800,
                        textTransform: 'none',
                        boxShadow: 'none',
                        marginTop: '8px'
                    }}
                >
                    {uploading ? <Loader2 className="animate-spin" size={20} /> : 'Kirim Link Video'}
                </Button>
            </div>
        </div>
    );
}
