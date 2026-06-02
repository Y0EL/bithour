'use client';

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Trash2, CheckCircle } from 'lucide-react';

interface SignaturePadProps {
    onSave: (signature: string | null) => void;
    defaultValue?: string | null;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, defaultValue }) => {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(!defaultValue);
    const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });

    // Update canvas size to match container EXACTLY - 1:1 SQUARE
    useEffect(() => {
        const updateCanvasSize = () => {
            if (containerRef.current) {
                // Use clientWidth to get width WITHOUT border/padding
                const width = containerRef.current.clientWidth;
                // Use 1:1 square aspect ratio as requested
                const height = width;

                // console.log('Container width:', width, 'Setting canvas:', width, 'x', height);
                setCanvasSize({ width, height });

                // Force canvas to redraw with new size
                if (sigCanvas.current) {
                    const canvas = sigCanvas.current.getCanvas();
                    canvas.width = width;
                    canvas.height = height;
                }
            }
        };

        // Initial size
        updateCanvasSize();

        // Update on resize with debounce
        let timeoutId: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(updateCanvasSize, 100);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    const clear = () => {
        sigCanvas.current?.clear();
        setIsEmpty(true);
        onSave(null);
    };

    const save = () => {
        if (sigCanvas.current?.isEmpty()) {
            alert('Please provide a signature first');
            return;
        }
        const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
        if (dataUrl) {
            onSave(dataUrl);
            setIsEmpty(false);
        }
    };

    return (
        <div className="input-group">
            <div
                ref={containerRef}
                style={{
                    border: '2px dashed #e2e8f0',
                    borderRadius: '16px',
                    background: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    padding: 0,
                }}
            >
                <SignatureCanvas
                    ref={sigCanvas}
                    penColor="#000"
                    minWidth={2.5}
                    maxWidth={5.0}
                    canvasProps={{
                        width: canvasSize.width,
                        height: canvasSize.height,
                        style: {
                            width: `${canvasSize.width}px`,
                            height: `${canvasSize.height}px`,
                            display: 'block',
                            touchAction: 'none',
                        }
                    }}
                    onEnd={() => {
                        setIsEmpty(false);
                        const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
                        onSave(dataUrl || null);
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '12px',
                        display: 'flex',
                        gap: '8px'
                    }}
                >
                    <button
                        type="button"
                        onClick={clear}
                        className="btn btn-outline"
                        style={{ padding: '8px 16px', height: 'auto', fontSize: '12px', background: 'white' }}
                    >
                        <Trash2 size={14} /> Hapus
                    </button>
                </div>
            </div>
            {!isEmpty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></div>
                    <p style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 600 }}>
                        Tanda Tangan Berhasil
                    </p>
                </div>
            )}
        </div>
    );
};


export default SignaturePad;
