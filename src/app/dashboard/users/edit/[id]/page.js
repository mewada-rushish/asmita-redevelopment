'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './editusers.module.css';

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [error, setError] = useState('');
    
    // ME ADDED: State for password visibility
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'Field Executive',
        department: 'Sales',
        status: 1,
        is_temporary: 0 
    });

    useEffect(() => {
        const verifyRoleAndFetch = async () => {
            try {
                const authRes = await fetch('/api/auth/me');
                const authData = await authRes.json();
                const role = (authData.user?.role || authData.role || '').toLowerCase();
                if (role !== 'super admin' && role !== 'admin') {
                    router.push('/dashboard');
                    return;
                }
                await fetchUser();
            } catch (err) {
                router.push('/dashboard');
            } finally {
                setCheckingAuth(false);
            }
        };

        if (id) verifyRoleAndFetch();
    }, [id, router]);

    const fetchUser = async () => {
        try {
            const res = await fetch(`/api/users/${id}`);
            const data = await res.json();

            if (res.ok && data.success) {
                setFormData({
                    name: data.user.name || '',
                    email: data.user.email || '',
                    phone: data.user.phone || '',
                    password: '', 
                    role: data.user.role || 'Field Executive',
                    department: data.user.department || 'Sales',
                    status: Number(data.user.status) || 1,
                    is_temporary: Number(data.user.is_temporary) || 0 
                });
            } else {
                setError(data.error || 'Failed to load user');
            }
        } catch (err) {
            setError('Error loading user data.');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let finalValue = type === 'checkbox' ? (checked ? 1 : 0) : value;
        
        if (name === 'status') {
            finalValue = Number(value);
        }
        
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    status: Number(formData.status),
                    is_temporary: Number(formData.is_temporary) 
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                router.push('/dashboard/users');
                router.refresh();
            } else {
                setError(data.error || 'Failed to update user');
            }
        } catch (err) {
            setError('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth || fetching) {
        return (
            <div className={styles.container} style={{ textAlign: 'center', padding: '50px' }}>
                <i className="fa fa-spinner fa-spin fa-2x"></i>
                <p>Loading user data...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/dashboard/users" className={styles.backBtn} title="Back to Users">
                    <i className="fa fa-arrow-left"></i>
                </Link>
                <h1>Edit User: {formData.name}</h1>
            </header>

            <form className={styles.formCard} onSubmit={handleSubmit}>
                {error && <div className={styles.error}><i className="fa fa-exclamation-circle"></i> {error}</div>}

                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label>Full Name *</label>
                        <input type="text" name="name" required value={formData.name} onChange={handleChange} className={styles.input} />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Email Address *</label>
                        <input type="email" name="email" required value={formData.email} onChange={handleChange} className={styles.input} />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Phone Number</label>
                        <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={styles.input} />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Update Password</label>
                        <div className={styles.passwordWrapper}>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                name="password" 
                                value={formData.password} 
                                onChange={handleChange} 
                                className={styles.input} 
                                placeholder="(Leave blank to keep current)" 
                                minLength="8" 
                            />
                            <button 
                                type="button" 
                                className={styles.visibilityBtn} 
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Role</label>
                        <select name="role" value={formData.role} onChange={handleChange} className={styles.input}>
                            <option value="Super Admin">Super Admin</option>
                            <option value="Admin">Admin</option>
                            <option value="Field Executive">Field Executive</option>
                            <option value="View Only">View Only</option>
                            <option value="CRM">CRM</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Department</label>
                        <select name="department" value={formData.department} onChange={handleChange} className={styles.input}>
                            <option value="Sales">Sales</option>
                            <option value="Operations">Operations</option>
                            <option value="Legal">Legal</option>
                            <option value="Management">Management</option>
                            <option value="IT">IT</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Account Status</label>
                        <select name="status" value={String(formData.status)} onChange={handleChange} className={styles.input}>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                    </div>

                    {/* Checkbox moved to its own container to force next line */}
                    <div className={styles.checkboxContainer}>
                        <div className={styles.checkboxGroup}>
                            <input 
                                type="checkbox" 
                                name="is_temporary" 
                                id="is_temporary" 
                                checked={formData.is_temporary === 1} 
                                onChange={handleChange} 
                            />
                            <label htmlFor="is_temporary">
                                Force user to change password on next login
                            </label>
                        </div>
                    </div>

                    <div className={styles.fullWidth}>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-save"></i>}
                            &nbsp; {loading ? 'Saving Changes...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}