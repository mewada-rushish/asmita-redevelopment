"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./partners.module.css";
import toast from "react-hot-toast";

// Standardized color engine matching your global dashboard map precisely
const getStatusStyles = (status) => {
  const s = status?.trim() || '';

  const colors = { 
    'Not Approached': { text: '#ef4444', bg: '#fee2e2' }, 
    'Interest Letter Sent': { text: '#f97316', bg: '#fff7ed' }, 
    'Interested Letter Sent': { text: '#f97316', bg: '#fff7ed' }, // Legacy handling
    'Society Docs Received': { text: '#eab308', bg: '#fef9c3' }, 
    'Architect Survey Phase': { text: '#84cc16', bg: '#f1fbe7' }, 
    'Architect Survey Completed': { text: '#06b6d4', bg: '#ecfeff' }, 
    'Offer Letter Sent': { text: '#3b82f6', bg: '#eff6ff' }, 
    'Offer Under Negotiation': { text: '#a855f7', bg: '#faf5ff' }, 
    'Meeting Finalized': { text: '#ec4899', bg: '#fdf2f8' }, // Legacy handling
    'Offer Accepted': { text: '#ec4899', bg: '#fdf2f8' }, 
    'Approved': { text: '#22c55e', bg: '#f0fdf4' }, // Legacy handling
    'Consent Phase': { text: '#14b8a6', bg: '#f0fdfa' }, 
    'DA Phase': { text: '#a0522d', bg: '#fdf6f0' }, 
    'Plan & CC Phase': { text: '#22c55e', bg: '#f0fdf4' } 
  };

  // Case-insensitive exact match check
  const normalizedStatus = Object.keys(colors).find(
    key => key.toLowerCase() === s.toLowerCase()
  );

  if (normalizedStatus) {
    return colors[normalizedStatus];
  }

  // Robust fallback matches in case database format differs slightly
  const sLower = s.toLowerCase();
  if (sLower.includes('not approached')) return colors['Not Approached'];
  if (sLower.includes('interest')) return colors['Interest Letter Sent'];
  if (sLower.includes('docs') || sLower.includes('received')) return colors['Society Docs Received'];
  if (sLower.includes('architect survey') || sLower.includes('survey phase')) return colors['Architect Survey Phase'];
  if (sLower.includes('survey completed')) return colors['Architect Survey Completed'];
  if (sLower.includes('offer letter sent')) return colors['Offer Letter Sent'];
  if (sLower.includes('negotiation') || sLower.includes('under negotiation')) return colors['Offer Under Negotiation'];
  if (sLower.includes('accepted')) return colors['Offer Accepted'];
  if (sLower.includes('approved')) return colors['Approved'];
  if (sLower.includes('consent')) return colors['Consent Phase'];
  if (sLower.includes('da')) return colors['DA Phase'];
  if (sLower.includes('cc') || sLower.includes('plan')) return colors['Plan & CC Phase'];

  // Default Gray fallback if status is empty or unknown
  return { text: '#475569', bg: '#f1f5f9' }; 
};

