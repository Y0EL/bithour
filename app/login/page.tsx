'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, AlertCircle, Clock, Sparkles, KeyRound } from 'lucide-react';

type LoginMode = 'staff' | 'creator';

export default function LoginPage() {
    const { status } = useSession();
    const [mode, setMode] = useState<LoginMode>('staff');

    // Staff login state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);

    // Creator login state
    const [creatorToken, setCreatorToken] = useState('');
    const [creatorError, setCreatorError] = useState('');
    const [creatorLoading, setCreatorLoading] = useState(false);
    const [creatorShake, setCreatorShake] = useState(false);

    const router = useRouter();

    useEffect(() => {
        if (status === 'authenticated') {
            router.push('/dashboard');
        }
    }, [status, router]);

    useEffect(() => {
        const savedAttempts = localStorage.getItem('login_attempts');
        const savedLockout = localStorage.getItem('lockout_until');
        if (savedAttempts) setAttempts(parseInt(savedAttempts));
        if (savedLockout) {
            const until = parseInt(savedLockout);
            if (until > Date.now()) {
                setLockoutUntil(until);
                setTimeLeft(Math.ceil((until - Date.now()) / 1000));
            }
        }
    }, []);

    useEffect(() => {
        if (!lockoutUntil) return;
        const interval = setInterval(() => {
            const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            if (remaining <= 0) {
                setLockoutUntil(null);
                setTimeLeft(0);
                localStorage.removeItem('lockout_until');
                clearInterval(interval);
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [lockoutUntil]);

    // Reset errors when switching mode
    useEffect(() => {
        setError('');
        setCreatorError('');
    }, [mode]);

    const getLockoutDuration = (failedAttempts: number) => {
        if (failedAttempts < 3) return 0;
        if (failedAttempts === 3) return 5;
        if (failedAttempts === 4) return 10;
        if (failedAttempts === 5) return 30;
        if (failedAttempts === 6) return 60;
        if (failedAttempts === 7) return 300;
        if (failedAttempts === 8) return 1800;
        return 3600;
    };

    const formatTimeLeft = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins < 60) return `${mins}m ${secs}s`;
        const hrs = Math.floor(mins / 60);
        const rmins = mins % 60;
        return `${hrs}h ${rmins}m`;
    };

    const handleStaffSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (lockoutUntil && Date.now() < lockoutUntil) return;
        setError('');
        setLoading(true);
        try {
            const result = await signIn('credentials', { username, password, redirect: false });
            if (result?.error) {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                localStorage.setItem('login_attempts', newAttempts.toString());
                setShake(true);
                setTimeout(() => setShake(false), 500);
                const duration = getLockoutDuration(newAttempts);
                if (duration > 0) {
                    const until = Date.now() + duration * 1000;
                    setLockoutUntil(until);
                    setTimeLeft(duration);
                    localStorage.setItem('lockout_until', until.toString());
                    setError(`${result.error}. Percobaan ke-${newAttempts}. Tunggu ${formatTimeLeft(duration)} sebelum coba lagi.`);
                } else {
                    setError(result.error);
                }
            } else if (result?.ok) {
                setAttempts(0);
                setLockoutUntil(null);
                localStorage.removeItem('login_attempts');
                localStorage.removeItem('lockout_until');
                router.push('/dashboard');
            }
        } catch {
            setError('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatorSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!creatorToken.trim()) return;
        setCreatorError('');
        setCreatorLoading(true);
        try {
            const res = await fetch(`/api/creator/session?token=${encodeURIComponent(creatorToken.trim())}`);
            if (!res.ok) throw new Error('not_found');
            const creator = await res.json();
            if (!creator?.usernameTikTok) throw new Error('not_found');
            router.push(`/creator/s/${creator.usernameTikTok}/${creatorToken.trim()}`);
        } catch {
            setCreatorShake(true);
            setTimeout(() => setCreatorShake(false), 500);
            setCreatorError('Kode akses tidak valid atau sudah kadaluarsa.');
        } finally {
            setCreatorLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fafafa',
            padding: '16px',
        }}>
            <div
                className={(mode === 'staff' ? shake : creatorShake) ? 'shake-animation' : ''}
                style={{
                    width: '100%',
                    maxWidth: '460px',
                    background: 'white',
                    borderRadius: '20px',
                    padding: '32px 24px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
            >
                {/* Logo/Header */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '80px', height: '80px', margin: '0 auto 16px',
                        background: 'white', borderRadius: '20px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden'
                    }}>
                        <img src="/bithour-logo.webp" alt="Bithour Production" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#000', marginBottom: '4px', letterSpacing: '-0.5px', lineHeight: 1.3 }}>
                        Bithour Production
                    </h1>
                    <p style={{ color: '#666', fontSize: '14px', fontWeight: 500, lineHeight: 1.4, margin: 0 }}>
                        {mode === 'staff' ? 'Masuk ke akun Anda untuk melanjutkan' : 'Masuk ke portal kreator Anda'}
                    </p>
                </div>

                {/* Mode Toggle */}
                <div style={{
                    display: 'flex', background: '#f1f5f9', borderRadius: '12px',
                    padding: '4px', marginBottom: '24px', gap: '4px'
                }}>
                    {(['staff', 'creator'] as LoginMode[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            style={{
                                flex: 1, padding: '9px 12px', borderRadius: '9px', border: 'none',
                                cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                                transition: 'all 0.2s',
                                background: mode === m ? '#fff' : 'transparent',
                                color: mode === m ? '#000' : '#64748b',
                                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}
                        >
                            {m === 'staff' ? <User size={14} /> : <Sparkles size={14} />}
                            {m === 'staff' ? 'Tim Internal' : 'Kreator'}
                        </button>
                    ))}
                </div>

                {/* ── STAFF LOGIN ── */}
                {mode === 'staff' && (
                    <>
                        {lockoutUntil && (
                            <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: '#f97316', color: 'white', padding: '6px', borderRadius: '8px' }}>
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <div style={{ color: '#9a3412', fontSize: '13px', fontWeight: 800 }}>TERKUNCI SEMENTARA</div>
                                    <div style={{ color: '#c2410c', fontSize: '12px', fontWeight: 600 }}>Coba lagi dalam {formatTimeLeft(timeLeft)}</div>
                                </div>
                            </div>
                        )}
                        {error && !lockoutUntil && (
                            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={20} color="#dc2626" />
                                <span style={{ color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>{error}</span>
                            </div>
                        )}
                        <form onSubmit={handleStaffSubmit} style={{ opacity: lockoutUntil ? 0.6 : 1, pointerEvents: lockoutUntil ? 'none' : 'auto' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#333' }}>Username</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Masukkan username"
                                        style={{ width: '100%', padding: '12px 12px 12px 42px', fontSize: '15px', border: '2px solid #e0e0e0', borderRadius: '10px', transition: 'all 0.3s', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={(e) => e.target.style.borderColor = '#000'}
                                        onBlur={(e) => e.target.style.borderColor = '#e0e0e0'} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#333' }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Masukkan password"
                                        style={{ width: '100%', padding: '12px 12px 12px 42px', fontSize: '15px', border: '2px solid #e0e0e0', borderRadius: '10px', transition: 'all 0.3s', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={(e) => e.target.style.borderColor = '#000'}
                                        onBlur={(e) => e.target.style.borderColor = '#e0e0e0'} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#666', fontWeight: 600 }}>
                                    <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: '#000' }} />
                                    Remember Me
                                </label>
                            </div>
                            <button type="submit" disabled={loading || !!lockoutUntil}
                                style={{ width: '100%', height: '52px', fontSize: '15px', fontWeight: 700, color: 'white', background: (loading || lockoutUntil) ? '#94a3b8' : '#000', border: 'none', borderRadius: '12px', cursor: (loading || lockoutUntil) ? 'not-allowed' : 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: (loading || lockoutUntil) ? 'none' : '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                                {loading && <div className="spinner" />}
                                {lockoutUntil ? (<><Clock size={18} />{formatTimeLeft(timeLeft)}</>) : (loading ? 'MEMPROSES...' : 'MASUK KE DASHBOARD')}
                            </button>
                        </form>
                    </>
                )}

                {/* ── CREATOR LOGIN ── */}
                {mode === 'creator' && (
                    <>
                        {creatorError && (
                            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={20} color="#dc2626" />
                                <span style={{ color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>{creatorError}</span>
                            </div>
                        )}
                        <form onSubmit={handleCreatorSubmit}>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#333' }}>Kode Akses</label>
                                <div style={{ position: 'relative' }}>
                                    <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                                    <input type="text" value={creatorToken} onChange={(e) => setCreatorToken(e.target.value)} required placeholder="Kode yang diberikan tim Bithour"
                                        style={{ width: '100%', padding: '12px 12px 12px 42px', fontSize: '15px', border: '2px solid #e0e0e0', borderRadius: '10px', transition: 'all 0.3s', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.03em' }}
                                        onFocus={(e) => e.target.style.borderColor = '#000'}
                                        onBlur={(e) => e.target.style.borderColor = '#e0e0e0'} />
                                </div>
                                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                                    Kode akses diberikan oleh tim Bithour Production saat onboarding.
                                </p>
                            </div>
                            <button type="submit" disabled={creatorLoading || !creatorToken.trim()}
                                style={{ width: '100%', height: '52px', fontSize: '15px', fontWeight: 700, color: 'white', background: (creatorLoading || !creatorToken.trim()) ? '#94a3b8' : '#000', border: 'none', borderRadius: '12px', cursor: (creatorLoading || !creatorToken.trim()) ? 'not-allowed' : 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: (!creatorLoading && creatorToken.trim()) ? '0 10px 15px -3px rgba(0,0,0,0.1)' : 'none' }}>
                                {creatorLoading && <div className="spinner" />}
                                {creatorLoading ? 'MEMVERIFIKASI...' : 'MASUK KE PORTAL KREATOR'}
                            </button>
                        </form>
                    </>
                )}

                {/* Footer */}
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <Link href="/" style={{ color: '#64748b', fontSize: '14px', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}>
                        Kembali ke Beranda
                    </Link>
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 480px) {
                    body { font-size: 14px; }
                    input { font-size: 16px !important; }
                }
                .shake-animation {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
                .spinner {
                    width: 18px; height: 18px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top: 2px solid white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
