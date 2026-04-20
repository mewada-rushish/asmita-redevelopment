'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Accordion from '@/components/accordion/Accordion';
import MapViewer from '@/components/maps/MapViewer';
import { validatePropertyForm } from '@/utils/propertyForm';
import { uploadPropertyDocument } from '@/utils/uploadsUtil';
import toast from 'react-hot-toast';
import styles from './add.module.css';

const YesNoToggle = ({ value, onChange }) => (
  <div className={styles.toggle} style={{ display: 'flex', gap: '5px' }}>
    <button
      type="button"
      onClick={() => onChange(1)}
      className={value === 1 ? styles.activeYes : ''}
      style={value === 1 ? { backgroundColor: '#10b981', color: 'white', border: '1px solid #10b981', padding: '4px 12px', borderRadius: '4px' } : { padding: '4px 12px', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}
    >
      YES
    </button>
    <button
      type="button"
      onClick={() => onChange(0)}
      className={value === 0 ? styles.activeNo : ''}
      style={value === 0 ? { backgroundColor: '#ef4444', color: 'white', border: '1px solid #ef4444', padding: '4px 12px', borderRadius: '4px' } : { padding: '4px 12px', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}
    >
      NO
    </button>
  </div>
);

export default function AddPropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [executives, setExecutives] = useState([]);

  const checklistNames = [
    "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
    "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
    "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
    "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
  ];

  const [formData, setFormData] = useState({
    category: 'Redevelopment', status: 'Not Approached',
    pmc_name: '', pmc_contact: '', assigned_cp_id: '',
    property_name: '', locality: 'Mira Road East', address: '',
    lat: 19.2813, lng: 72.8693,
    land_owner_name: '', land_type: 'Freehold', cts_survey_no: '',
    is_society_registered: 0, registration_no: '',
    total_plot_area: '', total_flats: '', total_shops: '', total_flat_area_combined: '',
    chairman_details: { name: '', contact: '' },
    secretary_details: { name: '', contact: '' },
    treasurer_details: { name: '', contact: '' },
    responsible_person_details: { name: '', contact: '' },
    extra_committee_members: [{ name: '', contact: '' }],
    has_approved_plan: 0, has_oc: 0, has_cc: 0, has_legal_dispute: 0,
    is_mortgaged: 0, has_redevelopment_interest: 0, flat_measure_allowed: 0,
    physical_survey: 'Not Started', physical_survey_records: '',
    banner_permission_allowed: 0, hoarding_date: '',
    document_checklist: checklistNames.map(name => ({ label: name, value: 0, file_name: '' })),
    document_remarks: '', interest_letter_file: '', architect_submitted: 0,
    interaction_history: '', offer_letter_status: 'Not Sent', offer_meeting_track: '',
    offer_acceptance_date: '', sgm_completed: 0, da_agreement_status: 'Not Started'
  });

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.users) {
          const cps = data.users.filter(u => u.role === 'Channel Partner' || u.role === 'Field Executive');
          setExecutives(cps);
        }
      }).catch(err => console.error(err));
  }, []);

  const handleAddressSearch = async (query) => {
    setFormData(prev => ({ ...prev, address: query }));
    if (query.length < 3) {
      setSuggestions([]); setShowSuggestions(false); return;
    }
    setSearching(true); setShowSuggestions(true);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GMAP_KEY;
      if (apiKey) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=locality:Mira+Bhayandar&key=${apiKey}`);
        const data = await res.json();
        if (data.status === 'OK') {
          setSuggestions(data.results.slice(0, 5).map(r => ({
            properties: { name: r.formatted_address.replace(', Maharashtra, India', ''), city: '' },
            geometry: { coordinates: [r.geometry.location.lng, r.geometry.location.lat] }
          })));
        } else setSuggestions([]);
      }
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  };

  const selectSuggestion = (f) => {
    const [lon, lat] = f.geometry.coordinates;
    const finalAddress = f.properties.city ? `${f.properties.name}, ${f.properties.city}` : f.properties.name;
    setFormData(prev => ({ ...prev, address: finalAddress, lat, lng: lon }));
    setShowSuggestions(false);
  };

  const handleBlur = () => setTimeout(() => setShowSuggestions(false), 300);

  const updateField = (key, val) => setFormData(p => ({ ...p, [key]: val }));
  const updateContact = (role, key, val) => setFormData(p => ({ ...p, [role]: { ...p[role], [key]: val } }));

  const updateCheck = (i, val) => {
    const next = [...formData.document_checklist];
    next[i] = { ...next[i], value: val };
    updateField('document_checklist', next);
  };

  const handleDocReupload = (i) => {
    const next = [...formData.document_checklist];
    next[i].file_name = '';
    updateField('document_checklist', next);
  };

  const handleLocationSelect = useCallback((c) => {
    setFormData(prev => ({ ...prev, lat: c.lat, lng: c.lng }));
  }, []);

  const executeDocUpload = async (index, inputId, item) => {
    const fileInput = document.getElementById(inputId);
    const file = fileInput?.files[0];
    if (!file) return toast.error("Please select a file to upload.");

    const uploadPromise = uploadPropertyDocument(file, null, formData.property_name, item.label, item.file_name || null);

    toast.promise(uploadPromise, {
      loading: `Uploading ${item.label}...`,
      success: (res) => {
        if (!res.success) throw new Error(res.error);
        const next = [...formData.document_checklist];
        next[index].file_name = res.fileKey;
        updateField('document_checklist', next);
        return `${item.label} uploaded successfully!`;
      },
      error: (err) => `Upload failed: ${err.message}`
    });
  };

  const executeInterestLetterUpload = async () => {
    const fileInput = document.getElementById('interest_letter_upload');
    const file = fileInput?.files[0];
    if (!file) return toast.error("Please select a file to upload.");

    const uploadPromise = uploadPropertyDocument(file, null, formData.property_name, "Interest Letter", formData.interest_letter_file || null);

    toast.promise(uploadPromise, {
      loading: `Uploading Interest Letter...`,
      success: (res) => {
        if (!res.success) throw new Error(res.error);
        updateField('interest_letter_file', res.fileKey);
        return `Interest Letter uploaded successfully!`;
      },
      error: (err) => `Upload failed: ${err.message}`
    });
  };

  const handleSave = async () => {
    const validation = validatePropertyForm(formData);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Property pipeline successfully saved!");
        setTimeout(() => {
          router.push('/dashboard/list');
        }, 1500);
      } else {
        toast.error("Save failed: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      toast.error("Save failed");
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1><i className="fa fa-edit"></i> Add Property</h1>
        <button onClick={handleSave} className={styles.saveBtn} disabled={loading}>
          {loading ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-save"></i>} Save Property
        </button>
      </header>

      <div className={styles.mainGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <label className={styles.label}>📍 Map Location</label>
            <MapViewer initialLat={formData.lat} initialLng={formData.lng} onLocationSelect={handleLocationSelect} />
            <div className={styles.coords}>Current Lat: {formData.lat.toFixed(6)} | Lng: {formData.lng.toFixed(6)}</div>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>👤 Assign Executive / CP</label>
            <select className={styles.input} value={formData.assigned_cp_id} onChange={e => updateField('assigned_cp_id', e.target.value)}>
              <option value="">-- Select Executive --</option>
              {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({ex.role})</option>)}
            </select>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>🏠 Overall Status *</label>
            <select className={styles.input} value={formData.status} onChange={e => updateField('status', e.target.value)}>
              <option>Not Approached</option><option>Interested Letter Sent</option><option>Meeting Finalized</option><option>Approved</option>
            </select>
          </div>
        </aside>

        <main className={styles.content}>
          <Accordion title="1. Building & Lead Details" icon="fa-building" defaultOpen={true}>
            <div className={styles.inputGroup}><label className={styles.label}>Building / Society Name</label><input className={styles.input} value={formData.property_name} onChange={e => updateField('property_name', e.target.value)} /></div>

            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label className={styles.label}>PMC / Co-ordinator Name</label><input className={styles.input} placeholder="Name of CP/PMC" value={formData.pmc_name} onChange={e => updateField('pmc_name', e.target.value)} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>PMC Contact No.</label><input className={styles.input} placeholder="Phone Number" value={formData.pmc_contact} onChange={e => updateField('pmc_contact', e.target.value)} /></div>
            </div>

            <div className={styles.inputGroup} style={{ position: 'relative', zIndex: 1000 }}>
              <label className={styles.label}>Address {searching && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '10px' }}></i>}</label>
              <textarea
                className={styles.input} value={formData.address}
                onChange={e => handleAddressSearch(e.target.value)} onBlur={handleBlur}
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
            <div className={styles.inputGroup}><label className={styles.label}>Land Owner / Society Name</label><input className={styles.input} value={formData.land_owner_name} onChange={e => updateField('land_owner_name', e.target.value)} /></div>
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label className={styles.label}>Land Type</label><select className={styles.input} value={formData.land_type} onChange={e => updateField('land_type', e.target.value)}><option>Freehold</option><option>Leasehold</option></select></div>
              <div className={styles.inputGroup}><label className={styles.label}>CTS / Survey No.</label><input className={styles.input} value={formData.cts_survey_no} onChange={e => updateField('cts_survey_no', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="3. Society Registration" icon="fa-university">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Society Registered?</label>
                <YesNoToggle value={formData.is_society_registered} onChange={(v) => updateField('is_society_registered', v)} />
              </div>
              <div className={styles.inputGroup}><label className={styles.label}>Reg No.</label><input className={styles.input} value={formData.registration_no} onChange={e => updateField('registration_no', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="4. Core Committee" icon="fa-users">
            {['Chairman', 'Secretary', 'Treasurer'].map(role => {
              const stateKey = `${role.toLowerCase()}_details`;
              return (
                <div key={role} className={styles.grid3}>
                  <label className={styles.label}>{role}</label>
                  <input placeholder="Name" className={styles.input} value={formData[stateKey].name} onChange={e => updateContact(stateKey, 'name', e.target.value)} />
                  <input placeholder="Contact" className={styles.input} value={formData[stateKey].contact} onChange={e => updateContact(stateKey, 'contact', e.target.value)} />
                </div>
              );
            })}
          </Accordion>

          <Accordion title="5. Extra Committee Members" icon="fa-plus-square">
            {formData.extra_committee_members.map((m, i) => (
              <div key={i} className={styles.grid3} style={{ marginBottom: '10px' }}>
                <span>Member {i + 1}</span>
                <input placeholder="Name" className={styles.input} value={m.name} onChange={e => {
                  const newM = [...formData.extra_committee_members]; newM[i].name = e.target.value; updateField('extra_committee_members', newM);
                }} />
                <input placeholder="Contact" className={styles.input} value={m.contact} onChange={e => {
                  const newM = [...formData.extra_committee_members]; newM[i].contact = e.target.value; updateField('extra_committee_members', newM);
                }} />
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => updateField('extra_committee_members', [...formData.extra_committee_members, { name: '', contact: '' }])}>+ Add Member</button>
          </Accordion>

          <Accordion title="6. Responsible Person" icon="fa-user">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label className={styles.label}>Name</label><input className={styles.input} value={formData.responsible_person_details.name} onChange={e => updateContact('responsible_person_details', 'name', e.target.value)} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Contact</label><input className={styles.input} value={formData.responsible_person_details.contact} onChange={e => updateContact('responsible_person_details', 'contact', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="7 & 8. Area Info" icon="fa-info-circle">
            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label className={styles.label}>Total Plot Area</label><input className={styles.input} value={formData.total_plot_area} onChange={e => updateField('total_plot_area', e.target.value)} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Total Flats</label><input className={styles.input} type="number" value={formData.total_flats} onChange={e => updateField('total_flats', e.target.value)} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Total Shops</label><input className={styles.input} type="number" value={formData.total_shops} onChange={e => updateField('total_shops', e.target.value)} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Total Flat Area Combined</label><input className={styles.input} value={formData.total_flat_area_combined} onChange={e => updateField('total_flat_area_combined', e.target.value)} /></div>
            </div>
          </Accordion>

          <Accordion title="9, 10 & 11. Legal Permissions" icon="fa-gavel">
            {[
              { l: 'Approved Plan', k: 'has_approved_plan' },
              { l: 'OC', k: 'has_oc' }, { l: 'CC', k: 'has_cc' },
              { l: 'Legal Dispute', k: 'has_legal_dispute' },
              { l: 'Mortgaged', k: 'is_mortgaged' },
              { l: 'Redevelopment Interest', k: 'has_redevelopment_interest' }
            ].map(f => (
              <div key={f.k} className={styles.checkRow}>
                <span>{f.l}</span>
                <YesNoToggle value={formData[f.k]} onChange={(v) => updateField(f.k, v)} />
              </div>
            ))}
          </Accordion>

          <Accordion title="12. Survey, Banners & Hoarding" icon="fa-search">
            <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
              <label className={styles.label}>Physical Survey Status</label>
              <select className={styles.input} value={formData.physical_survey} onChange={e => updateField('physical_survey', e.target.value)}>
                <option>Not Started</option><option>In Progress</option><option>Completed</option>
              </select>
            </div>

            <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
              <label className={styles.label}>Physical Survey Records / Notes</label>
              <textarea className={styles.input} rows="3" value={formData.physical_survey_records} onChange={e => updateField('physical_survey_records', e.target.value)} placeholder="Enter survey details..." />
            </div>

            <div className={styles.checkRow} style={{ marginBottom: '15px' }}>
              <span>Flat Measurement Allowed</span>
              <YesNoToggle value={formData.flat_measure_allowed} onChange={(v) => updateField('flat_measure_allowed', v)} />
            </div>

            <div className={styles.checkRow} style={{ marginBottom: '15px' }}>
              <span>Banner Permission / Hoarding Allowed</span>
              <YesNoToggle value={formData.banner_permission_allowed} onChange={(v) => updateField('banner_permission_allowed', v)} />
            </div>

            {formData.banner_permission_allowed === 1 && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Hoarding Installation Date</label>
                <input type="date" className={styles.input} value={formData.hoarding_date} onChange={e => updateField('hoarding_date', e.target.value)} />
              </div>
            )}
          </Accordion>

          <Accordion title="13. Document Checklist" icon="fa-list-ol">
            <div className={styles.inputGroup} style={{ marginBottom: '20px' }}>
              <label className={styles.label}>Interest Letter Upload</label>

              {!formData.interest_letter_file ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="file" id="interest_letter_upload" className={styles.fileInput} />
                  <button type="button" className={styles.uploadBtn} onClick={executeInterestLetterUpload}>
                    <i className="fa fa-upload"></i> Upload
                  </button>
                </div>
              ) : (
                <div className={styles.submittedWrapper}>
                  <span className={styles.submittedChip}>
                    <i className="fa fa-check-circle"></i> Uploaded
                  </span>
                  <button type="button" className={styles.reuploadBtn} onClick={() => updateField('interest_letter_file', '')}>
                    Re-upload
                  </button>
                </div>
              )}
            </div>

            <div className={styles.checklist}>
              {formData.document_checklist.map((item, i) => (
                <div key={i} className={styles.checkItem}>
                  <div className={styles.docItemHeader}>
                    <span>{i + 1}. {item.label}</span>

                    {!item.file_name ? (
                      <YesNoToggle value={item.value} onChange={(v) => updateCheck(i, v)} />
                    ) : (
                      <div className={styles.submittedWrapper}>
                        <span className={styles.submittedChip}>
                          <i className="fa fa-check-circle"></i> Submitted
                        </span>
                        <button type="button" onClick={() => handleDocReupload(i)} className={styles.reuploadBtn}>
                          Re-upload
                        </button>
                      </div>
                    )}
                  </div>

                  {item.value === 1 && !item.file_name && (
                    <div className={styles.uploadRow}>
                      <input type="file" id={`doc_upload_${i}`} className={styles.fileInput} />
                      <button
                        type="button"
                        className={styles.uploadBtn}
                        onClick={() => executeDocUpload(i, `doc_upload_${i}`, item)}
                      >
                        <i className="fa fa-upload"></i> Upload
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.checkRow} style={{ margin: '20px 0' }}>
              <strong>Documents Submitted to Architect?</strong>
              <YesNoToggle value={formData.architect_submitted} onChange={(v) => updateField('architect_submitted', v)} />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Overall Checklist Remarks</label>
              <textarea className={styles.input} rows="3" value={formData.document_remarks} onChange={e => updateField('document_remarks', e.target.value)} placeholder="Notes on missing or pending documents..." />
            </div>
          </Accordion>

          <Accordion title="14. Interaction & Offer Journey" icon="fa-handshake-o">
            <div className={styles.inputGroup}>
              <label className={styles.label}>Interaction History</label>
              <textarea className={styles.input} rows="3" value={formData.interaction_history} onChange={e => updateField('interaction_history', e.target.value)} placeholder="Log of calls and interactions..." />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Offer Letter Status</label>
              <select className={styles.input} value={formData.offer_letter_status} onChange={e => updateField('offer_letter_status', e.target.value)}>
                <option>Not Sent</option><option>Offer Sent</option><option>Under Negotiation</option><option>Accepted</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Offer Meeting Track</label>
              <textarea className={styles.input} rows="2" value={formData.offer_meeting_track} onChange={e => updateField('offer_meeting_track', e.target.value)} placeholder="Tracking of society meetings regarding offer..." />
            </div>

            {formData.offer_letter_status === 'Accepted' && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Offer Acceptance Date</label>
                <input type="date" className={styles.input} value={formData.offer_acceptance_date} onChange={e => updateField('offer_acceptance_date', e.target.value)} />
              </div>
            )}
          </Accordion>

          <Accordion title="15. Legal Pipeline & Milestones" icon="fa-file-text-o">
            <div className={styles.checkRow} style={{ marginBottom: '15px' }}>
              <span>SGM Completed (Appointment of Developer)?</span>
              <YesNoToggle value={formData.sgm_completed} onChange={(v) => updateField('sgm_completed', v)} />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>DA (Development Agreement) Status</label>
              <select className={styles.input} value={formData.da_agreement_status} onChange={e => updateField('da_agreement_status', e.target.value)}>
                <option>Not Started</option><option>In Process</option><option>Completed</option>
              </select>
            </div>
          </Accordion>
        </main>
      </div>
    </div>
  );
}