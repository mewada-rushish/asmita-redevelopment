'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './list.module.css';

export default function PropertiesList() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);
  
  // ME ADDED: State to track the current user's role
  const [userRole, setUserRole] = useState(''); 

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filterOptions = ['All', 'Not Approached', 'Interested Letter Sent', 'Meeting Finalized', 'Approved'];

  useEffect(() => {
    // ME ADDED: Fetch the logged-in user's role to enforce permissions
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        const u = data.user || data;
        setUserRole(u.role || '');
      })
      .catch(err => console.error("Failed to load user info", err));

    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      setProperties(data);
    } catch (err) {
      console.error("Failed to fetch properties");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) {
        setProperties(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      }
    } catch (err) {
      console.error("Update error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // --- Export to Excel (CSV Format) ---
  const exportToExcel = () => {
    const headers = ["ID", "Building Name", "Locality", "Address", "Status", "Created At"];
    const rows = filteredData.map(p => [
      p.id, p.property_name, p.locality, p.address.replace(/,/g, ' '), p.status, p.created_at
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AsmitA_Properties_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Filter & Search Logic ---
  const filteredData = properties.filter(p => {
    const matchesSearch = p.property_name.toLowerCase().includes(search.toLowerCase()) || 
                          p.locality.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  // --- Pagination Calculation ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // ME ADDED: Security check flag
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1>Properties</h1>
          <p>{filteredData.length} entries match your filters</p>
        </div>
        <div className={styles.actionBtns}>
          <button onClick={exportToExcel} className={styles.exportBtn}>
            <i className="fa fa-file-excel-o"></i> Export Excel
          </button>
          
          {/* ME FIX: Conditionally render the Add button based on role */}
          {isAdmin && (
            <Link href="/dashboard/add" className={styles.addBtn}>+ Add Property</Link>
          )}
        </div>
      </header>

      <div className={styles.filterBar}>
        <div className={styles.pills}>
          {filterOptions.map(opt => (
            <button 
              key={opt} 
              className={`${styles.pill} ${filter === opt ? styles.activePill : ''}`}
              onClick={() => { setFilter(opt); setCurrentPage(1); }}
            >
              <span className={styles.dot} style={{ background: getStatusColor(opt) }}></span>
              {opt}
            </button>
          ))}
        </div>
        <div className={styles.searchWrapper}>
          <i className="fa fa-search"></i>
          <input 
            type="text" 
            placeholder="Search building name, area..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>BUILDING NAME</th>
              <th>LOCATION / AREA</th>
              <th>STATUS</th>
              <th>LAST EDITED BY</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className={styles.loadingCell}>Loading...</td></tr>
            ) : currentItems.map(p => (
              <tr key={p.id}>
                <td>
                  <div className={styles.buildingCell}>
                    <div className={styles.logoPlaceholder}><i className="fa fa-building"></i></div>
                    <strong>{p.property_name}</strong>
                  </div>
                </td>
                <td><span className={styles.areaText}>{p.locality || p.address}</span></td>
                <td>
                  <div className={styles.statusWrapper}>
                    <select 
                      className={styles.statusDropdown} 
                      value={p.status}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      disabled={updatingId === p.id}
                      style={{ 
                        borderColor: getStatusColor(p.status),
                        backgroundColor: getStatusBgColor(p.status)
                      }}
                    >
                      {filterOptions.filter(o => o !== 'All').map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    {updatingId === p.id && <i className="fa fa-spinner fa-spin"></i>}
                  </div>
                </td>
                <td><span className={styles.emailBadge}>admin@asmita.com</span></td>
                <td>
                  {/* Note: All users can edit, so this button remains unprotected */}
                  <Link href={`/dashboard/edit/${p.id}`} className={styles.editBtn}>
                    <i className="fa fa-pencil"></i> Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* --- Pagination Footer --- */}
        <div className={styles.paginationFooter}>
          <div className={styles.perPage}>
            <span>Show</span>
            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>per page</span>
          </div>
          <div className={styles.pages}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><i className="fa fa-chevron-left"></i></button>
            <span>Page <strong>{currentPage}</strong> of {totalPages || 1}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}><i className="fa fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper colors (Keep these consistent)
function getStatusColor(s) {
  const colors = { 'Not Approached': '#ef4444', 'Interested Letter Sent': '#f59e0b', 'Meeting Finalized': '#b45309', 'Approved': '#10b981' };
  return colors[s] || '#9ca3af';
}
function getStatusBgColor(s) {
  const bgs = { 'Not Approached': '#fef2f2', 'Interested Letter Sent': '#fffbeb', 'Meeting Finalized': '#fffcf0', 'Approved': '#f0fdf4' };
  return bgs[s] || '#f9fafb';
}