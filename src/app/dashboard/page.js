'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import MapViewer from '@/components/maps/MapViewer';
import { logoPath } from '@/assets/images';
import styles from './map.module.css';

const STATUS_FLOW = [
  'Not Approached',
  'Interest Letter Sent',
  'Society Docs Received',
  'Architect Survey Phase',
  'Offer Letter Sent',
  'Offer Under Negotiation',
  'Offer Accepted',
  'Consent Phase',
  'DA Phase',
  'Plan & CC Phase'
];

const getStatusColor = (s) => {
  const colors = { 
    'Not Approached': '#ef4444', 
    'Interest Letter Sent': '#f59e0b', 
    'Society Docs Received': '#8b5cf6', 
    'Architect Survey Phase': '#3b82f6', 
    'Offer Letter Sent': '#6366f1', 
    'Offer Under Negotiation': '#a855f7', 
    'Offer Accepted': '#10b981', 
    'Consent Phase': '#f97316', 
    'DA Phase': '#ec4899', 
    'Plan & CC Phase': '#14b8a6' 
  };
  return colors[s] || '#9ca3af';
};

const formatKeyName = (key) => {
  const result = key.replace(/([A-Z_])/g, " $1").replace(/_/g, '');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const safeJSONParse = (data, fallback = null) => {
  if (data === null || data === undefined || data === '') return fallback;
  if (typeof data === 'object') return data;
  try {
    let parsed = JSON.parse(data);
    while (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (e) {
    return fallback;
  }
};

export default function DashboardMapPage() {
  const [properties, setProperties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStatus, setExpandedStatus] = useState(null);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const [currentStyle, setCurrentStyle] = useState('satellite');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        const u = data.user || data;
        setUserRole(u.role || '');
      })
      .catch(err => console.error(err));

    fetch('/api/properties')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.properties)) {
          setProperties(data.properties);
        } else if (Array.isArray(data)) {
          setProperties(data);
        } else {
          setProperties([]);
        }
      })
      .catch(err => {
        console.error("Failed to fetch properties:", err);
        setProperties([]);
      });
  }, []);

  const getFilteredProperties = (status) => {
    if (!Array.isArray(properties)) return [];
    return properties.filter(p =>
      p.status === status && (p.property_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const linkedProperties = useMemo(() => {
    if (!selectedProperty || !selectedProperty.club_id || !Array.isArray(properties)) return [];
    return properties.filter(p => p.club_id === selectedProperty.club_id && p.id !== selectedProperty.id);
  }, [selectedProperty, properties]);

  // --- RBAC PERMISSIONS ---
  const roleStr = (userRole || '').trim().toLowerCase();

  const isFieldExec = roleStr === 'field executive';

  const canViewContacts = ['super admin', 'admin', 'crm', 'sales', 'view only', 'field executive'].includes(roleStr);
  const canViewOffers = ['super admin', 'admin', 'crm', 'sales', 'view only'].includes(roleStr);
  const canViewAdvancedDetails = !isFieldExec;
  const canViewSystemInfo = ['super admin', 'admin', 'view only'].includes(roleStr);

  const buildCommitteeList = () => {
    if (!selectedProperty) return null;
    const list = [];

    const addCard = (role, detailStr) => {
      const detail = safeJSONParse(detailStr, {});
      if (detail && (detail.name || detail.contact)) {
        list.push({
          Role: role,
          Name: detail.name || '-',
          Contact: canViewContacts ? (detail.contact || '-') : '*** RESTRICTED ***'
        });
      }
    };

    addCard('Chairman', selectedProperty.chairman_details);
    addCard('Secretary', selectedProperty.secretary_details);
    addCard('Treasurer', selectedProperty.treasurer_details);
    addCard('Responsible Person', selectedProperty.responsible_person_details);

    const others = safeJSONParse(selectedProperty.extra_committee_members, []);
    if (Array.isArray(others)) {
      others.forEach((o, i) => addCard(`Member ${i + 1}`, JSON.stringify(o)));
    }

    return list.length > 0 ? list : null;
  };

  const buildPmcCpList = () => {
    if (!selectedProperty) return null;
    const list = [];

    if (selectedProperty.pmc_name || selectedProperty.pmc_contact) {
      list.push({
        Role: 'PMC / Co-ordinator',
        Name: selectedProperty.pmc_name || '-',
        Contact: selectedProperty.pmc_contact ? (canViewContacts ? selectedProperty.pmc_contact : '*** RESTRICTED ***') : '-'
      });
    }

    const cpName = selectedProperty.cp_name || (selectedProperty.assigned_cp_id ? `ID: ${selectedProperty.assigned_cp_id}` : '');
    if (cpName || selectedProperty.cp_phone) {
      list.push({
        Role: 'CP', 
        Name: cpName || '-',
        Contact: selectedProperty.cp_phone ? (canViewContacts ? selectedProperty.cp_phone : '*** RESTRICTED ***') : '-'
      });
    }

    return list.length > 0 ? list : null;
  };

  const renderFileLink = (label, fileKey) => {
    if (!fileKey) return null;
    return (
      <div className={styles.field} key={label} style={{ width: '100%', boxSizing: 'border-box' }}>
        <label>{label}</label>
        <p style={{ margin: 0 }}>
          <a href={`/api/viewDoc?key=${encodeURIComponent(fileKey)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontSize: '13px', textDecoration: 'none', wordBreak: 'break-all', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <i className="fa fa-external-link" style={{ marginTop: '2px' }}></i> {fileKey.split('/').pop()}
          </a>
        </p>
      </div>
    );
  };

  const renderMultipleFiles = (label, filesString) => {
    const files = safeJSONParse(filesString, []);
    if (!Array.isArray(files) || files.length === 0) return null;
    return (
      <div className={styles.field} key={label} style={{ width: '100%', boxSizing: 'border-box' }}>
        <label>{label}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {files.map((f, i) => (
            <p key={i} style={{ margin: 0 }}>
              <a href={`/api/viewDoc?key=${encodeURIComponent(f)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontSize: '13px', textDecoration: 'none', wordBreak: 'break-all', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <i className="fa fa-external-link" style={{ marginTop: '2px' }}></i> {f.split('/').pop()}
              </a>
            </p>
          ))}
        </div>
      </div>
    );
  };

  const renderActivityLogs = () => {
    if (!selectedProperty) return null;
    const logs = safeJSONParse(selectedProperty.activity_logs, []);
    if (!Array.isArray(logs) || logs.length === 0) return <p style={{fontSize:'12px', color:'#94a3b8', margin: 0}}>No activity logs found.</p>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
        {logs.map((log, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#64748b', fontSize: '11px' }}>
              <strong>{log.category}</strong>
              <span>{log.date ? log.date.split(',')[0] : ''}</span>
            </div>
            <div style={{ color: '#1f2937', marginBottom: '6px' }}>{log.note}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px', fontStyle: 'italic', textAlign: 'right' }}>By: {log.user}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderField = (label, val, isPill = false, isDocList = false) => {
    if (val === null || val === undefined || val === '') return null;

    if (isPill) {
      const isYes = val === 1 || val === 'YES' || val === true;
      return (
        <div className={styles.field} key={label} style={{ width: '100%', boxSizing: 'border-box' }}>
          {label && <label>{label}</label>}
          <span className={styles.yesBadge} style={{
            background: isYes ? '#f0fdf4' : '#fef2f2',
            color: isYes ? '#166534' : '#991b1b',
            border: `1px solid ${isYes ? '#bbf7d0' : '#fecaca'}`,
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold'
          }}>
            {isYes ? 'YES' : 'NO'}
          </span>
        </div>
      );
    }

    if (isDocList) {
      const docs = safeJSONParse(val, []);
      if (!Array.isArray(docs) || docs.length === 0) return <p style={{ fontSize: '12px', color: '#64748b' }}>No documents specified</p>;

      return (
        <div className={styles.field} key={label} style={{ width: '100%', boxSizing: 'border-box' }}>
          {label && <label>{label}</label>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {docs.map((doc, idx) => {
              const isYes = doc.value === 1;
              return (
                <div key={idx} style={{
                  background: isYes ? '#f8fafc' : '#fff1f2',
                  border: `1px solid ${isYes ? '#e2e8f0' : '#ffe4e6'}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', wordBreak: 'break-word', flex: 1, lineHeight: '1.4' }}>
                      {idx + 1}. {doc.label}
                    </span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 'bold', 
                      color: isYes ? '#0f766e' : '#9f1239', 
                      background: isYes ? '#ccfbf1' : '#ffe4e6',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      flexShrink: 0 
                    }}>
                      {isYes ? 'YES' : 'NO'}
                    </span>
                  </div>
                  {isYes && doc.file_name && (
                    <a href={`/api/viewDoc?key=${encodeURIComponent(doc.file_name)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0ea5e9', wordBreak: 'break-all', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <i className="fa fa-paperclip"></i> {doc.file_name.split('/').pop()}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return null;
      return (
        <div className={styles.field} key={label} style={{ width: '100%', boxSizing: 'border-box' }}>
          {label && <label>{label}</label>}
          <div className={styles.nestedCardList}>
            {val.map((item, idx) => (
              <div key={`${label}-${idx}`} className={styles.nestedCard}>
                {Object.entries(item).map(([k, v]) => (
                  <div key={k} className={styles.nestedRow}>
                    <span className={styles.nestedKey}>{formatKeyName(k)}:</span>
                    <span className={styles.nestedVal} style={{ color: v === '*** RESTRICTED ***' ? '#ef4444' : 'inherit' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.field} key={label} style={{ width: '100%', boxSizing: 'border-box' }}>
        {label && <label>{label}</label>}
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#1f2937', wordBreak: 'break-word' }}>{String(val)}</p>
      </div>
    );
  };

  const legendStatuses = Array.from(new Set([...STATUS_FLOW, ...properties.map(p => p.status)])).filter(Boolean);
  const isSearching = searchTerm.trim().length > 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.mapContainer}>
        <MapViewer 
          properties={properties} 
          mapStyle={currentStyle} 
          onMarkerClick={setSelectedProperty} 
          selectedProperty={selectedProperty}
          center={selectedProperty ? { lat: Number(selectedProperty.lat), lng: Number(selectedProperty.lng) } : undefined}
          zoom={selectedProperty ? 18 : undefined}
        />
      </div>

      <div className={`${styles.detailSidebar} ${selectedProperty ? styles.showSidebar : ''}`}>
        {selectedProperty && (
          <>
            <div className={styles.sidebarHeader}>
              <button className={styles.closeBtn} onClick={() => setSelectedProperty(null)}>
                <i className="fa fa-times"></i>
              </button>
              <div className={styles.headerInfo}>
                <span className={styles.subLabel}>PROPERTY DETAIL</span>
                <div className={styles.titleRow}>
                  <Image src={logoPath} alt="AsmitA Logo" width={38} height={38} className={styles.sidebarLogo} priority />
                  <h2>{selectedProperty.property_name}</h2>
                </div>
              </div>
            </div>

            <div className={styles.sidebarBody}>
              <div className={styles.statusPill} style={{ borderColor: getStatusColor(selectedProperty.status), color: getStatusColor(selectedProperty.status) }}>
                <span className={styles.dot} style={{ background: getStatusColor(selectedProperty.status) }}></span>
                {selectedProperty.status}
              </div>

              {selectedProperty.club_id && (
                <div className={styles.sideSection} style={{ borderLeft: '4px solid #3b82f6', background: '#eff6ff' }}>
                  <h4 className={styles.sectionHeading} style={{ color: '#1e40af', borderBottomColor: '#bfdbfe' }}>
                    <i className="fa fa-link"></i> Linked Redevelopment Club
                  </h4>
                  <p style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '10px', fontWeight: '700' }}>
                    These properties are clubbed for joint redevelopment.
                  </p>
                  <div className={styles.linkedList}>
                    {linkedProperties.length > 0 ? linkedProperties.map(lp => (
                      <div key={lp.id} className={styles.linkedItem} onClick={() => setSelectedProperty(lp)}>
                        <i className="fa fa-building"></i>
                        <div className={styles.linkedItemInfo}>
                          <strong>{lp.property_name}</strong>
                          <span>{lp.locality}</span>
                        </div>
                        <i className="fa fa-chevron-right"></i>
                      </div>
                    )) : (
                      <p className={styles.emptyVal}>No other properties in this club.</p>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-building-o"></i> 1. BUILDING & LEAD DETAILS</h4>
                {renderField('', buildPmcCpList())}
                {renderField('ADDRESS', selectedProperty.address || 'Address not provided')}
                {renderField('LOCALITY', selectedProperty.locality)}
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-balance-scale"></i> 2. LAND & LEGAL DETAILS</h4>
                {renderField('LAND OWNER / SOCIETY', selectedProperty.land_owner_name)}
                {renderField('LAND TYPE', selectedProperty.land_type)}
                {renderField('CTS / SURVEY NO', selectedProperty.cts_survey_no)}
              </div>

              {canViewAdvancedDetails && (
                <>
                  <div className={styles.sideSection}>
                    <h4 className={styles.sectionHeading}><i className="fa fa-university"></i> 3. SOCIETY REGISTRATION</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {renderField('SOCIETY REGISTERED?', selectedProperty.is_society_registered, true)}
                      {renderField('REGISTRATION NO.', selectedProperty.registration_no)}
                    </div>
                  </div>

                  <div className={styles.sideSection}>
                    <h4 className={styles.sectionHeading}><i className="fa fa-users"></i> 4. COMMITTEE & CONTACTS</h4>
                    {renderField('', buildCommitteeList())}
                  </div>

                  <div className={styles.sideSection}>
                    <h4 className={styles.sectionHeading}><i className="fa fa-pie-chart"></i> 5. AREA INFO</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {renderField('TOTAL PLOT AREA', selectedProperty.total_plot_area)}
                      {renderField('TOTAL FLATS', selectedProperty.total_flats)}
                      {renderField('TOTAL SHOPS', selectedProperty.total_shops)}
                      {renderField('TOTAL AREA COMBINED', selectedProperty.total_flat_area_combined)}
                    </div>
                  </div>

                  <div className={styles.sideSection}>
                    <h4 className={styles.sectionHeading}><i className="fa fa-gavel"></i> 6. LEGAL PERMISSIONS & SURVEY</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {renderField('OC', selectedProperty.has_oc, true)}
                      {renderField('LEGAL DISPUTE', selectedProperty.has_legal_dispute, true)}
                      {renderField('MORTGAGED', selectedProperty.is_mortgaged, true)}
                      {renderField('REDEV. INTEREST', selectedProperty.has_redevelopment_interest, true)}
                      {renderField('PHYSICAL SURVEY ALLOWED', selectedProperty.physical_survey_allowed, true)}
                      {renderField('FLAT MEASUREMENT', selectedProperty.flat_measure_allowed, true)}
                      {renderField('BANNER PERMISSION', selectedProperty.banner_permission_allowed, true)}
                    </div>
                    {selectedProperty.banner_permission_allowed === 1 && renderField('HOARDING DATE', new Date(selectedProperty.hoarding_date).toLocaleDateString())}
                    
                    <hr style={{ borderTop: '1px dashed #cbd5e1', margin: '15px 0' }} />
                    
                    {renderField('PHYSICAL SURVEY STATUS', selectedProperty.physical_survey)}
                    {renderField('SURVEY RECORDS', selectedProperty.physical_survey_records)}

                    <hr style={{ borderTop: '1px dashed #cbd5e1', margin: '15px 0' }} />

                    <div style={{ marginTop: '10px' }}>
                      {renderField('CONSENT ROUTE', selectedProperty.consent_type)}
                    </div>
                    {renderFileLink('79/A CONSENT DOCUMENT', selectedProperty.consent_79a_file)}
                  </div>

                  {canViewOffers && (
                    <div className={styles.sideSection} style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 className={styles.sectionHeading} style={{ color: '#0f172a' }}>
                        <i className="fa fa-handshake-o"></i> 7. PROPOSAL & OFFERS
                      </h4>
                      {renderFileLink('INTEREST LETTER', selectedProperty.interest_letter_file)}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        {renderField('SOCIETY ACKNOWLEDGED?', selectedProperty.society_acknowledgement, true)}
                        {renderField('OFFER LETTER SENT?', selectedProperty.offer_letter_sent, true)}
                      </div>
                      {renderMultipleFiles('OFFER LETTERS SENT', selectedProperty.offer_letter_files)}
                      {renderFileLink('OFFER ACCEPTANCE LETTER', selectedProperty.offer_acceptance_letter_file)}
                      
                      <hr style={{ borderTop: '1px dashed #cbd5e1', margin: '15px 0' }} />
                      
                      {renderField('INTERACTION HISTORY', selectedProperty.interaction_history)}
                      {renderField('OFFER LETTER STATUS', selectedProperty.offer_letter_status)}
                      {renderField('OFFER MEETING TRACK', selectedProperty.offer_meeting_track)}
                      {selectedProperty.offer_letter_status === 'Accepted' && renderField('ACCEPTANCE DATE', new Date(selectedProperty.offer_acceptance_date).toLocaleDateString())}

                    </div>
                  )}

                  <div className={styles.sideSection}>
                    <h4 className={styles.sectionHeading}><i className="fa fa-list-ol"></i> 8. DOCUMENT CHECKLIST</h4>
                    {renderField('DOCUMENT CHECKLIST', selectedProperty.document_checklist, false, true)}
                    {renderField('DOCUMENT REMARKS', selectedProperty.document_remarks)}
                  </div>

                  <div className={styles.sideSection}>
                    <h4 className={styles.sectionHeading}><i className="fa fa-map"></i> 9. PLAN & CC</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      {renderField('APPROVED PLAN', selectedProperty.has_approved_plan, true)}
                      {renderField('CC', selectedProperty.has_cc, true)}
                    </div>
                    {renderFileLink('APPROVED PLAN DOCUMENT', selectedProperty.approved_plan_file)}
                    {renderFileLink('COMMENCEMENT CERT (CC)', selectedProperty.cc_file)}
                    
                    <hr style={{ borderTop: '1px dashed #e2e8f0', margin: '10px 0' }} />
                    
                    {renderField('ARCHITECT SURVEY STATUS', selectedProperty.architect_survey_status)}
                    {renderField('SENT TO ARCHITECT?', selectedProperty.sent_to_architect, true)}
                  </div>

                  {canViewOffers && (
                    <div className={styles.sideSection} style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 className={styles.sectionHeading} style={{ color: '#0f172a' }}>
                        <i className="fa fa-flag-checkered"></i> 10. LEGAL PIPELINE & MILESTONES
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {renderField('SGM COMPLETED?', selectedProperty.sgm_completed, true)}
                      </div>
                      {renderField('DA AGREEMENT STATUS', selectedProperty.da_agreement_status)}
                      {renderField('ON-GROUND PROGRESS', selectedProperty.project_progress || 'Not Started')}
                    </div>
                  )}

                  {canViewOffers && (
                    <div className={styles.sideSection} style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                      <h4 className={styles.sectionHeading} style={{ color: '#0f172a' }}>
                        <i className="fa fa-history"></i> 11. ACTIVITY LOGS
                      </h4>
                      {/* Render legacy interaction history only if it exists and activity logs are empty */}
                      {selectedProperty?.interaction_history && safeJSONParse(selectedProperty?.activity_logs, []).length === 0 && (
                        renderField('LEGACY INTERACTION HISTORY', selectedProperty.interaction_history)
                      )}
                      {renderActivityLogs()}
                    </div>
                  )}

                  {canViewSystemInfo && (
                    <div className={styles.sideSection} style={{ background: '#f1f5f9', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
                      <h4 className={styles.sectionHeading} style={{ color: '#334155', margin: 0, paddingBottom: '10px' }}>
                        <i className="fa fa-info-circle"></i> SYSTEM INFO
                      </h4>
                      {renderField('LAST EDITED BY', selectedProperty.updated_by_name || 'Unknown')}
                    </div>
                  )}
                </>
              )}

            </div>
          </>
        )}
      </div>

      <div className={`${styles.legend} ${isLegendCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.legendHeader} onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}>
          <div className={styles.headerTitle}>
            <h3>MAP LEGEND</h3>
            <span className={styles.totalBadge}>{Array.isArray(properties) ? properties.length : 0} total</span>
          </div>
          <i className={`fa ${isLegendCollapsed ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
        </div>
        {!isLegendCollapsed && (
          <div className={styles.legendBody}>
            <div className={styles.searchBox}>
              <i className="fa fa-search"></i>
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className={styles.statusSections}>
              {legendStatuses.map(status => {
                const list = getFilteredProperties(status);
                
                // If user is searching, hide empty statuses. If not searching, hide empty legacy statuses.
                if (isSearching && list.length === 0) return null;
                if (!isSearching && list.length === 0 && !STATUS_FLOW.includes(status)) return null;

                // Auto-expand categories if a search is active, otherwise rely on manual toggle state
                const isOpen = isSearching || expandedStatus === status;

                return (
                  <div key={status} className={styles.section}>
                    <button 
                      className={styles.sectionToggle} 
                      onClick={() => {
                        // Allow manual toggling only if not currently searching
                        if (!isSearching) setExpandedStatus(isOpen ? null : status);
                      }}
                      style={{ cursor: isSearching ? 'default' : 'pointer' }}
                    >
                      <div className={styles.statusLabel}>
                        <span className={styles.dot} style={{ background: getStatusColor(status) }}></span>
                        {status}
                      </div>
                      <span className={styles.countBadge}>{list.length}</span>
                    </button>
                    {isOpen && (
                      <ul className={styles.propertyList}>
                        {list.map(p => (
                          <li key={p.id} className={styles.propertyItem} onClick={() => setSelectedProperty(p)} style={{ cursor: 'pointer' }}>
                            {p.property_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.styleSwitcher}>
        {['streets', 'satellite'].map(style => (
          <button key={style} className={`${styles.styleBtn} ${currentStyle === style ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(style)}>
            {style === 'satellite' ? 'SATELLITE' : 'STREETS'}
          </button>
        ))}
      </div>
    </div>
  );
}