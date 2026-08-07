// Module 4 — Corridor task matcher: expands route H3 cells by k-rings and matches candidate tasks
import { gridDisk } from 'h3-js';
import {
  TRAIL_CONSTANTS,
  type CanonicalRoute,
  type TaskSuggestion,
} from './types';
import { haversineM } from './stay-point-detector';

export interface TaskCandidate {
  id: string;
  title: string;
  category: string;
  requiredSkills: string[];
  riskLevel: 'low' | 'medium';
  location: { lat: number; lng: number; h3Cell: string };
  estimatedDurationMinutes?: number;
}

export function buildRouteCorridorCells(
  h3Path: string[],
  kRings: number = TRAIL_CONSTANTS.CORRIDOR_BUFFER_RINGS,
): Set<string> {
  const corridor = new Set<string>();
  for (const cell of h3Path) {
    if (!cell) continue;
    try {
      const disk = gridDisk(cell, kRings);
      for (const diskCell of disk) {
        corridor.add(diskCell);
      }
    } catch {
      corridor.add(cell);
    }
  }
  return corridor;
}

export function computeAddedDetourSeconds(
  taskLoc: { lat: number; lng: number },
  routeCenter?: { lat: number; lng: number },
): number {
  // Approximate detour: distance from closest point on route to task location (there and back)
  // Assuming average urban transit speed of 30 km/h (500 m/min)
  let minDistM = Infinity;

  if (routeCenter) {
    minDistM = haversineM(routeCenter.lat, routeCenter.lng, taskLoc.lat, taskLoc.lng);
  } else {
    // Default fallback estimate for detour
    minDistM = 600; // 600 meters ~ 2.4 min detour
  }

  // There and back detour time in seconds
  const roundTripMeters = minDistM * 2;
  const metersPerSecond = 8.33; // ~30 km/h
  return Math.round(roundTripMeters / metersPerSecond);
}

export function matchTasksInCorridor(
  route: CanonicalRoute,
  openTasks: TaskCandidate[],
  slackMinutes: number,
  volunteerSkills: string[] = [],
): TaskSuggestion[] {
  if (slackMinutes < TRAIL_CONSTANTS.MIN_SLACK_MINUTES) {
    return [];
  }

  const corridorCells = buildRouteCorridorCells(route.h3Path, 1);
  const slackSeconds = slackMinutes * 60;
  const suggestions: TaskSuggestion[] = [];

  for (const task of openTasks) {
    // 1. Check if task H3 cell is within the corridor
    if (!corridorCells.has(task.location.h3Cell)) {
      continue;
    }

    // 2. Skill match check
    if (
      task.requiredSkills.length > 0 &&
      !task.requiredSkills.some((skill) => volunteerSkills.includes(skill))
    ) {
      continue;
    }

    // 3. Compute added detour time
    const addedDetourSeconds = computeAddedDetourSeconds(
      task.location,
    );
    const taskDurationSeconds = (task.estimatedDurationMinutes ?? 15) * 60;
    const totalImpactSeconds = taskDurationSeconds + addedDetourSeconds;

    // 4. Slack constraint check
    if (totalImpactSeconds > slackSeconds) {
      continue;
    }

    // 5. Rank score calculation:
    // (a) added detour time (lower is better)
    // (b) skill overlap
    // (c) risk level match
    const detourScore = Math.max(0, 1 - addedDetourSeconds / 900); // 15 min max detour
    const skillScore =
      task.requiredSkills.length > 0
        ? task.requiredSkills.filter((s) => volunteerSkills.includes(s)).length /
          task.requiredSkills.length
        : 1;

    const rankScore = 0.5 * detourScore + 0.5 * skillScore;

    suggestions.push({
      id: `sug_${route.id}_${task.id}`,
      taskId: task.id,
      routeId: route.id,
      title: task.title,
      category: task.category,
      addedDetourSeconds,
      taskDurationSeconds,
      slackSeconds,
      rankScore,
      shownAt: Date.now(),
    });
  }

  // Sort by rank score descending (top 3 to 5)
  return suggestions.sort((a, b) => b.rankScore - a.rankScore).slice(0, 5);
}
