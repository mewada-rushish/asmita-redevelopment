'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { APIProvider, Map, useMap, useApiIsLoaded, AdvancedMarker } from '@vis.gl/react-google-maps';
import { logoPath } from '@/assets/images';
import { getStatusColor } from '@/utils/geoUtils';
import styles from './BuildingBoundaryManager.module.css';

function BuildingDrawingMap({ initialBoundary, onPolygonChange, pinLat, pinLng, status = 'Not Approached' }) {
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
            scale: 8,
            fillColor: statusColor,
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
          },
          title: "Click to close building border"
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

  // Sync coords to Polygon and handle edits
  useEffect(() => {
    if (!apiIsLoaded || !map || !window.google) return;

    const strokeCol = statusColor;
    const fillCol = statusColor;

    if (!polygonRef.current) {
      polygonRef.current = new window.google.maps.Polygon({
        fillColor: fillCol,
        fillOpacity: 0.35,
        strokeWeight: 3,
        strokeColor: strokeCol,
        clickable: true,
        editable: true,
        zIndex: 50,
        map: map
      });

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

      window.google.maps.event.addListener(polygonRef.current.getPath(), 'set_at', handlePathEdit);
      window.google.maps.event.addListener(polygonRef.current.getPath(), 'insert_at', handlePathEdit);
      window.google.maps.event.addListener(polygonRef.current.getPath(), 'remove_at', handlePathEdit);
    } else {
      polygonRef.current.setOptions({ editable: true });
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

    return () => {
      // Keep polygon on unmount of effect
    };
  }, [apiIsLoaded, map, coords, updateCoords]);

  return (
    <>
      {/* Property Pin for visual reference */}
      {pinLat && pinLng && (
        <AdvancedMarker position={{ lat: Number(pinLat), lng: Number(pinLng) }} zIndex={100}>
          <div style={{
            width: '32px', height: '32px', backgroundColor: statusColor,
            borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
            border: '2px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Image src={logoPath} alt="L" width={18} height={18} style={{ transform: 'rotate(45deg)', filter: 'brightness(0) invert(1)' }} />
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}

export default function BuildingBoundaryManager({
  initialBoundary = null,
  lat,
  lng,
  propertyName = 'Property',
  status = 'Not Approached',
  onSave,
  onClose
}) {
  const statusColor = getStatusColor(status);
  const [boundary, setBoundary] = useState(initialBoundary);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const handleSave = () => {
    onSave(boundary);
    onClose();
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
            <h2><i className="fa fa-building-o" style={{ color: statusColor }}></i> Mark Building Border — {propertyName}</h2>
            <p>Click corners around the building footprint to draw the rooftop boundary. Drag vertices to fine-tune.</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close">
            <i className="fa fa-times"></i>
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.instruction}>
            <i className="fa fa-info-circle" style={{ color: statusColor }}></i>
            {boundary && boundary.length > 2
              ? `Boundary marked with ${boundary.length} vertices. You can drag any vertex point to adjust.`
              : 'Click 3 or more points around the building rooftop/edges to complete the outline.'}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setBoundary([])}
              title="Clear Boundary"
            >
              <i className="fa fa-trash"></i> Clear
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              style={{ backgroundColor: statusColor, borderColor: statusColor, boxShadow: `0 2px 6px ${statusColor}40` }}
              onClick={handleSave}
            >
              <i className="fa fa-check"></i> Save Building Border
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
              mapTypeId="hybrid"
              gestureHandling="cooperative"
              style={{ width: '100%', height: '100%' }}
            >
              <BuildingDrawingMap
                initialBoundary={initialBoundary}
                onPolygonChange={setBoundary}
                pinLat={lat}
                pinLng={lng}
                status={status}
              />
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
