'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './addusers.module.css';

export default function AddUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'Field Executive',
        department: 'Sales',
        status: 1,
        is_temporary: 1 
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const finalValue = type === 'checkbox' ? (checked ? 1 : 0) : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
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
                setError(data.error || 'Failed to create user');
            }
        } catch (err) {
            setError('Something went wrong. Check terminal.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/dashboard/users" className={styles.backBtn} title="Back to Users">
                    <i className="fa fa-arrow-left"></i>
                </Link>
                <h1>Add New User</h1>
            </header>

            <form className={styles.formCard} onSubmit={handleSubmit}>
                {error && <div className={styles.error}><i className="fa fa-exclamation-circle"></i> {error}</div>}

                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label>Full Name *</label>
                        <input type="text" name="name" required value={formData.name} onChange={handleChange} className={styles.input} placeholder="John Doe" />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Email Address *</label>
                        <input type="email" name="email" required value={formData.email} onChange={handleChange} className={styles.input} placeholder="john@asmita.com" />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Phone Number</label>
                        <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={styles.input} placeholder="+91 9876543210" />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Temporary Password *</label>
                        <input type="password" name="password" required value={formData.password} onChange={handleChange} className={styles.input} placeholder="••••••••" minLength="6" />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Role</label>
                        <select name="role" value={formData.role} onChange={handleChange} className={styles.input}>
                            <option value="Super Admin">Super Admin</option>
                            <option value="Admin">Admin</option>
                            <option value="Field Executive">Field Executive</option>
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
                        <select name="status" value={formData.status} onChange={handleChange} className={styles.input}>
                            <option value={1}>Active</option>
                            <option value={0}>Inactive</option>
                        </select>
                    </div>

                    {/* ME FIX: Used clean CSS class instead of inline styles */}
                    <div className={styles.checkboxGroup}>
                        <input 
                            type="checkbox" 
                            name="is_temporary" 
                            id="is_temporary" 
                            checked={formData.is_temporary === 1} 
                            onChange={handleChange} 
                        />
                        <label htmlFor="is_temporary">
                            Force user to change password on first login
                        </label>
                    </div>

                    <div className={styles.fullWidth}>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-save"></i>}
                            &nbsp; {loading ? 'Creating User...' : 'Create User'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}