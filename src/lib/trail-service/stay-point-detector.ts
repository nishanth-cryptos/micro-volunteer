// Module 1 — Stay-point detector & GPS spoofing filter
import { latLngToCell } from 'h3-js';
import { TRAIL_CONSTANTS, type LocationPing, type StayPoint } from './types';

export function isGpsPingValid(
  lastPing: LocationPing | null,
  newPing: LocationPing,
): boolean {
  if (!lastPing) return true;
  const timeDeltaSec = (newPing.timestamp - lastPing.timestamp) / 1000;
  if (timeDeltaSec <= 0) return false;

  const distM = haversineM(
    lastPing.lat,
    lastPing.lng,
    newPing.lat,
    newPing.lng,
  );
  const speedKmh = distM / 1000 / (timeDeltaSec / 3600);

  // Impossible speed check (> 150 km/h or > 5 km in 10s)
  if (speedKmh > TRAIL_CONSTANTS.GPS_MAX_SPEED_KMH) return false;
  if (distM > 5000 && timeDeltaSec < 10) return false;

  return true;
}

export function detectStayPoints(
  volunteerId: string,
  pings: LocationPing[],
): StayPoint[] {
  if (pings.length < 2) return [];

  // Filter out invalid/spoofed pings first
  const validPings: LocationPing[] = [];
  let prevPing: LocationPing | null = null;
  for (const ping of pings) {
    if (isGpsPingValid(prevPing, ping)) {
      validPings.push(ping);
      prevPing = ping;
    }
  }

  const stayPoints: StayPoint[] = [];
  let i = 0;

  while (i < validPings.length) {
    const currentPing = validPings[i];
    if (!currentPing) break;
    let j = i + 1;
    let sumLat = currentPing.lat;
    let sumLng = currentPing.lng;
    let count = 1;

    while (j < validPings.length) {
      const nextPing = validPings[j];
      if (!nextPing) break;
      const centerLat = sumLat / count;
      const centerLng = sumLng / count;
      const dist = haversineM(centerLat, centerLng, nextPing.lat, nextPing.lng);

      if (dist <= TRAIL_CONSTANTS.STAY_POINT_RADIUS_M) {
        sumLat += nextPing.lat;
        sumLng += nextPing.lng;
        count++;
        j++;
      } else {
        break;
      }
    }

    const firstSeen = currentPing.timestamp;
    const lastPing = validPings[j - 1];
    const lastSeen = lastPing ? lastPing.timestamp : firstSeen;
    const durationMs = lastSeen - firstSeen;

    if (durationMs >= TRAIL_CONSTANTS.STAY_POINT_TIME_THRESHOLD_MS) {
      const centroid = {
        lat: sumLat / count,
        lng: sumLng / count,
      };
      const h3Cell = latLngToCell(
        centroid.lat,
        centroid.lng,
        TRAIL_CONSTANTS.H3_RESOLUTION,
      );

      stayPoints.push({
        id: `sp_${volunteerId}_${firstSeen}`,
        volunteerId,
        centroid,
        h3Cell,
        firstSeen,
        lastSeen,
        visitCount: 1,
      });

      i = j;
    } else {
      i++;
    }
  }

  return stayPoints;
}

export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
