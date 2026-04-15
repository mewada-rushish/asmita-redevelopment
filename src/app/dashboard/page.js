'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import MapLibreViewer from '@/components/maps/MapLibreViewer';
import { logoPath } from '@/assets/images';
import styles from './map.module.css';

const getStatusColor = (s) => {
  const colors = {
    'Not Approached': '#ef4444',
    'Interested Letter Sent': '#f59e0b',
    'Meeting Finalized': '#f97316',
    'Approved': '#10b981'
  };
  return colors[s] || '#6b7280';
};

const formatKeyName = (key) => {
  const result = key.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
};

// THE FIX: This parser now safely ignores normal words and only parses real JSON!
const safeJSONParse = (data) => {
  if (data === null || data === undefined) return null;
  if (typeof data === 'object') return data;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        let parsed = JSON.parse(trimmed);
        while (typeof parsed === 'string') {
          parsed = JSON.parse(parsed); // Catch double-escapes
        }
        return parsed;
      } catch (e) {
        return data; // Return the raw string if JSON parsing somehow fails
      }
    }
  }
  return data; // Return standard strings (like "Mira Road East") untouched
};

const CHECKLIST_LABELS = [
  "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
  "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
  "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
  "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
];

export default function DashboardMapPage() {
  const [properties, setProperties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStatus, setExpandedStatus] = useState(null);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const [currentStyle, setCurrentStyle] = useState('streets');
  const [selectedProperty, setSelectedProperty] = useState(null);

  useEffect(() => {
    fetch('/api/properties').then(res => res.json()).then(data => setProperties(data));
  }, []);

  const getFilteredProperties = (status) => {
    return properties.filter(p =>
      p.status === status && p.property_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const parsedDetails = useMemo(() => safeJSONParse(selectedProperty?.details) || {}, [selectedProperty]);

  const getVal = (keyBase) => {
    if (!selectedProperty) return null;
    const snake = keyBase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    const camel = keyBase.replace(/_([a-z])/g, g => g[1].toUpperCase());
    return parsedDetails[snake] ?? parsedDetails[camel] ?? selectedProperty[snake] ?? selectedProperty[camel];
  };

  const buildCommitteeList = () => {
    const list = [];
    const addCard = (role, name, contact) => {
      if (name || contact) {
        list.push({ Role: role, Name: name || '-', Contact: contact || '-' });
      }
    };

    addCard('Chairman', getVal('chairmanName'), getVal('chairmanContact'));
    addCard('Secretary', getVal('secretaryName'), getVal('secretaryContact'));
    addCard('Treasurer', getVal('treasurerName'), getVal('treasurerContact'));
    addCard('Responsible Person', getVal('responsibleName'), getVal('responsibleContact'));

    const others = safeJSONParse(selectedProperty?.committee);
    if (Array.isArray(others)) {
      others.forEach(o => {
        if (o.name || o.contact) {
          list.push({ Role: 'Member', Name: o.name || '-', Contact: o.contact || '-' });
        }
      });
    }
    return list.length > 0 ? list : null;
  };

  const renderField = (label, rawVal, isPill = false, keyProp = undefined) => {
    if (rawVal === null || rawVal === undefined || rawVal === '') return null;

    const val = safeJSONParse(rawVal);

    if (isPill) {
      const isYes = val === 'YES' || val === true;
      return (
        <div className={styles.field} key={keyProp}>
          {label && <label>{label}</label>}
          <span className={styles.yesBadge} style={{
            background: isYes ? '#dcfce7' : '#fee2e2',
            color: isYes ? '#166534' : '#991b1b'
          }}>
            {String(val).toUpperCase()}
          </span>
        </div>
      );
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return null;

      if (typeof val[0] === 'object' && !val[0].label) {
        return (
          <div className={styles.field} key={keyProp}>
            {label && <label>{label}</label>}
            <div className={styles.nestedCardList}>
              {val.map((item, idx) => (
                <div key={`${keyProp}-${idx}`} className={styles.nestedCard}>
                  {Object.entries(item).map(([k, v]) => (
                    <div key={k} className={styles.nestedRow}>
                      <span className={styles.nestedKey}>{formatKeyName(k)}:</span>
                      <span className={styles.nestedVal}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div className={styles.field} key={keyProp}>
          {label && <label>{label}</label>}
          <div className={styles.badgeGroup}>
            {val.map((item, idx) => {
              const dLabel = item.label || CHECKLIST_LABELS[idx] || `Document ${idx + 1}`;
              const dValue = item.value !== undefined ? item.value : item;
              const isYes = dValue === 'YES' || dValue === true;

              return (
                <span key={idx} className={styles.neutralBadge} style={{
                  background: isYes ? '#f1f8f5' : '#fff1f2',
                  color: isYes ? '#0f766e' : '#9f1239',
                  borderColor: isYes ? '#ccfbf1' : '#ffe4e6',
                  display: 'flex',
                  gap: '6px'
                }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>{dLabel}:</span>
                  <span>{String(dValue)}</span>
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.field} key={keyProp}>
        {label && <label>{label}</label>}
        <p>{String(val)}</p>
      </div>
    );
  };

  const ignoredKeys = [
    'id', 'lat', 'lng', 'property_name', 'status', 'address', 'details',
    'created_at', 'updated_at', 'committee', 'checklist', 'locality'
  ];

  const handledKeys = [
    'landOwner', 'land_owner', 'landType', 'land_type', 'ctsNo', 'cts_no', 'cts',
    'regStatus', 'reg_status', 'regNo', 'reg_no',
    'totalPlotArea', 'total_plot_area', 'totalFlats', 'total_flats', 'totalShops', 'total_shops',
    'totalAreaCombined', 'total_area_combined', 'plotArea', 'flatArea', 'shopArea',
    'chairmanName', 'chairman_name', 'chairmanContact', 'chairman_contact',
    'secretaryName', 'secretary_name', 'secretaryContact', 'secretary_contact',
    'treasurerName', 'treasurer_name', 'treasurerContact', 'treasurer_contact',
    'responsibleName', 'responsible_name', 'responsibleContact', 'responsible_contact',
    'committeeMembers', 'committee_members', 'checklist', 'documentChecklist', 'document_checklist',
    'approvedPlan', 'approved_plan', 'oc', 'cc', 'legalDispute', 'legal_dispute',
    'mortgaged', 'membersInterested', 'members_interested', 'redevelopmentInterest', 'redevelopment_interest',
    'physicalSurvey', 'physical_survey', 'flatMeasure', 'flat_measure', 'bannerPerm', 'banner_perm',
    'legalChecklist', 'surveyChecklist'
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.mapContainer}>
        <MapLibreViewer properties={properties} mapStyle={currentStyle} onMarkerClick={setSelectedProperty} />
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

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-building-o"></i> 1. BUILDING & LAND</h4>
                {renderField('BUILDING NAME', selectedProperty.property_name)}
                {renderField('ADDRESS', selectedProperty.address || 'Address not provided')}
                {renderField('LOCALITY', selectedProperty.locality)}
                {renderField('LAND OWNER / SOCIETY', getVal('landOwner'))}
                {renderField('LAND TYPE', getVal('landType'))}
                {renderField('CTS / SURVEY NO', getVal('ctsNo') || getVal('cts'))}
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-university"></i> 2. REGISTRATION</h4>
                {renderField('SOCIETY REGISTERED?', getVal('regStatus'), true)}
                {renderField('REGISTRATION NO.', getVal('regNo'))}
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-users"></i> 3. COMMITTEE & CONTACTS</h4>
                {renderField('', buildCommitteeList(), false, 'committee-list')}
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-pie-chart"></i> 4. AREA INFO</h4>
                {renderField('TOTAL PLOT AREA', getVal('totalPlotArea') || getVal('plotArea'))}
                {renderField('TOTAL FLATS', getVal('totalFlats'))}
                {renderField('TOTAL SHOPS', getVal('totalShops'))}
                {renderField('TOTAL AREA COMBINED', getVal('totalAreaCombined') || getVal('flatArea'))}
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-balance-scale"></i> 5. STATUS & LEGAL</h4>
                {getVal('legalChecklist')
                  ? renderField('', getVal('legalChecklist'), false, 'legal-checks')
                  : ['approvedPlan', 'oc', 'cc', 'legalDispute', 'mortgaged', 'membersInterested'].map(k => renderField(formatKeyName(k).toUpperCase(), getVal(k), true, k))
                }
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-eye"></i> 6. PERMISSIONS</h4>
                {getVal('surveyChecklist')
                  ? renderField('', getVal('surveyChecklist'), false, 'survey-checks')
                  : ['physicalSurvey', 'flatMeasure', 'bannerPerm'].map(k => renderField(formatKeyName(k).toUpperCase(), getVal(k), true, k))
                }
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-file-text-o"></i> 7. DOCUMENTS</h4>
                {renderField('', getVal('checklist'), false, 'doc-checklist')}
              </div>

              <div className={styles.sideSection}>
                <h4 className={styles.sectionHeading}><i className="fa fa-database"></i> ADDITIONAL INFO</h4>
                {Object.keys(selectedProperty).map(key => {
                  if (ignoredKeys.includes(key) || handledKeys.includes(key)) return null;
                  return renderField(formatKeyName(key).toUpperCase(), selectedProperty[key], false, `prop-${key}`);
                })}
                {Object.keys(parsedDetails).map(key => {
                  if (handledKeys.includes(key)) return null;
                  return renderField(formatKeyName(key).toUpperCase(), parsedDetails[key], false, `det-${key}`);
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`${styles.legend} ${isLegendCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.legendHeader} onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}>
          <div className={styles.headerTitle}>
            <h3>MAP LEGEND</h3>
            <span className={styles.totalBadge}>{properties.length} total</span>
          </div>
          <i className={`fa ${isLegendCollapsed ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
        </div>
        {!isLegendCollapsed && (
          <div className={styles.legendBody}>
            <div className={styles.searchBox}>
              <i className="fa fa-search"></i>
              <input type="text" placeholder="Search..." onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className={styles.statusSections}>
              {['Not Approached', 'Interested Letter Sent', 'Meeting Finalized', 'Approved'].map(status => {
                const list = getFilteredProperties(status);
                const isOpen = expandedStatus === status;
                return (
                  <div key={status} className={styles.section}>
                    <button className={styles.sectionToggle} onClick={() => setExpandedStatus(isOpen ? null : status)}>
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
            {style.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}