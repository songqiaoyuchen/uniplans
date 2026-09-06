import miniModuleData from "@/data/miniModuleData.json";
import type { StudentContext } from "@/types/prerequisiteTypes";
import { validateStudentContext } from "@/utils/prerequisites/validateStudentContext";
import {
  DEFAULT_MCS_PER_SEMESTER,
  isAllowedMaxMcs,
  MAX_EXEMPTED_MODULES,
  MAX_MODULES_PER_PRESERVED_SEMESTER,
  MAX_PRESERVED_SEMESTER_ID,
  MAX_PRESERVED_SEMESTERS,
  MAX_TARGET_MODULES,
} from "@/constants/plannerLimits";

export type ValidTimetableRequest = {
  requiredModuleCodes: string[];
  exemptedModuleCodes: string[];
  useSpecialTerms: boolean;
  maxMcsPerSemester: number;
  preservedTimetable: Record<number, string[]>;
  studentContext: StudentContext | null;
};

export type TimetableRequestValidation =
  | { success: true; data: ValidTimetableRequest }
  | { success: false; error: string };

const knownModuleCodes = new Set(
  miniModuleData.map(({ code }) => code.toUpperCase()),
);

function validateModuleCodes(
  value: unknown,
  fieldName: string,
  maxItems: number,
): { success: true; codes: string[] } | { success: false; error: string } {
  if (!Array.isArray(value)) {
    return { success: false, error: `${fieldName} must be an array` };
  }

  if (value.length > maxItems) {
    return {
      success: false,
      error: `${fieldName} cannot contain more than ${maxItems} modules`,
    };
  }

  const codes: string[] = [];
  const seen = new Set<string>();

  for (const rawCode of value) {
    if (typeof rawCode !== "string") {
      return { success: false, error: `${fieldName} must contain only module codes` };
    }

    const code = rawCode.trim().toUpperCase();
    if (!knownModuleCodes.has(code)) {
      return { success: false, error: `Unknown module code in ${fieldName}: ${code}` };
    }

    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }

  return { success: true, codes };
}

function validatePreservedTimetable(
  value: unknown,
):
  | { success: true; timetable: Record<number, string[]> }
  | { success: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { success: false, error: "preservedTimetable must be an object" };
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_PRESERVED_SEMESTERS) {
    return {
      success: false,
      error: `preservedTimetable cannot contain more than ${MAX_PRESERVED_SEMESTERS} semesters`,
    };
  }

  const timetable: Record<number, string[]> = {};

  for (const [semesterKey, moduleCodes] of entries) {
    if (!/^(0|[1-9]\d*)$/.test(semesterKey)) {
      return { success: false, error: `Invalid preserved semester: ${semesterKey}` };
    }

    const semesterId = Number(semesterKey);
    if (semesterId > MAX_PRESERVED_SEMESTER_ID) {
      return {
        success: false,
        error: `Preserved semester IDs cannot exceed ${MAX_PRESERVED_SEMESTER_ID}`,
      };
    }

    const validatedCodes = validateModuleCodes(
      moduleCodes,
      `preservedTimetable.${semesterKey}`,
      MAX_MODULES_PER_PRESERVED_SEMESTER,
    );
    if (!validatedCodes.success) {
      return validatedCodes;
    }

    timetable[semesterId] = validatedCodes.codes;
  }

  return { success: true, timetable };
}

export function validateTimetableRequest(body: unknown): TimetableRequestValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  const input = body as Record<string, unknown>;
  const required = validateModuleCodes(
    input.required ?? [],
    "required",
    MAX_TARGET_MODULES,
  );
  if (!required.success) return required;
  if (required.codes.length === 0) {
    return { success: false, error: "No target modules specified" };
  }

  const exempted = validateModuleCodes(
    input.exempted ?? [],
    "exempted",
    MAX_EXEMPTED_MODULES,
  );
  if (!exempted.success) return exempted;

  const overlap = required.codes.find((code) => exempted.codes.includes(code));
  if (overlap) {
    return {
      success: false,
      error: `A module cannot be both targeted and exempted: ${overlap}`,
    };
  }

  const specialTerms = input.specialTerms ?? false;
  if (typeof specialTerms !== "boolean") {
    return { success: false, error: "specialTerms must be a boolean" };
  }

  const maxMcs = input.maxMcs ?? DEFAULT_MCS_PER_SEMESTER;
  if (!isAllowedMaxMcs(maxMcs)) {
    return {
      success: false,
      error: "maxMcs must be an even integer between 16 and 40",
    };
  }

  const preserved = validatePreservedTimetable(input.preservedTimetable ?? {});
  if (!preserved.success) return preserved;
  const context = validateStudentContext(input.studentContext);
  if (!context.success) return context;

  return {
    success: true,
    data: {
      requiredModuleCodes: required.codes,
      exemptedModuleCodes: exempted.codes,
      useSpecialTerms: specialTerms,
      maxMcsPerSemester: maxMcs,
      preservedTimetable: preserved.timetable,
      studentContext: context.data,
    },
  };
}
