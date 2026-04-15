'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { logoPath } from '@/assets/images';

const MIRA_ROAD_CENTER = { lat: 19.2813, lng: 72.8693 };

const getStatusColor = (s) => {
  const colors = { 
    'Not Approached': '#ef4444', 
    'Interested Letter Sent': '#f59e0b', 
    'Meeting Finalized': '#f97316', 
    'Approved': '#10b981' 
  };
  return colors[s] || '#6b7280';
};

const STYLE_URLS = {
  streets: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};

export default function MapLibreViewer({ 
  properties = [], 
  mapStyle = 'streets', 
  initialLat, 
  initialLng, 
  onLocationSelect,
  onMarkerClick
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [isMapReady, setIsMapReady] = useState(false);

  const createMarkerElement = useCallback((title, status, propertyData = null) => {
    const color = getStatusColor(status);
    const container = document.createElement('div');
    container.style.cssText = 'display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.15)); cursor:pointer; z-index: 100; pointer-events: auto;';

    const badge = document.createElement('div');
    badge.style.cssText = `
      display:flex; align-items:center; background:rgba(255, 255, 255, 0.95); 
      backdrop-filter: blur(4px); border: 2px solid ${color}; 
      padding: 5px 12px; border-radius: 30px; transition: all 0.2s ease;
    `;
    
    const img = document.createElement('img');
    img.src = logoPath;
    img.style.cssText = 'width:18px; height:18px; margin-right:8px; display:block; object-fit:contain;';
    img.onerror = () => { img.style.display = 'none'; };

    const name = document.createElement('span');
    name.innerText = title;
    name.style.cssText = 'font-size:12px; font-weight:800; color:#1e293b; white-space:nowrap; font-family: sans-serif;';

    badge.appendChild(img);
    badge.appendChild(name);

    const tail = document.createElement('div');
    tail.style.cssText = `
      width: 0; height: 0; 
      border-left: 7px solid transparent; border-right: 7px solid transparent; 
      border-top: 10px solid ${color}; margin-top: -1px;
    `;

    container.appendChild(badge);
    container.appendChild(tail);

    if (propertyData && onMarkerClick) {
      container.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onMarkerClick(propertyData);
      };
    }

    container.onmouseenter = () => { badge.style.transform = 'scale(1.05) translateY(-2px)'; };
    container.onmouseleave = () => { badge.style.transform = 'scale(1) translateY(0)'; };

    return container;
  }, [onMarkerClick]);

  const renderMarkers = useCallback(() => {
    if (!map.current || !isMapReady) return;
    
    markers.current.forEach(m => m.remove());
    markers.current = [];

    if (properties && properties.length > 0) {
      properties.forEach(p => {
        const el = createMarkerElement(p.property_name, p.status, p);
        const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([parseFloat(p.lng), parseFloat(p.lat)])
          .addTo(map.current);
        markers.current.push(m);
      });
    } else if (Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
      const el = createMarkerElement("Selected Location", "Approved");
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([parseFloat(initialLng), parseFloat(initialLat)])
        .addTo(map.current);
      markers.current.push(m);
    }
  }, [properties, initialLat, initialLng, isMapReady, createMarkerElement]);

  // ME TRICK 1: Center/Fly logic when coordinates change (Address search or Manual Type)
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    if (Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
      // Check if map already looking there. If not, FLY!
      const center = map.current.getCenter();
      const diffLat = Math.abs(center.lat - initialLat);
      const diffLng = Math.abs(center.lng - initialLng);

      if (diffLat > 0.0001 || diffLng > 0.0001) {
        map.current.flyTo({
          center: [initialLng, initialLat],
          essential: true,
          zoom: 17
        });
      }
    }
  }, [initialLat, initialLng, isMapReady]);

  // ME TRICK 2: Dashboard auto-center on nearest property
  useEffect(() => {
    if (!map.current || !isMapReady || properties.length === 0) return;
    
    // Only do "nearest Mira Road" if NO specific initialLat is given (Dashboard mode)
    if (!initialLat || !initialLng) {
        let nearest = properties[0];
        let minDiff = Math.sqrt(
          Math.pow(parseFloat(properties[0].lat) - MIRA_ROAD_CENTER.lat, 2) +
          Math.pow(parseFloat(properties[0].lng) - MIRA_ROAD_CENTER.lng, 2)
        );

        properties.forEach(p => {
          const diff = Math.sqrt(
            Math.pow(parseFloat(p.lat) - MIRA_ROAD_CENTER.lat, 2) +
            Math.pow(parseFloat(p.lng) - MIRA_ROAD_CENTER.lng, 2)
          );
          if (diff < minDiff) {
            minDiff = diff;
            nearest = p;
          }
        });

        map.current.flyTo({
          center: [parseFloat(nearest.lng), parseFloat(nearest.lat)],
          essential: true,
          zoom: 16
        });
    }
  }, [properties, isMapReady, initialLat, initialLng]);

  useEffect(() => {
    if (map.current) return;

    // Use property coords if exist, else use Mira Road
    const startLat = Number.isFinite(initialLat) ? initialLat : MIRA_ROAD_CENTER.lat;
    const startLng = Number.isFinite(initialLng) ? initialLng : MIRA_ROAD_CENTER.lng;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      attributionControl: false,
      style: {
        version: 8,
        sources: { 'base-tiles': { type: 'raster', tiles: [STYLE_URLS[mapStyle]], tileSize: 256 } },
        layers: [{ id: 'base-layer', type: 'raster', source: 'base-tiles' }]
      },
      center: [startLng, startLat],
      zoom: 15
    });

    map.current.on('load', () => setIsMapReady(true));

    map.current.on('click', (e) => {
      if (onLocationSelect) {
        const { lng, lat } = e.lngLat;
        onLocationSelect({ lat, lng });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); 

  useEffect(() => {
    if (!map.current || !isMapReady) return;
    const updateStyle = () => {
      if (map.current.getLayer('base-layer')) map.current.removeLayer('base-layer');
      if (map.current.getSource('base-tiles')) map.current.removeSource('base-tiles');
      map.current.addSource('base-tiles', { type: 'raster', tiles: [STYLE_URLS[mapStyle]], tileSize: 256 });
      map.current.addLayer({ id: 'base-layer', type: 'raster', source: 'base-tiles' });
    };
    if (map.current.isStyleLoaded()) updateStyle();
    else map.current.once('style.load', updateStyle);
  }, [mapStyle, isMapReady]);

  useEffect(() => {
    renderMarkers();
  }, [properties, initialLat, initialLng, renderMarkers]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%', minHeight: '350px' }} />;
}