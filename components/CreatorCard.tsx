'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Clock,
    ArrowRight,
    MessageSquare,
    Video,
    CreditCard,
    Trash2,
    ArrowLeftRight,
    ExternalLink
} from 'lucide-react';
import { CreatorStatus } from '@prisma/client';

interface CreatorCardProps {
    creator: any;
    onClick: () => void;
    onOper?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    onShare?: (e: React.MouseEvent) => void;
    isSelected?: boolean;
    onSelect?: (e: React.MouseEvent) => void;
}

const statusColors: Record<string, { bg: string, text: string, color: string }> = {
    REACHOUT: { bg: 'rgba(243, 244, 246, 0.8)', text: '#374151', color: '#9CA3AF' },
    DEALING: { bg: 'rgba(254, 243, 199, 0.8)', text: '#92400E', color: '#F59E0B' },
    SAMPLING: { bg: 'rgba(219, 234, 254, 0.8)', text: '#1E40AF', color: '#3B82F6' },
    DRAFTING: { bg: 'rgba(224, 231, 255, 0.8)', text: '#3730A3', color: '#6366F1' },
    FINANCING: { bg: 'rgba(243, 232, 255, 0.8)', text: '#6B21A8', color: '#A855F7' },
    FINISHED: { bg: 'rgba(220, 252, 231, 0.8)', text: '#166534', color: '#22C55E' },
    MONITORING: { bg: 'rgba(0, 0, 0, 0.05)', text: '#000000', color: '#000000' },
    FAIL: { bg: 'rgba(254, 226, 226, 0.8)', text: '#991B1B', color: '#EF4444' }
};

