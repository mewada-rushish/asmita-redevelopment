'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState({ name: 'Loading...', role: '' });

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        // Handle cases where API returns { name, role } OR { user: { name, role } }
        const userData = data.user || data; 
        if (userData.name) {
          setUser({
            name: userData.name,
            role: userData.role || 'Portal'
          });
        }
      })
      .catch(err => console.error("Failed to load user info", err));
  }, []);

  const navItems = [
    { name: 'Global Map', path: '/dashboard', icon: 'fa-globe' },
    { name: 'Add Property', path: '/dashboard/add', icon: 'fa-plus-circle' },
    { name: 'Properties List', path: '/dashboard/list', icon: 'fa-list' },
  ];

  if (user.role === 'Super Admin' || user.role === 'Admin') {
    navItems.push({ name: 'User Management', path: '/dashboard/users', icon: 'fa-users' });
  }

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) window.location.href = '/login';
    } catch (err) {
      window.location.href = '/login';
    }
  };

  // Helper to get initials and first name
  const firstName = user.name !== 'Loading...' ? user.name.split(' ')[0] : 'Loading...';
  const initial = user.name !== 'Loading...' ? user.name.charAt(0).toUpperCase() : 'A';

  return (
    <div className={styles.layoutContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>AsmitA ERP</h2>
          <span className={styles.badge}>{user.role || 'Portal'}</span>
        </div>
        
        <nav className={styles.navMenu}>
          {navItems.map((item) => (
            <Link href={item.path} key={item.path} className={`${styles.navLink} ${pathname === item.path ? styles.activeLink : ''}`}>
              <i className={`fa ${item.icon} ${styles.icon}`}></i>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userProfile}>
            <Link href="/dashboard/profile" style={{ textDecoration: 'none' }}>
              <div className={styles.avatar} title="Manage Profile" style={{ cursor: 'pointer' }}>
                {initial}
              </div>
            </Link>

            <div className={styles.userInfo}>
              <Link href="/dashboard/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className={styles.userName} title="Manage Profile" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {firstName}
                  <i className="fa fa-cog" style={{ fontSize: '12px', opacity: 0.5 }}></i>
                </span>
              </Link>

              <button onClick={handleLogout} className={styles.logoutBtn}>
                <i className="fa fa-sign-out"></i> Logout
              </button>
            </div>
          </div>
        </div>
      </aside>
      
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}