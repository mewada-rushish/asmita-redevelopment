'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Accordion from '@/components/accordion/Accordion';
import MapLibreViewer from '@/components/maps/MapLibreViewer';
import styles from './edit.module.css';

export default function EditPropertyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState('Redevelopment');
  const [committeeMembers, setCommitteeMembers] = useState([]);
  
  const [formData, setFormData] = useState({
    propertyName: '', locality: '', address: '',
    lat: 19.2813, lng: 72.8693, status: 'Not Approached',
    details: {},
    checklist: Array(19).fill('NO')
  });

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`/api/properties/${id}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        if (data) {
          setCategory(data.category);
          setCommitteeMembers(JSON.parse(data.committee || '[]'));
          setFormData({
            propertyName: data.property_name || '',
            locality: data.locality || '',
            address: data.address || '',
            lat: parseFloat(data.lat) || 19.2813,
            lng: parseFloat(data.lng) || 72.8693,
            status: data.status || 'Not Approached',
            details: JSON.parse(data.details || '{}'),
            checklist: JSON.parse(data.checklist || '[]')
          });
        }
      } catch (err) {
        console.error("Load Error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  // --- State Handlers ---
  const updateDetail = (key, val) => setFormData(p => ({...p, details: {...p.details, [key]: val}}));
  
  const updateCheck = (i, val) => {
    const next = [...formData.checklist]; 
    next[i] = val;
    setFormData(p => ({...p, checklist: next}));
  };

  const handleLocationSelect = useCallback((c) => {
    setFormData(prev => ({ ...prev, lat: c.lat, lng: c.lng }));
  }, []);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, category, committeeMembers })
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
             <div className={styles.coords}>Lat: {formData.lat.toFixed(6)} | Lng: {formData.lng.toFixed(6)}</div>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>🏠 Status</label>
            <select className={styles.input} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option>Not Approached</option>
              <option>Interested Letter Sent</option>
              <option>Meeting Finalized</option>
              <option>Approved</option>
            </select>
          </div>
        </aside>

        <main className={styles.content}>
          {/* SECTION 1 */}
          <Accordion title="1. Building Details" icon="fa-building" defaultOpen={true}>
            <div className={styles.inputGroup}><label>Building Name</label><input className={styles.input} value={formData.propertyName} onChange={e => setFormData({...formData, propertyName: e.target.value})} /></div>
            <div className={styles.inputGroup}><label>Address</label><textarea className={styles.input} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
            <div className={styles.inputGroup}><label>Location / Area</label><input className={styles.input} value={formData.locality} onChange={e => setFormData({...formData, locality: e.target.value})} /></div>
          </Accordion>

          {/* SECTION 2 */}
          <Accordion title="2. Land & Legal Details" icon="fa-balance-scale">
            <div className={styles.inputGroup}><label>Land Owner / Society Name</label><input className={styles.input} value={formData.details.landOwner || ''} onChange={e => updateDetail('landOwner', e.target.value)} /></div>
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Land Type</label><select className={styles.input} value={formData.details.landType || 'Freehold'} onChange={e => updateDetail('landType', e.target.value)}><option>Freehold</option><option>Leasehold</option></select></div>
              <div className={styles.inputGroup}><label>CTS / Survey No.</label><input className={styles.input} value={formData.details.cts || ''} onChange={e => updateDetail('cts', e.target.value)} /></div>
            </div>
          </Accordion>

          {/* SECTION 3 */}
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

          {/* SECTION 4 */}
          <Accordion title="4. Committee Details" icon="fa-users">
            {['Chairman', 'Secretary', 'Treasurer'].map(role => (
              <div key={role} className={styles.grid3}>
                <label>{role}</label>
                <input placeholder="Name" className={styles.input} value={formData.details[`${role.toLowerCase()}Name`] || ''} onChange={e => updateDetail(`${role.toLowerCase()}Name`, e.target.value)} />
                <input placeholder="Contact" className={styles.input} value={formData.details[`${role.toLowerCase()}Contact`] || ''} onChange={e => updateDetail(`${role.toLowerCase()}Contact`, e.target.value)} />
              </div>
            ))}
          </Accordion>

          {/* SECTION 5 & 6 */}
          <Accordion title="5 & 6. Members & Responsible Person" icon="fa-user-circle">
            {committeeMembers.map((m, i) => (
              <div key={i} className={styles.grid3} style={{marginBottom: '10px'}}>
                <span>Member {i+1}</span>
                <input className={styles.input} value={m.name} onChange={e => {
                   const next = [...committeeMembers]; next[i].name = e.target.value; setCommitteeMembers(next);
                }} />
                <input className={styles.input} value={m.contact} onChange={e => {
                   const next = [...committeeMembers]; next[i].contact = e.target.value; setCommitteeMembers(next);
                }} />
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => setCommitteeMembers([...committeeMembers, {name: '', contact: ''}])}>+ Add Member</button>
            <hr className={styles.divider} />
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Responsible Person</label><input className={styles.input} value={formData.details.responsibleName || ''} onChange={e => updateDetail('responsibleName', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Contact</label><input className={styles.input} value={formData.details.responsibleContact || ''} onChange={e => updateDetail('responsibleContact', e.target.value)} /></div>
            </div>
          </Accordion>

          {/* SECTION 7 & 8 */}
          <Accordion title="7 & 8. Building & Area Info" icon="fa-info-circle">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Total Plot Area</label><input className={styles.input} value={formData.details.plotArea || ''} onChange={e => updateDetail('plotArea', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Flats</label><input type="number" className={styles.input} value={formData.details.totalFlats || ''} onChange={e => updateDetail('totalFlats', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Shops</label><input type="number" className={styles.input} value={formData.details.totalShops || ''} onChange={e => updateDetail('totalShops', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Flat Area Combined</label><input className={styles.input} value={formData.details.flatArea || ''} onChange={e => updateDetail('flatArea', e.target.value)} /></div>
            </div>
          </Accordion>

          {/* SECTION 9, 10 & 11 */}
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

          {/* SECTION 12 */}
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

          {/* SECTION 13 */}
          <Accordion title="13. Document Checklist" icon="fa-list-ol">
            <div className={styles.checklist}>
              {checklistNames.map((name, i) => (
                <div key={i} className={styles.checkItem}>
                  <span>{i + 1}. {name}</span>
                  <div className={styles.toggle}>
                    <button type="button" onClick={() => updateCheck(i, 'YES')} className={formData.checklist[i] === 'YES' ? styles.activeYes : ''}>YES</button>
                    <button type="button" onClick={() => updateCheck(i, 'NO')} className={formData.checklist[i] === 'NO' ? styles.activeNo : ''}>NO</button>
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