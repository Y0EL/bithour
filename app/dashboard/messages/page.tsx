'use client';

import { useState, useEffect } from 'react';
import {
    Mail,
    MailOpen,
    Bell,
    Trash2,
    CheckCircle,
    Clock,
    Loader2,
    AlertCircle,
    Info,
    Sparkles,
    XCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';

export default function MessagesPage() {
    const { t } = useTranslation();
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role;

    if (userRole === 'ANALYST') {
        return (
            <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff', borderRadius: '32px', border: '1px solid #f1f5f9', marginTop: '40px' }}>
                <div style={{ width: '80px', height: '80px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <XCircle size={40} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', marginBottom: '12px' }}>Akses Terbatas</h2>
                <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    Role <b>Analyst</b> tidak memiliki izin untuk melihat pesan.
                </p>
            </div>
        );
    }
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/messages/list');
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleRead = async (id: string, currentRead: boolean) => {
        try {
            await fetch('/api/messages/list', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isRead: !currentRead })
            });
            setMessages(messages.map((m: any) =>
                m.id === id ? { ...m, isRead: !currentRead } : m
            ));
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const unreadCount = Array.isArray(messages) ? messages.filter((m: any) => !m.isRead).length : 0;

    return (
        <div style={{ padding: '0px', maxWidth: '900px', margin: '0 auto' }}>
            {/* Compact Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(24px, 5vw, 28px)', fontWeight: 800, marginBottom: '2px', color: '#111' }}>
                        {t('messages.title')}
                    </h1>
                    <p style={{ color: '#666', fontSize: '13px', fontWeight: 500 }}>
                        {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <div style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        background: '#000',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }}>
                        <Bell size={14} />
                        {unreadCount}
                    </div>
                )}
            </div>

            {/* Compact Message List */}
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                        <Loader2 className="animate-spin" size={32} style={{ color: '#000', margin: '0 auto' }} />
                        <p style={{ marginTop: '12px', color: '#999', fontSize: '13px', fontWeight: 600 }}>Loading...</p>
                    </div>
                ) : (!Array.isArray(messages) || messages.length === 0) ? (
                    <div style={{
                        padding: '60px 24px',
                        textAlign: 'center',
                        background: '#fafafa',
                        borderRadius: '16px',
                        border: '1px solid #eee'
                    }}>
                        <Sparkles size={40} style={{ margin: '0 auto 12px', opacity: 0.3, color: '#999' }} />
                        <p style={{ fontSize: '14px', color: '#666', fontWeight: 600 }}>No messages yet</p>
                        <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Your inbox is empty</p>
                    </div>
                ) : (
                    messages.map((msg: any) => (
                        <div
                            key={msg.id}
                            onClick={() => !msg.isRead && toggleRead(msg.id, false)}
                            style={{
                                padding: '14px 16px',
                                background: msg.isRead ? '#fafafa' : 'white',
                                borderRadius: '12px',
                                border: msg.isRead ? '1px solid #f0f0f0' : '2px solid #000',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            className="message-card"
                        >
                            {/* Unread Indicator */}
                            {!msg.isRead && (
                                <div style={{
                                    position: 'absolute',
                                    top: '14px',
                                    right: '14px',
                                    width: '8px',
                                    height: '8px',
                                    background: '#000',
                                    borderRadius: '50%'
                                }} />
                            )}

                            {/* Header Row */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                                {/* Icon */}
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: msg.type === 'ALERT' ? '#fee2e2' : '#f5f5f5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {msg.type === 'ALERT' ? (
                                        <AlertCircle size={15} style={{ color: '#ef4444' }} />
                                    ) : (
                                        <Info size={15} style={{ color: '#000' }} />
                                    )}
                                </div>

                                {/* Title & Time */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        margin: 0,
                                        color: msg.isRead ? '#666' : '#111',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        paddingRight: '20px'
                                    }}>
                                        {msg.title}
                                    </h3>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '11px',
                                        color: '#999',
                                        marginTop: '2px',
                                        fontWeight: 600
                                    }}>
                                        <Clock size={11} />
                                        {new Date(msg.createdAt).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <p style={{
                                color: msg.isRead ? '#999' : '#555',
                                fontSize: '13px',
                                lineHeight: 1.5,
                                marginLeft: '38px',
                                marginBottom: '8px',
                                marginTop: '4px',
                                fontWeight: 500
                            }}>
                                {msg.content}
                            </p>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginLeft: '38px' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleRead(msg.id, msg.isRead); }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: msg.isRead ? '#999' : '#000',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        transition: 'all 0.15s'
                                    }}
                                    className="mark-btn"
                                >
                                    {msg.isRead ? (
                                        <><Mail size={12} /> Mark Unread</>
                                    ) : (
                                        <><CheckCircle size={12} /> Mark Read</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
                .message-card:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
                }
                .mark-btn:hover {
                    background: rgba(0, 0, 0, 0.05) !important;
                }
                .animate-in {
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
