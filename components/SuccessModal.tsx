'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { Button, IconButton } from '@mui/material';

interface SuccessModalProps {
    show: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

export default function SuccessModal({ show, title, message, onClose }: SuccessModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (show) {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [show, onClose]);

    return (
        <AnimatePresence>
            {show && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 15000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(4px)'
                }}>
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        style={{
                            background: '#fff',
                            borderRadius: '24px',
                            padding: '32px',
                            maxWidth: '400px',
                            width: '100%',
                            textAlign: 'center',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                            position: 'relative'
                        }}
                    >
                        <IconButton
                            onClick={onClose}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.03)' }}
                        >
                            <X size={18} />
                        </IconButton>

                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: '#f0fdf4',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px',
                            color: '#22c55e'
                        }}>
                            <CheckCircle2 size={36} />
                        </div>

                        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 800, color: '#000' }}>{title}</h3>
                        <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: 'rgba(0,0,0,0.5)', lineHeight: 1.5 }}>{message}</p>

                        <Button
                            fullWidth
                            variant="contained"
                            onClick={onClose}
                            style={{
                                background: '#000',
                                color: '#fff',
                                borderRadius: '12px',
                                padding: '12px',
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '16px'
                            }}
                        >
                            Got it
                        </Button>
                        <p style={{ marginTop: '16px', fontSize: '11px', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>Press Enter to close</p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
