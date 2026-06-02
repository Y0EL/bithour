// COMPLETE WORKING MOBILE SIDEBAR FIX
// Copy this to app/dashboard/layout.tsx

'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useMediaQuery, useTheme } from '@mui/material';
import {
    LayoutDashboard,
    FileText,
    FilePlus,
    Folder,
    Users,
    Menu,
    X,
    LogOut,
    Settings,
    ChevronRight,
    Link as LinkIcon,
    Mail,
    Plus,
    Database,
    Play,
    Activity,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useTranslation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['Creator Center', 'Documents', 'Analysis', 'Curation']);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mounted, setMounted] = useState(false);

    const sidebarWidth = isMobile ? 280 : (isCollapsed ? 80 : 280);

    useEffect(() => {
        setMounted(true);
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    if (!mounted || status === 'loading' || status === 'unauthenticated') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--background)'
            }}>
                <div style={{
                    fontSize: '18px',
                    color: 'var(--primary)',
                    fontWeight: 600,
                }}>
                    {!mounted ? '...' : (status === 'loading' ? t('common.loading') : t('common.redirecting'))}
                </div>
            </div>
        );
    }


    const user = session?.user as any;
    const userRole = user?.role || 'BD';

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupKey)
                ? prev.filter(k => k !== groupKey)
                : [...prev, groupKey]
        );
    };

    const menuGroups = [
        {
            title: t('sidebar.groups.Overview'),
            key: 'Overview',
            items: [
                { icon: <LayoutDashboard size={16} />, label: t('sidebar.dashboard'), href: '/dashboard' },
            ]
        },
        ...(userRole === 'ANALYST' || userRole === 'SYSTEM' || userRole === 'MANAGER'
            ? [
                {
                    title: t('sidebar.groups.Analysis'),
                    key: 'Analysis',
                    items: [
                        { icon: <Play size={16} />, label: t('sidebar.review_videos'), href: '/dashboard/review' },
                        { icon: <Activity size={16} />, label: t('sidebar.curator_results'), href: '/dashboard/review/curator' },
                    ]
                }
            ]
            : []),
        ...(userRole === 'CURATOR' || userRole === 'SYSTEM' || userRole === 'MANAGER'
            ? [
                {
                    title: t('sidebar.groups.Curation'),
                    key: 'Curation',
                    items: [
                        { icon: <Play size={16} />, label: t('sidebar.dashboard_curator'), href: '/dashboard/curator' },
                    ]
                }
            ]
            : []),
        ...((userRole !== 'ANALYST' && userRole !== 'CURATOR')
            ? [
                {
                    title: t('sidebar.creator_center'),
                    key: 'Creator Center',
                    items: [
                        { icon: <Plus size={16} />, label: t('sidebar.create_invoice'), href: '/dashboard/create-invoice' },
                        { icon: <Plus size={16} />, label: t('sidebar.create_mou'), href: '/dashboard/create-mou' },
                        { icon: <Users size={16} />, label: t('sidebar.creator_center'), href: '/dashboard/creators' },
                    ]
                }
            ]
            : []),
        ...((userRole !== 'ANALYST' && userRole !== 'CURATOR')
            ? [
                {
                    title: t('sidebar.documents'),
                    key: 'Documents',
                    items: [
                        { icon: <Folder size={16} />, label: t('sidebar.all_files'), href: '/dashboard/documents' },
                        { icon: <FileText size={16} />, label: t('sidebar.invoices'), href: '/dashboard/invoices' },
                        { icon: <FileText size={16} />, label: t('sidebar.mous'), href: '/dashboard/mou' },
                        { icon: <LinkIcon size={16} />, label: t('sidebar.sessions'), href: '/dashboard/sessions' },
                    ]
                }
            ]
            : []),
        {
            title: t('sidebar.preferences'),
            key: 'Preferences',
            items: [
                { icon: <Mail size={16} />, label: t('sidebar.messages'), href: '/dashboard/messages' },
                ...(userRole === 'SYSTEM' || userRole === 'MANAGER'
                    ? [
                        { icon: <Users size={16} />, label: t('sidebar.user_management'), href: '/dashboard/users' },
                        ...(userRole === 'SYSTEM'
                            ? [{ icon: <Database size={16} />, label: 'DB Lookup', href: '/dashboard/db-lookup' }]
                            : []
                        )
                    ]
                    : []),
                { icon: <Settings size={16} />, label: t('sidebar.settings'), href: '/dashboard/settings' },
            ]
        }
    ];

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.push('/');
    };

    const closeSidebar = () => {
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
            {/* Overlay - shows when sidebar open on mobile */}
            {sidebarOpen && isMobile && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 999,
                    }}
                />
            )}

            {/* Sidebar */}
            <div className={sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} style={{
                height: isCollapsed && !isMobile ? 'calc(100vh - 32px)' : '100vh',
                width: `${sidebarWidth}px`,
                background: isCollapsed && !isMobile ? 'rgba(10, 10, 10, 0.95)' : '#0a0a0a',
                backdropFilter: isCollapsed && !isMobile ? 'blur(20px)' : 'none',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                left: isCollapsed && !isMobile ? '16px' : 0,
                top: isCollapsed && !isMobile ? '16px' : 0,
                zIndex: 1000,
                boxShadow: isCollapsed && !isMobile ? '0 8px 32px rgba(0,0,0,0.4)' : '4px 0 24px rgba(0,0,0,0.1)',
                borderRadius: isCollapsed && !isMobile ? '24px' : '0',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                border: isCollapsed && !isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none',
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                background: 'white',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                overflow: 'hidden',
                                flexShrink: 0
                            }}>
                                <img src="/bithour-logo.webp" alt="Bithour" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                            </div>
                            <div style={{ opacity: isCollapsed && !isMobile ? 0 : 1, transition: 'opacity 0.3s' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', display: 'block', whiteSpace: 'nowrap' }}>Bithour</span>
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                            </div>
                        </div>
                        <button
                            onClick={() => isMobile ? setSidebarOpen(false) : setIsCollapsed(!isCollapsed)}
                            className="collapse-toggle-btn"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.3s'
                            }}
                        >
                            {isMobile ? <X size={20} /> : (isCollapsed ? <Menu size={20} /> : <ChevronRight style={{ transform: 'rotate(180deg)' }} size={20} />)}
                        </button>
                    </div>
                </div>

                {/* User Info */}
                {!isCollapsed || isMobile ? (
                    <div style={{
                        padding: '20px 24px',
                    }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '20px',
                            padding: '12px 16px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
                                    <img
                                        src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${user?.username || 'user'}`}
                                        alt="Avatar"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                                <div style={{ overflow: 'hidden', flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {user?.name || 'User'}
                                        <div title={t('sidebar.cloud_sync')} style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></div>
                                    </div>
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'rgba(255,255,255,0.5)',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.02em'
                                    }}>
                                        {t(`dashboard.roles.${userRole}`) === `dashboard.roles.${userRole}` ? userRole.replace(/_/g, ' ') : t(`dashboard.roles.${userRole}`)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
                            <img
                                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${user?.username || 'user'}`}
                                alt="Avatar"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav
                    className="no-scrollbar"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '0 16px',
                    }}
                >
                    {menuGroups.map((group, groupIdx) => (
                        <div
                            key={group.key}
                            style={{
                                marginBottom: '12px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '12px',
                                padding: '4px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                overflow: 'hidden'
                            }}
                        >
                            {(!isCollapsed || isMobile) && (
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.4)',
                                        fontSize: '9.5px',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t(`sidebar.groups.${group.key}`)}
                                    <ChevronRight
                                        size={12}
                                        style={{
                                            transform: expandedGroups.includes(group.key) ? 'rotate(90deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s'
                                        }}
                                    />
                                </button>
                            )}

                            {(expandedGroups.includes(group.key) || isCollapsed) && (
                                <div style={{ marginTop: (!isCollapsed || isMobile) ? '4px' : '0' }}>
                                    {group.items.map((item, index) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={index}
                                                href={item.href}
                                                onClick={closeSidebar}
                                                className="sidebar-link-item"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: (!isCollapsed || isMobile) ? 'flex-start' : 'center',
                                                    gap: '8px',
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    marginBottom: '2px',
                                                    textDecoration: 'none',
                                                    color: isActive ? '#000' : 'rgba(255,255,255,0.6)',
                                                    background: isActive ? '#fff' : 'transparent',
                                                    transition: 'all 0.15s ease',
                                                    fontSize: '12.5px',
                                                    fontWeight: isActive ? 700 : 500,
                                                    boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.1)' : 'none',
                                                    position: 'relative'
                                                }}
                                                title={(!isCollapsed || isMobile) ? '' : item.label}
                                            >
                                                <span style={{ opacity: isActive ? 1 : 0.7, display: 'flex', flexShrink: 0 }}>
                                                    {item.icon}
                                                </span>
                                                {(!isCollapsed || isMobile) && (
                                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* Logout */}
                <div style={{ padding: (!isCollapsed || isMobile) ? '24px' : '20px 0', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: (!isCollapsed || isMobile) ? '100%' : '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            padding: (!isCollapsed || isMobile) ? '14px 16px' : '12px',
                            borderRadius: '14px',
                            background: 'rgba(255,0,0,0.1)',
                            border: '1px solid rgba(255,0,0,0.1)',
                            color: '#ff4d4d',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                            transition: 'all 0.2s',
                        }}
                        title={(!isCollapsed || isMobile) ? '' : 'Logout'}
                    >
                        <LogOut size={18} />
                        {(!isCollapsed || isMobile) && <span>Logout</span>}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                marginLeft: isMobile ? 0 : `${sidebarWidth + (isCollapsed ? 32 : 0)}px`,
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }} className="main-content">
                {/* Mobile Top Bar */}
                <div className="mobile-topbar" style={{
                    display: 'none',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px 20px',
                    background: 'rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    borderBottom: '1px solid var(--border)',
                }}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        style={{
                            background: '#000',
                            border: 'none',
                            color: 'white',
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                    >
                        <Menu size={20} />
                    </button>
                    <div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bithour</span>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#000', letterSpacing: '-0.02em' }}>
                            Dashboard
                        </span>
                    </div>
                </div >

                {/* Page Content */}
                <main style={{
                    padding: isMobile ? '16px 12px 120px 12px' : '40px',
                    maxWidth: '1600px',
                    margin: '0 auto',
                    width: '100%',
                    boxSizing: 'border-box',
                    overflowX: 'hidden'
                }}>
                    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
                        {children}
                    </div>
                </main >
            </div >


            {/* Mobile CSS */}
            < style jsx global > {`
        /* Hide X button on desktop */
        .mobile-close-btn {
          display: none;
        }
        
        @media (max-width: 900px) {
          /* Remove left margin on mobile */
          .main-content {
            margin-left: 0 !important;
          }
          
          /* Show mobile topbar */
          .mobile-topbar {
            display: flex !important;
          }
          
          /* Hide sidebar offscreen by default */
          .sidebar-closed {
            transform: translateX(-100%) !important;
          }
          
          /* Show sidebar when open */
          .sidebar-open {
            transform: translateX(0) !important;
          }
          
          .collapse-toggle-btn {
            background: transparent !important;
            border: none !important;
          }
        }
        
        /* Hide scrollbars everywhere but keep functionality */
        .no-scrollbar::-webkit-scrollbar,
        nav::-webkit-scrollbar,
        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          display: none !important;
        }

        .no-scrollbar, nav, html, body {
          -ms-overflow-style: none !important;  /* IE and Edge */
          scrollbar-width: none !important;  /* Firefox */
        }
      `}</style >
        </div>
    );
}
