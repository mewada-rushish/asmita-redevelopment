'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // ME ADDED: For optimized logo rendering
import { usePathname, useRouter } from 'next/navigation';
import { logoPath } from '@/assets/images'; // Ensure this points to your logo file
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const [user, setUser] = useState({ name: 'Loading...', role: '' });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
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

  const closeMenu = () => setIsMenuOpen(false);

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
    closeMenu();
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) window.location.href = '/login';
    } catch (err) {
      window.location.href = '/login';
    }
  };

  const firstName = user.name !== 'Loading...' ? user.name.split(' ')[0] : 'Loading...';
  const initial = user.name !== 'Loading...' ? user.name.charAt(0).toUpperCase() : 'A';

  return (
    <div className={styles.layoutContainer}>
      <header className={styles.mobileHeader}>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={styles.hamburger}>
          <i className={`fa ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>

        <Link href="/dashboard" className={styles.mobileLogoLink} onClick={closeMenu}>
          <Image 
            src={logoPath} 
            alt="AsmitA Logo" 
            width={40} 
            height={40} 
            priority
          />
        </Link>
        
        <div className={styles.mobileAvatar}>{initial}</div>
      </header>

      {isMenuOpen && <div className={styles.overlay} onClick={closeMenu} />}

      <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          {/* SIDEBAR LOGO: Branded home link */}
          <Link href="/dashboard" className={styles.sidebarLogoLink} onClick={closeMenu}>
            <Image 
              src={logoPath} 
              alt="AsmitA Logo" 
              width={75} 
              height={75} 
              className={styles.brandLogo}
            />
            {/* <span className={styles.brandName}>AsmitA ERP</span> */}
          </Link>
          <span className={styles.badge}>{user.role || 'Portal'}</span>
        </div>
        
        <nav className={styles.navMenu}>
          {navItems.map((item) => (
            <Link 
              href={item.path} 
              key={item.path} 
              onClick={closeMenu}
              className={`${styles.navLink} ${pathname === item.path ? styles.activeLink : ''}`}
            >
              <i className={`fa ${item.icon} ${styles.icon}`}></i>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userProfile}>
            <Link href="/dashboard/profile" className={styles.avatarLink} onClick={closeMenu}>
              <div className={styles.avatar}>{initial}</div>
            </Link>

            <div className={styles.userInfo}>
              <Link href="/dashboard/profile" className={styles.userNameLink} onClick={closeMenu}>
                <span className={styles.userName}>
                  {firstName} <i className="fa fa-cog" style={{ fontSize: '10px', opacity: 0.5 }}></i>
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