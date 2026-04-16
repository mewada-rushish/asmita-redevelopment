'use client';

import { useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  useMap 
} from '@vis.gl/react-google-maps';
import { logoPath } from '@/assets/images';

const MIRA_ROAD_COORDS = { lat: 19.2813, lng: 72.8693 };

function InnerMap({ properties = [], mapStyle, onMarkerClick, lat, lng, onLocationSelect }) {
  const map = useMap();

  // 1. Calculate Bounds (Static size: 1 item [properties])
  const bounds = useMemo(() => {
    if (typeof window === 'undefined' || !window.google || properties.length === 0) return null;
    
    const b = new google.maps.LatLngBounds();
    properties.forEach(p => {
      if (p.lat && p.lng) {
        b.extend({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) });
      }
    });
    return b;
  }, [properties]);

  // 2. Auto-fit logic (Static size: 3 items)
  useEffect(() => {
    if (map && bounds && !bounds.isEmpty() && !onLocationSelect) {
      map.fitBounds(bounds, { padding: 70 });

      const listener = map.addListener('idle', () => {
        const currentZoom = map.getZoom();
        if (currentZoom < 14) map.setZoom(14);
        if (currentZoom > 17) map.setZoom(17);
        google.maps.event.removeListener(listener);
      });
    }
  }, [map, bounds, onLocationSelect]);

  // 3. Recenter Logic (Static size: 3 items)
  const handleRecenter = useCallback(() => {
    if (!map) return;
    if (bounds && !bounds.isEmpty() && !onLocationSelect) {
      map.fitBounds(bounds, { padding: 70 });
    } else {
      map.panTo(MIRA_ROAD_COORDS);
      map.setZoom(15);
    }
  }, [map, bounds, onLocationSelect]);

  // 4. Manual Pan logic (Static size: 3 items)
  useEffect(() => {
    if (map) {
      map.panTo({ lat, lng });
    }
  }, [lat, lng, map]);

  const getStatusColor = (status) => {
    const colors = {
      'Approved': '#10b981',
      'Interested Letter Sent': '#f59e0b',
      'Meeting Finalized': '#f97316',
      'Not Approached': '#ef4444'
    };
    return colors[status] || '#1e4ec4';
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultZoom={15}
        defaultCenter={MIRA_ROAD_COORDS} 
        mapTypeId={mapStyle === 'satellite' ? 'satellite' : 'roadmap'}
        
        /* ME FIX: 'cooperative' stops the map from stealing your scroll! 
           Requires 2 fingers on mobile or Ctrl+Scroll on Desktop to zoom/pan. */
        gestureHandling={'cooperative'} 
        
        disableDefaultUI={true} 
        mapId={process.env.NEXT_PUBLIC_GMAP_ID} 
        onClick={(e) => {
          if (onLocationSelect && e.detail.latLng) {
            onLocationSelect({ 
              lat: e.detail.latLng.lat, 
              lng: e.detail.latLng.lng 
            });
          }
        }}
      >
        {/* GLOBAL MODE: Render all properties */}
        {!onLocationSelect && properties.length > 0 && properties.map((p) => (
          <AdvancedMarker
            key={p.id}
            position={{ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }}
            onClick={() => onMarkerClick?.(p)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateY(-100%)', cursor: 'pointer' }}>
              <div style={{
                display: 'flex', alignItems: 'center', backgroundColor: 'white',
                padding: '4px 12px 4px 8px', borderRadius: '50px',
                border: `2px solid ${getStatusColor(p.status)}`,
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)', gap: '8px', whiteSpace: 'nowrap'
              }}>
                <Image src={logoPath} alt="L" width={18} height={18} />
                <span style={{ color: '#1e293b', fontSize: '13px', fontWeight: '700' }}>{p.property_name}</span>
              </div>
              <div style={{
                width: 0, height: 0, borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent', borderTop: `7px solid ${getStatusColor(p.status)}`,
                marginTop: '-1px'
              }} />
            </div>
          </AdvancedMarker>
        ))}

        {/* ADD/EDIT MODE: Render a single draggable pin */}
        {onLocationSelect && (
          <AdvancedMarker
            position={{ lat, lng }}
            draggable={true}
            onDragEnd={(e) => {
              onLocationSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateY(-50%)', cursor: 'grab' }}>
              <div style={{
                width: '38px', height: '38px', backgroundColor: '#1e4ec4', 
                border: '2px solid white', borderRadius: '50% 50% 50% 0', 
                transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 12px rgba(30, 78, 196, 0.3)',
              }}>
                <div style={{ transform: 'rotate(45deg)', display: 'flex' }}>
                  <Image src={logoPath} alt="A" width={22} height={22} style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
              </div>
            </div>
          </AdvancedMarker>
        )}
      </Map>

      <button 
        onClick={handleRecenter}
        style={{
          position: 'absolute', bottom: '20px', right: '20px',
          width: '40px', height: '40px', backgroundColor: 'white',
          border: 'none', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10
        }}
      >
        <i className="fa fa-crosshairs" style={{ fontSize: '18px', color: '#1e4ec4' }}></i>
      </button>
    </div>
  );
}

export default function GoogleMapsViewer({ 
  properties = [], 
  mapStyle = 'roadmap', 
  onMarkerClick,
  initialLat = 19.2813, 
  initialLng = 72.8693, 
  onLocationSelect 
}) {
  const containerHeight = onLocationSelect ? '400px' : '100%';

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GMAP_KEY}>
      <div style={{ 
        height: containerHeight, width: '100%', 
        borderRadius: '8px', overflow: 'hidden', 
        backgroundColor: '#e5e7eb', position: 'relative' 
      }}>
        <InnerMap 
          properties={properties}
          mapStyle={mapStyle}
          onMarkerClick={onMarkerClick}
          lat={Number(initialLat)}
          lng={Number(initialLng)}
          onLocationSelect={onLocationSelect}
        />
      </div>
    </APIProvider>
  );
}