// Pin-on-map location picker built on react-leaflet 5 + Leaflet 1.9 + OSM tiles.
// Responsibilities:
//   - Render an interactive map with a single draggable marker.
//   - Try browser geolocation (5s timeout); fall back to Mumbai centre.
//   - Compute the H3 cell at resolution 9 and report (lat, lng, h3Cell)
//     up to the parent via onLocationChange.
// Governs: memory-bank/systemPatterns.md (H3 res 9; map provider behind
// a thin wrapper so we can swap to Google Maps later without touching
// the form).

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { LeafletEvent, Marker as LMarker } from 'leaflet';
import L from 'leaflet';
import { latLngToCell } from 'h3-js';

// Fix Leaflet's default marker icons under a bundler. Vite resolves the
// PNG asset URLs at build time; without this, markers render broken.
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

interface DefaultIconProto {
  _getIconUrl?: unknown;
}
delete (L.Icon.Default.prototype as DefaultIconProto)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const H3_RESOLUTION = 9;
const MUMBAI: LatLng = { lat: 19.076, lng: 72.8777 };
const GEO_TIMEOUT_MS = 5000;

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  onLocationChange: (
    loc: LatLng & { h3Cell: string },
  ) => void;
}

export function TaskLocationPicker({ onLocationChange }: Props) {
  const [position, setPosition] = useState<LatLng>(MUMBAI);
  const [didGeo, setDidGeo] = useState(false);

  useEffect(() => {
    if (didGeo || !('geolocation' in navigator)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setDidGeo(true);
    }, GEO_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        clearTimeout(timer);
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDidGeo(true);
      },
      () => {
        if (cancelled) return;
        clearTimeout(timer);
        setDidGeo(true);
      },
      { timeout: GEO_TIMEOUT_MS, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [didGeo]);

  useEffect(() => {
    const h3Cell = latLngToCell(position.lat, position.lng, H3_RESOLUTION);
    onLocationChange({ ...position, h3Cell });
  }, [position, onLocationChange]);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200">
      <MapContainer
        center={[MUMBAI.lat, MUMBAI.lng]}
        zoom={13}
        className="h-72 w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapRecenterer center={position} />
        <DraggablePin position={position} onChange={setPosition} />
      </MapContainer>
      <p className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
        Drag the pin to the exact meeting point.{' '}
        <span className="font-mono">
          {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
        </span>
      </p>
    </div>
  );
}

// Re-centres the map whenever the controlled position changes, without
// fighting the user's drag (drag updates position via the marker's own
// dragend, which then re-centres — that's intentional so the meeting
// point stays visible).
function MapRecenterer({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center.lat, center.lng, map]);
  return null;
}

function DraggablePin({
  position,
  onChange,
}: {
  position: LatLng;
  onChange: (next: LatLng) => void;
}) {
  const markerRef = useRef<LMarker | null>(null);

  function handleDragEnd(e: LeafletEvent) {
    const m = e.target as LMarker;
    const ll = m.getLatLng();
    onChange({ lat: ll.lat, lng: ll.lng });
  }

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      draggable
      eventHandlers={{ dragend: handleDragEnd }}
    />
  );
}
