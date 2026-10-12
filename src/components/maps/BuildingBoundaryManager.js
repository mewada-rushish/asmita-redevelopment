'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { APIProvider, Map, useMap, useApiIsLoaded, AdvancedMarker } from '@vis.gl/react-google-maps';
import { logoPath } from '@/assets/images';
import { getStatusColor } from '@/utils/geoUtils';
import toast from 'react-hot-toast';
import styles from './BuildingBoundaryManager.module.css';

function BuildingDrawingMap({ 
  initialBoundary, 
  onPolygonChange, 
  pinLat, 
  pinLng, 
  propertyName = 'Property', 
  status = 'Not Approached', 
  linkedProperties = [],
  controllerRef,
  onDrawingStateChange
}) {
  const statusColor = getStatusColor(status);
  const map = useMap();
  const apiIsLoaded = useApiIsLoaded();
  const polygonRef = useRef(null);
  const firstMarkerRef = useRef(null);

  const parsedBoundary = React.useMemo(() => {
    if (typeof initialBoundary === 'string') {
      try {
        return JSON.parse(initialBoundary);
      } catch (e) {
        return [];
      }
    }
    return initialBoundary || [];
  }, [initialBoundary]);

  const [history, setHistory] = useState([parsedBoundary]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(!(parsedBoundary && parsedBoundary.length > 2));

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

  useEffect(() => {
    onPolygonChange(coords);
  }, [coords, onPolygonChange]);

  // Center on building pin on mount
  useEffect(() => {
    if (map && pinLat && pinLng) {
      map.setCenter({ lat: Number(pinLat), lng: Number(pinLng) });
      map.setZoom(20);
    }
  }, [map, pinLat, pinLng]);

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
            fillColor: statusColor,
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2.5,
          },
          title: "Click to connect & close building border",
          zIndex: 999
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
  }, [apiIsLoaded, map, isDrawing, coords, statusColor]);

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

  // Sync coords to Polygon and handle edits & double-click removal
  useEffect(() => {
    if (!apiIsLoaded || !map || !window.google) return;

    const strokeCol = statusColor;
    const fillCol = statusColor;
    // Area background color is colored ONLY after vertices are connected
    const fillOpacity = isConnected ? 0.35 : 0;

    if (!polygonRef.current) {
      polygonRef.current = new window.google.maps.Polygon({
        fillColor: fillCol,
        fillOpacity: fillOpacity,
        strokeWeight: 3,
        strokeColor: strokeCol,
        clickable: true,
        editable: true,
        zIndex: 50,
        map: map
      });
    } else {
      polygonRef.current.setOptions({ 
        editable: true, 
        strokeColor: strokeCol, 
        fillColor: fillCol,
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
  }, [apiIsLoaded, map, coords, statusColor, updateCoords, isConnected, isDrawing]);

  return (
    <>
      {/* Current Property Custom Marker */}
      {pinLat && pinLng && (
        <AdvancedMarker position={{ lat: Number(pinLat), lng: Number(pinLng) }} zIndex={100}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', backgroundColor: '#ffffff',
              padding: '4px 12px 4px 8px', borderRadius: '50px',
              border: `3px solid ${statusColor}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', gap: '8px', whiteSpace: 'nowrap'
            }}>
              <div style={{
                width: '20px', height: '20px', backgroundColor: statusColor,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Image src={logoPath} alt="L" width={13} height={13} style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <span style={{ color: '#0f172a', fontSize: '13px', fontWeight: '700', fontFamily: 'var(--font-montserrat)' }}>
                {propertyName}
              </span>
            </div>
            <div style={{
              width: 0, height: 0, borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent', borderTop: `7px solid ${statusColor}`,
              marginTop: '-1px'
            }} />
          </div>
        </AdvancedMarker>
      )}

      {/* Linked Group Properties Custom Markers */}
      {linkedProperties && linkedProperties.filter(p => p.lat && p.lng && (Math.abs(Number(p.lat) - Number(pinLat)) > 0.00001 || Math.abs(Number(p.lng) - Number(pinLng)) > 0.00001)).map(p => {
        const pStatusColor = getStatusColor(p.status);
        return (
          <AdvancedMarker 
            key={`linked-${p.id || p.property_name}`}
            position={{ lat: Number(p.lat), lng: Number(p.lng) }}
            zIndex={70}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.9 }}>
              <div style={{
                display: 'flex', alignItems: 'center', backgroundColor: '#ffffff',
                padding: '4px 10px 4px 6px', borderRadius: '50px',
                border: `2px solid ${pStatusColor}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)', gap: '6px', whiteSpace: 'nowrap'
              }}>
                <Image src={logoPath} alt="L" width={16} height={16} />
                <span style={{ color: '#334155', fontSize: '12px', fontWeight: '600', fontFamily: 'var(--font-montserrat)' }}>
                  {p.property_name}
                </span>
              </div>
              <div style={{
                width: 0, height: 0, borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent', borderTop: `6px solid ${pStatusColor}`,
                marginTop: '-1px'
              }} />
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
}

export default function BuildingBoundaryManager({
  initialBoundary = null,
  lat,
  lng,
  propertyName = 'Property',
  status = 'Not Approached',
  linkedProperties = [],
  propertyId = null,
  onSave,
  onClose
}) {
  const statusColor = getStatusColor(status);
  const [boundary, setBoundary] = useState(initialBoundary);
  const [resetKey, setResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const drawingControllerRef = useRef(null);
  const [drawingState, setDrawingState] = useState({
    canUndo: false,
    canRedo: false,
    isDrawing: !(initialBoundary && Array.isArray(initialBoundary) && initialBoundary.length > 2),
    pointCount: Array.isArray(initialBoundary) ? initialBoundary.length : 0
  });

  const handleClear = () => {
    if (drawingControllerRef.current) {
      drawingControllerRef.current.clear();
    }
    setBoundary([]);
    setResetKey(prev => prev + 1);
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
    const validBoundary = boundary && Array.isArray(boundary) && boundary.length >= 3 ? boundary : null;

    if (boundary && Array.isArray(boundary) && boundary.length > 0 && boundary.length < 3) {
      toast.error("A building boundary requires at least 3 points to outline a building. Please add more points.");
      return;
    }

    setIsSaving(true);
    try {
      if (propertyId) {
        const res = await fetch(`/api/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ building_boundary: validBoundary })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to save to database');
        }
        toast.success("Building border saved successfully!");
      }
      onSave(validBoundary);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error saving building border: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const centerCoords = {
    lat: Number(lat) || 19.2813,
    lng: Number(lng) || 72.8693
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.headerInfo}>
            <div className={styles.headerTitleRow}>
              <div 
                className={styles.headerIconBadge} 
                style={{ 
                  backgroundColor: `${statusColor}18`, 
                  borderColor: `${statusColor}35`, 
                  color: statusColor 
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"></rect>
                  <circle cx="3" cy="3" r="2" fill="currentColor"></circle>
                  <circle cx="21" cy="3" r="2" fill="currentColor"></circle>
                  <circle cx="21" cy="21" r="2" fill="currentColor"></circle>
                  <circle cx="3" cy="21" r="2" fill="currentColor"></circle>
                </svg>
              </div>
              <h2>Mark Building Border &mdash; <span style={{ color: statusColor }}>{propertyName}</span></h2>
            </div>
            <p>Click corners around the building footprint to draw the rooftop boundary. Drag vertices to fine-tune.</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close" disabled={isSaving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.instruction}>
            <div className={styles.instructionIcon} style={{ color: statusColor }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <span>
              {!drawingState.isDrawing && drawingState.pointCount >= 3
                ? `Boundary connected with ${drawingState.pointCount} vertices. Drag vertices to adjust, or double-click to delete.`
                : drawingState.pointCount >= 3
                ? `Click starting point or "Connect Border" to close the shape and color the area.`
                : `Click 3 or more corners around the building rooftop/edges to outline.`}
            </span>
          </div>

          <div className={styles.actions}>
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

            {/* CONNECT BUTTON (when drawing and >= 3 points) */}
            {drawingState.isDrawing && drawingState.pointCount >= 3 && (
              <button
                type="button"
                className={styles.connectBtn}
                style={{ backgroundColor: `${statusColor}18`, color: statusColor, borderColor: `${statusColor}40` }}
                onClick={() => drawingControllerRef.current?.connect()}
                title="Connect vertices and color the building area"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                Connect Border
              </button>
            )}

            <div className={styles.toolBtnDivider} />

            {/* CLEAR BUTTON */}
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClear}
              title="Clear Boundary"
              disabled={isSaving}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear
            </button>

            {/* SAVE BUTTON */}
            <button
              type="button"
              className={styles.saveBtn}
              style={{ backgroundColor: statusColor, borderColor: statusColor, boxShadow: `0 2px 8px ${statusColor}40` }}
              onClick={handleSave}
              disabled={isSaving}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              {isSaving ? 'Saving...' : 'Save Building Border'}
            </button>
          </div>
        </div>

        <div className={styles.mapWrapper}>
          <APIProvider
            apiKey={process.env.NEXT_PUBLIC_GMAP_KEY}
            libraries={['places', 'marker']}
          >
            <Map
              defaultCenter={centerCoords}
              defaultZoom={20}
              mapId={process.env.NEXT_PUBLIC_GMAP_ID || "DEMO_MAP_ID"}
              disableDefaultUI={true}
              disableDoubleClickZoom={true}
              mapTypeId="satellite"
              clickableIcons={false}
              gestureHandling="cooperative"
              style={{ width: '100%', height: '100%' }}
            >
              <BuildingDrawingMap
                key={`draw-map-${resetKey}`}
                initialBoundary={boundary}
                onPolygonChange={setBoundary}
                pinLat={lat}
                pinLng={lng}
                propertyName={propertyName}
                status={status}
                linkedProperties={linkedProperties}
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
