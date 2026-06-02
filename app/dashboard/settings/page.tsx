'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
    Settings,
    Lock,
    User,
    Mail,
    AtSign,
    ShieldCheck,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    RefreshCw,
    TrendingUp,
    Eye,
    EyeOff,
    Languages
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface ChangeRequest {
    id: string;
    type: 'NAME' | 'USERNAME';
    requestedValue: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    user: {
        fullName: string;
        username: string;
        email: string;
    };
}


export default function SettingsPage() {
    const { data: session, update } = useSession();
    const { t } = useTranslation();
    const currentUser = session?.user as any;
    const isAdmin = currentUser?.role === 'SYSTEM' || currentUser?.role === 'MANAGER';

    // State for Password Change
    const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    // State for Requests
    const [profileData, setProfileData] = useState({ fullName: currentUser?.name || '', username: currentUser?.username || '' });
    const [profileLoading, setProfileLoading] = useState(false);

    // Admin state
    const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
    const [adminLoading, setAdminLoading] = useState(false);

    // General feedback
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);


    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setPasswordLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch('/api/settings/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(passwordData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('Password updated successfully!');
            setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleRequestChange = async (type: 'NAME' | 'USERNAME') => {
        const requestedValue = type === 'NAME' ? profileData.fullName : profileData.username;

        if (type === 'NAME' && requestedValue === currentUser?.name) return;
        if (type === 'USERNAME' && requestedValue === currentUser?.username) return;

        setProfileLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // ADMINS UPDATE DIRECTLY
            if (isAdmin) {
                const res = await fetch('/api/settings/admin-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        [type === 'NAME' ? 'fullName' : 'username']: requestedValue
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setSuccess(`Profile updated successfully! Please refresh to see changes.`);
                // We might need to call update() from next-auth but that requires careful config
            } else {
                // REGULAR USERS SUBMIT REQUEST
                const res = await fetch('/api/settings/request-change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, requestedValue }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setSuccess(`Change request for ${type.toLowerCase()} submitted. Admin approval required.`);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProfileLoading(false);
        }
    };


    return (
        <div className="grid gap-8 animate-in">
            <div className="flex-responsive" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>{t('settings.title') || 'Security & Account'}</h1>
                    <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('settings.subtitle') || 'Manage your credentials and personal information'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                        padding: '8px 16px',
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: 700
                    }}>
                        {t('settings.role') || 'Role'}: {currentUser?.role?.replace(/_/g, ' ')}
                    </span>
                </div>
            </div>

            {error && (
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', borderRadius: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertCircle size={18} />
                    <span style={{ fontWeight: 600 }}>{error}</span>
                </div>
            )}

            {success && (
                <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontWeight: 600 }}>{success}</span>
                </div>
            )}

            <div className="grid grid-cols-2">
                {/* ACCOUNT PROFILE */}
                <div className="glass-card" style={{ padding: '32px' }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={20} color="var(--accent)" /> {t('settings.profile_info') || 'Profile Information'}
                    </h3>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>{t('settings.profile_notice') || 'Updating name or username requires manual approval from an administrator.'}</p>

                    <div className="input-group">
                        <label className="input-label">Full Name</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input
                                type="text"
                                value={profileData.fullName}
                                onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                                className="form-control"
                                placeholder="Edit your name"
                            />
                            <button
                                onClick={() => handleRequestChange('NAME')}
                                className="btn btn-outline"
                                style={{ padding: '0 16px', fontSize: '12px' }}
                                disabled={profileLoading || profileData.fullName === currentUser?.name}
                            >
                                {isAdmin ? 'Update' : 'Request'}
                            </button>
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input
                                type="text"
                                value={profileData.username}
                                onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                className="form-control"
                                placeholder="Edit your username"
                            />
                            <button
                                onClick={() => handleRequestChange('USERNAME')}
                                className="btn btn-outline"
                                style={{ padding: '0 16px', fontSize: '12px' }}
                                disabled={profileLoading || profileData.username === currentUser?.username}
                            >
                                {isAdmin ? 'Update' : 'Request'}
                            </button>
                        </div>
                    </div>


                    <div className="input-group">
                        <label className="input-label">Email (Read-only)</label>
                        <input
                            type="email"
                            value={currentUser?.email}
                            className="form-control"
                            style={{ background: 'var(--background)', cursor: 'not-allowed' }}
                            readOnly
                        />
                    </div>
                </div>

                {/* SECURITY / PASSWORD */}
                <div className="glass-card" style={{ padding: '32px' }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Lock size={20} color="var(--accent)" /> {t('settings.change_password') || 'Change Password'}
                    </h3>
                    <form onSubmit={handlePasswordChange}>
                        <div className="input-group">
                            <label className="input-label">Current Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    value={passwordData.oldPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                    className="form-control"
                                    style={{ paddingRight: '44px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">New Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    className="form-control"
                                    style={{ paddingRight: '44px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Confirm New Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    className="form-control"
                                    style={{ paddingRight: '44px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', height: '56px', marginTop: '8px' }}
                            disabled={passwordLoading}
                        >
                            {passwordLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>

                {/* LANGUAGE SETTINGS */}
                <div className="glass-card" style={{ padding: '32px' }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Languages size={20} color="var(--accent)" /> {t('settings.language_title')}
                    </h3>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>{t('settings.language_subtitle')}</p>
                    <div style={{ maxWidth: '300px' }}>
                        <LanguageSwitcher />
                    </div>
                </div>
            </div>

        </div>
    );
}

