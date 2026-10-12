'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useApiIsLoaded
} from '@vis.gl/react-google-maps';
import { logoPath } from '@/assets/images';
import { getClubBoundary, getGroupColor, getStatusColor } from '@/utils/geoUtils';

const MIRA_ROAD_COORDS = { lat: 19.2813, lng: 72.8693 };


function InnerMap({ properties = [], propertyGroups = [], mapStyle, onMarkerClick, lat, lng, onLocationSelect, selectedProperty, expandedGroup, onGroupSelect }) {
  const map = useMap();
  const apiIsLoaded = useApiIsLoaded();
  const [activeOverlay, setActiveOverlay] = useState(null);
  const [spiderfiedCoords, setSpiderfiedCoords] = useState(null);
  const [territoryLabels, setTerritoryLabels] = useState([]);

  const activeGroupId = expandedGroup || (selectedProperty?.club_id ? selectedProperty.club_id : null);

  const groupedProperties = useMemo(() => {
    const groups = {};
    properties.forEach(p => {
      if (activeGroupId && String(p.club_id) !== String(activeGroupId)) return;
      if (!p.lat || !p.lng) return;
      const key = `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [properties, activeGroupId]);

  const bounds = useMemo(() => {
    if (!apiIsLoaded || typeof window === 'undefined' || !window.google || properties.length === 0) return null;

    const b = new google.maps.LatLngBounds();
    properties.forEach(p => {
      if (p.lat && p.lng) {
        b.extend({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) });
      }
    });
    return b;
  }, [apiIsLoaded, properties]);

  // Initial bounds loading and limits
  useEffect(() => {
    if (map && bounds && !bounds.isEmpty() && !onLocationSelect && !selectedProperty) {
      if (!map.initializedState) {
        map.initializedState = true;
        
        const savedState = localStorage.getItem('asmita_map_state');
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            if (parsed.lat && parsed.lng && parsed.zoom) {
              map.setCenter({ lat: parsed.lat, lng: parsed.lng });
              map.setZoom(parsed.zoom);
              map.fullyInitialized = true; // Mark as ready for saving state
              return;
            }
          } catch (e) {}
        }

        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
        map.fitBounds(bounds, { 
          top: 70, 
          right: 70, 
          bottom: 70, 
          left: isMobile ? 70 : 380 
        });
        map.fullyInitialized = true; // Mark as ready for saving state

        const listener = map.addListener('idle', () => {
          const currentZoom = map.getZoom();
          if (currentZoom > 17) map.setZoom(17);
          google.maps.event.removeListener(listener);
        });
      }
    }
  }, [map, bounds, onLocationSelect, selectedProperty]);

  // Save map state whenever user pans or zooms
  useEffect(() => {
    if (!map || onLocationSelect) return;
    
    const listener = map.addListener('idle', () => {
      // Don't save state until the initial state has been restored or fitBounds applied
      if (!map.fullyInitialized) return;
      
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (center && zoom && !selectedProperty) { // Only save state if not currently focused on a specific property
        localStorage.setItem('asmita_map_state', JSON.stringify({
          lat: center.lat(),
          lng: center.lng(),
          zoom: zoom
        }));
      }
    });
    
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, selectedProperty, onLocationSelect]);

  // Handle zooming & offset when a specific property is clicked from legend or map
  useEffect(() => {
    if (!map) return;
    
    if (selectedProperty && selectedProperty.lat && selectedProperty.lng) {
      // Determine if we are on a mobile device where the sidebar stacks at the bottom
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      
      // Calculate a geographic offset to prevent the marker from hiding under the sidebar
      // On desktop: Offset Longitude positive (East) so the marker shifts Left
      // On mobile: Offset Latitude negative (South) so the marker shifts Up
      // ONLY apply offset on main dashboard with sidebar, NOT in location selector cards
      const lngOffset = (!onLocationSelect && !isMobile) ? 0.0005 : 0; // Approx 180px left shift at zoom 19
      const latOffset = (!onLocationSelect && isMobile) ? -0.0004 : 0; // Approx 150px up shift at zoom 19
      
      map.setZoom(19); // High zoom level to focus on building
      map.panTo({
        lat: parseFloat(selectedProperty.lat) + latOffset,
        lng: parseFloat(selectedProperty.lng) + lngOffset
      });

      // Auto-spiderfy if the selected property is clustered
      const key = `${parseFloat(selectedProperty.lat).toFixed(5)},${parseFloat(selectedProperty.lng).toFixed(5)}`;
      if (groupedProperties[key] && groupedProperties[key].length > 1) {
        setSpiderfiedCoords(key);
      }
    }
  }, [selectedProperty, map, onLocationSelect, groupedProperties]);

  // Pan to active group
  useEffect(() => {
    if (!map || !activeGroupId || !window.google) return;
    
    // If a specific property was clicked, let the selectedProperty zoom effect handle high zoom on that building
    if (selectedProperty && selectedProperty.lat && selectedProperty.lng) return;

    const groupProps = properties.filter(p => String(p.club_id) === String(activeGroupId) && p.lat && p.lng);
    if (groupProps.length === 0) return;

    if (groupProps.length === 1) {
      map.panTo({ lat: parseFloat(groupProps[0].lat), lng: parseFloat(groupProps[0].lng) });
      map.setZoom(18);
    } else {
      const groupBounds = new window.google.maps.LatLngBounds();
      groupProps.forEach(p => {
        groupBounds.extend({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) });
      });
      map.fitBounds(groupBounds, { padding: 50 });
    }
  }, [activeGroupId, selectedProperty, map, properties]);


  const handleRecenter = useCallback(() => {
    if (!map) return;
    if (bounds && !bounds.isEmpty() && !onLocationSelect) {
      map.fitBounds(bounds, { padding: 70 });
    } else {
      map.panTo(MIRA_ROAD_COORDS);
      map.setZoom(15);
    }
  }, [map, bounds, onLocationSelect]);

  useEffect(() => {
    if (map && onLocationSelect && lat && lng) {
      map.setCenter({ lat: Number(lat), lng: Number(lng) });
      map.panTo({ lat: Number(lat), lng: Number(lng) });
    }
  }, [lat, lng, map, onLocationSelect]);

  // Spatial highlighting using GeoUtils
  useEffect(() => {
    let polygonInstances = [];
    let isMounted = true;

    if (activeOverlay) {
      if (Array.isArray(activeOverlay)) {
        activeOverlay.forEach(overlay => overlay.setMap(null));
      } else {
        activeOverlay.setMap(null);
      }
      setActiveOverlay(null);
    }

    const drawHighlight = async () => {
      setTerritoryLabels([]);
      if (!map) return;
      
      const newLabels = [];
      const drawnClubIds = new Set();
      
      // 1. Draw ALL saved territories globally
      if (propertyGroups && propertyGroups.length > 0) {
        propertyGroups.forEach((group, groupIdx) => {
          if (activeGroupId && String(group.id) !== String(activeGroupId)) return;
          if (!group.territory) return;
          
          let boundaryPaths = null;
          try {
            boundaryPaths = typeof group.territory === 'string' ? JSON.parse(group.territory) : group.territory;
          } catch(e) { return; }
          
          if (!boundaryPaths || boundaryPaths.length === 0) return;
          
          let normalizedPaths = boundaryPaths;
          if (boundaryPaths.length > 0 && boundaryPaths[0].lat !== undefined) {
             normalizedPaths = [boundaryPaths];
          }
          
          // Find properties belonging to this group
          const groupProps = properties.filter(p => p.club_id === group.id);
          const firstProp = groupProps.length > 0 ? groupProps[0] : (properties.length > 0 ? properties[0] : null);

          const territoryColor = group.color || getGroupColor(group.id, groupIdx);
          const isSelected = activeGroupId && String(activeGroupId) === String(group.id);

          normalizedPaths.forEach(pathCoords => {
            const polygon = new window.google.maps.Polygon({
              paths: pathCoords,
              strokeColor: territoryColor,
              strokeOpacity: isSelected ? 1 : 0.7,
              strokeWeight: isSelected ? 3 : 2,
              fillColor: territoryColor,
              fillOpacity: isSelected ? 0.3 : 0.15,
              clickable: true,
              map: map
            });

            polygon.addListener('click', () => {
              onGroupSelect?.(group.id);
            });

            polygon.addListener('mouseover', () => {
              polygon.setOptions({ fillOpacity: isSelected ? 0.4 : 0.25 });
            });

            polygon.addListener('mouseout', () => {
              polygon.setOptions({ fillOpacity: isSelected ? 0.3 : 0.15 });
            });

            polygonInstances.push(polygon);
          });

          if (normalizedPaths[0] && normalizedPaths[0].length > 0) {
            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
            normalizedPaths[0].forEach(p => {
              const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
              const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
              if (lng < minLng) minLng = lng;
              if (lng > maxLng) maxLng = lng;
            });
            
            let fallbackPropName = firstProp && firstProp.property_name ? firstProp.property_name.replace(/(?:\s*(?:LANE|Phase|Wing|Part|Stage).*$)/i, '').trim() : (group.id || '').replace('club_', '');
            const groupName = group.club_name || group.name || fallbackPropName;
            newLabels.push({
              id: group.id,
              lat: (minLat + maxLat) / 2,
              lng: (minLng + maxLng) / 2,
              text: groupName,
              color: territoryColor,
              isSelected: !!isSelected
            });
          }
          drawnClubIds.add(group.id);
        });
      }

      // 2. Draw dynamic territory ONLY for the selected property if it's not already drawn
      if (selectedProperty && selectedProperty.club_id && !drawnClubIds.has(selectedProperty.club_id) && (!activeGroupId || String(selectedProperty.club_id) === String(activeGroupId))) {
        const clubProps = properties.filter(p => p.club_id === selectedProperty.club_id && p.lat && p.lng);
        if (clubProps.length > 0) {
          const boundaryPaths = await getClubBoundary(clubProps);
          
          if (boundaryPaths && boundaryPaths.length > 0 && isMounted) {
            let normalizedPaths = boundaryPaths;
            if (boundaryPaths.length > 0 && boundaryPaths[0].lat !== undefined) {
               normalizedPaths = [boundaryPaths];
            }

            const territoryColor = selectedProperty.group_color || getGroupColor(selectedProperty.club_id);

            normalizedPaths.forEach(pathCoords => {
              const polygon = new window.google.maps.Polygon({
                paths: pathCoords,
                strokeColor: territoryColor,
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: territoryColor,
                fillOpacity: 0.25,
                clickable: true,
                map: map
              });

              polygon.addListener('click', () => {
                onGroupSelect?.(selectedProperty.club_id);
              });

              polygonInstances.push(polygon);
            });

            if (normalizedPaths[0] && normalizedPaths[0].length > 0) {
              let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
              normalizedPaths[0].forEach(p => {
                const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
                const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
              });
              
              let fallbackName = selectedProperty.property_name ? selectedProperty.property_name.replace(/(?:\s*(?:LANE|Phase|Wing|Part|Stage).*$)/i, '').trim() : selectedProperty.club_id;

              newLabels.push({
                id: selectedProperty.club_id,
                lat: (minLat + maxLat) / 2,
                lng: (minLng + maxLng) / 2,
                text: fallbackName,
                color: territoryColor,
                isSelected: true
              });
            }
          }
        }
      }

      // 3. Draw Building Border for properties with building_boundary
      const propertiesToDrawBoundary = [];
      if (selectedProperty && selectedProperty.building_boundary) {
        propertiesToDrawBoundary.push(selectedProperty);
      }
      properties.forEach(p => {
        if (p.building_boundary && (!selectedProperty || String(p.id) !== String(selectedProperty.id))) {
          if (!activeGroupId || String(p.club_id) === String(activeGroupId)) {
            propertiesToDrawBoundary.push(p);
          }
        }
      });

      propertiesToDrawBoundary.forEach(p => {
        let bCoords = null;
        try {
          bCoords = typeof p.building_boundary === 'string' ? JSON.parse(p.building_boundary) : p.building_boundary;
        } catch(e) {}
        if (!bCoords || !Array.isArray(bCoords) || bCoords.length < 3) return;

        const isSelectedBuilding = selectedProperty && String(selectedProperty.id) === String(p.id);
        const propStatus = p.status || selectedProperty?.status || 'Not Approached';
        const statusCol = getStatusColor(propStatus);

        const buildingPoly = new window.google.maps.Polygon({
          paths: bCoords,
          strokeColor: statusCol,
          strokeOpacity: 1.0,
          strokeWeight: isSelectedBuilding ? 3 : 2,
          fillColor: statusCol,
          fillOpacity: isSelectedBuilding ? 0.35 : 0.2,
          zIndex: isSelectedBuilding ? 60 : 30,
          map: map
        });

        polygonInstances.push(buildingPoly);
      });
      
      if (isMounted) {
        setTerritoryLabels(newLabels);
        setActiveOverlay(polygonInstances);
      }
    };

    drawHighlight();

    return () => {
      isMounted = false;
      polygonInstances.forEach(polygon => polygon.setMap(null));
      if (activeOverlay) {
        if (Array.isArray(activeOverlay)) {
          activeOverlay.forEach(overlay => overlay.setMap(null));
        } else {
          activeOverlay.setMap(null);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, properties, propertyGroups, map, activeGroupId, onGroupSelect]);

  const getStatusColor = (status) => {
    const colors = { 
      'Not Approached': '#ef4444', 
      'Interest Letter Sent': '#f97316', 
      'Interested Letter Sent': '#f97316', // Legacy handling
      'Society Docs Received': '#eab308', 
      'Architect Survey Phase': '#84cc16', 
      'Architect Survey Completed': '#06b6d4',
      'Offer Letter Sent': '#3b82f6', 
      'Offer Under Negotiation': '#a855f7', 
      'Meeting Finalized': '#ec4899', // Legacy handling
      'Offer Accepted': '#ec4899', 
      'Approved': '#22c55e', // Legacy handling
      'Consent Phase': '#14b8a6', 
      'DA Phase': '#a0522d', 
      'Plan & CC Phase': '#22c55e' 
    };
    return colors[status] || '#9ca3af';
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultZoom={onLocationSelect ? 19 : 15}
        defaultCenter={onLocationSelect && lat && lng ? { lat: Number(lat), lng: Number(lng) } : MIRA_ROAD_COORDS}
        mapTypeId={mapStyle === 'satellite' ? 'satellite' : 'roadmap'}
        gestureHandling={'cooperative'}
        disableDefaultUI={true}
        mapId={process.env.NEXT_PUBLIC_GMAP_ID}
        clickableIcons={false}
        onClick={(e) => {
          if (onLocationSelect && e.detail.latLng) {
            onLocationSelect({
              lat: e.detail.latLng.lat,
              lng: e.detail.latLng.lng
            });
          } else {
            setSpiderfiedCoords(null);
          }
        }}
      >
        {!onLocationSelect && territoryLabels.map((label, idx) => (
          <AdvancedMarker key={`label-${label.id}-${idx}`} position={{ lat: label.lat, lng: label.lng }} zIndex={label.isSelected ? 90 : 80}>
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onGroupSelect?.(label.id);
              }}
              title={`Click to focus ${label.text}`}
              style={{
                backgroundColor: label.color,
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: '700',
                fontFamily: 'var(--font-montserrat)',
                fontSize: '14px',
                border: label.isSelected ? '2px solid #ffffff' : '2px solid transparent',
                boxShadow: label.isSelected ? '0 6px 16px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.2)',
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease-in-out',
                userSelect: 'none'
              }}>
              {label.text}
            </div>
          </AdvancedMarker>
        ))}
        {!onLocationSelect && Object.entries(groupedProperties).map(([key, groupProps]) => {
          const centerLat = parseFloat(groupProps[0].lat);
          const centerLng = parseFloat(groupProps[0].lng);

          if (groupProps.length === 1) {
            const p = groupProps[0];
            return (
              <AdvancedMarker
                key={p.id}
                position={{ lat: centerLat, lng: centerLng }}
                onClick={() => {
                  onMarkerClick?.(p);
                  setSpiderfiedCoords(null);
                }}
                zIndex={selectedProperty?.id === p.id ? 100 : 1}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
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
                  key={`${p.id}-spider`}
                  position={{ lat: centerLat, lng: centerLng }}
                  onClick={() => onMarkerClick?.(p)}
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
        })}

        {onLocationSelect && (
          <AdvancedMarker
            position={{ lat, lng }}
            draggable={true}
            onDragEnd={(e) => {
              onLocationSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'grab' }}>
              <div style={{
                width: '38px', height: '38px',
                backgroundColor: getStatusColor(selectedProperty?.status || 'Not Approached'),
                border: '2px solid white', borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 14px rgba(0, 0, 0, 0.35)',
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
        title="Recenter Map"
        style={{
          position: 'absolute', bottom: '20px', right: '20px',
          width: '40px', height: '40px', backgroundColor: 'white',
          border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e4ec4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="22" y1="12" x2="18" y2="12"></line>
          <line x1="6" y1="12" x2="2" y2="12"></line>
          <line x1="12" y1="6" x2="12" y2="2"></line>
          <line x1="12" y1="22" x2="12" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}

export default function GoogleMapsViewer({
  properties = [],
  propertyGroups = [],
  mapStyle = 'roadmap',
  onMarkerClick,
  initialLat = 19.2813,
  initialLng = 72.8693,
  onLocationSelect,
  selectedProperty,
  expandedGroup,
  onGroupSelect
}) {
  const containerHeight = onLocationSelect ? '400px' : '100%';
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    window.gm_authFailure = () => {
      setAuthError(true);
    };
  }, []);

  if (authError) {
    return (
      <div style={{
        height: containerHeight, width: '100%',
        borderRadius: '8px', overflow: 'hidden',
        backgroundColor: '#f8d7da', border: '1px solid #f5c6cb',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        color: '#721c24', padding: '20px', textAlign: 'center'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#721c24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px', opacity: 0.5 }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>Map Unavailable</h3>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          This server is not authorized to use the Google Maps API key.<br/>
          (RefererNotAllowedMapError)
        </p>
      </div>
    );
  }

  return (
    <APIProvider 
      apiKey={process.env.NEXT_PUBLIC_GMAP_KEY} 
      libraries={['places', 'marker']}
      onError={() => setAuthError(true)}
    >
      <div style={{
        height: containerHeight, width: '100%',
        borderRadius: '8px', overflow: 'hidden',
        backgroundColor: '#e5e7eb', position: 'relative'
      }}>
        <InnerMap
          properties={properties}
          propertyGroups={propertyGroups}
          mapStyle={mapStyle}
          onMarkerClick={onMarkerClick}
          lat={Number(initialLat)}
          lng={Number(initialLng)}
          onLocationSelect={onLocationSelect}
          selectedProperty={selectedProperty}
          expandedGroup={expandedGroup}
          onGroupSelect={onGroupSelect}
        />
      </div>
    </APIProvider>
  );
}