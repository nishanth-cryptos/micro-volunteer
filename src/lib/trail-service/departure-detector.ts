// Module 2 — Departure detector & pre-warm window matching
import { type CanonicalRoute, type DepartureEvent } from './types';

export function isTimeInPreWarmWindow(
  route: CanonicalRoute,
  nowDate: Date = new Date(),
): boolean {
  const currentDayOfWeek = nowDate.getDay();
  if (!route.dayOfWeekMask.includes(currentDayOfWeek)) {
    return false;
  }

  const currentMinutesFromMidnight =
    nowDate.getHours() * 60 + nowDate.getMinutes();

  const stdDev = Math.max(route.departureStdDevMinutes, 30);
  const windowStart = route.departureMeanMinutes - stdDev;
  const windowEnd = route.departureMeanMinutes + stdDev;

  return (
    currentMinutesFromMidnight >= windowStart &&
    currentMinutesFromMidnight <= windowEnd
  );
}

export function shouldTriggerDeparturePrompt(
  route: CanonicalRoute,
  nowDate: Date = new Date(),
): boolean {
  // Check if feature backed off due to repeated declines
  if (route.declinedCount >= 3 && route.confidence < 0.3) {
    return false;
  }

  // Rate limit: max 1 prompt per route per day
  const todayStr = nowDate.toISOString().split('T')[0];
  if (route.lastPromptedDate === todayStr) {
    return false;
  }

  // Check pre-warm departure window
  return isTimeInPreWarmWindow(route, nowDate);
}

export function createDepartureEvent(
  routeId: string,
  confirmed: boolean,
): DepartureEvent {
  const event: DepartureEvent = {
    id: `dep_${routeId}_${Date.now()}`,
    routeId,
    triggeredAt: Date.now(),
    confirmed,
  };
  if (confirmed) {
    event.actualDepartureTime = Date.now();
  }
  return event;
}

export function calculateRouteSlack(
  route: CanonicalRoute,
  mustArriveByMinutesFromMidnight?: number,
  nowDate: Date = new Date(),
): { slackMinutes: number; predictedDurationMinutes: number } {
  const predictedDuration = route.durationMeanMinutes || 25;
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  // If mustArriveBy is not set, infer from departureMean + durationMean + 15 min buffer
  const targetArrival =
    mustArriveByMinutesFromMidnight ??
    route.departureMeanMinutes + predictedDuration + 15;

  const slackMinutes = targetArrival - nowMinutes - predictedDuration;

  return {
    slackMinutes: Math.max(0, slackMinutes),
    predictedDurationMinutes: predictedDuration,
  };
}
