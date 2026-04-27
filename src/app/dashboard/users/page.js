'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './users.module.css';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewUser, setViewUser] = useState(null);
    const [currentUserRole, setCurrentUserRole] = useState('');
    const router = useRouter();

    const [resetUser, setResetUser] = useState(null);
    const [tempPassword, setTempPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    // Search & Pagination States
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // --- ME ADDED: Table Scroll Sync & Drag States ---
    const topScrollRef = useRef(null);
    const tableWrapperRef = useRef(null);
    const tableRef = useRef(null);
    const [tableScrollWidth, setTableScrollWidth] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeftState, setScrollLeftState] = useState(0);

    const fetchUsers = async () => {
        setLoading(true);
        try {
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
        if (role === 'View Only') return styles.roleView;
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

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (tempPassword.length < 8) {
            return alert('Temporary password must be at least 8 characters.');
        }

        setIsResetting(true);
        try {
            const res = await fetch('/api/admin/users/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: resetUser.id, temporaryPassword: tempPassword })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                alert(`Password reset successful!\n\nPlease tell ${resetUser.name} to log in using: ${tempPassword}\n\nThey will be forced to change it immediately.`);
                setResetUser(null);
                setTempPassword('');
            } else {
                alert(data.error || 'Failed to reset password.');
            }
        } catch (err) {
            alert('Connection error while resetting password.');
        } finally {
            setIsResetting(false);
        }
    };

    // Filter & Pagination Logic
    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        return (u.name || '').toLowerCase().includes(term) ||
               (u.email || '').toLowerCase().includes(term) ||
               (u.phone || '').toLowerCase().includes(term) ||
               (u.department || '').toLowerCase().includes(term) ||
               (u.role || '').toLowerCase().includes(term);
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;

    const isAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

    // --- ME ADDED: Scroll & Drag Handlers ---
    useEffect(() => {
        if (tableRef.current) {
            setTableScrollWidth(tableRef.current.scrollWidth);
        }
    }, [currentUsers, loading]);

    const handleTopScroll = () => {
        if (tableWrapperRef.current && topScrollRef.current) {
            tableWrapperRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };

    const handleTableScroll = () => {
        if (topScrollRef.current && tableWrapperRef.current) {
            topScrollRef.current.scrollLeft = tableWrapperRef.current.scrollLeft;
        }
    };

    const handleDragStart = (e) => {
        setIsDragging(true);
        setStartX(e.pageX - tableWrapperRef.current.offsetLeft);
        setScrollLeftState(tableWrapperRef.current.scrollLeft);
    };

    const handleDragEnd = () => setIsDragging(false);

    const handleDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevent text highlighting while dragging
        const x = e.pageX - tableWrapperRef.current.offsetLeft;
        const walk = (x - startX) * 1.5; // Multiply for drag speed
        tableWrapperRef.current.scrollLeft = scrollLeftState - walk;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1><i className="fa fa-users"></i> User Management</h1>
                {isAdmin && (
                    <Link href="/dashboard/users/add" className={styles.addBtn}>
                        <i className="fa fa-user-plus"></i> Add New User
                    </Link>
                )}
            </header>

            <div className={styles.filterBar}>
                <div className={styles.searchWrapper}>
                    <i className="fa fa-search"></i>
                    <input 
                        type="text" 
                        placeholder="Search by name, email, role or phone..." 
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className={styles.searchInput}
                    />
                </div>
            </div>

            <div className={styles.tableContainer}>
                {loading && users.length === 0 ? (
                    <div className={styles.emptyState}>
                        <i className="fa fa-spinner fa-spin fa-2x"></i>
                        <p>Loading staff records...</p>
                    </div>
                ) : currentUsers.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No users found matching your search.</p>
                    </div>
                ) : (
                    <>
                        {/* --- TOP SCROLLBAR --- */}
                        <div 
                            className={styles.topScrollWrapper} 
                            ref={topScrollRef} 
                            onScroll={handleTopScroll}
                        >
                            <div style={{ width: `${tableScrollWidth}px`, height: '1px' }}></div>
                        </div>

                        {/* --- MAIN DRAGGABLE TABLE WRAPPER --- */}
                        <div 
                            className={`${styles.tableWrapper} ${isDragging ? styles.dragging : ''}`}
                            ref={tableWrapperRef}
                            onScroll={handleTableScroll}
                            onMouseDown={handleDragStart}
                            onMouseLeave={handleDragEnd}
                            onMouseUp={handleDragEnd}
                            onMouseMove={handleDragMove}
                        >
                            <table className={styles.table} ref={tableRef}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px', textAlign: 'center' }}>SR #</th>
                                        <th style={{ width: '80px', textAlign: 'center' }}>ID</th>
                                        <th>Name</th>
                                        <th>Contact</th>
                                        <th>Role & Dept</th>
                                        <th>Status</th>
                                        <th className={styles.stickyCol}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentUsers.map((user, index) => (
                                        <tr key={user.id}>
                                            <td style={{ textAlign: 'center', fontWeight: '600', color: '#9ca3af' }}>
                                                {indexOfFirstItem + index + 1}
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
                                                        {user.role === 'View Only'}
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
                                            <td className={styles.stickyCol}>
                                                <div className={styles.actionsCell}>
                                                    <button
                                                        onClick={() => setViewUser(user)}
                                                        className={`${styles.actionBtn} ${styles.viewBtn}`}
                                                        title="View User"
                                                    >
                                                        <i className="fa fa-eye"></i>
                                                    </button>
                                                    
                                                    {isAdmin && (
                                                        <>
                                                            <Link href={`/dashboard/users/edit/${user.id}`} className={`${styles.actionBtn} ${styles.editBtn}`} title="Edit User" draggable="false">
                                                                <i className="fa fa-edit"></i>
                                                            </Link>

                                                            <button
                                                                onClick={() => setResetUser(user)}
                                                                className={`${styles.actionBtn} ${styles.editBtn}`} 
                                                                style={{ color: '#d97706', borderColor: '#fcd34d', backgroundColor: '#fffbeb' }}
                                                                title="Force Password Reset"
                                                            >
                                                                <i className="fa fa-key"></i>
                                                            </button>

                                                            <button
                                                                onClick={() => handleDelete(user.id, user.name)}
                                                                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                                                title="Delete User"
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Pagination Controls */}
            {!loading && filteredUsers.length > 0 && (
                <div className={styles.paginationFooter}>
                    <div className={styles.perPage}>
                        <span>Show</span>
                        <select 
                            value={itemsPerPage} 
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        <span>entries</span>
                    </div>
                    <div className={styles.pages}>
                        <button 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(p => p - 1)}
                        >
                            <i className="fa fa-chevron-left"></i>
                        </button>
                        <span>Page <strong>{currentPage}</strong> of {totalPages}</span>
                        <button 
                            disabled={currentPage === totalPages} 
                            onClick={() => setCurrentPage(p => p + 1)}
                        >
                            <i className="fa fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* View User Modal */}
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
                                <span>Role:</span> <strong>{viewUser.role} {viewUser.role === 'View Only' && <i className="fa fa-eye" style={{ marginLeft: '4px' }}></i>}</strong>
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

            {/* Reset Password Modal */}
            {resetUser && (
                <div className={styles.modalOverlay} onClick={() => { setResetUser(null); setTempPassword(''); }}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Reset Password for {resetUser.name}</h2>
                            <button className={styles.closeBtn} onClick={() => { setResetUser(null); setTempPassword(''); }}>
                                <i className="fa fa-times"></i>
                            </button>
                        </div>
                        <form className={styles.modalBody} onSubmit={handleResetPassword}>
                            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '15px' }}>
                                Assign a temporary password. The user will be locked out and forced to pick a new permanent password immediately upon their next login.
                            </p>
                            <div className={styles.infoRow} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                <label style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>New Temporary Password *</label>
                                <input 
                                    type="text" 
                                    required 
                                    minLength="8" 
                                    value={tempPassword}
                                    onChange={(e) => setTempPassword(e.target.value)}
                                    placeholder="e.g. AsmitA123!"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => { setResetUser(null); setTempPassword(''); }}
                                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isResetting}
                                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#d97706', color: 'white', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    {isResetting ? 'Resetting...' : 'Assign Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}