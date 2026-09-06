import { PROGRAMME_TYPES, StudentContext } from "../../types/prerequisiteTypes";
import { isPlainRecord } from "./isPlainRecord";

export { PROGRAMME_TYPES, EMPTY_STUDENT_CONTEXT } from "../../types/prerequisiteTypes";

export type StudentContextValidation =
  | { success: true; data: StudentContext | null }
  | { success: false; error: string };

export function isCohortYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1000 && value <= 9999;
}

export function isProgrammeType(value: unknown): value is string {
  return typeof value === "string" && PROGRAMME_TYPES.some((type) => type === value);
}

export function validateStudentContext(input: unknown): StudentContextValidation {
  if (input === null || input === undefined) return { success: true, data: null };
  if (typeof input !== "object" || Array.isArray(input)) {
    return { success: false, error: "Student context must be an object or null." };
  }
  if (!isPlainRecord(input)) {
    return { success: false, error: "Student context must be a plain object or null." };
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "cohortYear" && key !== "programmeType")) {
    return { success: false, error: "Student context contains unsupported fields." };
  }
  const cohortYear = value.cohortYear ?? null;
  const programmeType = value.programmeType ?? null;
  if (cohortYear !== null && !isCohortYear(cohortYear)) {
    return { success: false, error: "Admission cohort year must be a four-digit integer or null." };
  }
  if (programmeType !== null && !isProgrammeType(programmeType)) {
    return { success: false, error: "Programme type must be a supported programme category or null." };
  }
  return { success: true, data: { cohortYear, programmeType } };
}
