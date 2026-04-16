'use client';

import GoogleMapsViewer from './GoogleMapsViewer';
import MapLibreViewer from './MapLibreViewer';

export default function MapViewer(props) {
  const engine = process.env.NEXT_PUBLIC_MAP_ENGINE;

  if (engine === 'maplibre') {
    return <MapLibreViewer {...props} />;
  }

  return <GoogleMapsViewer {...props} />;
}