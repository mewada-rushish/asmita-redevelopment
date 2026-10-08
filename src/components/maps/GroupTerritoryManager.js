import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { APIProvider, Map, useMap, useApiIsLoaded, AdvancedMarker } from '@vis.gl/react-google-maps';
import { logoPath } from '@/assets/images';
import styles from './GroupTerritoryManager.module.css';

const getStatusColor = (status) => {
  const colors = { 
    'Not Approached': '#ef4444', 
    'Interest Letter Sent': '#f97316', 
    'Interested Letter Sent': '#f97316', 
    'Society Docs Received': '#eab308', 
    'Architect Survey Phase': '#84cc16', 
    'Architect Survey Completed': '#06b6d4',
    'Offer Letter Sent': '#3b82f6', 
    'Offer Under Negotiation': '#a855f7', 
    'Meeting Finalized': '#ec4899', 
    'Offer Accepted': '#ec4899', 
    'Approved': '#22c55e', 
    'Consent Phase': '#14b8a6', 
    'DA Phase': '#a0522d', 
    'Plan & CC Phase': '#22c55e' 
  };
  return colors[status] || '#9ca3af';
};

const MIRA_ROAD_COORDS = { lat: 19.2813, lng: 72.8693 };

function DrawingMap({ initialTerritory, onPolygonChange, clubbedProperties = [] }) {
  const map = useMap();
  const apiIsLoaded = useApiIsLoaded();
  const polygonRef = useRef(null);
  
  const parsedTerritory = React.useMemo(() => {
    if (typeof initialTerritory === 'string') {
      try {
        return JSON.parse(initialTerritory);
      } catch (e) {
        return [];
      }
    }
    return initialTerritory || [];
  }, [initialTerritory]);

  const [history, setHistory] = useState([parsedTerritory]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(!(parsedTerritory && parsedTerritory.length > 2));
  const firstMarkerRef = useRef(null);
  
  const [spiderfiedCoords, setSpiderfiedCoords] = useState(null);

  const groupedProperties = React.useMemo(() => {
    const groups = {};
    if (!clubbedProperties) return groups;
    clubbedProperties.forEach(p => {
      if (!p.lat || !p.lng) return;
      const key = `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [clubbedProperties]);

  const coords = history[historyIndex] || [];

  const updateCoords = useCallback((newCoords) => {
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      nextHistory.push(newCoords);
      return nextHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) setHistoryIndex(prev => prev - 1);
  };

  const redo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex(prev => prev + 1);
  };

  const clear = () => {
    updateCoords([]);
    setIsDrawing(true);
  };

  // Update parent when coords change
  useEffect(() => {
    onPolygonChange(coords);
  }, [coords, onPolygonChange]);

  // Render first point marker for closing the circuit
  useEffect(() => {
    if (!apiIsLoaded || !map || !window.google) return;
    
    if (isDrawing && coords.length > 0) {
      if (!firstMarkerRef.current) {
        firstMarkerRef.current = new window.google.maps.Marker({
          map,
          position: coords[0],
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
          },
          title: 'Click to close circuit',
          zIndex: 100,
        });

        firstMarkerRef.current.addListener('click', () => {
          if (coords.length > 2) {
            setIsDrawing(false);
            if (firstMarkerRef.current) {
              firstMarkerRef.current.setMap(null);
              firstMarkerRef.current = null;
            }
          }
        });
      } else {
        firstMarkerRef.current.setPosition(coords[0]);
      }
    } else {
      if (firstMarkerRef.current) {
        firstMarkerRef.current.setMap(null);
        firstMarkerRef.current = null;
      }
    }

    return () => {
      if (firstMarkerRef.current) {
        firstMarkerRef.current.setMap(null);
        firstMarkerRef.current = null;
      }
    };
  }, [apiIsLoaded, map, isDrawing, coords]);

  // Handle map clicks to build polygon
  useEffect(() => {
    if (!apiIsLoaded || !map || !window.google || !isDrawing) return;
    
    const clickListener = window.google.maps.event.addListener(map, 'click', (e) => {
      const newCoord = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      updateCoords([...coords, newCoord]);
    });

    return () => {
      window.google.maps.event.removeListener(clickListener);
    };
  }, [apiIsLoaded, map, isDrawing, coords, updateCoords]);

  // Sync coords to Polygon and handle edits
  useEffect(() => {
    if (!apiIsLoaded || !map || !window.google) return;

      const getStatusColor = (status) => {
        const colors = { 
          'Not Approached': '#ef4444', 
          'Interest Letter Sent': '#f97316', 
          'Interested Letter Sent': '#f97316',
          'Society Docs Received': '#eab308', 
          'Architect Survey Phase': '#84cc16', 
          'Architect Survey Completed': '#06b6d4',
          'Offer Letter Sent': '#3b82f6', 
          'Offer Under Negotiation': '#a855f7', 
          'Meeting Finalized': '#ec4899',
          'Offer Accepted': '#ec4899', 
          'Approved': '#22c55e',
          'Consent Phase': '#14b8a6', 
          'DA Phase': '#a0522d', 
          'Plan & CC Phase': '#22c55e' 
        };
        return colors[status] || '#9ca3af';
      };

      const polyColor = '#7c3aed'; // Distinct Violet for territories

      if (!polygonRef.current) {
        polygonRef.current = new window.google.maps.Polygon({
          fillColor: polyColor,
          fillOpacity: 0.3,
          strokeWeight: 2,
          strokeColor: polyColor,
          clickable: true,
          editable: !isDrawing,
          zIndex: 1,
          map: map
        });

      const handlePathEdit = () => {
        if (isDrawing) return;
        const path = polygonRef.current.getPath();
        const newCoords = [];
        for (let i = 0; i < path.getLength(); i++) {
          const xy = path.getAt(i);
          newCoords.push({ lat: xy.lat(), lng: xy.lng() });
        }
        updateCoords(newCoords);
      };

      window.google.maps.event.addListener(polygonRef.current.getPath(), 'set_at', handlePathEdit);
      window.google.maps.event.addListener(polygonRef.current.getPath(), 'insert_at', handlePathEdit);
      window.google.maps.event.addListener(polygonRef.current.getPath(), 'remove_at', handlePathEdit);
    } else {
      polygonRef.current.setOptions({ editable: !isDrawing });
    }

    // Update paths carefully to avoid loops
    const currentPath = polygonRef.current.getPath();
    let isDifferent = false;
    if (currentPath.getLength() !== coords.length) {
      isDifferent = true;
    } else {
      for (let i = 0; i < coords.length; i++) {
        const pt = currentPath.getAt(i);
        if (pt.lat() !== coords[i].lat || pt.lng() !== coords[i].lng) {
          isDifferent = true;
          break;
        }
      }
    }
    
    if (isDifferent) {
      polygonRef.current.setPaths(coords);
    }

  }, [apiIsLoaded, map, coords, isDrawing, updateCoords]);

  // Initial fit bounds (fit either initial territory or clubbed properties)
  useEffect(() => {
    if (map && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;
      
      if (parsedTerritory && parsedTerritory.length > 0) {
        parsedTerritory.forEach(coord => bounds.extend(coord));
        hasPoints = true;
      } else if (clubbedProperties && clubbedProperties.length > 0) {
        clubbedProperties.forEach(p => {
          if (p.lat && p.lng) {
            bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) });
            hasPoints = true;
          }
        });
      }

      if (hasPoints) {
        map.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [parsedTerritory, clubbedProperties, map]);

  return (
    <>
    <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'white', padding: '8px 16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '15px' }}>
      <span style={{ color: '#334155' }}>{isDrawing ? (coords.length > 2 ? 'Click the red starting point to complete the circuit.' : 'Click on the map to place points.') : 'Drag the vertices to edit. Right-click a vertex to remove it.'}</span>
      <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid #e2e8f0', paddingLeft: '15px' }}>
        <button 
          onClick={(e) => { e.preventDefault(); undo(); }} 
          disabled={historyIndex === 0} 
          title="Undo"
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: historyIndex === 0 ? '#f1f5f9' : '#f8fafc', color: historyIndex === 0 ? '#94a3b8' : '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: historyIndex === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
        >
          <i className="fa fa-undo"></i>
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); redo(); }} 
          disabled={historyIndex === history.length - 1} 
          title="Redo"
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: historyIndex === history.length - 1 ? '#f1f5f9' : '#f8fafc', color: historyIndex === history.length - 1 ? '#94a3b8' : '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: historyIndex === history.length - 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
        >
          <i className="fa fa-repeat"></i>
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); clear(); }} 
          title="Clear Map"
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', color: '#ef4444', border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <i className="fa fa-trash"></i>
        </button>
      </div>
    </div>

    {Object.entries(groupedProperties).map(([key, groupProps]) => {
      const centerLat = parseFloat(groupProps[0].lat);
      const centerLng = parseFloat(groupProps[0].lng);

      if (groupProps.length === 1) {
        const p = groupProps[0];
        return (
          <AdvancedMarker 
            key={p.id || p.property_name} 
            position={{ lat: centerLat, lng: centerLng }} 
            onClick={() => setSpiderfiedCoords(null)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{
                display: 'flex', alignItems: 'center', backgroundColor: '#ffffff',
                padding: '4px 12px 4px 8px', borderRadius: '50px',
                border: `3px solid ${getStatusColor(p.status)}`,
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)', gap: '8px', whiteSpace: 'nowrap'
              }}>
                <Image src={logoPath} alt="L" width={22} height={22} />
                <span style={{ color: '#1e293b', fontSize: '14px', fontWeight: '600', fontFamily: 'var(--font-montserrat)' }}>{p.property_name}</span>
              </div>
              <div style={{
                width: 0, height: 0, borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent', borderTop: `7px solid ${getStatusColor(p.status)}`,
                marginTop: '-1px'
              }} />
            </div>
          </AdvancedMarker>
        );
      }

      if (spiderfiedCoords === key) {
        const markers = groupProps.map((p, i) => {
          const angleRad = (2 * Math.PI * i) / groupProps.length;
          // Expand radius to comfortably fit markers without overlap
          const radiusX = 100; 
          const radiusY = 70;
          const xOffset = Math.cos(angleRad) * radiusX;
          const yOffset = Math.sin(angleRad) * radiusY;
          
          const length = Math.sqrt(xOffset * xOffset + yOffset * yOffset);
          const angleDeg = angleRad * (180 / Math.PI);
          const color = getStatusColor(p.status);
          
          return (
            <AdvancedMarker
              key={`${p.id || p.property_name}-spider`}
              position={{ lat: centerLat, lng: centerLng }}
              zIndex={100}
            >
              <div style={{ width: 0, height: 0, position: 'relative' }}>
                {/* The spider leg */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${length}px`,
                  height: '3px',
                  backgroundColor: color,
                  transformOrigin: '0 50%',
                  transform: `rotate(${angleDeg}deg)`,
                  opacity: 0.7,
                  pointerEvents: 'none'
                }} />
                
                {/* The marker pill */}
                <div style={{
                  position: 'absolute',
                  top: `${yOffset}px`,
                  left: `${xOffset}px`,
                  transform: 'translate(-50%, -50%) scale(0.9)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', backgroundColor: '#ffffff',
                    padding: '4px 12px 4px 8px', borderRadius: '50px',
                    border: `3px solid ${color}`,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)', gap: '8px', whiteSpace: 'nowrap'
                  }}>
                    <Image src={logoPath} alt="L" width={20} height={20} />
                    <span style={{ color: '#1e293b', fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-montserrat)' }}>{p.property_name}</span>
                  </div>
                </div>
              </div>
            </AdvancedMarker>
          );
        });
        
        // Add a center dot
        markers.push(
          <AdvancedMarker key={`${key}-center`} position={{ lat: centerLat, lng: centerLng }} zIndex={90} onClick={() => setSpiderfiedCoords(null)}>
            <div style={{
              width: '18px', height: '18px', backgroundColor: '#1e4ec4', border: '3px solid white', borderRadius: '50%',
              cursor: 'pointer', transform: 'translate(0, 0)', boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
            }} title="Click to collapse" />
          </AdvancedMarker>
        );
        
        return markers;
      } else {
        return (
          <AdvancedMarker
            key={`group-${key}`}
            position={{ lat: centerLat, lng: centerLng }}
            onClick={() => setSpiderfiedCoords(key)}
            zIndex={50}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{
                display: 'flex', alignItems: 'center', backgroundColor: '#1e4ec4',
                padding: '6px 12px', borderRadius: '50px',
                border: `3px solid #ffffff`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', gap: '8px', whiteSpace: 'nowrap'
              }}>
                <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: '800', fontFamily: 'var(--font-montserrat)' }}>
                  {groupProps.length} Properties
                </span>
                <i className="fa fa-expand" style={{ color: '#ffffff', fontSize: '12px' }}></i>
              </div>
              <div style={{
                width: 0, height: 0, borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent', borderTop: `7px solid #ffffff`,
                marginTop: '-1px'
              }} />
            </div>
          </AdvancedMarker>
        );
      }
    })}
    </>
  );
}

