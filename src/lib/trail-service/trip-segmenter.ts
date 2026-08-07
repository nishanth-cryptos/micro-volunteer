// Module 1 — Trip segmenter: extracts trips between consecutive stay points
import { latLngToCell } from 'h3-js';
import {
  TRAIL_CONSTANTS,
  type LocationPing,
  type StayPoint,
  type Trip,
} from './types';

export function segmentTrips(
  volunteerId: string,
  stayPoints: StayPoint[],
  pings: LocationPing[],
): Trip[] {
  if (stayPoints.length < 2) return [];

  const trips: Trip[] = [];

  for (let idx = 0; idx < stayPoints.length - 1; idx++) {
    const startSp = stayPoints[idx];
    const endSp = stayPoints[idx + 1];
    if (!startSp || !endSp) continue;

    // Find pings between startSp.lastSeen and endSp.firstSeen
    const tripPings = pings.filter(
      (p) => p.timestamp >= startSp.lastSeen && p.timestamp <= endSp.firstSeen,
    );

    if (tripPings.length < 2) continue;

    // Convert pings into a deduplicated sequence of H3 cells
    const h3PathSet: string[] = [];
    for (const p of tripPings) {
      const cell = latLngToCell(p.lat, p.lng, TRAIL_CONSTANTS.H3_RESOLUTION);
      if (h3PathSet.length === 0 || h3PathSet[h3PathSet.length - 1] !== cell) {
        h3PathSet.push(cell);
      }
    }

    const durationMinutes = Math.max(
      1,
      Math.round((endSp.firstSeen - startSp.lastSeen) / 60000),
    );
    const startDate = new Date(startSp.lastSeen);
    const dayOfWeek = startDate.getDay();

    trips.push({
      id: `trip_${volunteerId}_${startSp.id}_${endSp.id}`,
      volunteerId,
      startStayId: startSp.id,
      endStayId: endSp.id,
      h3Path: h3PathSet,
      durationMinutes,
      dayOfWeek,
      startTime: startSp.lastSeen,
    });
  }

  return trips;
}
