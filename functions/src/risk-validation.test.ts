// Unit tests for task risk level derivation, catalog category validation, and task schema shape boundaries.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import catalogData from '../../scripts/seed/catalog.json';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTaskInput(data: Record<string, any>): ValidationResult {
  const errors: string[] = [];

  if (
    typeof data.title !== 'string' ||
    data.title.trim().length === 0 ||
    data.title.length > 80
  ) {
    errors.push('Title must be between 1 and 80 characters.');
  }

  const validCategories = catalogData.categories.map((c) => c.key);
  if (
    typeof data.category !== 'string' ||
    !validCategories.includes(data.category)
  ) {
    errors.push('Category must be a valid catalog category.');
  }

  const validSkills = catalogData.skills.map((s) => s.key);
  if (
    !Array.isArray(data.requiredSkills) ||
    data.requiredSkills.length === 0 ||
    data.requiredSkills.length > 5
  ) {
    errors.push('Required skills must be an array of 1 to 5 skills.');
  } else {
    for (const skill of data.requiredSkills) {
      if (!validSkills.includes(skill)) {
        errors.push(`Skill '${skill}' is not in the approved catalog.`);
      }
    }
  }

  if (data.riskLevel !== 'low' && data.riskLevel !== 'medium') {
    errors.push(
      "Risk level must be either 'low' or 'medium'. Prohibited/High risk levels are not permitted.",
    );
  }

  if (
    typeof data.estimatedMinutes !== 'number' ||
    data.estimatedMinutes < 5 ||
    data.estimatedMinutes > 480
  ) {
    errors.push('Estimated minutes must be between 5 and 480 (8 hours).');
  }

  if (
    typeof data.searchRadiusM !== 'number' ||
    data.searchRadiusM < 500 ||
    data.searchRadiusM > 10000
  ) {
    errors.push('Search radius must be between 500m and 10000m (10 km).');
  }

  if (
    !data.location ||
    typeof data.location.lat !== 'number' ||
    data.location.lat < -90 ||
    data.location.lat > 90 ||
    typeof data.location.lng !== 'number' ||
    data.location.lng < -180 ||
    data.location.lng > 180 ||
    typeof data.location.h3Cell !== 'string' ||
    data.location.h3Cell.length === 0
  ) {
    errors.push('Valid location coordinates and H3 cell are required.');
  }

  if (
    !data.description ||
    typeof data.description.meetingPoint !== 'string' ||
    data.description.meetingPoint.length === 0 ||
    data.description.meetingPoint.length > 280
  ) {
    errors.push(
      'Meeting point description must be between 1 and 280 characters.',
    );
  }

  return { valid: errors.length === 0, errors };
}

test('Risk & Task Validation: accepts valid low-risk task data', () => {
  const validLowRiskTask = {
    title: 'Water garden plants',
    category: 'errands',
    requiredSkills: ['buy-groceries', 'local-errand'],
    riskLevel: 'low',
    estimatedMinutes: 30,
    searchRadiusM: 2000,
    location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    description: {
      meetingPoint: 'Outside community garden main gate',
      whatToBring: 'None',
    },
  };

  const res = validateTaskInput(validLowRiskTask);
  assert.equal(
    res.valid,
    true,
    `Valid low-risk task should pass validation. Errors: ${res.errors.join(', ')}`,
  );
  assert.equal(res.errors.length, 0);
});

test('Risk & Task Validation: accepts valid medium-risk task (e.g. mobility assistance)', () => {
  const validMediumRiskTask = {
    title: 'Mobility assistance for evening walk',
    category: 'mobility-assist',
    requiredSkills: ['carry-bags'],
    riskLevel: 'medium',
    estimatedMinutes: 45,
    searchRadiusM: 1000,
    location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    description: {
      meetingPoint: 'Park entrance bench',
      whatToBring: 'Walking stick',
    },
  };

  const res = validateTaskInput(validMediumRiskTask);
  assert.equal(res.valid, true);
});

test('Risk & Task Validation: rejects high-risk, prohibited, or invalid risk strings', () => {
  const highRiskTask = {
    title: 'High risk task',
    category: 'errands',
    requiredSkills: ['buy-groceries'],
    riskLevel: 'high', // REJECTED
    estimatedMinutes: 30,
    searchRadiusM: 2000,
    location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    description: { meetingPoint: 'Somewhere', whatToBring: 'None' },
  };

  const prohibitedTask = { ...highRiskTask, riskLevel: 'prohibited' };
  const invalidRiskTask = { ...highRiskTask, riskLevel: 'UNKNOWN_RISK' };

  assert.equal(validateTaskInput(highRiskTask).valid, false);
  assert.equal(validateTaskInput(prohibitedTask).valid, false);
  assert.equal(validateTaskInput(invalidRiskTask).valid, false);
});

test('Risk & Task Validation: rejects unapproved categories or skills outside catalog', () => {
  const invalidCatTask = {
    title: 'Illegal errand',
    category: 'unapproved-gambling-category',
    requiredSkills: ['buy-groceries'],
    riskLevel: 'low',
    estimatedMinutes: 30,
    searchRadiusM: 2000,
    location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    description: { meetingPoint: 'Gate 1' },
  };

  const invalidSkillTask = {
    title: 'Valid errand',
    category: 'errands',
    requiredSkills: ['hacking-skill-unapproved'],
    riskLevel: 'low',
    estimatedMinutes: 30,
    searchRadiusM: 2000,
    location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    description: { meetingPoint: 'Gate 1' },
  };

  assert.equal(validateTaskInput(invalidCatTask).valid, false);
  assert.equal(validateTaskInput(invalidSkillTask).valid, false);
});

test('Risk & Task Validation: boundary value checks on title length, estimated minutes, and search radius', () => {
  const baseTask = {
    title: 'A'.repeat(80), // Max 80 chars
    category: 'errands',
    requiredSkills: ['buy-groceries'],
    riskLevel: 'low',
    estimatedMinutes: 5, // Min 5 mins
    searchRadiusM: 500, // Min 500 m
    location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    description: { meetingPoint: 'Gate 1' },
  };

  assert.equal(validateTaskInput(baseTask).valid, true);

  // Exceeding boundaries
  assert.equal(
    validateTaskInput({ ...baseTask, title: 'A'.repeat(81) }).valid,
    false,
    'Title > 80 chars rejected',
  );
  assert.equal(
    validateTaskInput({ ...baseTask, estimatedMinutes: 4 }).valid,
    false,
    'Minutes < 5 rejected',
  );
  assert.equal(
    validateTaskInput({ ...baseTask, estimatedMinutes: 481 }).valid,
    false,
    'Minutes > 480 rejected',
  );
  assert.equal(
    validateTaskInput({ ...baseTask, searchRadiusM: 499 }).valid,
    false,
    'Radius < 500m rejected',
  );
  assert.equal(
    validateTaskInput({ ...baseTask, searchRadiusM: 10001 }).valid,
    false,
    'Radius > 10000m rejected',
  );
});
