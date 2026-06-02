'use client';

import React, { useState } from 'react';
import { CheckCircle, Copy, Share2, X, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SessionSuccessModalProps {
    open: boolean;
    onClose: () => void;
    url: string | null;
    creatorName: string;
}

export default function SessionSuccessModal({ open, onClose, url, creatorName }: SessionSuccessModalProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (open && url) {
                if (e.key === 'Escape' || e.key === 'Enter') onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, url, onClose]);

    if (!open || !url) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        const text = `Halo ${creatorName}, ini adalah link untuk tanda tangan dokumen Anda: ${url}\n\nSilakan dibuka dan ditandatangani segera ya. Terima kasih!`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', backdropFilter: 'blur(8px)' }}>
            <div style={{
                maxWidth: '450px',
                width: '100%',
                padding: '32px',
                background: 'white',
                borderRadius: '32px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                textAlign: 'center',
                position: 'relative',
                animation: 'modalSlideUp 0.3s ease-out'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '20px', top: '20px', border: 'none', background: 'rgba(0,0,0,0.05)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', cursor: 'pointer' }}
                >
                    <X size={18} />
                </button>

                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '24px',
                    background: '#f0fdf4',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    boxShadow: '0 8px 16px rgba(16, 185, 129, 0.1)'
                }}>
                    <CheckCircle size={40} />
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: '#111' }}>{t('documents.session_modal.title')}</h2>
                <p style={{ color: '#666', fontSize: '15px', lineHeight: '1.5', marginBottom: '32px' }}>
                    {t('documents.session_modal.subtitle', { name: creatorName })}
                </p>

                <div style={{
                    background: '#f9fafb',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid #e5e7eb',
                    marginBottom: '24px',
                    textAlign: 'left'
                }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                        {t('documents.session_modal.label_link')}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{
                            flex: 1,
                            fontSize: '13px',
                            color: '#4b5563',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: 500
                        }}>
                            {url}
                        </div>
                        <button
                            onClick={handleCopy}
                            style={{
                                background: copied ? '#10b981' : '#111',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                minWidth: '90px',
                                justifyContent: 'center'
                            }}
                        >
                            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                            {copied ? t('documents.session_modal.btn_copied') : t('documents.session_modal.btn_copy')}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={handleWhatsApp}
                        style={{
                            width: '100%',
                            background: '#25D366',
                            color: 'white',
                            border: 'none',
                            height: '56px',
                            borderRadius: '16px',
                            fontWeight: 700,
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s, background 0.2s'
                        }}
                    >
                        <MessageCircle size={22} fill="white" />
                        {t('documents.session_modal.btn_share')}
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            color: '#666',
                            border: '1px solid #e5e7eb',
                            height: '50px',
                            borderRadius: '16px',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        {t('documents.session_modal.btn_done')}
                    </button>
                </div>
            </div>
            <style jsx>{`
                @keyframes modalSlideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
