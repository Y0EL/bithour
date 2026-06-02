'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Info, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SequenceSetupModalProps {
    open: boolean;
    type: 'INVOICE' | 'MOU';
    category: string;
    onSuccess: (newRef: string, newSeq: string) => void;
}

export default function SequenceSetupModal({ open, type, category, onSuccess }: SequenceSetupModalProps) {
    const [lastRef, setLastRef] = useState<string>('');
    const [lastSeq, setLastSeq] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (open) {
                if (e.key === 'Escape') onSuccess('001', '0001');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onSuccess]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const numRef = parseInt(lastRef);
            if (isNaN(numRef)) throw new Error('Mohon masukkan angka Ref yang valid.');

            const numSeq = parseInt(lastSeq);
            if (isNaN(numSeq)) throw new Error('Mohon masukkan angka Sequence yang valid.');

            const res = await fetch('/api/users/sequence-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    category,
                    lastRef: numRef,
                    lastSeq: numSeq
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Increment for the NEXT available number
            const nextRefNum = (numRef + 1).toString().padStart(3, '0');
            const nextSeqNum = (numSeq + 1).toString().padStart(4, '0');
            onSuccess(nextRefNum, nextSeqNum);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        style={{
                            maxWidth: '450px',
                            width: '100%',
                            padding: '32px',
                            background: 'white',
                            borderRadius: '24px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '20px',
                                background: '#eff6ff',
                                color: '#1e40af',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <Settings size={32} />
                            </div>
                            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111' }}>Inisialisasi Nomor Urut</h2>
                            <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
                                Kami tidak menemukan riwayat report kamu untuk <strong>{type}</strong> tipe <strong>{category}</strong>. Silahkan masukkan nomor ref terakhir kamu.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#444' }}>
                                        Terakhir (Ref 3-Digit)
                                    </label>
                                    <input
                                        type="number"
                                        value={lastRef}
                                        onChange={(e) => setLastRef(e.target.value)}
                                        placeholder="Misal: 080"
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            borderRadius: '12px',
                                            border: '2px solid #eee',
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            outline: 'none'
                                        }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#444' }}>
                                        Terakhir (Seq 4-Digit)
                                    </label>
                                    <input
                                        type="number"
                                        value={lastSeq}
                                        onChange={(e) => setLastSeq(e.target.value)}
                                        placeholder="Misal: 0013"
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            borderRadius: '12px',
                                            border: '2px solid #eee',
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            outline: 'none'
                                        }}
                                        required
                                    />
                                </div>
                            </div>
                            {error && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '-16px', marginBottom: '16px' }}>{error}</p>}

                            <div style={{
                                background: '#f8fafc',
                                padding: '16px',
                                borderRadius: '16px',
                                display: 'flex',
                                gap: '12px',
                                marginBottom: '24px',
                                border: '1px solid #e2e8f0'
                            }}>
                                <Info size={20} style={{ color: '#64748b', flexShrink: 0 }} />
                                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                                    <strong>Tips:</strong> Jika kamu ragu, silahkan cek di Google Sheets atau tanya ke <strong>Tim Leader</strong> kamu untuk angka terakhir yang kamu gunakan.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    background: '#000',
                                    color: 'white',
                                    height: '52px',
                                    borderRadius: '14px',
                                    fontWeight: 700,
                                    fontSize: '16px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Simpan & Lanjutkan'}
                            </button>

                            <button
                                type="button"
                                onClick={() => onSuccess('001', '0001')} // Default to 001/0001 if skipped
                                style={{
                                    width: '100%',
                                    background: 'none',
                                    color: '#666',
                                    marginTop: '12px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                Lewati (Mulai dari 001 & 0001)
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
