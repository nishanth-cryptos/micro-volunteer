// Module 1 — Route clusterer: groups trips into CanonicalRoute objects
import {
  TRAIL_CONSTANTS,
  type CanonicalRoute,
  type StayPoint,
  type Trip,
} from './types';

export function calculateH3OverlapRatio(pathA: string[], pathB: string[]): number {
  if (pathA.length === 0 || pathB.length === 0) return 0;
  const setA = new Set(pathA);
  const setB = new Set(pathB);
  let intersectionCount = 0;
  for (const cell of setA) {
    if (setB.has(cell)) intersectionCount++;
  }
  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount > 0 ? intersectionCount / unionCount : 0;
}

export function clusterTripsToCanonicalRoutes(
  volunteerId: string,
  trips: Trip[],
  stayPointsMap: Map<string, StayPoint>,
): CanonicalRoute[] {
  if (trips.length < TRAIL_CONSTANTS.CANONICAL_MIN_OCCURRENCES) return [];

  // Group trips by (startStayId -> endStayId) pair
  const pairGroups = new Map<string, Trip[]>();
  for (const trip of trips) {
    const key = `${trip.startStayId}->${trip.endStayId}`;
    const group = pairGroups.get(key) ?? [];
    group.push(trip);
    pairGroups.set(key, group);
  }

  const canonicalRoutes: CanonicalRoute[] = [];

  for (const [key, groupTrips] of pairGroups.entries()) {
    if (groupTrips.length < TRAIL_CONSTANTS.CANONICAL_MIN_OCCURRENCES) continue;

    // Sub-cluster by H3 overlap (threshold 0.65)
    const clusters: Trip[][] = [];

    for (const trip of groupTrips) {
      let matchedCluster = false;
      for (const cluster of clusters) {
        const representativePath = cluster[0]?.h3Path ?? [];
        const overlap = calculateH3OverlapRatio(trip.h3Path, representativePath);
        if (overlap >= 0.65) {
          cluster.push(trip);
          matchedCluster = true;
          break;
        }
      }
      if (!matchedCluster) {
        clusters.push([trip]);
      }
    }

    // Process valid clusters with >= CANONICAL_MIN_OCCURRENCES
    for (const cluster of clusters) {
      if (cluster.length < TRAIL_CONSTANTS.CANONICAL_MIN_OCCURRENCES) continue;

      // Extract destination label from end stay point or default
      const endStayId = cluster[0]?.endStayId ?? '';
      const endSp = stayPointsMap.get(endStayId);
      const destinationLabel =
        endSp?.label ??
        `Destination (${endSp ? `${endSp.centroid.lat.toFixed(3)}, ${endSp.centroid.lng.toFixed(3)}` : 'Location'})`;

      // Merge H3 paths (union of cells in order of frequency)
      const cellCounts = new Map<string, number>();
      for (const t of cluster) {
        for (const cell of t.h3Path) {
          cellCounts.set(cell, (cellCounts.get(cell) ?? 0) + 1);
        }
      }

      // Sort cells by appearance frequency
      const canonicalH3Path = Array.from(cellCounts.keys()).sort(
        (a, b) => (cellCounts.get(b) ?? 0) - (cellCounts.get(a) ?? 0),
      );

      // Departure time distribution (minutes from midnight)
      const departuresInMinutes = cluster.map((t) => {
        const d = new Date(t.startTime);
        return d.getHours() * 60 + d.getMinutes();
      });

      const departureMean =
        departuresInMinutes.reduce((acc, v) => acc + v, 0) /
        departuresInMinutes.length;

      const departureVariance =
        departuresInMinutes.reduce(
          (acc, v) => acc + (v - departureMean) ** 2,
          0,
        ) / departuresInMinutes.length;

      const departureStd = Math.sqrt(departureVariance);

      // Duration distribution (minutes)
      const durations = cluster.map((t) => t.durationMinutes);
      const durationMean =
        durations.reduce((acc, v) => acc + v, 0) / durations.length;
      const durationVariance =
        durations.reduce((acc, v) => acc + (v - durationMean) ** 2, 0) /
        durations.length;
      const durationStd = Math.sqrt(durationVariance);

      // Day of week mask
      const dayMaskSet = new Set(cluster.map((t) => t.dayOfWeek));
      const dayOfWeekMask = Array.from(dayMaskSet).sort();

      // Confidence score based on occurrences (max out at 1.0 for 10+ occurrences)
      const confidence = Math.min(1.0, 0.4 + cluster.length * 0.08);

      canonicalRoutes.push({
        id: `cr_${volunteerId}_${key}`,
        volunteerId,
        destinationLabel,
        h3Path: canonicalH3Path,
        departureMeanMinutes: Math.round(departureMean),
        departureStdDevMinutes: Math.round(departureStd),
        durationMeanMinutes: Math.round(durationMean),
        durationStdDevMinutes: Math.round(durationStd),
        dayOfWeekMask,
        confidence,
        declinedCount: 0,
      });
    }
  }

  return canonicalRoutes;
}
