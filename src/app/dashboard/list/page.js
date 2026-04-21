'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import styles from './list.module.css';

const safeParse = (data) => {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try { return JSON.parse(data); } catch { return {}; }
};

export default function PropertiesList() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);
  const [userRole, setUserRole] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  const filterOptions = ['All', 'Not Approached', 'Interested Letter Sent', 'Meeting Finalized', 'Approved'];

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        const u = data.user || data;
        setUserRole(u.role || '');
      })
      .catch(err => console.error(err));

    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProperties(data);
      } else if (data && Array.isArray(data.properties)) {
        setProperties(data.properties);
      } else {
        console.warn('Unexpected /api/properties response:', data);
        setProperties([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load properties.");
      setProperties([]);
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
        toast.success("Status updated successfully!");
      } else {
        toast.error("Failed to update status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while updating status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this property? This action cannot be undone.")) return;

    const deletePromise = fetch(`/api/properties/${id}`, {
      method: 'DELETE'
    }).then(async res => {
      if (!res.ok) throw new Error("Failed to delete property");
      return res.json();
    });

    toast.promise(deletePromise, {
      loading: 'Deleting property...',
      success: () => {
        setProperties(prev => prev.filter(p => p.id !== id));
        return 'Property deleted successfully!';
      },
      error: 'Failed to delete property. Check permissions.'
    });
  };

  const handleViewClick = (property) => {
    setSelectedProperty(property);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProperty(null);
  };

  const exportToExcel = () => {
    try {
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

      toast.success("Exported to Excel successfully!");
    } catch (error) {
      toast.error("Failed to export data.");
    }
  };

  const filteredData = Array.isArray(properties) ? properties.filter(p => {
    const matchesSearch = (p.property_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.locality || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    return matchesSearch && matchesFilter;
  }) : [];

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const roleStr = userRole ? userRole.toLowerCase() : '';
  const canAdd = ['super admin', 'admin', 'crm team', 'crm', 'field executive', 'channel partner', 'cp'].includes(roleStr);
  const canEdit = ['super admin', 'admin', 'crm team', 'crm'].includes(roleStr);
  const canDelete = ['super admin', 'admin'].includes(roleStr);
  const canExport = roleStr && roleStr !== 'view only';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1>Properties</h1>
          <p>{filteredData.length} entries match your filters</p>
        </div>
        <div className={styles.actionBtns}>
          {canExport && (
            <button onClick={exportToExcel} className={styles.exportBtn}>
              <i className="fa fa-file-excel-o"></i> Export Excel
            </button>
          )}
          {canAdd && (
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
                      disabled={!canEdit || updatingId === p.id}
                      style={{
                        borderColor: getStatusColor(p.status),
                        backgroundColor: getStatusBgColor(p.status),
                        opacity: !canEdit ? 0.7 : 1,
                        cursor: !canEdit ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {filterOptions.filter(o => o !== 'All').map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    {updatingId === p.id && <i className="fa fa-spinner fa-spin"></i>}
                  </div>
                </td>
                <td>
                  <span className={styles.emailBadge}>
                    {p.updated_by_name || p.updated_by_email || 'Unknown'}
                  </span>
                </td>
                <td>
                  <div className={styles.actionGroup}>
                    <button onClick={() => handleViewClick(p)} className={styles.viewBtn}>
                      <i className="fa fa-eye"></i> View
                    </button>
                    {canEdit ? (
                      <Link href={`/dashboard/edit/${p.id}`} className={styles.editBtn}>
                        <i className="fa fa-pencil"></i> Edit
                      </Link>
                    ) : (
                      <span className={styles.viewOnlyText}>View Only</span>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        className={styles.deleteBtn}
                        title="Delete Property"
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

      {isModalOpen && selectedProperty && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#1f2937' }}>{selectedProperty.property_name}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <strong style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Address</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1f2937' }}>{selectedProperty.address || 'N/A'}</p>
              </div>

              <div>
                <strong style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>PMC Details</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1f2937' }}>{selectedProperty.pmc_name || 'N/A'} {selectedProperty.pmc_contact ? `(${selectedProperty.pmc_contact})` : ''}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                <div>
                  <strong style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Chairman</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1f2937' }}>{safeParse(selectedProperty.chairman_details).name || 'N/A'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#4b5563' }}>{safeParse(selectedProperty.chairman_details).contact || ''}</p>
                </div>
                <div>
                  <strong style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Secretary</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1f2937' }}>{safeParse(selectedProperty.secretary_details).name || 'N/A'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#4b5563' }}>{safeParse(selectedProperty.secretary_details).contact || ''}</p>
                </div>
                <div>
                  <strong style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Treasurer</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1f2937' }}>{safeParse(selectedProperty.treasurer_details).name || 'N/A'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#4b5563' }}>{safeParse(selectedProperty.treasurer_details).contact || ''}</p>
                </div>
                <div>
                  <strong style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Responsible Person</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1f2937' }}>{safeParse(selectedProperty.responsible_person_details).name || 'N/A'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#4b5563' }}>{safeParse(selectedProperty.responsible_person_details).contact || ''}</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '25px', textAlign: 'right' }}>
              <button onClick={closeModal} style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(s) {
  const colors = { 'Not Approached': '#ef4444', 'Interested Letter Sent': '#f59e0b', 'Meeting Finalized': '#b45309', 'Approved': '#10b981' };
  return colors[s] || '#9ca3af';
}
function getStatusBgColor(s) {
  const bgs = { 'Not Approached': '#fef2f2', 'Interested Letter Sent': '#fffbeb', 'Meeting Finalized': '#fffcf0', 'Approved': '#f0fdf4' };
  return bgs[s] || '#f9fafb';
}