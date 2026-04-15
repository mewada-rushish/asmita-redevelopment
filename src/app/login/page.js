'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
  // SECURED: Removed hardcoded credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // SECURED: Trim email to prevent accidental spacebar errors
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      router.push('/dashboard');

    } catch (err) {
      setError('Connection error. Please try again later.');
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), currentPassword: password, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change password');
        setIsLoading(false);
        return;
      }

      setSuccess('Password updated successfully! Please log in with your new password.');
      setIsResetMode(false);
      setPassword('');
      setNewPassword('');
      setIsLoading(false);

    } catch (err) {
      setError('Connection error. Please try again later.');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logoArea}>
          <h2>AsmitA</h2>
          <p>Property Tracker ERP</p>
        </div>

        {error && (
          <div style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ color: '#166534', backgroundColor: '#dcfce3', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>
            {success}
          </div>
        )}

        {!isResetMode ? (
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading}>
              {isLoading ? 'Checking...' : 'Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(true);
                  setError('');
                  setSuccess('');
                  setPassword(''); // Clear password when switching modes
                }}
                style={{ background: 'none', border: 'none', color: '#1e4ec4', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textDecoration: 'underline' }}
              >
                Change Temporary Password
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Current / Temporary Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength="6"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setError('');
                  setSuccess('');
                  setPassword('');
                  setNewPassword('');
                }}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
              >
                <i className="fa fa-arrow-left"></i> Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}