export default function PartnersListingPage() {
  const router = useRouter();
  const [partners, setPartners] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State for the drawer
  const [selectedCP, setSelectedCP] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Channel Partners
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const res = await fetch("/api/partners");
        if (!res.ok) throw new Error("Failed to fetch data");
        const json = await res.json();
        setPartners(json.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load channel partners.");
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, []);

  // Handlers for Drawer & Navigation
  const handleViewClick = (cp) => {
    setSelectedCP(cp);
    setSearchQuery(""); // Reset search when opening new drawer
  };

  const closeDrawer = () => {
    setSelectedCP(null);
  };

  const handlePropertyClick = (propertyId) => {
    // Navigates to map page with the property selected
    router.push(`/dashboard?propertyId=${propertyId}`);
  };

  // --- EXPORT HANDLERS ---
  const handleGlobalExport = () => {
    toast.success("Starting complete database export...");
    window.open(`/api/properties/export`, '_blank');
  };

  const handleCPExport = (cpId) => {
    toast.success("Exporting partner properties...");
    window.open(`/api/properties/export?cpId=${cpId}`, '_blank');
  };

  const handleSingleExport = (e, propertyId) => {
    e.stopPropagation(); // Prevents the card click (map redirect) from firing
    toast.success("Downloading property data...");
    window.open(`/api/properties/export?propertyId=${propertyId}`, '_blank');
  };

  // Filter properties based on sticky search
  const filteredProperties = selectedCP?.properties.filter(prop => 
    prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prop.locality.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className={styles.container}>
      {/* Header with Global Export Button */}
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Channel Partners</h1>
          <p>Manage and view all registered channel partners and their linked properties.</p>
        </div>
        <button 
          onClick={handleGlobalExport} 
          style={{ 
            backgroundColor: '#E21F26', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '6px', 
            fontWeight: '600', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(226, 31, 38, 0.2)'
          }}
        >
          <i className="fa fa-download"></i> Export All
        </button>
      </header>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.emptyState}>
            <i className="fa fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Loading partners...
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>CP Code</th>
                  <th>Partner Name</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Properties Linked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners?.map((cp) => (
                  <tr key={cp.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{cp.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                        <i className="fa fa-user-circle-o" style={{ color: '#94a3b8', fontSize: '16px' }}></i>
                        {cp.name}
                      </div>
                    </td>
                    <td>{cp.company}</td>
                    <td>{cp.contact}</td>
                    <td>
                      <span className={`${styles.badge} ${cp.status === 'Active' ? styles.badgeActive : styles.badgeInactive}`}>
                        {cp.status}
                      </span>
                    </td>
                    <td>{cp.properties.length} Properties</td>
                    <td>
                      <button 
                        onClick={() => handleViewClick(cp)} 
                        className={styles.viewBtn}
                        aria-label={`View properties for ${cp.name}`}
                      >
                        <i className="fa fa-eye"></i> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer Overlay & Content for Linked Properties */}
      {selectedCP && (
        <div className={styles.drawerOverlay} onClick={closeDrawer}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            
            <div className={styles.drawerHeader}>
              <div>
                <h2>{selectedCP.company}</h2>
                <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedCP.name}
                </span>
              </div>
              <button onClick={closeDrawer} className={styles.closeBtn}>
                <i className="fa fa-times" style={{ fontSize: '20px' }}></i>
              </button>
            </div>

            {/* Sticky Search Bar */}
            <div className={styles.stickySearch}>
              <div className={styles.searchBox}>
                <i className="fa fa-search"></i>
                <input 
                  type="text" 
                  placeholder="Search linked properties..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Property List Container */}
            <div className={styles.propertyList}>
              
              {/* List Action Bar (Above the cards) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
                  Showing {filteredProperties.length} Properties
                </span>
                {filteredProperties.length > 0 && (
                  <button 
                    onClick={() => handleCPExport(selectedCP.raw_id)}
                    style={{ background: 'none', border: 'none', color: '#27347B', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa fa-download"></i> Download List
                  </button>
                )}
              </div>

              {filteredProperties.length > 0 ? (
                filteredProperties.map((prop) => {
                  const statusStyle = getStatusStyles(prop.status);
                  
                  return (
                    <div 
                      key={prop.id} 
                      className={styles.propertyCard}
                      onClick={() => handlePropertyClick(prop.id)}
                      style={{ position: 'relative' }} 
                    >
                      {/* Top Right Download Icon */}
                      <button 
                        onClick={(e) => handleSingleExport(e, prop.id)}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                        title="Download full property details"
                      >
                        <i className="fa fa-download" style={{ transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#27347B'} onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}></i>
                      </button>

                      <div className={styles.propertyIcon}>
                        <i className="fa fa-building-o" style={{ fontSize: '24px' }}></i>
                      </div>
                      
                      <div className={styles.propertyInfo} style={{ paddingRight: '40px' }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{prop.name}</h3>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                          <i className="fa fa-map-marker" style={{ marginRight: '4px' }}></i> {prop.locality}
                        </p>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginTop: '8px', display: 'block' }}>
                          {prop.type} • {prop.id}
                        </span>
                      </div>

                      {/* Bottom Right Status Badge */}
                      <div style={{ 
                        position: 'absolute', 
                        bottom: '12px', 
                        right: '12px', 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        backgroundColor: statusStyle.bg, 
                        color: statusStyle.text,
                        textTransform: 'uppercase'
                      }}>
                        {prop.status}
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyState}>
                  <p>No properties found matching &quot;{searchQuery}&quot;</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}