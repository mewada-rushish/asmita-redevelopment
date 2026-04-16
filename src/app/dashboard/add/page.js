'use client';
import { useState, useCallback } from 'react';
import Accordion from '@/components/accordion/Accordion';
import MapViewer from '@/components/maps/MapViewer'; 
import styles from './add.module.css';

export default function AddPropertyPage() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [category, setCategory] = useState('Redevelopment');
  const [committeeMembers, setCommitteeMembers] = useState([{ name: '', contact: '' }]);

  const checklistNames = [
    "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
    "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
    "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
    "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
  ];

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
    checklist: checklistNames.map(name => ({ label: name, value: 'NO' }))
  });

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
      const apiKey = process.env.NEXT_PUBLIC_GMAP_KEY;

      if (apiKey && process.env.NEXT_PUBLIC_MAP_ENGINE !== 'maplibre') {
        // GOOGLE GEOCODING API: Hyper-accurate for local addresses
        // components=locality:Mira+Bhayandar keeps the search focused on your territory
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=locality:Mira+Bhayandar&key=${apiKey}`);
        const data = await res.json();

        if (data.status === 'OK') {
          // We format Google's response to match your existing dropdown UI structure
          const formattedSuggestions = data.results.slice(0, 5).map(r => ({
            properties: { name: r.formatted_address.replace(', Maharashtra, India', ''), city: '' },
            geometry: { coordinates: [r.geometry.location.lng, r.geometry.location.lat] }
          }));
          setSuggestions(formattedSuggestions);
        } else {
          setSuggestions([]);
        }
      } else {
        // FALLBACK: Photon API (Free, open-source)
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lat=19.2813&lon=72.8693`);
        const data = await res.json();
        setSuggestions(data.features || []);
      }
    } catch (e) { 
      console.error("Geocoding Error:", e); 
    } finally {
      setSearching(false);
    }
  };

  const selectSuggestion = (f) => {
    const [lon, lat] = f.geometry.coordinates;
    const name = f.properties.name || '';
    const city = f.properties.city || '';
    
    // Clean up the address string for the input field
    const finalAddress = city ? `${name}, ${city}` : name;
    
    setFormData(prev => ({ 
      ...prev, 
      address: finalAddress, 
      lat, 
      lng: lon 
    }));
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

  const handleSave = async () => {
    setLoading(true);
    try {
      const legalStatusLabels = [
        { label: 'Approved Plan', value: formData.details.approvedPlan },
        { label: 'OC', value: formData.details.oc },
        { label: 'CC', value: formData.details.cc },
        { label: 'Legal Dispute', value: formData.details.legalDispute },
        { label: 'Mortgaged', value: formData.details.mortgaged },
        { label: 'Redevelopment Interest', value: formData.details.membersInterested }
      ];

      const surveyLabels = [
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
          legalChecklist: legalStatusLabels,
          surveyChecklist: surveyLabels
        }
      };

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) alert("Saved with labels to AsmitA DB!");
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
            <MapViewer
              initialLat={formData.lat}
              initialLng={formData.lng}
              onLocationSelect={handleLocationSelect}
            />

            <div className={styles.coordInputs}>
              <div className={styles.inputSubGroup}>
                <label>LATITUDE</label>
                <input
                  type="number" step="any" className={styles.input}
                  value={formData.lat}
                  onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className={styles.inputSubGroup}>
                <label>LONGITUDE</label>
                <input
                  type="number" step="any" className={styles.input}
                  value={formData.lng}
                  onChange={e => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className={styles.coords}>Current Lat: {formData.lat.toFixed(6)} | Lng: {formData.lng.toFixed(6)}</div>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>🏠 Status *</label>
            <select className={styles.input} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
              <option>Not Approached</option><option>Interested Letter Sent</option><option>Meeting Finalized</option><option>Approved</option>
            </select>
          </div>
        </aside>

        <main className={styles.content}>
          <Accordion title="1. Building Details" icon="fa-building" defaultOpen={true}>
            <div className={styles.inputGroup}><label>Building Name</label><input className={styles.input} value={formData.propertyName} onChange={e => setFormData({ ...formData, propertyName: e.target.value })} /></div>

            <div className={styles.inputGroup} style={{ position: 'relative', zIndex: 1000 }}>
              <label>Address {searching && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '10px', color: '#1e4ec4' }}></i>}</label>
              <textarea
                className={styles.input}
                value={formData.address}
                onChange={e => handleAddressSearch(e.target.value)}
                onBlur={handleBlur}
                onFocus={() => formData.address.length >= 3 && setShowSuggestions(true)}
                placeholder="Start typing address..."
              />
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
          </Accordion>

          <Accordion title="2. Land & Legal Details" icon="fa-balance-scale">
            <div className={styles.inputGroup}><label>Land Owner / Society Name</label><input className={styles.input} value={formData.details.landOwner} onChange={e => updateDetail('landOwner', e.target.value)} /></div>
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Land Type</label><select className={styles.input} value={formData.details.landType} onChange={e => updateDetail('landType', e.target.value)}><option>Freehold</option><option>Leasehold</option></select></div>
              <div className={styles.inputGroup}><label>CTS / Survey No.</label><input className={styles.input} value={formData.details.cts} onChange={e => updateDetail('cts', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="3. Society Registration" icon="fa-university">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}>
                <label>Society Registered?</label>
                <div className={styles.radioGroup}>
                  <label><input type="radio" checked={formData.details.regStatus === 'YES'} onChange={() => updateDetail('regStatus', 'YES')} /> YES</label>
                  <label><input type="radio" checked={formData.details.regStatus === 'NO'} onChange={() => updateDetail('regStatus', 'NO')} /> NO</label>
                </div>
              </div>
              <div className={styles.inputGroup}><label>Reg No.</label><input className={styles.input} value={formData.details.regNo} onChange={e => updateDetail('regNo', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="4. Committee Details" icon="fa-users">
            {['Chairman', 'Secretary', 'Treasurer'].map(role => (
              <div key={role} className={styles.grid3}>
                <label>{role}</label>
                <input placeholder="Name" className={styles.input} value={formData.details[`${role.toLowerCase()}Name`]} onChange={e => updateDetail(`${role.toLowerCase()}Name`, e.target.value)} />
                <input placeholder="Contact" className={styles.input} value={formData.details[`${role.toLowerCase()}Contact`]} onChange={e => updateDetail(`${role.toLowerCase()}Contact`, e.target.value)} />
              </div>
            ))}
          </Accordion>

          <Accordion title="5. Committee Members" icon="fa-plus-square">
            {committeeMembers.map((m, i) => (
              <div key={i} className={styles.grid3} style={{ marginBottom: '10px' }}>
                <span>Member {i + 1}</span>
                <input placeholder="Name" className={styles.input} value={m.name} onChange={e => {
                  const newM = [...committeeMembers]; newM[i].name = e.target.value; setCommitteeMembers(newM);
                }} />
                <input placeholder="Contact" className={styles.input} value={m.contact} onChange={e => {
                  const newM = [...committeeMembers]; newM[i].contact = e.target.value; setCommitteeMembers(newM);
                }} />
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => setCommitteeMembers([...committeeMembers, { name: '', contact: '' }])}>+ Add Member</button>
          </Accordion>

          <Accordion title="6. Responsible Person" icon="fa-user">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Name</label><input className={styles.input} value={formData.details.responsibleName} onChange={e => updateDetail('responsibleName', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Contact</label><input className={styles.input} value={formData.details.responsibleContact} onChange={e => updateDetail('responsibleContact', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="7 & 8. Building & Area Info" icon="fa-info-circle">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label>Total Plot Area</label><input className={styles.input} value={formData.details.plotArea} onChange={e => updateDetail('plotArea', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Flats</label><input className={styles.input} value={formData.details.totalFlats} onChange={e => updateDetail('totalFlats', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Shops</label><input className={styles.input} value={formData.details.totalShops} onChange={e => updateDetail('totalShops', e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Total Flat Area Combined</label><input className={styles.input} value={formData.details.flatArea} onChange={e => updateDetail('flatArea', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="9, 10 & 11. Status & Legal" icon="fa-gavel">
            {[
              { l: 'Approved Plan', k: 'approvedPlan' },
              { l: 'OC', k: 'oc' },
              { l: 'CC', k: 'cc' },
              { l: 'Legal Dispute', k: 'legalDispute' },
              { l: 'Mortgaged', k: 'mortgaged' },
              { l: 'Redevelopment Interest', k: 'membersInterested' }
            ].map(f => (
              <div key={f.k} className={styles.checkRow}>
                <span>{f.l}?</span>
                <div className={styles.radioGroup}>
                  <label><input type="radio" checked={formData.details[f.k] === 'YES'} onChange={() => updateDetail(f.k, 'YES')} /> YES</label>
                  <label><input type="radio" checked={formData.details[f.k] === 'NO'} onChange={() => updateDetail(f.k, 'NO')} /> NO</label>
                </div>
              </div>
            ))}
          </Accordion>

          <Accordion title="12. Survey & Permissions" icon="fa-search">
            {[
              { l: 'Physical Survey Allowed', k: 'physicalSurvey' },
              { l: 'Flat Measurement Allowed', k: 'flatMeasure' },
              { l: 'Banner Permission', k: 'bannerPerm' }
            ].map(p => (
              <div key={p.k} className={styles.checkRow}>
                <input type="checkbox" checked={formData.details[p.k] === 'YES'} onChange={e => updateDetail(p.k, e.target.checked ? 'YES' : 'NO')} />
                <span>{p.l}</span>
              </div>
            ))}
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
        </main>
      </div>
    </div>
  );
}