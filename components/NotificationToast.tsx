'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info';

interface NotificationToastProps {
    show: boolean;
    type: NotificationType;
    title: string;
    message: string;
    onClose: () => void;
    duration?: number;
}

export default function NotificationToast({ show, type, title, message, onClose, duration = 5000 }: NotificationToastProps) {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (show) {
            setIsAnimating(true);
            const timer = setTimeout(() => {
                handleClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [show, duration]);

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(onClose, 300);
    };

    if (!show && !isAnimating) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={20} className="text-green-500" />;
            case 'error': return <AlertCircle size={20} className="text-red-500" />;
            default: return <Info size={20} className="text-blue-500" />;
        }
    };

    const getStyles = () => {
        switch (type) {
            case 'success': return { background: '#f0fdf4', border: '1px solid #bbf7d0', titleColor: '#166534' };
            case 'error': return { background: '#fef2f2', border: '1px solid #fecaca', titleColor: '#991b1b' };
            default: return { background: '#eff6ff', border: '1px solid #bfdbfe', titleColor: '#1e40af' };
        }
    };

    const styles = getStyles();

    return (
        <div className={`notification-container ${isAnimating ? 'show' : 'hide'}`}>
            <div
                className="notification-card"
                style={{
                    background: styles.background,
                    border: styles.border,
                }}
            >
                <div className="notification-icon">
                    {getIcon()}
                </div>
                <div className="notification-content">
                    <h4 style={{ color: styles.titleColor }}>{title}</h4>
                    <p>{message}</p>
                </div>
                <button onClick={handleClose} className="notification-close">
                    <X size={16} />
                </button>
            </div>

            <style jsx>{`
                .notification-container {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 11000;
                    width: 90%;
                    max-width: 400px;
                    pointer-events: none;
                }
                
                .notification-card {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 16px;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    pointer-events: auto;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .notification-container.show .notification-card {
                    animation: slideInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                .notification-container.hide .notification-card {
                    animation: slideOutUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                @keyframes slideInDown {
                    from { transform: translateY(-40px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                @keyframes slideOutUp {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(-40px); opacity: 0; }
                }

                .notification-icon {
                    margin-top: 2px;
                }

                .notification-content {
                    flex: 1;
                }

                .notification-content h4 {
                    margin: 0 0 4px 0;
                    font-size: 14px;
                    font-weight: 800;
                }

                .notification-content p {
                    margin: 0;
                    font-size: 13px;
                    color: #666;
                    line-height: 1.4;
                }

                .notification-close {
                    background: transparent;
                    border: none;
                    color: #999;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .notification-close:hover {
                    background: rgba(0,0,0,0.05);
                    color: #333;
                }

                @media (max-width: 600px) {
                    .notification-container {
                        top: auto;
                        bottom: 32px;
                    }
                    @keyframes slideInDown {
                        from { transform: translateY(40px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    @keyframes slideOutUp {
                        from { transform: translateY(0); opacity: 1; }
                        to { transform: translateY(40px); opacity: 0; }
                    }
                }
            `}</style>
        </div>
    );
}
