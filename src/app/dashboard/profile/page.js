'use client';
import { useState, useEffect } from 'react';
import styles from './profile.module.css';

export default function ProfilePage() {
    const [user, setUser] = useState({ name: '', email: '', phone: '', role: '', department: '' });
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

    const [loading, setLoading] = useState(true);
    const [savingInfo, setSavingInfo] = useState(false);
    const [savingPass, setSavingPass] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/profile');
                const data = await res.json();
                if (data.success) setUser(data.user);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const showMessage = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: '', text: '' }), 5000);
    };

    const handleUpdateInfo = async (e) => {
        e.preventDefault();
        setSavingInfo(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                // ME FIX: Now sending email, role, and department too!
                body: JSON.stringify({
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    role: user.role,
                    department: user.department
                })
            });
            const data = await res.json();
            if (res.ok) showMessage('success', 'Profile information updated successfully!');
            else showMessage('error', data.error || 'Failed to update profile.');
        } catch (err) {
            showMessage('error', 'Connection error.');
        }
        setSavingInfo(false);
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            return showMessage('error', 'New passwords do not match!');
        }
        setSavingPass(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new })
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('success', 'Password updated successfully!');
                setPasswords({ current: '', new: '', confirm: '' });
            } else {
                showMessage('error', data.error || 'Failed to update password.');
            }
        } catch (err) {
            showMessage('error', 'Connection error.');
        }
        setSavingPass(false);
    };

    if (loading) return <div className={styles.loader}><i className="fa fa-spinner fa-spin fa-2x"></i></div>;

    // ME FIX: Check if the user is an admin to unlock fields
    const isAdmin = user.role === 'Super Admin' || user.role === 'Admin';

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1><i className="fa fa-user-circle"></i> My Profile</h1>
                <p>Manage your personal information and security settings.</p>
            </header>

            {msg.text && (
                <div className={`${styles.alert} ${msg.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
                    {msg.text}
                </div>
            )}

            <div className={styles.grid}>
                {/* Basic Info Card */}
                <div className={styles.card}>
                    <h2>Basic Information</h2>
                    <hr className={styles.divider} />
                    <form onSubmit={handleUpdateInfo} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label>Full Name</label>
                            <input type="text" value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Phone Number</label>
                            <input type="text" value={user.phone || ''} onChange={e => setUser({ ...user, phone: e.target.value })} />
                        </div>

                        {/* ME FIX: Conditionally locked based on isAdmin */}
                        <div className={styles.inputGroup}>
                            <label>Email Address {!isAdmin && <span className={styles.locked}>(Locked)</span>}</label>
                            <input
                                type="email"
                                value={user.email}
                                onChange={e => setUser({ ...user, email: e.target.value })}
                                disabled={!isAdmin}
                                className={!isAdmin ? styles.disabledInput : ''}
                                required
                            />
                        </div>
                        <div className={styles.inputRow}>
                            <div className={styles.inputGroup}>
                                <label>Role {!isAdmin && <span className={styles.locked}>(Locked)</span>}</label>
                                <input
                                    type="text"
                                    value={user.role}
                                    onChange={e => setUser({ ...user, role: e.target.value })}
                                    disabled={!isAdmin}
                                    className={!isAdmin ? styles.disabledInput : ''}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Department {!isAdmin && <span className={styles.locked}>(Locked)</span>}</label>
                                <input
                                    type="text"
                                    value={user.department}
                                    onChange={e => setUser({ ...user, department: e.target.value })}
                                    disabled={!isAdmin}
                                    className={!isAdmin ? styles.disabledInput : ''}
                                />
                            </div>
                        </div>
                        <button type="submit" className={styles.saveBtn} disabled={savingInfo}>
                            {savingInfo ? 'Saving...' : 'Update Information'}
                        </button>
                    </form>
                </div>

                {/* Security Card */}
                <div className={styles.card}>
                    <h2>Security & Password</h2>
                    <hr className={styles.divider} />
                    <form onSubmit={handleUpdatePassword} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label>Current Password</label>
                            <input type="password" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>New Password</label>
                            <input type="password" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} required minLength="6" />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Confirm New Password</label>
                            <input type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} required minLength="6" />
                        </div>
                        <button type="submit" className={styles.dangerBtn} disabled={savingPass}>
                            {savingPass ? 'Updating...' : 'Change Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}