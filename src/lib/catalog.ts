// Typed access to the starter catalog. Imports the JSON shipped with the
// repo (scripts/seed/catalog.json). Replaces with Firestore-loaded
// catalog when the M8 admin UI lands.

import catalogData from '../../scripts/seed/catalog.json';

export type RiskLevel = 'low' | 'medium';

export interface Category {
  key: string;
  label: string;
  description: string;
  defaultRisk: RiskLevel;
}

export interface Skill {
  key: string;
  label: string;
}

interface CatalogShape {
  _comment?: string;
  _seedVersion?: number;
  categories: Category[];
  skills: Skill[];
}

const catalog = catalogData as CatalogShape;

export const CATEGORIES: readonly Category[] = catalog.categories;
export const SKILLS: readonly Skill[] = catalog.skills;

export function getCategory(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function getSkillLabel(key: string): string {
  return SKILLS.find((s) => s.key === key)?.label ?? key;
}

// Risk derivation: defer to the catalog's per-category default until the
// admin UI in M8 introduces per-task overrides. Returning 'low' as a
// safe fallback for unknown categories — server rules also reject
// anything outside the {'low','medium'} set.
export function deriveRisk(categoryKey: string): RiskLevel {
  return getCategory(categoryKey)?.defaultRisk ?? 'low';
}
