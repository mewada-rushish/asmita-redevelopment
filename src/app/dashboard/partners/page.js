"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./partners.module.css";
import toast from "react-hot-toast";

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

  // Handlers
  const handleViewClick = (cp) => {
    setSelectedCP(cp);
    setSearchQuery(""); // Reset search when opening new drawer
  };

  const closeDrawer = () => {
    setSelectedCP(null);
  };

  const handlePropertyClick = (propertyId) => {
    // Navigates to map page (src/app/dashboard/page.js) with the property selected
    router.push(`/dashboard?propertyId=${propertyId}`);
  };

  // Filter properties based on sticky search
  const filteredProperties = selectedCP?.properties.filter(prop => 
    prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prop.locality.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Channel Partners</h1>
        <p>Manage and view all registered channel partners and their linked properties.</p>
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

            {/* Property List */}
            <div className={styles.propertyList}>
              {filteredProperties.length > 0 ? (
                filteredProperties.map((prop) => (
                  <div 
                    key={prop.id} 
                    className={styles.propertyCard}
                    onClick={() => handlePropertyClick(prop.id)}
                  >
                    <div className={styles.propertyIcon}>
                      <i className="fa fa-building-o" style={{ fontSize: '24px' }}></i>
                    </div>
                    <div className={styles.propertyInfo}>
                      <h3>{prop.name}</h3>
                      <p>
                        <i className="fa fa-map-marker"></i> {prop.locality}
                      </p>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginTop: '8px', display: 'block' }}>
                        {prop.type} • {prop.id}
                      </span>
                    </div>
                  </div>
                ))
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