// Central copy bank and wait-tier configuration constants.
// Governed by sections 3.2, 5, and 7 of implementation spec.

export const WAIT_TIER_CONFIG = {
  fast: { nudgeStages: [3, 8, 15], radiusStepMultiplier: 1.5 },
  normal: { nudgeStages: [5, 15, 30], radiusStepMultiplier: 1.0 },
  flexible: { nudgeStages: [10, 30, 60], radiusStepMultiplier: 0.75 },
} as const;

export type WaitTier = keyof typeof WAIT_TIER_CONFIG;

export const NUDGE_COPY_BANK: Record<1 | 2 | 3, string> = {
  1: "Looking for a padosi nearby... hang tight, this usually doesn't take long.",
  2: "Still on it — we've widened the search a bit to reach more neighbors.",
  3: "Things are a little quiet right now. We're still trying!",
} as const;

export const NEARING_EXPIRY_COPY =
  "We haven't found a match yet. Want us to keep trying, or would you rather check back later?";
