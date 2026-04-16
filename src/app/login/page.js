'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { logoPath } from '@/assets/images';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('login'); // login, forceChange, forgot-email, forgot-otp
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      if (data.requiresPasswordChange) {
        setMode('forceChange');
        setError('Security Notice: Update temporary password.');
        setIsLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError('Connection error.');
      setIsLoading(false);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      if (res.ok) {
        setSuccess('OTP sent to your email!');
        setMode('forgot-otp');
      } else {
        const data = await res.json();
        setError(data.error || 'Email not found.');
      }
    } catch (err) { setError('Failed to send OTP.'); }
    setIsLoading(false);
  };

  const handleFinalReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp, newPassword })
      });
      if (res.ok) {
        setSuccess('Password reset successful! Logging in...');
        setMode('login');
        setPassword(newPassword);
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid OTP.');
      }
    } catch (err) { setError('Reset failed.'); }
    setIsLoading(false);
  };

  const handleForceChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), currentPassword: password, newPassword })
      });
      if (res.ok) {
        setSuccess('Password updated!');
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update.');
      }
    } catch (err) { setError('Connection error.'); }
    setIsLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logoArea}>
          <Image src={logoPath} alt="AsmitA Logo" width={120} height={120} priority />
          <p style={{ marginTop: -5 }}>Property Tracker System</p>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}
        {success && <div className={styles.successAlert}>{success}</div>}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading}>
              {isLoading ? <i className="fa fa-spinner fa-spin"></i> : 'Sign In'}
            </button>
            <div className={styles.formFooter}>
              <button type="button" onClick={() => setMode('forgot-email')} className={styles.linkBtn}>Forgot Password?</button>
            </div>
          </form>
        )}

        {mode === 'forgot-email' && (
          <form onSubmit={handleResetRequest} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Enter Registered Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading}>
              {isLoading ? <i className="fa fa-spinner fa-spin"></i> : 'Send Reset OTP'}
            </button>
            <button type="button" onClick={() => setMode('login')} className={styles.linkBtn}>Back to Login</button>
          </form>
        )}

        {mode === 'forgot-otp' && (
          <form onSubmit={handleFinalReset} className={styles.form}>
            <div className={styles.inputGroup}><label>Enter 6-Digit OTP</label><input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength="6" /></div>
            <div className={styles.inputGroup}><label>New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
            <div className={styles.inputGroup}><label>Confirm Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading}>
              {isLoading ? <i className="fa fa-spinner fa-spin"></i> : 'Reset Password'}
            </button>
          </form>
        )}

        {mode === 'forceChange' && (
          <form onSubmit={handleForceChange} className={styles.form}>
            <div className={styles.inputGroup}><label>New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
            <div className={styles.inputGroup}><label>Confirm Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading}>
              {isLoading ? <i className="fa fa-spinner fa-spin"></i> : 'Update & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}