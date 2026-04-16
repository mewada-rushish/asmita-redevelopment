'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './users.module.css';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewUser, setViewUser] = useState(null);
    const [currentUserRole, setCurrentUserRole] = useState(''); // ME ADDED: Track logged-in user's role
    const router = useRouter();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // ME ADDED: Fetch the current logged-in user's profile to get their role
            const authRes = await fetch('/api/auth/me');
            const authData = await authRes.json();
            setCurrentUserRole(authData.user?.role || authData.role || '');

            const res = await fetch(`/api/users?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (res.status === 403) {
                router.push('/dashboard');
                return;
            }

            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();

        const handleVisibilityAndNav = (e) => {
            if (e.type === 'pageshow' && !e.persisted) return;
            fetchUsers();
        };

        window.addEventListener('popstate', handleVisibilityAndNav);
        window.addEventListener('pageshow', handleVisibilityAndNav);
        window.addEventListener('focus', handleVisibilityAndNav);

        return () => {
            window.removeEventListener('popstate', handleVisibilityAndNav);
            window.removeEventListener('pageshow', handleVisibilityAndNav);
            window.removeEventListener('focus', handleVisibilityAndNav);
        };
    }, []);

    const getRoleBadge = (role) => {
        if (role === 'Super Admin') return styles.roleSuper;
        if (role === 'Admin') return styles.roleAdmin;
        return styles.roleExec;
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to permanently delete ${name}?`)) return;

        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            const data = await res.json();

            if (res.ok && data.success) {
                setUsers(users.filter(user => user.id !== id));
            } else {
                alert(data.error || 'Failed to delete user');
            }
        } catch (err) {
            console.error(err);
            alert('Something went wrong while deleting.');
        }
    };

    // ME ADDED: Security flag for rendering the delete button
    const canDelete = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1><i className="fa fa-users"></i> User Management</h1>
                <Link href="/dashboard/users/add" className={styles.addBtn}>
                    <i className="fa fa-user-plus"></i> Add New User
                </Link>
            </header>

            <div className={styles.tableContainer}>
                {loading && users.length === 0 ? (
                    <div className={styles.emptyState}>
                        <i className="fa fa-spinner fa-spin fa-2x"></i>
                        <p>Loading staff records...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No users found in the system.</p>
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '60px', textAlign: 'center' }}>SR #</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>ID</th>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Role & Dept</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user, index) => (
                                <tr key={user.id}>
                                    <td style={{ textAlign: 'center', fontWeight: '600', color: '#9ca3af' }}>
                                        {index + 1}
                                    </td>
                                    <td style={{ textAlign: 'center', fontFamily: 'monospace', color: '#4b5563', fontWeight: '600' }}>
                                        #{user.id}
                                    </td>
                                    <td>
                                        <div className={styles.nameCell}>
                                            <div className={styles.avatar}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <strong>{user.name}</strong>
                                        </div>
                                    </td>
                                    <td>
                                        <div>{user.email}</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{user.phone || 'No phone'}</div>
                                    </td>
                                    <td>
                                        <div className={styles.roleCell}>
                                            <span className={`${styles.badge} ${getRoleBadge(user.role)}`}>
                                                {user.role}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                                                {user.department}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${user.status === 1 ? styles.statusActive : styles.statusInactive}`}>
                                            {user.status === 1 ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actionsCell}>
                                            <button
                                                onClick={() => setViewUser(user)}
                                                className={`${styles.actionBtn} ${styles.viewBtn}`}
                                                title="View User"
                                            >
                                                <i className="fa fa-eye"></i>
                                            </button>
                                            <Link href={`/dashboard/users/edit/${user.id}`} className={`${styles.actionBtn} ${styles.editBtn}`} title="Edit User">
                                                <i className="fa fa-edit"></i>
                                            </Link>
                                            
                                            {/* ME FIX: Conditionally render the delete button based on role */}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(user.id, user.name)}
                                                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                                    title="Delete User"
                                                >
                                                    <i className="fa fa-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {viewUser && (
                <div className={styles.modalOverlay} onClick={() => setViewUser(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>User Information</h2>
                            <button className={styles.closeBtn} onClick={() => setViewUser(null)}>
                                <i className="fa fa-times"></i>
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.infoRow}>
                                <span>Name:</span> <strong>{viewUser.name}</strong>
                            </div>
                            <div className={styles.infoRow}>
                                <span>Email:</span> <strong>{viewUser.email}</strong>
                            </div>
                            <div className={styles.infoRow}>
                                <span>Phone:</span> <strong>{viewUser.phone || 'N/A'}</strong>
                            </div>
                            <div className={styles.infoRow}>
                                <span>Role:</span> <strong>{viewUser.role}</strong>
                            </div>
                            <div className={styles.infoRow}>
                                <span>Department:</span> <strong>{viewUser.department}</strong>
                            </div>
                            <div className={styles.infoRow}>
                                <span>Status:</span> <strong>{viewUser.status === 1 ? 'Active' : 'Inactive'}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}