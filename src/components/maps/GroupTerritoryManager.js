import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { APIProvider, Map, useMap, useApiIsLoaded, AdvancedMarker } from '@vis.gl/react-google-maps';
import { logoPath } from '@/assets/images';
import { getGroupColor, getStatusColor } from '@/utils/geoUtils';
import styles from './GroupTerritoryManager.module.css';

const MIRA_ROAD_COORDS = { lat: 19.2813, lng: 72.8693 };

function DrawingMap({ 
  initialTerritory, 
  onPolygonChange, 
  clubbedProperties = [], 
  clubId, 
  currentPropertyId = null,
  controllerRef,
  onDrawingStateChange
}) {
  const map = useMap();
  const apiIsLoaded = useApiIsLoaded();
  const polygonRef = useRef(null);

  const currentProp = React.useMemo(() => {
    if (currentPropertyId) {
      const match = clubbedProperties.find(p => String(p.id) === String(currentPropertyId));
      if (match) return match;
    }
    return clubbedProperties.length > 0 ? clubbedProperties[0] : null;
  }, [clubbedProperties, currentPropertyId]);
  
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
  const isConnected = !isDrawing && coords.length >= 3;

  const updateCoords = useCallback((newCoords) => {
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      nextHistory.push(newCoords);
      return nextHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) setHistoryIndex(prev => prev - 1);
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) setHistoryIndex(prev => prev + 1);
  }, [historyIndex, history.length]);

  const clear = useCallback(() => {
    updateCoords([]);
    setIsDrawing(true);
  }, [updateCoords]);

  const connect = useCallback(() => {
    if (coords.length >= 3) {
      setIsDrawing(false);
    }
  }, [coords.length]);

  // Expose controller methods to parent modal
  useEffect(() => {
    if (controllerRef) {
      controllerRef.current = {
        undo,
        redo,
        clear,
        connect,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        isDrawing,
        pointCount: coords.length
      };
    }
  }, [controllerRef, undo, redo, clear, connect, historyIndex, history.length, isDrawing, coords.length]);

  // Broadcast state changes for reactive UI buttons
  useEffect(() => {
    if (onDrawingStateChange) {
      onDrawingStateChange({
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        isDrawing,
        pointCount: coords.length
      });
    }
  }, [historyIndex, history.length, isDrawing, coords.length, onDrawingStateChange]);

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
            scale: 9,
            fillColor: '#7c3aed',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2.5,
          },
          title: 'Click to connect & close territory',
          zIndex: 100,
        });

        firstMarkerRef.current.addListener('click', () => {
          if (coords.length >= 3) {
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

  // Sync coords to Polygon and handle edits & double click removal
  useEffect(() => {
    if (!apiIsLoaded || !map || !window.google) return;

    const polyColor = getGroupColor(clubId); // Distinct color matching group map territory
    const fillOpacity = isConnected ? 0.3 : 0;

    if (!polygonRef.current) {
      polygonRef.current = new window.google.maps.Polygon({
        fillColor: polyColor,
        fillOpacity: fillOpacity,
        strokeWeight: 2.5,
        strokeColor: polyColor,
        clickable: true,
        editable: true,
        zIndex: 1,
        map: map
      });
    } else {
      polygonRef.current.setOptions({ 
        editable: true,
        strokeColor: polyColor,
        fillColor: polyColor,
        fillOpacity: fillOpacity
      });
    }

    const currentPath = polygonRef.current.getPath();
    const currentLength = currentPath ? currentPath.getLength() : 0;
    
    let isDifferent = false;
    if (currentLength !== coords.length) {
      isDifferent = true;
    } else if (currentPath) {
      for (let i = 0; i < coords.length; i++) {
        const pt = currentPath.getAt(i);
        if (Math.abs(pt.lat() - coords[i].lat) > 0.000001 || Math.abs(pt.lng() - coords[i].lng) > 0.000001) {
          isDifferent = true;
          break;
        }
      }
    }
    
    if (isDifferent) {
      polygonRef.current.setPaths(coords);
    }

    const activePath = polygonRef.current.getPath();
    const listeners = [];
    if (activePath) {
      const handlePathEdit = () => {
        const path = polygonRef.current.getPath();
        if (!path) return;
        const newCoords = [];
        for (let i = 0; i < path.getLength(); i++) {
          const xy = path.getAt(i);
          newCoords.push({ lat: xy.lat(), lng: xy.lng() });
        }
        updateCoords(newCoords);
      };

      listeners.push(window.google.maps.event.addListener(activePath, 'set_at', handlePathEdit));
      listeners.push(window.google.maps.event.addListener(activePath, 'insert_at', handlePathEdit));
      listeners.push(window.google.maps.event.addListener(activePath, 'remove_at', handlePathEdit));
    }

    // Double-click on vertex point to remove it
    const dblclickListener = window.google.maps.event.addListener(polygonRef.current, 'dblclick', (e) => {
      if (e.stop) e.stop();
      const path = polygonRef.current.getPath();
      if (!path || path.getLength() === 0) return;

      if (e.vertex !== undefined) {
        path.removeAt(e.vertex);
        return;
      }

      // Fallback: check pixel distance to closest vertex on double-click
      if (e.latLng && map && map.getProjection()) {
        const proj = map.getProjection();
        const zoom = map.getZoom();
        const scale = Math.pow(2, zoom);
        const clickPoint = proj.fromLatLngToPoint(e.latLng);
        let closestIndex = -1;
        let minPixelDist = 22;

        for (let i = 0; i < path.getLength(); i++) {
          const pt = path.getAt(i);
          const vertexPoint = proj.fromLatLngToPoint(pt);
          const dx = (clickPoint.x - vertexPoint.x) * scale;
          const dy = (clickPoint.y - vertexPoint.y) * scale;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minPixelDist) {
            minPixelDist = dist;
            closestIndex = i;
          }
        }

        if (closestIndex !== -1) {
          path.removeAt(closestIndex);
        }
      }
    });
    listeners.push(dblclickListener);

    // Right-click on vertex to remove it
    const rightclickListener = window.google.maps.event.addListener(polygonRef.current, 'rightclick', (e) => {
      if (e.vertex !== undefined) {
        const path = polygonRef.current.getPath();
        if (path && path.getLength() > 0) {
          path.removeAt(e.vertex);
        }
      }
    });
    listeners.push(rightclickListener);

    // Clicking vertex 0 while drawing connects the shape
    const clickListener = window.google.maps.event.addListener(polygonRef.current, 'click', (e) => {
      if (isDrawing && e.vertex === 0 && coords.length >= 3) {
        setIsDrawing(false);
      }
    });
    listeners.push(clickListener);

    return () => {
      listeners.forEach(l => window.google.maps.event.removeListener(l));
    };

  }, [apiIsLoaded, map, coords, isDrawing, isConnected, clubId, updateCoords]);

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"></path>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
          </svg>
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); redo(); }} 
          disabled={historyIndex === history.length - 1} 
          title="Redo"
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: historyIndex === history.length - 1 ? '#f1f5f9' : '#f8fafc', color: historyIndex === history.length - 1 ? '#94a3b8' : '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: historyIndex === history.length - 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6"></path>
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
          </svg>
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); clear(); }} 
          title="Clear Map"
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', color: '#ef4444', border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>

    {(isDrawing || coords.length > 0) ? (
      clubbedProperties.filter(p => p.lat && p.lng).map(p => {
        const isCurrent = currentPropertyId && String(p.id) === String(currentPropertyId);
        const pStatusColor = getStatusColor(p.status);
        return (
          <AdvancedMarker 
            key={`group-prop-${p.id || p.property_name}`} 
            position={{ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }} 
            zIndex={isCurrent ? 100 : 70}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', backgroundColor: '#ffffff',
                padding: '4px 12px 4px 8px', borderRadius: '50px',
                border: `3px solid ${pStatusColor}`,
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)', gap: '8px', whiteSpace: 'nowrap'
              }}>
                <Image src={logoPath} alt="L" width={20} height={20} />
                <span style={{ color: '#1e293b', fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-montserrat)' }}>
                  {p.property_name} {isCurrent ? '(Current)' : ''}
                </span>
              </div>
              <div style={{
                width: 0, height: 0, borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent', borderTop: `7px solid ${pStatusColor}`,
                marginTop: '-1px'
              }} />
            </div>
          </AdvancedMarker>
        );
      })
    ) : (
      Object.entries(groupedProperties).map(([key, groupProps]) => {
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
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
      })
    )}
    </>
  );
}