export default function CreatorCard({ creator, onClick, onOper, onDelete, onShare, isSelected, onSelect }: CreatorCardProps) {
    const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${creator.usernameTikTok}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    const status = creator.status as CreatorStatus;
    const colorConfig = statusColors[status] || statusColors.REACHOUT;

    // Get unread count from API response
    const unreadCount = creator.unreadCount || 0;
    const hasUnread = unreadCount > 0;

    // Notification color theme
    const accentColor = '#6366F1'; // Indigo base
    const alertColor = '#10B981';  // Emerald for notifications (feels fresher than whatsapp green)
    const alertRGB = '16, 185, 129';

    const [isTinyMobile, setIsTinyMobile] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkRes = () => {
            setIsTinyMobile(window.innerWidth < 400);
            setIsMobile(window.innerWidth < 768);
        };
        checkRes();
        window.addEventListener('resize', checkRes);
        return () => window.removeEventListener('resize', checkRes);
    }, []);

    return (
        <motion.div
            onClick={onClick}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={!isMobile ? {
                y: -6,
                scale: 1.01,
                boxShadow: hasUnread
                    ? `0 20px 40px -10px rgba(${alertRGB}, 0.3), 0 0 0 1px rgba(${alertRGB}, 0.4)`
                    : '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
            } : { scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{
                background: hasUnread ? `linear-gradient(135deg, #fff 0%, rgba(${alertRGB}, 0.03) 100%)` : '#fff',
                borderRadius: '28px',
                padding: isTinyMobile ? '16px' : '22px',
                cursor: 'pointer',
                border: isSelected
                    ? '2px solid #000'
                    : (hasUnread ? `1.5px solid rgba(${alertRGB}, 0.3)` : '1px solid rgba(0,0,0,0.06)'),
                boxShadow: isSelected
                    ? '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    : (hasUnread
                        ? `0 10px 30px -5px rgba(${alertRGB}, 0.2)`
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.02)'),
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                width: '100%',
                boxSizing: 'border-box'
            }}
        >
            {/* Glowing Aura for unread */}
            {hasUnread && (
                <motion.div
                    animate={{
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.02, 1]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(circle at top right, rgba(${alertRGB}, 0.1) 0%, transparent 70%)`,
                        pointerEvents: 'none',
                        zIndex: 0
                    }}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    <div style={{
                        width: isTinyMobile ? '48px' : '56px',
                        height: isTinyMobile ? '48px' : '56px',
                        borderRadius: '20px',
                        background: '#f8f8f8',
                        padding: '4px',
                        border: '1px solid rgba(0,0,0,0.03)',
                        flexShrink: 0,
                        position: 'relative'
                    }}>
                        <img src={avatarUrl} alt={creator.usernameTikTok} style={{ width: '100%', height: '100%', borderRadius: '16px' }} />

                        {/* Status Dot for unread */}
                        {hasUnread && (
                            <div style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: alertColor,
                                border: '3px solid #fff',
                                boxShadow: `0 2px 4px rgba(${alertRGB}, 0.4)`
                            }} />
                        )}
                    </div>

                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: isTinyMobile ? '15px' : '17px',
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: '#111'
                            }}>
                                {creator.name}
                            </h3>
                            {hasUnread && (
                                <motion.div
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    style={{ width: '6px', height: '6px', borderRadius: '50%', background: alertColor }}
                                />
                            )}
                        </div>
                        <p style={{ margin: '2px 0 0 0', color: 'rgba(0,0,0,0.4)', fontSize: '12px', fontWeight: 600 }}>@{creator.usernameTikTok}</p>
                    </div>
                </div>

                <div style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: colorConfig.bg,
                    color: colorConfig.text,
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0
                }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colorConfig.text, opacity: 0.6 }} />
                    {status}
                </div>
            </div>

            {/* Middle Section: Stats & Info */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '4px 0',
                position: 'relative',
                zIndex: 1
            }}>
                {creator.videoUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(0,0,0,0.4)', fontSize: '11px', fontWeight: 700 }}>
                        <Video size={14} />
                        <span>Uploaded</span>
                    </div>
                )}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: hasUnread ? alertColor : 'rgba(0,0,0,0.4)',
                    fontSize: '11px',
                    fontWeight: 700
                }}>
                    <MessageSquare size={14} />
                    <span>{creator._count?.messages || 0}</span>
                    {hasUnread && (
                        <span style={{
                            background: alertColor,
                            color: '#fff',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            fontSize: '9px',
                            marginLeft: '2px'
                        }}>
                            +{unreadCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div style={{
                borderTop: '1px solid rgba(0,0,0,0.04)',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                zIndex: 1
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                        { icon: <ExternalLink size={14} />, action: onShare, color: '#f3f4f6', hover: '#000' },
                        { icon: <ArrowLeftRight size={14} />, action: onOper, color: '#f3f4f6', hover: '#000' },
                        { icon: <Trash2 size={14} />, action: onDelete, color: 'rgba(239,68,68,0.08)', hover: '#EF4444', textColor: '#EF4444' }
                    ].map((btn, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); btn.action?.(e); }}
                            style={{
                                border: 'none',
                                background: btn.color,
                                color: btn.textColor || 'rgba(0,0,0,0.4)',
                                padding: '8px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = btn.hover;
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = btn.color;
                                e.currentTarget.style.color = btn.textColor || 'rgba(0,0,0,0.4)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {btn.icon}
                        </button>
                    ))}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>
                    {new Date(creator.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </div>
            </div>

            {/* Progress Bar - Slim & Status Colored */}
            <div style={{
                height: '4px',
                background: 'rgba(0,0,0,0.03)',
                borderRadius: '10px',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 1
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(Object.keys(statusColors).indexOf(status) + 1) / Object.keys(statusColors).length * 100}%` }}
                    transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                    style={{
                        height: '100%',
                        background: colorConfig.color,
                        boxShadow: `0 0 10px ${colorConfig.color}44`,
                        borderRadius: '10px'
                    }}
                />
            </div>

            {/* CSS Keyframes for pulse animation */}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.05);
                        opacity: 0.9;
                    }
                }
            `}</style>
        </motion.div>
    );
}

function Tooltip({ children, title }: { children: React.ReactNode, title: string }) {
    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} title={title}>
            {children}
        </div>
    );
}
