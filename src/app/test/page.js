'use client';
import { useState, useEffect } from 'react';

export default function SchemaTestPage() {
    const [schema, setSchema] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/schema')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSchema(data.schema);
                } else {
                    setError(data.error || 'Failed to load schema');
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px' }}>Loading Database Schema... <i className="fa fa-spinner fa-spin"></i></div>;
    if (error) return <div style={{ padding: '40px', color: 'red', textAlign: 'center' }}>Error: {error}</div>;

    return (
        <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h1 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '15px', marginBottom: '40px', color: '#1f2937' }}>
                <i className="fa fa-database" style={{ marginRight: '10px', color: '#3b82f6' }}></i>
                Database Schema Overview
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                {Object.keys(schema).map(tableName => (
                    <div key={tableName} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>

                        {/* Table Header */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '15px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>
                            <i className="fa fa-table" style={{ marginRight: '8px', color: '#64748b' }}></i>
                            Table: <span style={{ color: '#2563eb' }}>{tableName}</span>
                        </div>

                        {/* Table Content */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '14px', textTransform: 'uppercase' }}>
                                <tr>
                                    <th style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb' }}>Column Name</th>
                                    <th style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb' }}>Field Type</th>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '14px', color: '#334155' }}>
                                {schema[tableName].map((col, idx) => (
                                    <tr key={col.field} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1f2937' }}>
                                            {col.field}
                                        </td>
                                        <td style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', color: '#d97706' }}>
                                            {col.type}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                    </div>
                ))}

                {Object.keys(schema).length === 0 && (
                    <div style={{ textAlign: 'center', color: '#6b7280' }}>No tables found in the database.</div>
                )}
            </div>
        </div>
    );
}