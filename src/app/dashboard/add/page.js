'use client';
import { useState } from 'react';
import Accordion from '@/components/accordion/Accordion';
import MapLibreViewer from '@/components/maps/MapLibreViewer';
import styles from './add.module.css';

export default function AddPropertyPage() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [category, setCategory] = useState('Redevelopment');
  const [committeeMembers, setCommitteeMembers] = useState([{ name: '', contact: '' }]);

  const [formData, setFormData] = useState({
    propertyName: '', locality: 'Mira Road East', address: '',
    lat: 19.2813, lng: 72.8693, status: 'Not Approached',
    details: {
      landOwner: '', landType: 'Freehold', cts: '', regStatus: 'NO', regNo: '',
      chairmanName: '', chairmanContact: '', secretaryName: '', secretaryContact: '', treasurerName: '', treasurerContact: '',
      responsibleName: '', responsibleContact: '', plotArea: '', totalFlats: '', totalShops: '', wings: '', floors: '',
      flatArea: '', shopArea: '', approvedPlan: 'NO', oc: 'NO', cc: 'NO', legalDispute: 'NO', mortgaged: 'NO',
      membersInterested: 'NO', agreeCount: '', priorDiscussion: 'NO', physicalSurvey: 'NO', flatMeasure: 'NO', bannerPerm: 'NO',
      checklistRemarks: ''
    },
    checklist: Array(19).fill('NO')
  });

  const checklistNames = [
    "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
    "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
    "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
    "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
  ];

  const handleAddressSearch = async (query) => {
    setFormData({ ...formData, address: query });
    if (query.length < 3) return setSuggestions([]);
    
    setSearching(true);
    setShowSuggestions(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  const selectSuggestion = (f) => {
    const [lon, lat] = f.geometry.coordinates;
    setFormData({ ...formData, address: f.properties.name + ", " + (f.properties.city || ""), lat, lng: lon });
    setShowSuggestions(false);
  };

  const updateDetail = (key, val) => setFormData(p => ({...p, details: {...p.details, [key]: val}}));
  const updateCheck = (i, val) => {
    const next = [...formData.checklist]; next[i] = val;
    setFormData(p => ({...p, checklist: next}));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, category, committeeMembers })
      });
      if (res.ok) alert("Saved to AsmitA DB!");
    } catch (e) { alert("Save failed"); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1><i className="fa fa-edit"></i> Edit Property</h1>
        <button onClick={handleSave} className={styles.saveBtn} disabled={loading}>
          {loading ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-save"></i>} Save Property
        </button>
      </header>

      <div className={styles.mainGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.card}>
             <label className={styles.label}>📍 Map Location</label>
             <MapLibreViewer initialLat={formData.lat} initialLng={formData.lng} onLocationSelect={c => setFormData({...formData, lat: c.lat, lng: c.lng})} />
             <div className={styles.coords}>Lat: {formData.lat.toFixed(6)} | Lng: {formData.lng.toFixed(6)}</div>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>🏠 Status *</label>
            <select className={styles.input} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option>Not Approached</option><option>Interested Letter Sent</option><option>Meeting Finalized</option><option>Approved</option>
            </select>
          </div>
        </aside>

        <main className={styles.content}>
          <Accordion title="1. Building Details" icon="fa-building" defaultOpen={true}>
            <div className={styles.inputGroup}><label>Building Name</label><input className={styles.input} value={formData.propertyName} onChange={e => setFormData({...formData, propertyName: e.target.value})} /></div>
            
            <div className={styles.inputGroup} style={{position: 'relative'}}>
              <label>Address {searching && <i className="fa fa-spinner fa-spin" style={{marginLeft: '10px', color: '#1e4ec4'}}></i>}</label>
              <textarea className={styles.input} value={formData.address} onChange={e => handleAddressSearch(e.target.value)} placeholder="Start typing address..." />
              {showSuggestions && suggestions.length > 0 && (
                <ul className={styles.suggestions}>
                  {suggestions.map((s, i) => (
                    <li key={i} onClick={() => selectSuggestion(s)}><i className="fa fa-map-marker"></i> {s.properties.name}, {s.properties.city}</li>
                  ))}
                </ul>
              )}
            </div>
          </Accordion>

          {/* REMAINDER OF YOUR ACCORDIONS (2 to 13) STAY HERE - DO NOT DELETE */}
          <Accordion title="2. Land & Legal Details" icon="fa-balance-scale">
            <div className={styles.inputGroup}><label>Land Owner / Society Name</label><input className={styles.input} onChange={e => updateDetail('landOwner', e.target.value)} /></div>
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Land Type</label><select className={styles.input} onChange={e => updateDetail('landType', e.target.value)}><option>Freehold</option><option>Leasehold</option></select></div>
              <div className={styles.inputGroup}><label>CTS / Survey No.</label><input className={styles.input} onChange={e => updateDetail('cts', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="3. Society Registration" icon="fa-university">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Society Registered?</label><div className={styles.radioGroup}><label><input type="radio" name="reg" onClick={() => updateDetail('regStatus', 'YES')} /> YES</label><label><input type="radio" name="reg" onClick={() => updateDetail('regStatus', 'NO')} /> NO</label></div></div>
              <div className={styles.inputGroup}><label>Reg No.</label><input className={styles.input} onChange={e => updateDetail('regNo', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="4. Committee Details" icon="fa-users">
            {['Chairman', 'Secretary', 'Treasurer'].map(role => (
              <div key={role} className={styles.grid3}><label>{role}</label><input placeholder="Name" className={styles.input} onChange={e => updateDetail(`${role.toLowerCase()}Name`, e.target.value)} /><input placeholder="Contact" className={styles.input} onChange={e => updateDetail(`${role.toLowerCase()}Contact`, e.target.value)} /></div>
            ))}
          </Accordion>

          <Accordion title="5. Committee Members" icon="fa-plus-square">
            {committeeMembers.map((m, i) => (
              <div key={i} className={styles.grid3} style={{marginBottom:'10px'}}>
                <span>Member {i+1}</span>
                <input placeholder="Name" className={styles.input} value={m.name} onChange={e => {
                  const newM = [...committeeMembers]; newM[i].name = e.target.value; setCommitteeMembers(newM);
                }} />
                <input placeholder="Contact" className={styles.input} value={m.contact} onChange={e => {
                  const newM = [...committeeMembers]; newM[i].contact = e.target.value; setCommitteeMembers(newM);
                }} />
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => setCommitteeMembers([...committeeMembers, {name:'', contact:''}])}>+ Add Member</button>
          </Accordion>

          <Accordion title="6. Responsible Person" icon="fa-user">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Name</label><input className={styles.input} onChange={e => updateDetail('responsibleName', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Contact</label><input className={styles.input} onChange={e => updateDetail('responsibleContact', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="7 & 8. Building & Area Info" icon="fa-info-circle">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Total Plot Area</label><input className={styles.input} /></div>
              <div className={styles.inputGroup}><label>Total Flats</label><input className={styles.input} /></div>
              <div className={styles.inputGroup}><label>Total Shops</label><input className={styles.input} /></div>
              <div className={styles.inputGroup}><label>Total Flat Area Combined</label><input className={styles.input} /></div>
            </div>
          </Accordion>

          <Accordion title="9, 10 & 11. Status & Legal" icon="fa-gavel">
             {['Approved Plan', 'OC', 'CC', 'Legal Dispute', 'Mortgaged', 'Redevelopment Interest'].map(f => (
               <div key={f} className={styles.checkRow}><span>{f}?</span><div className={styles.radioGroup}><label><input type="radio" name={f} /> YES</label><label><input type="radio" name={f} /> NO</label></div></div>
             ))}
          </Accordion>

          <Accordion title="12. Survey & Permissions" icon="fa-search">
            {['Physical Survey Allowed', 'Flat Measurement Allowed', 'Banner Permission'].map(p => (
              <div key={p} className={styles.checkRow}><input type="checkbox" /> <span>{p}</span></div>
            ))}
          </Accordion>

          <Accordion title="13. Document Checklist" icon="fa-list-ol">
            <div className={styles.checklist}>
              {checklistNames.map((name, i) => (
                <div key={i} className={styles.checkItem}>
                  <span>{i+1}. {name}</span>
                  <div className={styles.toggle}><button type="button" onClick={() => updateCheck(i, 'YES')} className={formData.checklist[i] === 'YES' ? styles.activeYes : ''}>YES</button><button type="button" onClick={() => updateCheck(i, 'NO')} className={formData.checklist[i] === 'NO' ? styles.activeNo : ''}>NO</button></div>
                </div>
              ))}
            </div>
          </Accordion>
        </main>
      </div>
    </div>
  );
}