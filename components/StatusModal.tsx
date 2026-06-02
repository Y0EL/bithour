import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StatusModalProps {
    open: boolean;
    title: string;
    message: React.ReactNode;
    type?: 'success' | 'error' | 'info' | 'confirm';
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
}

export default function StatusModal({
    open,
    title,
    message,
    type = 'info',
    onClose,
    onConfirm,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    loading = false
}: StatusModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (open) {
                if (e.key === 'Escape') onClose();
                if (e.key === 'Enter' && !loading) (onConfirm || onClose)();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose, onConfirm, loading]);

    return (
        <AnimatePresence>
            {open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        style={{
                            maxWidth: '400px',
                            width: '100%',
                            padding: '32px',
                            background: 'white',
                            borderRadius: '24px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                            textAlign: 'center',
                            position: 'relative'
                        }}
                    >
                        <button
                            onClick={onClose}
                            style={{ position: 'absolute', right: '16px', top: '16px', border: 'none', background: 'none', color: '#999', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '20px',
                            background: type === 'success' ? '#f0fdf4' : type === 'error' ? '#fef2f2' : (type === 'confirm' ? '#fff7ed' : '#eff6ff'),
                            color: type === 'success' ? '#166534' : type === 'error' ? '#991b1b' : (type === 'confirm' ? '#9a3412' : '#1e40af'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            {type === 'success' ? <CheckCircle size={32} /> : type === 'error' ? <AlertTriangle size={32} /> : (type === 'confirm' ? <AlertTriangle size={32} /> : <Clock size={32} />)}
                        </div>

                        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: '#111' }}>{title}</h2>
                        <div style={{ color: '#666', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>{message}</div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            {type === 'confirm' && (
                                <button
                                    onClick={onClose}
                                    style={{ flex: 1, background: '#f3f4f6', color: '#4b5563', border: 'none', height: '48px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {cancelText}
                                </button>
                            )}
                            <button
                                onClick={onConfirm || onClose}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    background: type === 'error' ? '#ef4444' : (type === 'confirm' ? '#ea580c' : '#000'),
                                    color: 'white',
                                    border: 'none',
                                    height: '48px',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading ? 'Processing...' : (type === 'confirm' ? confirmText : 'Understood')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
