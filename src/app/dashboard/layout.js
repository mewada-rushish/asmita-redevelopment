'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const navItems = [
    { name: 'Global Map', path: '/dashboard', icon: 'fa-globe' },
    { name: 'Add Property', path: '/dashboard/add', icon: 'fa-plus-circle' },
    { name: 'Properties List', path: '/dashboard/list', icon: 'fa-list' },
  ];

  const handleLogout = (e) => {
    e.preventDefault();
    document.cookie = "asmita_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = '/login';
  };

  return (
    <div className={styles.layoutContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>AsmitA ERP</h2>
          <span className={styles.badge}>Admin Portal</span>
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
            <div className={styles.avatar}>A</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>Admin User</span>
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