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
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
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
  const [isChoosing, setIsChoosing] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  residential?: string;
  city_district?: string;
  town?: string;
  city?: string;
}

interface NominatimResponse {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

  useEffect(() => {
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.lat}&lon=${position.lng}`,
    )
      .then((res) => res.json() as Promise<NominatimResponse>)
      .then((data) => {
        if (cancelled) return;
        const addr = data.address;
        const name =
          addr?.suburb ||
          addr?.neighbourhood ||
          addr?.residential ||
          addr?.city_district ||
          addr?.town ||
          addr?.city ||
          data.name ||
          (data.display_name ? data.display_name.split(',')[0] : null);
        if (name) {
          setPlaceName(name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [position.lat, position.lng]);

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
        className="h-72 w-full cursor-pointer"
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapRecenterer center={position} />
        <MapZoomControls center={position} />
        <MapClickHandler
          enabled={isChoosing}
          onPick={(lat, lng) => {
            setPosition({ lat, lng });
            setIsChoosing(false);
          }}
        />
        <DraggablePin
          position={position}
          onChange={(next) => {
            setPosition(next);
            setIsChoosing(false);
          }}
          placeName={placeName}
          draggable={isChoosing}
        />
        <Circle
          center={[position.lat, position.lng]}
          radius={2500}
          pathOptions={{
            fillColor: '#1f6f5c',
            fillOpacity: 0.12,
            color: '#1f6f5c',
            weight: 1.5,
            dashArray: '6, 6',
          }}
        />
      </MapContainer>
      {isChoosing && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-[#1f6f5c] px-4 py-1.5 text-xs font-semibold text-white shadow-md">
          Click anywhere on the map or drag the pin to set location
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ececea] bg-white px-4 py-2.5 text-xs text-[#4f4b46]">
        <p className="m-0">
          Drag the pin to the exact meeting point.{' '}
          <span className="font-semibold text-[#131312]">
            {placeName ? `${placeName} ` : ''}({position.lat.toFixed(4)}, {position.lng.toFixed(4)})
          </span>{' '}
          · <span className="font-semibold text-[#1f6f5c]">2.5 km coverage preview</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsChoosing((prev) => !prev)}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition focus:outline-none ' +
              (isChoosing
                ? 'bg-[#1f6f5c] text-white shadow-sm hover:bg-[#185845]'
                : 'border border-[#ececea] bg-white text-[#4f4b46] hover:bg-[#f3f1ec] hover:border-[#d8d4cc]')
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {isChoosing ? 'Lock location' : 'Choose on map'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!('geolocation' in navigator)) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                () => {},
                { timeout: 8000 },
              );
            }}
            className="rounded-full border border-[#ececea] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1f6f5c] hover:bg-[#f3f1ec] focus:outline-none"
          >
            Detect my location
          </button>
        </div>
      </div>
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

function MapZoomControls({ center }: { center: LatLng }) {
  const map = useMap();

  const handleZoomIn = () => {
    const nextZoom = Math.min(map.getZoom() + 1, 18);
    map.setView([center.lat, center.lng], nextZoom, { animate: true });
  };

  const handleZoomOut = () => {
    const nextZoom = Math.max(map.getZoom() - 1, 3);
    map.setView([center.lat, center.lng], nextZoom, { animate: true });
  };

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col overflow-hidden rounded-xl border border-[#ececea] bg-white/95 shadow-md backdrop-blur-sm">
      <button
        type="button"
        onClick={handleZoomIn}
        title="Zoom in (Magnify)"
        aria-label="Zoom in"
        className="flex h-9 w-9 items-center justify-center text-[#131312] transition hover:bg-[#f3f1ec] active:bg-[#e3efe9]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      </button>
      <div className="h-px bg-[#ececea]" />
      <button
        type="button"
        onClick={handleZoomOut}
        title="Zoom out (Minify)"
        aria-label="Zoom out"
        className="flex h-9 w-9 items-center justify-center text-[#131312] transition hover:bg-[#f3f1ec] active:bg-[#e3efe9]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
          <path d="M8 11h6" />
        </svg>
      </button>
    </div>
  );
}

function MapClickHandler({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function DraggablePin({
  position,
  onChange,
  placeName,
  draggable,
}: {
  position: LatLng;
  onChange: (next: LatLng) => void;
  placeName: string | null;
  draggable: boolean;
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
      draggable={draggable}
      eventHandlers={{ dragend: handleDragEnd }}
    >
      <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
        <span className="font-sans text-xs font-semibold text-[#131312]">
          📍 {placeName ? placeName : `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`}
        </span>
      </Tooltip>
    </Marker>
  );
}
