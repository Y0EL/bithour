'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Users, XCircle, UserPlus, RefreshCw, Loader2, Lock, CheckCircle2, ShieldCheck, Check, X, Clock, MoreVertical, Mail, User as UserIcon, Folder, Edit3, Trash2, Plus } from 'lucide-react';
import { useMediaQuery } from '@mui/material';

type User = {
    id: string;
    username: string;
    fullName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    groupId: string | null;
    group: {
        id: string;
        name: string;
        isSystem: boolean;
    } | null;
};

type Group = {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    _count: { users: number };
};

type ChangeRequest = {
    id: string;
    type: string;
    requestedValue: string;
    status: string;
    createdAt: string;
    user: {
        id: string;
        username: string;
        fullName: string;
    };
};

const ROLES = ['BD', 'TEAM_LEADER', 'FINANCE', 'BD_ASSISTANT_MANAGER', 'MANAGER', 'ANALYST', 'CURATOR', 'SYSTEM'];

export default function UserManagementPage() {
    const { data: session } = useSession();
    const { t } = useTranslation();
    const userRole = (session?.user as any)?.role;
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [users, setUsers] = useState<User[]>([]);
    const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const [showAddForm, setShowAddForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        fullName: '',
        role: 'BD'
    });

    const canManageUsers = ['SYSTEM', 'MANAGER'].includes(userRole);
    const isSystem = userRole === 'SYSTEM';

    // Groups management state
    const [groups, setGroups] = useState<Group[]>([]);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [groupFormData, setGroupFormData] = useState({ name: '', description: '' });
    const [assigningUser, setAssigningUser] = useState<string | null>(null);

    useEffect(() => {
        if (canManageUsers) {
            fetchUsers();
            fetchRequests();
            fetchGroups();
        }
    }, [canManageUsers]);

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            if (res.ok && data.groups) {
                setGroups(data.groups);
            }
        } catch (err) {
            console.error('Failed to fetch groups:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/users');
            const data = await res.json();
            if (res.ok && data.users) {
                const sorted = data.users.sort((a: User, b: User) => {
                    if (a.role === 'SYSTEM') return 1;
                    if (b.role === 'SYSTEM') return -1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                setUsers(sorted);
            } else {
                setError(data.error || 'Failed to load users');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/settings/requests');
            const data = await res.json();
            if (res.ok) {
                setPendingRequests(data.requests || []);
            }
        } catch (err) {
            console.error('Failed to fetch requests:', err);
        }
    };

    const handleUserAction = async (userId: string, action: string, extraData: any = {}) => {
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, action, ...extraData }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('User updated successfully');
            fetchUsers();
            setActiveMenu(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleProcessAdminRequest = async (requestId: string, newStatus: 'APPROVED' | 'REJECTED') => {
        try {
            const res = await fetch('/api/settings/requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: requestId, status: newStatus })
            });
            if (!res.ok) throw new Error('Failed to process request');
            setSuccess(`Request ${newStatus.toLowerCase()} successfully`);
            fetchRequests();
            setActiveMenu(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSubmitting(true);

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create user');
            }

            setSuccess('User created successfully!');
            setFormData({ username: '', email: '', password: '', fullName: '', role: 'BD' });
            setShowAddForm(false);
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Group management functions
    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(groupFormData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('Group created successfully!');
            setGroupFormData({ name: '', description: '' });
            setShowGroupModal(false);
            fetchGroups();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGroup) return;
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch('/api/groups', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingGroup.id, action: 'UPDATE', ...groupFormData })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('Group updated successfully!');
            setEditingGroup(null);
            setGroupFormData({ name: '', description: '' });
            fetchGroups();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm('Are you sure you want to delete this group? Users in this group will be unassigned.')) return;
        setError(null);
        try {
            const res = await fetch('/api/groups', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: groupId, action: 'DELETE' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('Group deleted successfully!');
            fetchGroups();
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAssignGroup = async (userId: string, groupId: string | null) => {
        setError(null);
        try {
            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, action: 'ASSIGN_GROUP', groupId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('User group updated!');
            fetchUsers();
            fetchGroups();
            setAssigningUser(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (!canManageUsers) {
        return (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                <XCircle size={48} color="var(--error)" style={{ marginBottom: '16px' }} />
                <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Access Denied</h2>
                <p style={{ color: 'var(--muted)' }}>You do not have permission to manage users.</p>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800, marginBottom: '4px', color: '#111' }}>User Management</h1>
                    <p style={{ color: '#666', fontSize: '14px' }}>Create and manage team members and their access levels</p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`btn ${showAddForm ? 'btn-outline' : 'btn-primary'}`}
                    style={{ height: '42px', padding: '0 20px', borderRadius: '12px', fontSize: '13px' }}
                >
                    {showAddForm ? <X size={18} /> : <UserPlus size={18} />}
                    {showAddForm ? 'Cancel' : 'Add New User'}
                </button>
            </div>

            {/* Error/Success Messages */}
            {(error || success) && (
                <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                    {error && (
                        <div style={{ padding: '16px', background: '#fff1f2', border: '1px solid #fda4af', color: '#be123c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}>
                            <XCircle size={18} /> {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}>
                            <CheckCircle2 size={18} /> {success}
                        </div>
                    )}
                </div>
            )}

            {/* Add User Form */}
            {showAddForm && (
                <div className="glass-card animate-in" style={{ padding: '32px', border: '2px solid var(--primary)', background: '#fff' }}>
                    <h3 style={{ fontSize: '20px', marginBottom: '24px', fontWeight: 800 }}>Create New User Account</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                        <div className="input-group">
                            <label className="input-label">Full Name</label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                required
                                className="form-control"
                                placeholder="Enter user's full name"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Email Address</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="form-control"
                                placeholder="Email for login & notifications"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Username</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                required
                                className="form-control"
                                placeholder="Unique username (e.g. @username)"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Initial Password</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                className="form-control"
                                placeholder="Temporary password"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Select Role</label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="form-control"
                                style={{ height: '56px' }}
                            >
                                {ROLES.filter(r => r !== 'SYSTEM').map(role => (
                                    <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ gridColumn: isMobile ? '1' : 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ height: '56px', padding: '0 40px', fontSize: '16px' }}>
                                {submitting ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                                {submitting ? 'Creating Account...' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Group Management Section - Only for SYSTEM role */}
            {isSystem && (
                <div className="glass-card animate-in" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                            <Folder size={22} color="var(--primary)" /> Group
                        </h3>
                        <button
                            onClick={() => {
                                setShowGroupModal(true);
                                setEditingGroup(null);
                                setGroupFormData({ name: '', description: '' });
                            }}
                            className="btn btn-primary"
                            style={{ height: '40px', padding: '0 16px', borderRadius: '10px', fontSize: '13px' }}
                        >
                            <Plus size={16} /> Add
                        </button>
                    </div>

                    <div style={{ padding: '16px' }}>
                        {groups.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                                <Folder size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                <p>No groups created yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                {groups.map((g) => (
                                    <div
                                        key={g.id}
                                        style={{
                                            padding: '16px',
                                            background: g.isSystem ? '#fffbeb' : '#f8fafc',
                                            border: g.isSystem ? '2px solid #fbbf24' : '1px solid #e2e8f0',
                                            borderRadius: '14px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {g.name}
                                                {g.isSystem && (
                                                    <span style={{ fontSize: '9px', background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>SYSTEM</span>
                                                )}
                                            </div>
                                            {g.description && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{g.description}</div>}
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                                                {g._count.users} member{g._count.users !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        {!g.isSystem && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => {
                                                        setEditingGroup(g);
                                                        setGroupFormData({ name: g.name, description: g.description || '' });
                                                    }}
                                                    style={{ padding: '8px', background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteGroup(g.id)}
                                                    style={{ padding: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Group Create/Edit Modal */}
            {(showGroupModal || editingGroup) && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div className="glass-card animate-in" style={{ padding: '32px', maxWidth: '400px', width: '100%', background: '#fff' }}>
                        <h3 style={{ fontSize: '20px', marginBottom: '24px', fontWeight: 800 }}>
                            {editingGroup ? 'Edit Group' : 'Create New Group'}
                        </h3>
                        <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} style={{ display: 'grid', gap: '16px' }}>
                            <div className="input-group">
                                <label className="input-label">Group Name</label>
                                <input
                                    type="text"
                                    value={groupFormData.name}
                                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                    required
                                    className="form-control"
                                    placeholder="e.g. Team Alpha, Group 01"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Description (Optional)</label>
                                <input
                                    type="text"
                                    value={groupFormData.description}
                                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                                    className="form-control"
                                    placeholder="Short description"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowGroupModal(false);
                                        setEditingGroup(null);
                                        setGroupFormData({ name: '', description: '' });
                                    }}
                                    className="btn btn-outline"
                                    style={{ flex: 1, height: '48px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn btn-primary"
                                    style={{ flex: 1, height: '48px' }}
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : editingGroup ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Requests - AT TOP FOR ADMINS */}
            {pendingRequests.length > 0 && (
                <div className="glass-card animate-in" style={{ padding: '24px', border: '2px solid #3b82f6', background: '#f8faff' }}>
                    <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                            <ShieldCheck size={22} color="#3b82f6" />
                            Pending Profile Changes
                            <span className="animate-pulse" style={{ padding: '2px 10px', background: '#ef4444', color: 'white', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>{pendingRequests.length}</span>
                        </h3>
                    </div>

                    <div>
                        {/* Desktop View Requests */}
                        {!isMobile && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>

                                <tbody>
                                    {pendingRequests.map((req) => (
                                        <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ fontWeight: 800, color: '#111', fontSize: '14px' }}>{req.user.fullName}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>@{req.user.username}</div>
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#3b82f6' }}>{req.requestedValue}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 24px', fontSize: '12px', color: '#64748b' }}>
                                                {new Date(req.createdAt).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => handleProcessAdminRequest(req.id, 'APPROVED')} className="btn" style={{ background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, border: 'none' }}>
                                                        Approve
                                                    </button>
                                                    <button onClick={() => handleProcessAdminRequest(req.id, 'REJECTED')} className="btn" style={{ background: '#ef4444', color: '#fff', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, border: 'none' }}>
                                                        Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Mobile View Requests */}
                        {isMobile && (
                            <div style={{ display: 'grid', gap: '16px' }}>
                                {pendingRequests.map((req) => (
                                    <div key={req.id} style={{ padding: '20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '15px' }}>{req.user.fullName}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>@{req.user.username}</div>
                                            </div>
                                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(req.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8' }}>CHANGE {req.type.toUpperCase()}:</div>
                                            <div style={{ fontWeight: 800, color: '#3b82f6', fontSize: '14px', marginTop: '4px' }}>{req.requestedValue}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                            <button onClick={() => handleProcessAdminRequest(req.id, 'APPROVED')} style={{ flex: 1, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '13px' }}>Approve</button>
                                            <button onClick={() => handleProcessAdminRequest(req.id, 'REJECTED')} style={{ flex: 1, padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '13px' }}>Reject</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Team Members */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px', border: '1px solid #eee', background: 'white', marginTop: '20px' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                        <Users size={22} color="var(--primary)" /> Team Members
                    </h3>
                    <button
                        onClick={fetchUsers}
                        className="btn btn-outline refresh-btn-compact"
                        style={{ width: '40px', height: '40px', padding: '0' }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div>
                    {loading ? (
                        <div style={{ padding: '64px', textAlign: 'center', color: 'var(--muted)' }}>
                            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
                            <p>Loading members...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div style={{ padding: '64px', textAlign: 'center', color: 'var(--muted)' }}>
                            <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                            <p>No team members found</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop View Members */}
                            {!isMobile && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#fdfdfd', borderBottom: '1px solid var(--border)' }}>
                                        <tr>
                                            <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>User</th>
                                            <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>Role</th>
                                            <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>Group</th>
                                            <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>Status</th>
                                            <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                                                <td style={{ padding: '20px 24px' }}>
                                                    <div style={{ fontWeight: 800, color: '#111', fontSize: '14px' }}>{u.fullName}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>@{u.username}</div>
                                                </td>
                                                <td style={{ padding: '20px 24px' }}>
                                                    {isSystem ? (
                                                        <select
                                                            value={u.role}
                                                            onChange={(e) => {
                                                                if (confirm(`Are you sure you want to change role to ${e.target.value}?`)) {
                                                                    handleUserAction(u.id, 'CHANGE_ROLE', { role: e.target.value });
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                background: u.role === 'SYSTEM' ? '#000' : 'var(--background)',
                                                                color: u.role === 'SYSTEM' ? '#fff' : '#111',
                                                                fontSize: '11px',
                                                                fontWeight: 800,
                                                                border: u.role === 'SYSTEM' ? 'none' : '1px solid var(--border)',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {ROLES.map(role => (
                                                                <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            background: u.role === 'SYSTEM' ? '#000' : 'var(--background)',
                                                            color: u.role === 'SYSTEM' ? '#fff' : '#111',
                                                            fontSize: '11px',
                                                            fontWeight: 800,
                                                            border: u.role === 'SYSTEM' ? 'none' : '1px solid var(--border)'
                                                        }}>
                                                            {t(`dashboard.roles.${u.role}`)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '20px 24px' }}>
                                                    {isSystem ? (
                                                        <select
                                                            value={u.groupId || ''}
                                                            onChange={(e) => handleAssignGroup(u.id, e.target.value || null)}
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                border: '1px solid #e2e8f0',
                                                                background: u.group?.isSystem ? '#fffbeb' : '#f8fafc',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                minWidth: '120px'
                                                            }}
                                                        >
                                                            <option value="">No Group</option>
                                                            {groups.map((g) => (
                                                                <option key={g.id} value={g.id}>{g.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            background: u.group ? (u.group.isSystem ? '#fffbeb' : '#f0fdf4') : '#f1f5f9',
                                                            color: u.group ? (u.group.isSystem ? '#b45309' : '#15803d') : '#64748b',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            border: u.group?.isSystem ? '1px solid #fbbf24' : '1px solid #e2e8f0'
                                                        }}>
                                                            {u.group?.name || t('dashboard.no_members').replace('Tidak ada anggota tim', 'Tanpa Grup')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '20px 24px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: u.isActive ? 'var(--success)' : 'var(--error)' }} />
                                                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{u.isActive ? t('dashboard.activate_user').replace('Aktifkan User', 'Aktif') : t('dashboard.suspend_user').replace('Suspend User', 'Nonaktif')}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => {
                                                                const newPass = prompt('Enter new password:');
                                                                if (newPass) handleUserAction(u.id, 'RESET_PASSWORD', { password: newPass });
                                                            }}
                                                            className="btn-icon"
                                                            style={{ padding: '10px', background: '#f0f9ff', color: '#0ea5e9', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                                                        >
                                                            <Lock size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUserAction(u.id, 'TOGGLE_STATUS')}
                                                            className="btn-icon"
                                                            style={{ padding: '10px', background: u.isActive ? '#fff1f2' : '#f0fdf4', color: u.isActive ? '#ef4444' : '#16a34a', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                                                        >
                                                            {u.isActive ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* Mobile View Members */}
                            {isMobile && (
                                <div style={{ display: 'grid' }}>
                                    {users.map((u) => (
                                        <div key={u.id} style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '16px' }}>{u.fullName}</div>
                                                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>@{u.username}</div>
                                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        {isSystem ? (
                                                            <select
                                                                value={u.role}
                                                                onChange={(e) => {
                                                                    if (confirm(`Are you sure you want to change role to ${e.target.value}?`)) {
                                                                        handleUserAction(u.id, 'CHANGE_ROLE', { role: e.target.value });
                                                                    }
                                                                }}
                                                                style={{
                                                                    fontSize: '10px',
                                                                    fontWeight: 800,
                                                                    padding: '4px 8px',
                                                                    borderRadius: '6px',
                                                                    background: u.role === 'SYSTEM' ? '#000' : '#eee',
                                                                    color: u.role === 'SYSTEM' ? '#fff' : '#111',
                                                                    border: 'none',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {ROLES.map(role => (
                                                                    <option key={role} value={role}>{t(`dashboard.roles.${role}`)}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#eee' }}>{u.role}</span>
                                                        )}
                                                        {u.group && (
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 800,
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                background: u.group.isSystem ? '#fffbeb' : '#f0fdf4',
                                                                color: u.group.isSystem ? '#b45309' : '#15803d',
                                                                border: u.group.isSystem ? '1px solid #fbbf24' : '1px solid #86efac'
                                                            }}>
                                                                {u.group.name}
                                                            </span>
                                                        )}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.isActive ? 'var(--success)' : 'var(--error)' }} />
                                                            <span style={{ fontSize: '11px', fontWeight: 700 }}>{u.isActive ? 'Aktif' : 'Nonaktif'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ position: 'relative' }}>
                                                    <button onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)} style={{ padding: '10px', background: '#f3f4f6', border: 'none', borderRadius: '10px' }}>
                                                        <MoreVertical size={18} />
                                                    </button>
                                                    {activeMenu === u.id && (
                                                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '8px', background: '#fff', border: '1px solid #eee', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '200px', overflow: 'hidden' }}>
                                                            <button
                                                                onClick={() => {
                                                                    const newPass = prompt('Enter new password:');
                                                                    if (newPass) handleUserAction(u.id, 'RESET_PASSWORD', { password: newPass });
                                                                    setActiveMenu(null);
                                                                }}
                                                                style={{ width: '100%', padding: '14px', border: 'none', background: 'none', textAlign: 'left', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}
                                                            >
                                                                <Lock size={16} /> Reset Password
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleUserAction(u.id, 'TOGGLE_STATUS');
                                                                    setActiveMenu(null);
                                                                }}
                                                                style={{ width: '100%', padding: '14px', border: 'none', background: 'none', textAlign: 'left', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', color: u.isActive ? '#ef4444' : '#16a34a' }}
                                                            >
                                                                {u.isActive ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                                                {u.isActive ? 'Suspend User' : 'Activate User'}
                                                            </button>
                                                            {isSystem && (
                                                                <>
                                                                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 14px' }}>
                                                                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px' }}>ASSIGN GROUP</div>
                                                                        <select
                                                                            value={u.groupId || ''}
                                                                            onChange={(e) => {
                                                                                handleAssignGroup(u.id, e.target.value || null);
                                                                                setActiveMenu(null);
                                                                            }}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '10px',
                                                                                borderRadius: '8px',
                                                                                border: '1px solid #e2e8f0',
                                                                                fontSize: '13px',
                                                                                fontWeight: 700
                                                                            }}
                                                                        >
                                                                            <option value="">No Group</option>
                                                                            {groups.map((g) => (
                                                                                <option key={g.id} value={g.id}>{g.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style jsx global>{`
                .hover-row:hover {
                    background: #fcfcfc;
                }
                .grid {
                    overflow-y: visible !important;
                }
                .glass-card {
                    overflow: visible !important;
                }
                .refresh-btn-compact {
                    transition: all 0.2s;
                }
                .refresh-btn-compact:active {
                    transform: scale(0.9);
                }
            `}</style>
        </div >
    );
}
