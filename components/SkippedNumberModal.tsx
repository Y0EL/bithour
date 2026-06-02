'use client';

import React from 'react';
import {
    Hash,
    ChevronRight,
    X,
    Sparkles,
    AlertCircle,
    Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SkippedNumberModalProps {
    open: boolean;
    onClose: () => void;
    skippedRefs: string[];
    skippedSeqs: string[];
    onSelectRef: (ref: string) => void;
    onSelectSeq: (seq: string) => void;
    onUseLatest: () => void;
    nextRef: string;
    nextSeq: string;
}

const SkippedNumberModal = ({
    open,
    onClose,
    skippedRefs,
    skippedSeqs,
    onSelectRef,
    onSelectSeq,
    onUseLatest,
    nextRef,
    nextSeq
}: SkippedNumberModalProps) => {
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (open) {
                if (e.key === 'Escape') onClose();
                if (e.key === 'Enter') onUseLatest();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose, onUseLatest]);

    return (
        <AnimatePresence>
            {open && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    display: 'grid',
                    placeItems: 'center',
                    padding: '40px 20px',
                    overflowY: 'auto'
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '28px',
                            width: '100%',
                            maxWidth: '460px',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '1px solid #f1f5f9',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '24px 24px 20px',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            position: 'relative',
                            borderBottom: '1px solid #e2e8f0'
                        }}>
                            <button
                                onClick={onClose}
                                style={{
                                    position: 'absolute',
                                    right: '20px',
                                    top: '20px',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '6px',
                                    cursor: 'pointer',
                                    color: '#64748b'
                                }}
                            >
                                <X size={16} />
                            </button>

                            <div style={{
                                width: '48px',
                                height: '48px',
                                background: 'white',
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                            }}>
                                <Hash size={24} color="#0f172a" />
                            </div>

                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                                Nomor yang Terlewat Ditemukan
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.4 }}>
                                Sistem mendeteksi urutan yang bisa digunakan kembali.
                            </p>
                        </div>

                        {/* Content Area - Scrollable */}
                        <div
                            className="no-scrollbar"
                            style={{
                                padding: '20px 24px',
                                maxHeight: 'min(50vh, 400px)',
                                overflowY: 'auto',
                                background: '#fff',
                                msOverflowStyle: 'none',
                                scrollbarWidth: 'none',
                            }}
                        >
                            <style jsx>{`
                            .no-scrollbar::-webkit-scrollbar {
                                display: none;
                            }
                        `}</style>
                            {/* REF GAPS */}
                            {skippedRefs.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>
                                        <AlertCircle size={12} /> Ref Terlewat (3-Digit)
                                    </label>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(65px, 1fr))',
                                        gap: '8px'
                                    }}>
                                        {skippedRefs.map(ref => (
                                            <button
                                                key={ref}
                                                onClick={() => onSelectRef(ref)}
                                                style={{
                                                    padding: '8px',
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    color: '#0f172a',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    textAlign: 'center'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = '#000';
                                                    e.currentTarget.style.background = '#fff';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                    e.currentTarget.style.background = '#f8fafc';
                                                }}
                                            >
                                                {ref}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SEQ GAPS */}
                            {skippedSeqs.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>
                                        <Clock size={12} /> Seq Terlewat (4-Digit)
                                    </label>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
                                        gap: '8px'
                                    }}>
                                        {skippedSeqs.map(seq => (
                                            <button
                                                key={seq}
                                                onClick={() => onSelectSeq(seq)}
                                                style={{
                                                    padding: '8px',
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    color: '#0f172a',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    textAlign: 'center'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = '#000';
                                                    e.currentTarget.style.background = '#fff';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                    e.currentTarget.style.background = '#f8fafc';
                                                }}
                                            >
                                                {seq}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer - Fixed Area */}
                        <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                            <button
                                onClick={onUseLatest}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    background: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '14px',
                                    fontSize: '14px',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    marginBottom: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Sparkles size={16} />
                                    <span>Gunakan Nomor Terbaru</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '8px', fontSize: '11px' }}>
                                    R: {nextRef} | S: {nextSeq}
                                    <ChevronRight size={12} />
                                </div>
                            </button>
                            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, textAlign: 'center', margin: 0 }}>
                                Hati-hati: Penomoran manual bisa menyebabkan tabrakan data.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SkippedNumberModal;