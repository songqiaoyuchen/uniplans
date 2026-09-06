import { EMPTY_STUDENT_CONTEXT, PROGRAMME_TYPES, validateStudentContext } from "./validateStudentContext";
import { evaluateCondition } from "./evaluatePrerequisite";
import type { StudentContext } from "../../types/prerequisiteTypes";

describe("validateStudentContext", () => {
  test("absent context remains absent rather than inferred", () => {
    expect(validateStudentContext(null)).toEqual({ success: true, data: null });
    expect(validateStudentContext(undefined)).toEqual({ success: true, data: null });
    expect(validateStudentContext({})).toEqual({ success: true, data: EMPTY_STUDENT_CONTEXT });
    expect(validateStudentContext({ cohortYear: 2024 })).toEqual({ success: true, data: { cohortYear: 2024, programmeType: null } });
    expect(validateStudentContext({ programmeType: "Undergraduate Degree" })).toEqual({ success: true, data: { cohortYear: null, programmeType: "Undergraduate Degree" } });
  });

  test.each(PROGRAMME_TYPES)("accepts the source programme category %s", (programmeType) => {
    expect(validateStudentContext({ cohortYear: 2024, programmeType })).toEqual({ success: true, data: { cohortYear: 2024, programmeType } });
  });

  test.each([
    false, true, 2024, "2024", [], new Date(),
    { cohortYear: "2024" }, { cohortYear: "2024/25" }, { cohortYear: 2024.5 },
    { cohortYear: NaN }, { cohortYear: Infinity }, { cohortYear: -1 }, { cohortYear: 0 },
    { cohortYear: 999 }, { cohortYear: 10000 }, { cohortYear: [] },
    { programmeType: "" }, { programmeType: "PhD" }, { programmeType: "Undergraduate" },
    { programmeType: "undergraduate degree" }, { programmeType: " Undergraduate Degree " },
    { programmeType: 1 }, { programmeType: ["Undergraduate Degree"] },
    { admissionYear: 2024 }, { cohortYear: 2024, programmeType: null, major: "CS" },
  ])("rejects malformed context without coercion: %j", (input) => {
    expect(validateStudentContext(input)).toMatchObject({ success: false, error: expect.any(String) });
  });

  test("accepts only four-digit integer cohort years without today's-date assumptions", () => {
    expect(validateStudentContext({ cohortYear: 1000 })).toMatchObject({ success: true });
    expect(validateStudentContext({ cohortYear: 9999 })).toMatchObject({ success: true });
  });

  test("returns a fresh object and leaves the immutable empty context unchanged", () => {
    const original: StudentContext = { cohortYear: 2024, programmeType: "Undergraduate Degree" };
    const result = validateStudentContext(original);
    expect(result).toEqual({ success: true, data: original });
    if (result.success) expect(result.data).not.toBe(original);
    expect(Object.isFrozen(EMPTY_STUDENT_CONTEXT)).toBe(true);
  });

  test("unvalidated invalid values also remain unknown at the evaluator boundary", () => {
    const context = { cohortYear: "2024", programmeType: "PhD" } as unknown as StudentContext;
    expect(evaluateCondition({ kind: "cohort", rule: "MUST_BE_IN", years: ["S:2021"] }, context)).toBeNull();
    expect(evaluateCondition({ kind: "programType", rule: "IF_IN", types: ["Undergraduate Degree"] }, context)).toBeNull();
  });
});
