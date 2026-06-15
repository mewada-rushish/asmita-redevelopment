'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Accordion from '@/components/accordion/Accordion';
import styles from './list.module.css';

const safeParse = (data) => {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try { return JSON.parse(data); } catch { return {}; }
};

const STATUS_FLOW = [
  'Not Approached',
  'Interest Letter Sent',
  'Society Docs Received',
  'Architect Survey Phase',
  'Architect Survey Completed',
  'Offer Letter Sent',
  'Offer Under Negotiation',
  'Offer Accepted',
  'Consent Phase',
  'DA Phase',
  'Plan & CC Phase'
];

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
  
  // Custom Modal State for Safe Deletions
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Table Scroll Sync & Drag States
  const topScrollRef = useRef(null);
  const tableWrapperRef = useRef(null);
  const tableRef = useRef(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const filterOptions = ['All', ...STATUS_FLOW];

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
        setDeleteConfirmId(null);
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

  const filteredData = Array.isArray(properties) ? properties.filter(p => {
    const matchesSearch = (p.property_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.locality || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    return matchesSearch && matchesFilter;
  }) : [];

  // --- REUSED SECURE EXPORT LOGIC ---
  const handleExport = () => {
    if (filteredData.length === 0) {
      toast.error("No data matching current search/filter available to export.");
      return;
    }
    
    toast.success("Generating highly styled Excel report...");
    
    // Convert current filtered property IDs to a query string
    const filteredIds = filteredData.map(p => p.id).join(',');
    window.open(`/api/properties/export?ids=${filteredIds}`, '_blank');
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const roleStr = userRole ? userRole.toLowerCase() : '';
  const canAdd = ['super admin', 'admin', 'crm team', 'crm', 'field executive', 'channel partner', 'cp'].includes(roleStr);
  const canEdit = ['super admin', 'admin', 'crm team', 'crm'].includes(roleStr);
  const canDelete = ['super admin', 'admin'].includes(roleStr);
  const canExport = roleStr && roleStr !== 'view only';

  // --- Scroll & Drag Handlers ---
  useEffect(() => {
    if (tableRef.current) {
      setTableScrollWidth(tableRef.current.scrollWidth);
    }
  }, [currentItems, loading]);

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
    e.preventDefault(); 
    const x = e.pageX - tableWrapperRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; 
    tableWrapperRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Helper for rendering boolean values in the modal
  const renderBool = (val) => (
    <span className={val === 1 || val === true || val === '1' ? styles.badgeYes : styles.badgeNo}>
      {val === 1 || val === true || val === '1' ? 'YES' : 'NO'}
    </span>
  );

  // Helper for rendering a single field
  const Field = ({ label, value }) => (
    <div className={styles.detailItem}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value || '-'}</span>
    </div>
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1>Properties</h1>
          <p>{filteredData.length} entries match your filters</p>
        </div>
        <div className={styles.actionBtns}>
          {canExport && (
            <button onClick={handleExport} className={styles.exportBtn}>
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
        {/* --- TOP SCROLLBAR --- */}
        <div className={styles.topScrollWrapper} ref={topScrollRef} onScroll={handleTopScroll}>
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
                <th>ID</th>
                <th>BUILDING NAME</th>
                <th>LOCATION / AREA</th>
                <th>STATUS</th>
                <th>LAST EDITED BY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className={styles.loadingCell}>Loading...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className={styles.emptyCell}>
                    <div className={styles.emptyState}>
                      <i className="fa fa-folder-open-o"></i>
                      <p>No properties found matching your search or filter.</p>
                    </div>
                  </td>
                </tr>
              ) : currentItems.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className={styles.idBadge}>#{p.id}</span>
                  </td>
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
                          color: getStatusColor(p.status),
                          opacity: !canEdit ? 0.7 : 1,
                          cursor: !canEdit ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {STATUS_FLOW.map(o => (
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
                      <button onClick={() => handleViewClick(p)} className={styles.viewBtn} title="View Details">
                        <i className="fa fa-eye"></i>
                      </button>
                      {canEdit ? (
                        <Link href={`/dashboard/edit/${p.id}`} className={styles.editBtn} draggable="false" title="Edit Property">
                          <i className="fa fa-pencil"></i>
                        </Link>
                      ) : (
                        <span className={styles.viewOnlyText}>View Only</span>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteConfirmId(p.id)} className={styles.deleteBtn} title="Delete Property">
                          <i className="fa fa-trash"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

      {/* --- VIEW PROPERTY MODAL --- */}
      {isModalOpen && selectedProperty && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBox}>
                <span className={styles.idBadge}>#{selectedProperty.id}</span>
                <h2>{selectedProperty.property_name}</h2>
              </div>
              <button onClick={closeModal} className={styles.closeBtn}>&times;</button>
            </div>

            <div className={styles.modalBody}>
              <Accordion title="1. Basic & Area Information" icon="fa-building" defaultOpen={true}>
                <div className={styles.detailGrid}>
                  <Field label="Address" value={selectedProperty.address} />
                  <Field label="Locality" value={selectedProperty.locality} />
                  <Field label="PMC Name" value={selectedProperty.pmc_name} />
                  <Field label="PMC Contact" value={selectedProperty.pmc_contact} />
                  <Field label="CP Name" value={selectedProperty.cp_name || selectedProperty.assigned_cp_id} />
                  <Field label="CP Contact" value={selectedProperty.cp_phone} />
                </div>
                <hr className={styles.divider} />
                <div className={styles.detailGrid}>
                  <Field label="Total Plot Area" value={selectedProperty.total_plot_area} />
                  <Field label="Total Flats" value={selectedProperty.total_flats} />
                  <Field label="Total Shops" value={selectedProperty.total_shops} />
                  <Field label="Combined Area" value={selectedProperty.total_flat_area_combined} />
                </div>
              </Accordion>

              <Accordion title="2. Land & Society Registration" icon="fa-balance-scale">
                <div className={styles.detailGrid}>
                  <Field label="Land Owner / Society" value={selectedProperty.land_owner_name} />
                  <Field label="Land Type" value={selectedProperty.land_type} />
                  <Field label="CTS / Survey No" value={selectedProperty.cts_survey_no} />
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Society Registered?</span>
                    {renderBool(selectedProperty.is_society_registered)}
                  </div>
                  <Field label="Registration No." value={selectedProperty.registration_no} />
                </div>
              </Accordion>

              <Accordion title="3. Committee & Contacts" icon="fa-users">
                <div className={styles.detailGrid}>
                  <Field label="Chairman" value={`${safeParse(selectedProperty.chairman_details).name || '-'} (${safeParse(selectedProperty.chairman_details).contact || '-'})`} />
                  <Field label="Secretary" value={`${safeParse(selectedProperty.secretary_details).name || '-'} (${safeParse(selectedProperty.secretary_details).contact || '-'})`} />
                  <Field label="Treasurer" value={`${safeParse(selectedProperty.treasurer_details).name || '-'} (${safeParse(selectedProperty.treasurer_details).contact || '-'})`} />
                  <Field label="Responsible Person" value={`${safeParse(selectedProperty.responsible_person_details).name || '-'} (${safeParse(selectedProperty.responsible_person_details).contact || '-'})`} />
                </div>
                
                {Array.isArray(safeParse(selectedProperty.extra_committee_members)) && safeParse(selectedProperty.extra_committee_members).length > 0 && (
                  <div style={{ marginTop: '15px' }}>
                    <span className={styles.detailLabel} style={{ marginBottom: '8px', display: 'block' }}>Extra Members</span>
                    {safeParse(selectedProperty.extra_committee_members).map((m, i) => {
                      if(!m.name && !m.contact) return null;
                      return <div key={i} className={styles.detailValue}>- {m.name || 'Unnamed'} ({m.contact || 'No contact'})</div>;
                    })}
                  </div>
                )}
              </Accordion>

              <Accordion title="4. Permissions, Survey & Legal" icon="fa-gavel">
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Approved Plan</span>{renderBool(selectedProperty.has_approved_plan)}</div>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Has OC</span>{renderBool(selectedProperty.has_oc)}</div>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Has CC</span>{renderBool(selectedProperty.has_cc)}</div>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Legal Dispute</span>{renderBool(selectedProperty.has_legal_dispute)}</div>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Mortgaged</span>{renderBool(selectedProperty.is_mortgaged)}</div>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Redevelopment Interest</span>{renderBool(selectedProperty.has_redevelopment_interest)}</div>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Flat Measure Allowed</span>{renderBool(selectedProperty.flat_measure_allowed)}</div>
                  <div className={styles.detailItem}><span className={styles.detailLabel}>Banner Permission</span>{renderBool(selectedProperty.banner_permission_allowed)}</div>
                </div>
                <hr className={styles.divider} />
                <div className={styles.detailGrid}>
                  <Field label="Physical Survey Status" value={selectedProperty.physical_survey} />
                  <Field label="Survey Records" value={selectedProperty.physical_survey_records} />
                  <Field label="Hoarding Date" value={selectedProperty.hoarding_date ? selectedProperty.hoarding_date.split('T')[0] : '-'} />
                </div>
              </Accordion>

              <Accordion title="5. Documents & Journey" icon="fa-folder-open">
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Interest Letter</span>
                    {selectedProperty.interest_letter_file ? (
                      <a href={`/api/viewDoc?key=${encodeURIComponent(selectedProperty.interest_letter_file)}`} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                        <i className="fa fa-external-link"></i> View Document
                      </a>
                    ) : renderBool(selectedProperty.has_interest_letter)}
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Architect Submitted</span>
                    {renderBool(selectedProperty.sent_to_architect || selectedProperty.architect_submitted)}
                  </div>
                </div>
                
                <div style={{ marginTop: '15px' }}>
                  <span className={styles.detailLabel} style={{ display: 'block', marginBottom: '8px' }}>Document Checklist</span>
                  <div className={styles.checklistGrid}>
                    {Array.isArray(safeParse(selectedProperty.document_checklist)) && safeParse(selectedProperty.document_checklist).map((doc, idx) => (
                       <div key={idx} className={styles.checkItemPill}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                           <span style={{ fontWeight: 600 }}>{doc.label.replace('Bulk: ', '')}</span>
                           {renderBool(doc.value)}
                         </div>
                         {doc.file_name && (
                           <a href={`/api/viewDoc?key=${encodeURIComponent(doc.file_name)}`} target="_blank" rel="noopener noreferrer" className={styles.docLinkSmall}>
                             View File
                           </a>
                         )}
                       </div>
                    ))}
                  </div>
                </div>

                <hr className={styles.divider} />
                
                <div className={styles.detailGrid}>
                  <Field label="Interaction History" value={selectedProperty.interaction_history} />
                  <Field label="Offer Status" value={selectedProperty.offer_letter_status} />
                  <Field label="Offer Meeting Track" value={selectedProperty.offer_meeting_track} />
                  <Field label="Acceptance Date" value={selectedProperty.offer_acceptance_date ? selectedProperty.offer_acceptance_date.split('T')[0] : '-'} />
                  <div className={styles.detailItem}><span className={styles.detailLabel}>SGM Completed</span>{renderBool(selectedProperty.sgm_completed)}</div>
                  <Field label="DA Agreement Status" value={selectedProperty.da_agreement_status} />
                  <Field label="On-Ground Progress" value={selectedProperty.project_progress || 'Not Started'} />
                </div>
              </Accordion>

            </div>
          </div>
        </div>
      )}

      {/* --- IFRAME SECURITY SHIELDED PORTAL CONFIRMATION DIALOG --- */}
      {deleteConfirmId !== null && (
        <div className={styles.modalOverlay} style={{ zIndex: 10000 }}>
          <div className={styles.modalContent} style={{ maxWidth: '450px', background: '#fff' }}>
            <div className={styles.modalHeader} style={{ borderBottom: 'none', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#ef4444' }}>
                <i className="fa fa-exclamation-triangle" style={{ marginRight: '8px' }}></i> Delete Property
              </h2>
              <button onClick={() => setDeleteConfirmId(null)} className={styles.closeBtn}>&times;</button>
            </div>
            <div className={styles.modalBody} style={{ padding: '0 24px 24px' }}>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                Are you sure you want to delete this property? This action cannot be undone and will permanently remove this record from the database.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setDeleteConfirmId(null)} 
                  style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={() => handleDelete(deleteConfirmId)} 
                  style={{ padding: '10px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function getStatusColor(s) {
  const colors = { 
    'Not Approached': '#ef4444', 
    'Interest Letter Sent': '#f97316', 
    'Society Docs Received': '#eab308', 
    'Architect Survey Phase': '#84cc16', 
    'Architect Survey Completed': '#06b6d4', 
    'Offer Letter Sent': '#3b82f6', 
    'Offer Under Negotiation': '#a855f7', 
    'Offer Accepted': '#ec4899', 
    'Consent Phase': '#14b8a6', 
    'DA Phase': '#a0522d', 
    'Plan & CC Phase': '#22c55e' 
  };
  return colors[s] || '#9ca3af';
}

function getStatusBgColor(s) {
  const bgs = { 
    'Not Approached': '#fef2f2', 
    'Interest Letter Sent': '#fff7ed', 
    'Society Docs Received': '#fefce8', 
    'Architect Survey Phase': '#f7fee7', 
    'Architect Survey Completed': '#ecfeff', 
    'Offer Letter Sent': '#eff6ff', 
    'Offer Under Negotiation': '#faf5ff', 
    'Offer Accepted': '#fdf2f8', 
    'Consent Phase': '#f0fdfa', 
    'DA Phase': '#f5ece3', 
    'Plan & CC Phase': '#f0fdf4' 
  };
  return bgs[s] || '#f9fafb';
}