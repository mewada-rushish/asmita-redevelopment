'use client';
import { useState } from 'react';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@asmita.com');
  const [password, setPassword] = useState('password123');

  const handleLogin = (e) => {
    e.preventDefault();
    
    document.cookie = "asmita_auth=true; path=/; max-age=86400; SameSite=Lax";
    
    console.log("--- AUTHENTICATION TRIGGERED ---");
    console.log("Raw Document Cookie String:", document.cookie);
    console.log("If you see 'asmita_auth=true' above, the browser successfully saved it.");
    console.log("Redirecting to dashboard in 1.5 seconds...");

    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logoArea}>
          <h2>AsmitA</h2>
          <p>Property Tracker ERP</p>
        </div>
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className={styles.loginBtn}>Sign In</button>
        </form>
      </div>
    </div>
  );
}