export default function GroupTerritoryManager({ 
  clubId, 
  initialName = '', 
  initialTerritory = null, 
  clubbedProperties = [],
  currentPropertyId = null,
  onSave, 
  onClose 
}) {
  const [name, setName] = useState(initialName);
  const [territory, setTerritory] = useState(initialTerritory);
  const [isSaving, setIsSaving] = useState(false);
  const drawingControllerRef = useRef(null);
  const [drawingState, setDrawingState] = useState({
    canUndo: false,
    canRedo: false,
    isDrawing: !(initialTerritory && Array.isArray(initialTerritory) && initialTerritory.length > 2),
    pointCount: Array.isArray(initialTerritory) ? initialTerritory.length : 0
  });

  const handleClear = () => {
    if (drawingControllerRef.current) {
      drawingControllerRef.current.clear();
    }
    setTerritory([]);
  };

  // Keyboard shortcuts for Undo and Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          drawingControllerRef.current?.redo();
        } else {
          drawingControllerRef.current?.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        drawingControllerRef.current?.redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          <div className={styles.headerTitleRow}>
            <div className={styles.headerIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="20 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </div>
            <h2>Manage Group Territory &amp; Identity</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {isSaving ? 'Saving...' : 'Save Group'}
          </button>
        </div>

        <div className={styles.mapInstruction}>
          <div className={styles.instructionText}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>
              {!drawingState.isDrawing && drawingState.pointCount >= 3
                ? `Territory connected (${drawingState.pointCount} vertices). Drag vertices to edit, or double-click to delete.`
                : drawingState.pointCount >= 3
                ? `Click starting point or "Connect Territory" to close the shape and fill territory.`
                : `Click on map to place vertices (min 3 points). Drag to edit, double-click to delete.`}
            </span>
          </div>

          <div className={styles.toolbarActions}>
            {/* UNDO BUTTON */}
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => drawingControllerRef.current?.undo()}
              disabled={!drawingState.canUndo || isSaving}
              title="Undo (Ctrl+Z)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6"></path>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
              </svg>
            </button>

            {/* REDO BUTTON */}
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => drawingControllerRef.current?.redo()}
              disabled={!drawingState.canRedo || isSaving}
              title="Redo (Ctrl+Y)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6"></path>
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
              </svg>
            </button>

            {/* CONNECT BUTTON */}
            {drawingState.isDrawing && drawingState.pointCount >= 3 && (
              <button
                type="button"
                className={styles.connectBtn}
                onClick={() => drawingControllerRef.current?.connect()}
                title="Connect vertices and color the group territory"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                Connect Territory
              </button>
            )}

            <div className={styles.toolBtnDivider} />

            {/* CLEAR BUTTON */}
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClear}
              title="Clear Territory"
              disabled={isSaving}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear
            </button>
          </div>
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
              disableDoubleClickZoom={true}
              mapTypeId="satellite"
              clickableIcons={false}
              gestureHandling="cooperative"
              style={{ width: '100%', height: '100%' }}
            >
              <DrawingMap 
                initialTerritory={territory} 
                onPolygonChange={setTerritory}
                clubbedProperties={clubbedProperties}
                clubId={clubId}
                currentPropertyId={currentPropertyId}
                controllerRef={drawingControllerRef}
                onDrawingStateChange={setDrawingState}
              />
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