export default function GroupTerritoryManager({ 
  clubId, 
  initialName = '', 
  initialTerritory = null, 
  clubbedProperties = [],
  onSave, 
  onClose 
}) {
  const [name, setName] = useState(initialName);
  const [territory, setTerritory] = useState(initialTerritory);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name || name.trim() === '') {
      alert('Group/Township Name is mandatory. Please enter a name before saving.');
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/groups/${clubId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, territory })
      });
      if (res.ok) {
        onSave({ id: clubId, name, territory });
      } else {
        alert('Failed to save group details');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving group details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Manage Group Territory & Identity</h2>
          <button onClick={onClose} className={styles.closeBtn}><i className="fa fa-times"></i></button>
        </div>
        
        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label>Group/Township Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Aurora Township"
              className={styles.textInput}
            />
          </div>
          <button 
            className={styles.saveBtn} 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Group'}
          </button>
        </div>

        <div className={styles.mapInstruction}>
          <i className="fa fa-info-circle"></i> Click on the map to place vertices and draw your custom territory. You can drag existing vertices to edit the shape!
        </div>

        <div className={styles.mapWrapper}>
          <APIProvider 
            apiKey={process.env.NEXT_PUBLIC_GMAP_KEY} 
            libraries={['places', 'marker']}
          >
            <Map
              defaultCenter={MIRA_ROAD_COORDS}
              defaultZoom={15}
              mapId={process.env.NEXT_PUBLIC_GMAP_ID || "DEMO_MAP_ID"}
              disableDefaultUI={true}
              mapTypeId="hybrid"
              gestureHandling="cooperative"
              style={{ width: '100%', height: '100%' }}
            >
              <DrawingMap 
                initialTerritory={territory} 
                onPolygonChange={setTerritory}
                clubbedProperties={clubbedProperties}
              />
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
