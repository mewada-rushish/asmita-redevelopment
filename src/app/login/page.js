'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { logoPath } from '@/assets/images';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // --- Visibility Toggle States ---
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('login'); // Only 'login' or 'forceChange'

  // --- Security UI States ---
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Lockout countdown interval
  useEffect(() => {
    let timer;
    if (lockoutTimer > 0) {
      timer = setInterval(() => setLockoutTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTimer]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();

      if (res.status === 429) {
        const match = data.error?.match(/(\d+) minutes/);
        if (match) setLockoutTimer(parseInt(match[1]) * 60);
        setError(data.error);
        setIsLoading(false);
        return;
      }

      if (res.status === 401) {
        setFailedAttempts((prev) => prev + 1);
        setError(data.error || 'Wrong email or password');
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      setFailedAttempts(0);

      // Trigger the mandatory password change
      if (data.requiresPasswordChange) {
        setMode('forceChange');
        setError('Security Notice: You must update your temporary password.');
        setShowPassword(false);
        setIsLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
      setIsLoading(false);
    } catch (err) {
      setError('Connection error.');
      setIsLoading(false);
    }
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

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update.');
        setIsLoading(false);
        return;
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: newPassword })
      });

      if (loginRes.ok) {
        setSuccess('Password updated! Redirecting...');
        router.push('/dashboard');
        router.refresh();
        setIsLoading(false);
      } else {
        setError('Password updated, but auto-login failed. Please login manually.');
        setMode('login');
        setPassword('');
        setShowPassword(false);
        setIsLoading(false);
      }
    } catch (err) {
      setError('Connection error.');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logoArea}>
          <Image src={logoPath} alt="AsmitA Logo" width={120} height={120} priority />
          <p style={{ marginTop: -5 }}>Property Tracker System</p>
        </div>

        {lockoutTimer > 0 ? (
          <div className={styles.lockoutAlert}>
            <i className="fa fa-lock"></i>
            <div className={styles.lockoutText}>
              <strong>Account Temporarily Locked</strong>
              <p>Try again in <span>{formatTime(lockoutTimer)}</span></p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className={styles.errorAlert}>
                {error}
                {failedAttempts > 0 && failedAttempts < 5 && (
                  <div className={styles.attemptWarning}>
                    <i className="fa fa-warning"></i> Warning: {5 - failedAttempts} attempts remaining before lockout.
                  </div>
                )}
              </div>
            )}
            {success && <div className={styles.successAlert}>{success}</div>}
          </>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={lockoutTimer > 0} />
            </div>
            <div className={styles.inputGroup}>
              <label>Password</label>
              <div className={styles.passwordWrapper}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  disabled={lockoutTimer > 0}
                />
                <button type="button" className={styles.visibilityBtn} onClick={() => setShowPassword(!showPassword)} tabIndex="-1" disabled={lockoutTimer > 0}>
                  <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading || lockoutTimer > 0}>
              {isLoading ? <i className="fa fa-spinner fa-spin"></i> : 'Sign In'}
            </button>
            <div className={styles.formFooter}>
              {/* ME FIX: Changed this button to simply inform the user to contact IT/Admin */}
              <button 
                type="button" 
                onClick={() => {
                  setError('Please contact your System Administrator to receive a temporary reset password.');
                  setSuccess('');
                }} 
                className={styles.linkBtn} 
                disabled={lockoutTimer > 0}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {mode === 'forceChange' && (
          <form onSubmit={handleForceChange} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>New Password</label>
              <div className={styles.passwordWrapper}>
                <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <button type="button" className={styles.visibilityBtn} onClick={() => setShowNewPassword(!showNewPassword)} tabIndex="-1">
                  <i className={`fa ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>Confirm Password</label>
              <div className={styles.passwordWrapper}>
                <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <button type="button" className={styles.visibilityBtn} onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex="-1">
                  <i className={`fa ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>
            <button type="submit" className={styles.loginBtn} disabled={isLoading}>
              {isLoading ? <i className="fa fa-spinner fa-spin"></i> : 'Update & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}