'use client';
import { useState, useEffect } from 'react';

export default function SchemaTestPage() {
    const [schema, setSchema] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/debug/schema')
            .then(res => res.json())
            .then(data => {
                if (data.success) setSchema(data.schema);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p style={{ padding: '20px' }}>Analyzing database structure...</p>;
    if (!schema) return <p style={{ padding: '20px', color: 'red' }}>Failed to fetch schema.</p>;

    return (
        <div style={{ padding: '40px', fontFamily: 'monospace', backgroundColor: '#f4f4f4', minHeight: '100vh' }}>
            <h1 style={{ color: '#1e4ec4' }}>Database Schema Inspector</h1>
            <hr />

            {Object.entries(schema).map(([tableName, columns]) => (
                <section key={tableName} style={{ marginBottom: '40px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ textTransform: 'uppercase', color: '#333', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                        Table: <span style={{ color: '#ef4444' }}>{tableName}</span>
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
                                <th style={thStyle}>Field</th>
                                <th style={thStyle}>Type</th>
                                <th style={thStyle}>Null</th>
                                <th style={thStyle}>Key</th>
                                <th style={thStyle}>Default</th>
                            </tr>
                        </thead>
                        <tbody>
                            {columns.map((col) => (
                                <tr key={col.Field} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={tdStyle}><strong>{col.Field}</strong></td>
                                    <td style={tdStyle}><code style={{ color: '#059669' }}>{col.Type}</code></td>
                                    <td style={tdStyle}>{col.Null}</td>
                                    <td style={tdStyle}>{col.Key || '-'}</td>
                                    <td style={tdStyle}>{col.Default || 'NULL'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            ))}
        </div>
    );
}

const thStyle = { padding: '12px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #eee' };
const tdStyle = { padding: '12px', fontSize: '14px', color: '#374151' };