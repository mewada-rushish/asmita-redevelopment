'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Accordion from '@/components/accordion/Accordion';
import MapViewer from '@/components/maps/MapViewer';
import DuplicateAlertModal from '@/components/modals/DuplicateAlertModal';
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
  const [admins, setAdmins] = useState([]); 
  
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState('');
  
  const [showExecModal, setShowExecModal] = useState(false);
  const [creatingExec, setCreatingExec] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  const [newExecForm, setNewExecForm] = useState({
    name: '', email: '', phone: '', password: ''
  });

  const [isBulkUpload, setIsBulkUpload] = useState(false);

  // --- Duplicate Check & Clubbing States ---
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const [clubbingSearch, setClubbingSearch] = useState('');
  const [clubbingSuggestions, setClubbingSuggestions] = useState([]);
  const [clubbedProperties, setClubbedProperties] = useState([]);

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        const role = (data.user?.role || data.role || '').toLowerCase();
        setCurrentUserRole(role); 
        const allowed = ['super admin', 'admin', 'crm', 'crm team', 'sales', 'field executive', 'channel partner', 'cp'];
        if (!allowed.includes(role)) {
          router.push('/dashboard');
        }
      } catch (err) {
        router.push('/dashboard');
      } finally {
        setCheckingAuth(false);
      }
    };
    verifyAccess();
  }, [router]);

  const checklistNames = [
    "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
    "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
    "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
    "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
  ];

  const [formData, setFormData] = useState({
    category: 'Redevelopment', status: 'Not Approached',
    pmc_name: '', pmc_contact: '', 
    assigned_cp_id: '', assigned_admin_id: '',
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
    document_remarks: '', 
    interest_letter_file: '', 
    has_interest_letter: 0,
    architect_submitted: 0,
    interaction_history: '', offer_letter_status: 'Not Sent', offer_meeting_track: '',
    offer_acceptance_date: '', sgm_completed: 0, da_agreement_status: 'Not Started'
  });

  const fetchUsersData = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && data.users) {
        const cps = data.users.filter(u => u.role === 'CP' || u.role === 'Channel Partner' || u.role === 'Field Executive');
        setExecutives(cps);
        const adminList = data.users.filter(u => u.role === 'Admin');
        setAdmins(adminList);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  // --- Duplicate Check Logic ---
  const checkDuplicates = async () => {
    if (!formData.property_name && (!formData.address || formData.address.length < 5)) return;

    try {
      const res = await fetch('/api/properties/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          property_name: formData.property_name, 
          address: formData.address 
        })
      });
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicateMatch(data.matchedProperty);
        setShowDuplicateModal(true);
      }
    } catch (err) {
      console.error("Duplicate check failed", err);
    }
  };

  // --- Clubbing (Search & Assign) Logic ---
  const handleClubbingSearch = async (query) => {
    setClubbingSearch(query);
    if (query.length < 2) {
      setClubbingSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/properties/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
          const filtered = data.filter(p => !clubbedProperties.find(cp => cp.id === p.id));
          setClubbingSuggestions(filtered);
      } else {
          setClubbingSuggestions([]);
      }
    } catch (err) {
      console.error(err);
      setClubbingSuggestions([]);
    }
  };

  const addClubbedProperty = (prop) => {
    setClubbedProperties([...clubbedProperties, prop]);
    setClubbingSearch('');
    setClubbingSuggestions([]);
  };

  const removeClubbedProperty = (id) => {
    setClubbedProperties(clubbedProperties.filter(p => p.id !== id));
  };


  const handleAddressSearch = (query) => {
    setFormData(prev => ({ ...prev, address: query }));
    
    if (query.length < 3) {
      setSuggestions([]); 
      setShowSuggestions(false); 
      return;
    }
    
    setSearching(true); 
    setShowSuggestions(true);

    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      const autocompleteService = new window.google.maps.places.AutocompleteService();
      
      autocompleteService.getPlacePredictions({
        input: `${query}, Mira Bhayandar`, 
        componentRestrictions: { country: 'in' },
      }, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.map(p => ({
            description: p.description,
            place_id: p.place_id
          })));
        } else {
          setSuggestions([]);
        }
        setSearching(false);
      });
    } else {
      setSearching(false);
    }
  };

  const selectSuggestion = (suggestion) => {
    setFormData(prev => ({ ...prev, address: suggestion.description }));
    setShowSuggestions(false);

    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: suggestion.place_id }, (results, status) => {
        if (status === 'OK' && results[0]) {
          setFormData(prev => ({
            ...prev,
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          }));
        }
      });
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      checkDuplicates(); // Run duplicate check when user finishes address
    }, 300);
  };

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

  const executeBulkUpload = async () => {
    const fileInput = document.getElementById('bulk_upload_input');
    const files = fileInput?.files;
    
    if (!files || files.length === 0) {
      return toast.error("Please select files to upload.");
    }

    const newBulkItems = [];
    const uploadPromises = Array.from(files).map(async (file) => {
      const res = await uploadPropertyDocument(file, null, formData.property_name, `Bulk: ${file.name}`, null);
      if (res.success) {
        newBulkItems.push({ label: `Bulk: ${file.name}`, value: 1, file_name: res.fileKey });
      } else {
        throw new Error(`Failed to upload ${file.name}`);
      }
    });

    toast.promise(Promise.all(uploadPromises), {
      loading: `Uploading ${files.length} files...`,
      success: () => {
        updateField('document_checklist', [...formData.document_checklist, ...newBulkItems]);
        fileInput.value = '';
        return "Bulk upload completed!";
      },
      error: "Some files failed to upload."
    });
  };

  const handleCreateExecutive = async (e) => {
    e.preventDefault();
    if (newExecForm.password.length < 8) return toast.error("Temporary password must be at least 8 characters");
    
    setCreatingExec(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newExecForm,
          role: 'CP', 
          department: 'Sales',
          status: 1,
          is_temporary: 1 
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("CP created successfully!");
        setNewExecForm({ name: '', email: '', phone: '', password: '' });
        setShowExecModal(false);
        await fetchUsersData(); 
      } else {
        toast.error(data.error || "Failed to create user.");
      }
    } catch (err) {
      toast.error("Network error while creating CP.");
    } finally {
      setCreatingExec(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '250px' }}>
        <div><i className="fa fa-spinner fa-spin fa-2x"></i> Checking permissions...</div>
      </div>
    );
  }

  const handleSave = async () => {
    const validation = validatePropertyForm(formData);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        clubbed_properties: clubbedProperties.map(p => p.id)
      };

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  const isAdmin = currentUserRole === 'super admin' || currentUserRole === 'admin';
  const bulkFiles = formData.document_checklist.filter(item => item.label.startsWith('Bulk:'));

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
            <MapViewer initialLat={formData.lat} initialLng={formData.lng} onLocationSelect={handleLocationSelect} mapStyle="satellite" />
            <div className={styles.coords}>Current Lat: {formData.lat.toFixed(6)} | Lng: {formData.lng.toFixed(6)}</div>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>👤 Assign CP</label>
            <select className={styles.input} value={formData.assigned_cp_id} onChange={e => updateField('assigned_cp_id', e.target.value)}>
              <option value="">-- Select CP --</option>
              {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({ex.role})</option>)}
            </select>

            {isAdmin && (
              <button 
                type="button" 
                onClick={() => setShowExecModal(true)} 
                className={styles.quickAddBtn}
                style={{ marginTop: '10px' }}
              >
                <i className="fa fa-plus-circle"></i> Add New CP
              </button>
            )}
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
            <div className={styles.inputGroup}>
              <label className={styles.label}>Building / Society Name</label>
              <input 
                className={styles.input} 
                value={formData.property_name} 
                onChange={e => updateField('property_name', e.target.value)} 
                onBlur={checkDuplicates} 
              />
            </div>

            <div className={styles.grid2}>
              <div className={styles.inputGroup}><label className={styles.label}>PMC / Co-ordinator Name</label><input className={styles.input} placeholder="Name of PMC" value={formData.pmc_name} onChange={e => updateField('pmc_name', e.target.value)} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>PMC Contact No.</label><input className={styles.input} placeholder="Phone Number" value={formData.pmc_contact} onChange={e => updateField('pmc_contact', e.target.value)} /></div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Reporting Manager *</label>
              <select className={styles.input} value={formData.assigned_admin_id} onChange={e => updateField('assigned_admin_id', e.target.value)} required>
                <option value="">-- Select Reporting Manager --</option>
                {admins.map(admin => (
                  <option key={admin.id} value={admin.id}>{admin.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup} style={{ position: 'relative', zIndex: 99 }}>
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
                      <i className="fa fa-map-marker"></i> {s.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ME MOVED: Clubbing Repeater Interface integrated into Section 1 */}
            <div style={{ marginTop: '25px', borderTop: '1px dashed #e5e7eb', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '15px', color: '#1f2937', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa fa-link" style={{ color: '#64748b' }}></i> Property Grouping (Clubbed Redevelopment)
              </h3>
              <div className={styles.inputGroup} style={{ position: 'relative', zIndex: 98 }}>
                <label className={styles.label}>Link Nearby Properties</label>
                <div className={styles.searchWrapper}>
                    <i className="fa fa-search" style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }}></i>
                    <input 
                        type="text" 
                        className={styles.input} 
                        style={{ paddingLeft: '35px' }}
                        placeholder="Search by building name or address..." 
                        value={clubbingSearch}
                        onChange={(e) => handleClubbingSearch(e.target.value)}
                    />
                    {clubbingSuggestions.length > 0 && (
                        <ul className={styles.suggestions}>
                            {clubbingSuggestions.map(p => (
                                <li key={p.id} onMouseDown={() => addClubbedProperty(p)}>
                                    <i className="fa fa-building"></i> <strong>{p.property_name}</strong> 
                                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>({p.address.substring(0, 35)}...)</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {clubbedProperties.length > 0 && (
                    <div className={styles.chipContainer}>
                        {clubbedProperties.map(p => (
                            <div key={p.id} className={styles.propertyChip}>
                                <i className="fa fa-building"></i>
                                <strong>{p.property_name}</strong>
                                <i 
                                    className="fa fa-times-circle" 
                                    onClick={() => removeClubbedProperty(p.id)}
                                ></i>
                            </div>
                        ))}
                    </div>
                )}
              </div>
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
            <div className={styles.bulkActionRow}>
              <div>
                <strong>Enable Bulk Document Upload?</strong>
                <div style={{ marginTop: '5px' }}>
                  <YesNoToggle value={isBulkUpload ? 1 : 0} onChange={(v) => setIsBulkUpload(v === 1)} />
                </div>
              </div>
              
              {bulkFiles.length > 0 && (
                <button 
                  type="button" 
                  className={styles.libraryBtn}
                  onClick={() => setShowBulkModal(true)}
                >
                  <i className="fa fa-folder-open"></i> View Bulk Files ({bulkFiles.length})
                </button>
              )}
            </div>

            {isBulkUpload && (
              <div className={styles.uploadRow} style={{ marginBottom: '20px', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <input type="file" multiple id="bulk_upload_input" className={styles.fileInput} />
                <button type="button" className={styles.uploadBtn} onClick={executeBulkUpload}>
                  <i className="fa fa-upload"></i> Upload All
                </button>
              </div>
            )}

            <div className={styles.checklist}>
              <div className={styles.checkItem}>
                <div className={styles.docItemHeader}>
                  <span>Interest Letter</span>
                  {!formData.interest_letter_file ? (
                    <YesNoToggle value={formData.has_interest_letter} onChange={(v) => updateField('has_interest_letter', v)} />
                  ) : (
                    <div className={styles.submittedWrapper}>
                      <a 
                        href={`/api/viewDoc?key=${encodeURIComponent(formData.interest_letter_file)}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.viewFileBtn}
                      >
                        <i className="fa fa-external-link"></i> View
                      </a>
                      <button type="button" className={styles.reuploadBtn} onClick={() => updateField('interest_letter_file', '')}>
                        <i className="fa fa-refresh"></i> Re-upload
                      </button>
                    </div>
                  )}
                </div>

                {formData.has_interest_letter === 1 && !formData.interest_letter_file && !isBulkUpload && (
                  <div className={styles.uploadRow}>
                    <input type="file" id="interest_letter_upload" className={styles.fileInput} />
                    <button type="button" className={styles.uploadBtn} onClick={executeInterestLetterUpload}>
                      <i className="fa fa-upload"></i> Upload
                    </button>
                  </div>
                )}
              </div>

              {formData.document_checklist.map((item, i) => {
                if (item.label.startsWith('Bulk:')) return null;
                return (
                  <div key={i} className={styles.checkItem}>
                    <div className={styles.docItemHeader}>
                      <span>{i + 1}. {item.label}</span>

                      {!item.file_name ? (
                        <YesNoToggle value={item.value} onChange={(v) => updateCheck(i, v)} />
                      ) : (
                        <div className={styles.submittedWrapper}>
                          <a 
                            href={`/api/viewDoc?key=${encodeURIComponent(item.file_name)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.viewFileBtn}
                          >
                            <i className="fa fa-external-link"></i> View
                          </a>
                          <button type="button" onClick={() => handleDocReupload(i)} className={styles.reuploadBtn}>
                            <i className="fa fa-refresh"></i> Re-upload
                          </button>
                        </div>
                      )}
                    </div>

                    {item.value === 1 && !item.file_name && !isBulkUpload && (
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
                )
              })}
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

      {showBulkModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2><i className="fa fa-files-o"></i> Bulk Uploaded Documents</h2>
              <button className={styles.closeBtn} onClick={() => setShowBulkModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.bulkList}>
                {bulkFiles.map((file, index) => (
                  <div key={index} className={styles.bulkFileRow}>
                    <span className={styles.fileName} title={file.label.replace('Bulk: ', '')}>
                      <i className="fa fa-file-text-o"></i> {file.label.replace('Bulk: ', '')}
                    </span>
                    <div className={styles.fileActions}>
                      <a 
                        href={`/api/viewDoc?key=${encodeURIComponent(file.file_name)}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.viewFileBtn}
                      >
                        <i className="fa fa-external-link"></i> View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showExecModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2><i className="fa fa-user-plus"></i> Add CP</h2>
              <button className={styles.closeBtn} onClick={() => setShowExecModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleCreateExecutive} className={styles.modalBody}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#6b7280' }}>
                This creates a new <strong>CP</strong> account. They will be forced to change their password upon first login.
              </p>
              
              <div className={styles.inputGroup}>
                <label className={styles.label}>Full Name *</label>
                <input type="text" required className={styles.input} value={newExecForm.name} onChange={e => setNewExecForm(prev => ({...prev, name: e.target.value}))} placeholder="John Doe" />
              </div>
              
              <div className={styles.inputGroup}>
                <label className={styles.label}>Email Address *</label>
                <input type="email" required className={styles.input} value={newExecForm.email} onChange={e => setNewExecForm(prev => ({...prev, email: e.target.value}))} placeholder="john@asmita.com" />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Contact Number</label>
                <input type="text" className={styles.input} value={newExecForm.phone} onChange={e => setNewExecForm(prev => ({...prev, phone: e.target.value}))} placeholder="+91 9876543210" />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Temporary Password *</label>
                <input type="text" required minLength="8" className={styles.input} value={newExecForm.password} onChange={e => setNewExecForm(prev => ({...prev, password: e.target.value}))} placeholder="Min 8 characters" />
              </div>

              <button type="submit" disabled={creatingExec} className={styles.saveBtn} style={{ marginTop: '10px' }}>
                {creatingExec ? 'Creating...' : 'Create CP'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ME ADDED: Modularized Duplicate Warning Modal */}
      <DuplicateAlertModal 
        isOpen={showDuplicateModal} 
        matchedProperty={duplicateMatch} 
        onContinue={() => setShowDuplicateModal(false)} 
      />

    </div>
  );
}