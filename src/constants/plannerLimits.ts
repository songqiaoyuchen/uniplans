export const MAX_TARGET_MODULES = 20;
export const MAX_EXEMPTED_MODULES = 50;

export const MIN_MCS_PER_SEMESTER = 16;
export const MAX_MCS_PER_SEMESTER = 40;
export const MCS_PER_SEMESTER_STEP = 2;
export const DEFAULT_MCS_PER_SEMESTER = 20;

// Defensive request-shape limits. These are deliberately much higher than a
// normal semester and are not product rules shown to users.
export const MAX_SCHEDULER_SEMESTER_ID = 20;
export const MAX_PRESERVED_SEMESTERS = MAX_SCHEDULER_SEMESTER_ID + 1;
export const MAX_MODULES_PER_PRESERVED_SEMESTER = 50;
export const MAX_PRESERVED_SEMESTER_ID = MAX_SCHEDULER_SEMESTER_ID;

export function isAllowedMaxMcs(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_MCS_PER_SEMESTER &&
    value <= MAX_MCS_PER_SEMESTER &&
    (value - MIN_MCS_PER_SEMESTER) % MCS_PER_SEMESTER_STEP === 0
  );
}
