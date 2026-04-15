'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Accordion from '@/components/accordion/Accordion';
import MapLibreViewer from '@/components/maps/MapLibreViewer';
import styles from './edit.module.css';

// Bulletproof parser to handle MySQL string escapes
const safeJSONParse = (data) => {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try {
    let parsed = JSON.parse(data);
    while (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed || {};
  } catch (e) {
    return {};
  }
};

export default function EditPropertyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [category, setCategory] = useState('Redevelopment');
  const [committeeMembers, setCommitteeMembers] = useState([]);

  const checklistNames = [
    "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract / Property Card & Mutation Entries",
    "Latest Approved Survey Plan with DP Remarks", "Physical Plot Survey Showing Plot Area",
    "Structural Audit Report", "Society Registration Certificate", "Managing Committee Members Details",
    "Society Members List with Share Holding Details", "Carpet Area Statement (Members / Tenants)",
    "Assessment Extract & Property Tax Bill Copy", "Conveyance Deed / Deemed Conveyance",
    "Society Bye-laws Copy", "Latest Electricity Bill (Common Meter)", "Water Bill Copy",
    "Encumbrance Certificate (if available)", "Any NOC (if applicable)",
    "C-1 Notice (Delapidated building) from MBMC", "Latest Assessment amount paid receipt"
  ];

  const [formData, setFormData] = useState({
    propertyName: '', locality: '', address: '',
    lat: 19.2813, lng: 72.8693, status: 'Not Approached',
    details: {
      landOwner: '', landType: 'Freehold', cts: '', regStatus: 'NO', regNo: '',
      chairmanName: '', chairmanContact: '', secretaryName: '', secretaryContact: '', treasurerName: '', treasurerContact: '',
      responsibleName: '', responsibleContact: '', plotArea: '', totalFlats: '', totalShops: '', wings: '', floors: '',
      flatArea: '', shopArea: '', approvedPlan: 'NO', oc: 'NO', cc: 'NO', legalDispute: 'NO', mortgaged: 'NO',
      membersInterested: 'NO', agreeCount: '', priorDiscussion: 'NO', physicalSurvey: 'NO', flatMeasure: 'NO', bannerPerm: 'NO',
      checklistRemarks: ''
    },
    checklist: checklistNames.map(name => ({ label: name, value: 'NO' }))
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`/api/properties/${id}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        if (data) {
          setCategory(data.category || 'Redevelopment');

          let parsedCommittee = safeJSONParse(data.committee);
          if (!Array.isArray(parsedCommittee)) parsedCommittee = [];
          setCommitteeMembers(parsedCommittee);

          let parsedDetails = safeJSONParse(data.details);

          let incomingCheck = safeJSONParse(data.checklist);
          if (!Array.isArray(incomingCheck)) incomingCheck = [];

          const standardizedCheck = checklistNames.map((name, i) => {
            const existing = incomingCheck[i];
            const val = (typeof existing === 'object' && existing !== null) ? existing.value : (existing || 'NO');
            return { label: name, value: val };
          });

          setFormData(prev => ({
            ...prev,
            propertyName: data.property_name || '',
            locality: data.locality || '',
            address: data.address || '',
            lat: parseFloat(data.lat) || 19.2813,
            lng: parseFloat(data.lng) || 72.8693,
            status: data.status || 'Not Approached',
            details: { ...prev.details, ...parsedDetails },
            checklist: standardizedCheck
          }));
        }
      } catch (err) {
        console.error("Load Error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  const handleAddressSearch = async (query) => {
    setFormData(prev => ({ ...prev, address: query }));
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    setShowSuggestions(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lat=19.2813&lon=72.8693`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  const selectSuggestion = (f) => {
    const [lon, lat] = f.geometry.coordinates;
    const name = f.properties.name || '';
    const city = f.properties.city || f.properties.district || '';
    setFormData(prev => ({ ...prev, address: city ? `${name}, ${city}` : name, lat, lng: lon, locality: city || prev.locality }));
    setShowSuggestions(false);
  };

  const handleBlur = () => setTimeout(() => setShowSuggestions(false), 300);
  const updateDetail = (key, val) => setFormData(p => ({ ...p, details: { ...p.details, [key]: val } }));

  const updateCheck = (i, val) => {
    const next = [...formData.checklist];
    next[i] = { ...next[i], value: val };
    setFormData(p => ({ ...p, checklist: next }));
  };

  const handleLocationSelect = useCallback((c) => {
    setFormData(prev => ({ ...prev, lat: c.lat, lng: c.lng }));
  }, []);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const legalChecklist = [
        { label: 'Approved Plan', value: formData.details.approvedPlan },
        { label: 'OC', value: formData.details.oc },
        { label: 'CC', value: formData.details.cc },
        { label: 'Legal Dispute', value: formData.details.legalDispute },
        { label: 'Mortgaged', value: formData.details.mortgaged },
        { label: 'Redevelopment Interest', value: formData.details.membersInterested }
      ];

      const surveyChecklist = [
        { label: 'Physical Survey Allowed', value: formData.details.physicalSurvey },
        { label: 'Flat Measurement Allowed', value: formData.details.flatMeasure },
        { label: 'Banner Permission', value: formData.details.bannerPerm }
      ];

      const payload = {
        ...formData,
        category,
        committeeMembers,
        details: {
          ...formData.details,
          legalChecklist,
          surveyChecklist
        }
      };

      const res = await fetch(`/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Property successfully updated in AsmitA ERP!");
        router.push('/dashboard/list');
      }
    } catch (e) { alert("Update failed. Check console."); }
    setSaving(false);
  };

  if (loading) return <div className={styles.loader}>Synchronizing with Database...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1><i className="fa fa-edit"></i> Editing: {formData.propertyName}</h1>
          <p>Property ID: {id} | Last Sync: {new Date().toLocaleTimeString()}</p>
        </div>
        <button onClick={handleUpdate} className={styles.saveBtn} disabled={saving}>
          {saving ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-save"></i>} Update Changes
        </button>
      </header>

      <div className={styles.mainGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <label className={styles.label}>📍 Map Positioning</label>
            <MapLibreViewer initialLat={formData.lat} initialLng={formData.lng} onLocationSelect={handleLocationSelect} />
            <div className={styles.coordInputs}>
              <div className={styles.inputSubGroup}>
                <label>LATITUDE</label>
                <input type="number" step="any" className={styles.input} value={formData.lat} onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className={styles.inputSubGroup}>
                <label>LONGITUDE</label>
                <input type="number" step="any" className={styles.input} value={formData.lng} onChange={e => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>🏠 Status</label>
            <select className={styles.input} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
              <option>Not Approached</option>
              <option>Interested Letter Sent</option>
              <option>Meeting Finalized</option>
              <option>Approved</option>
            </select>
          </div>
        </aside>

        <main className={styles.content}>
          <Accordion title="1. Building Details" icon="fa-building" defaultOpen={true}>
            <div className={styles.inputGroup}><label>Building Name</label><input className={styles.input} value={formData.propertyName} onChange={e => setFormData({ ...formData, propertyName: e.target.value })} /></div>
            <div className={styles.inputGroup} style={{ position: 'relative', zIndex: 1000 }}>
              <label>Address {searching && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '10px', color: '#1e4ec4' }}></i>}</label>
              <textarea className={styles.input} value={formData.address} onChange={e => handleAddressSearch(e.target.value)} onBlur={handleBlur} onFocus={() => formData.address.length >= 3 && setShowSuggestions(true)} placeholder="Start typing address..." />
              {showSuggestions && suggestions.length > 0 && (
                <ul className={styles.suggestions}>
                  {suggestions.map((s, i) => (
                    <li key={i} onMouseDown={() => selectSuggestion(s)} style={{ cursor: 'pointer' }}>
                      <i className="fa fa-map-marker"></i> {s.properties.name}{s.properties.city ? `, ${s.properties.city}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.inputGroup}><label>Location / Area</label><input className={styles.input} value={formData.locality} onChange={e => setFormData({ ...formData, locality: e.target.value })} /></div>
          </Accordion>

          <Accordion title="2. Land & Legal Details" icon="fa-balance-scale">
            <div className={styles.inputGroup}><label>Land Owner / Society Name</label><input className={styles.input} value={formData.details.landOwner || ''} onChange={e => updateDetail('landOwner', e.target.value)} /></div>
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Land Type</label><select className={styles.input} value={formData.details.landType || 'Freehold'} onChange={e => updateDetail('landType', e.target.value)}><option>Freehold</option><option>Leasehold</option></select></div>
              <div className={styles.inputGroup}><label>CTS / Survey No.</label><input className={styles.input} value={formData.details.cts || ''} onChange={e => updateDetail('cts', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="3. Society Registration" icon="fa-university">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Society Registered?</label>
                <div className={styles.radioGroup}>
                  <label><input type="radio" checked={formData.details.regStatus === 'YES'} onChange={() => updateDetail('regStatus', 'YES')} /> YES</label>
                  <label><input type="radio" checked={formData.details.regStatus === 'NO'} onChange={() => updateDetail('regStatus', 'NO')} /> NO</label>
                </div>
              </div>
              <div className={styles.inputGroup}><label>Reg No.</label><input className={styles.input} value={formData.details.regNo || ''} onChange={e => updateDetail('regNo', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="4. Committee Details" icon="fa-users">
            {['Chairman', 'Secretary', 'Treasurer'].map(role => (
              <div key={role} className={styles.grid3}>
                <label>{role}</label>
                <input placeholder="Name" className={styles.input} value={formData.details[`${role.toLowerCase()}Name`] || ''} onChange={e => updateDetail(`${role.toLowerCase()}Name`, e.target.value)} />
                <input placeholder="Contact" className={styles.input} value={formData.details[`${role.toLowerCase()}Contact`] || ''} onChange={e => updateDetail(`${role.toLowerCase()}Contact`, e.target.value)} />
              </div>
            ))}
          </Accordion>

          <Accordion title="5 & 6. Members & Responsible Person" icon="fa-user-circle">
            {committeeMembers.map((m, i) => (
              <div key={i} className={styles.grid3} style={{ marginBottom: '10px' }}>
                <span>Member {i + 1}</span>
                <input className={styles.input} value={m.name} onChange={e => {
                  const next = [...committeeMembers]; next[i].name = e.target.value; setCommitteeMembers(next);
                }} />
                <input className={styles.input} value={m.contact} onChange={e => {
                  const next = [...committeeMembers]; next[i].contact = e.target.value; setCommitteeMembers(next);
                }} />
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => setCommitteeMembers([...committeeMembers, { name: '', contact: '' }])}>+ Add Member</button>
            <hr className={styles.divider} />
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Responsible Person</label><input className={styles.input} value={formData.details.responsibleName || ''} onChange={e => updateDetail('responsibleName', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Contact</label><input className={styles.input} value={formData.details.responsibleContact || ''} onChange={e => updateDetail('responsibleContact', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="7 & 8. Building & Area Info" icon="fa-info-circle">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Total Plot Area</label><input className={styles.input} value={formData.details.plotArea || ''} onChange={e => updateDetail('plotArea', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Flats</label><input type="number" className={styles.input} value={formData.details.totalFlats || ''} onChange={e => updateDetail('totalFlats', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Shops</label><input type="number" className={styles.input} value={formData.details.totalShops || ''} onChange={e => updateDetail('totalShops', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Flat Area Combined</label><input className={styles.input} value={formData.details.flatArea || ''} onChange={e => updateDetail('flatArea', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="9, 10 & 11. Approvals & Status" icon="fa-gavel">
            <div className={styles.radioGrid}>
              {['approvedPlan', 'oc', 'cc', 'legalDispute', 'mortgaged', 'membersInterested'].map(f => (
                <div key={f} className={styles.checkRow}>
                  <span>{f.replace(/([A-Z])/g, ' $1').toUpperCase()}?</span>
                  <div className={styles.radioGroup}>
                    <label><input type="radio" checked={formData.details[f] === 'YES'} onChange={() => updateDetail(f, 'YES')} /> YES</label>
                    <label><input type="radio" checked={formData.details[f] === 'NO'} onChange={() => updateDetail(f, 'NO')} /> NO</label>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>

          <Accordion title="12. Survey & Permission" icon="fa-search">
            <div className={styles.checkGrid}>
              {['physicalSurvey', 'flatMeasure', 'bannerPerm'].map(p => (
                <div key={p} className={styles.checkRow}>
                  <input type="checkbox" checked={formData.details[p] === 'YES'} onChange={(e) => updateDetail(p, e.target.checked ? 'YES' : 'NO')} />
                  <span>{p.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                </div>
              ))}
            </div>
          </Accordion>

          <Accordion title="13. Document Checklist" icon="fa-list-ol">
            <div className={styles.checklist}>
              {formData.checklist.map((item, i) => (
                <div key={i} className={styles.checkItem}>
                  <span>{i + 1}. {item.label}</span>
                  <div className={styles.toggle}>
                    <button type="button" onClick={() => updateCheck(i, 'YES')} className={item.value === 'YES' ? styles.activeYes : ''}>YES</button>
                    <button type="button" onClick={() => updateCheck(i, 'NO')} className={item.value === 'NO' ? styles.activeNo : ''}>NO</button>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>

          <Accordion title="Photos" icon="fa-camera">
            <div className={styles.uploadArea}><i className="fa fa-picture-o"></i><p>Upload property images here</p></div>
          </Accordion>
        </main>
      </div>
    </div>
  );
}