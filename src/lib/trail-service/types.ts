// TrailService data models & constants
// Governs: Hyperlocal commute trail mining, departure detection,
// corridor task matching, and privacy/security controls.

export interface StayPoint {
  id: string;
  volunteerId: string;
  centroid: { lat: number; lng: number };
  h3Cell: string;
  firstSeen: number; // epoch ms
  lastSeen: number; // epoch ms
  visitCount: number;
  label?: string; // e.g. "Home", "Office"
}

export interface Trip {
  id: string;
  volunteerId: string;
  startStayId: string;
  endStayId: string;
  h3Path: string[]; // H3 cells at resolution 9
  durationMinutes: number;
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  startTime: number; // epoch ms
}

export interface CanonicalRoute {
  id: string;
  volunteerId: string;
  destinationLabel: string;
  h3Path: string[];
  departureMeanMinutes: number; // minutes from midnight (0 - 1439)
  departureStdDevMinutes: number;
  durationMeanMinutes: number;
  durationStdDevMinutes: number;
  dayOfWeekMask: number[]; // e.g. [1, 2, 3, 4, 5]
  confidence: number; // 0.0 to 1.0
  mustArriveByMinutes?: number; // minutes from midnight
  declinedCount: number;
  lastPromptedDate?: string; // YYYY-MM-DD
}

export interface DepartureEvent {
  id: string;
  routeId: string;
  triggeredAt: number;
  confirmed: boolean;
  actualDepartureTime?: number;
}

export interface TaskSuggestion {
  id: string;
  taskId: string;
  routeId: string;
  title: string;
  category: string;
  addedDetourSeconds: number;
  taskDurationSeconds: number;
  slackSeconds: number;
  rankScore: number;
  shownAt: number;
  accepted?: boolean;
}

export interface TrailConsent {
  volunteerId: string;
  trailConsentGiven: boolean;
  consentTimestamp: number;
  retentionDays: number; // default 45
}

export interface LocationPing {
  volunteerId: string;
  lat: number;
  lng: number;
  timestamp: number; // epoch ms
  accuracyM: number;
}

export const TRAIL_CONSTANTS = {
  STAY_POINT_RADIUS_M: 200,
  STAY_POINT_TIME_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes
  H3_RESOLUTION: 9,
  CANONICAL_MIN_OCCURRENCES: 3,
  CANONICAL_WINDOW_DAYS: 30,
  GPS_MAX_SPEED_KMH: 150,
  MIN_SLACK_MINUTES: 5,
  CORRIDOR_BUFFER_RINGS: 1,
  DEFAULT_RETENTION_DAYS: 45,
} as const;
