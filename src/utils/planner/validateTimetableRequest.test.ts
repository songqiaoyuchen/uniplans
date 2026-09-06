import miniModuleData from "@/data/miniModuleData.json";
import {
  MAX_EXEMPTED_MODULES,
  MAX_MODULES_PER_PRESERVED_SEMESTER,
  MAX_TARGET_MODULES,
} from "@/constants/plannerLimits";
import { validateTimetableRequest } from "./validateTimetableRequest";

const knownCodes = miniModuleData.map(({ code }) => code);

describe("validateTimetableRequest", () => {
  test("normalises module codes and applies safe defaults", () => {
    const result = validateTimetableRequest({
      required: [` ${knownCodes[0].toLowerCase()} `],
    });

    expect(result).toEqual({
      success: true,
      data: {
        requiredModuleCodes: [knownCodes[0]],
        exemptedModuleCodes: [],
        useSpecialTerms: false,
        maxMcsPerSemester: 20,
        preservedTimetable: {},
        studentContext: null,
      },
    });
  });

  test("validates and retains per-timetable student context", () => {
    const studentContext = { cohortYear: 2024, programmeType: "Undergraduate Degree" };
    expect(validateTimetableRequest({ required: [knownCodes[0]], studentContext })).toMatchObject({
      success: true, data: { studentContext },
    });
    expect(validateTimetableRequest({ required: [knownCodes[0]], studentContext: { cohortYear: "2024" } }).success).toBe(false);
  });

  test("rejects target arrays beyond the shared frontend limit", () => {
    const result = validateTimetableRequest({
      required: Array(MAX_TARGET_MODULES + 1).fill(knownCodes[0]),
    });

    expect(result).toEqual({
      success: false,
      error: `required cannot contain more than ${MAX_TARGET_MODULES} modules`,
    });
  });

  test("rejects exemption arrays beyond the shared frontend limit", () => {
    const result = validateTimetableRequest({
      required: [knownCodes[0]],
      exempted: Array(MAX_EXEMPTED_MODULES + 1).fill(knownCodes[1]),
    });

    expect(result).toEqual({
      success: false,
      error: `exempted cannot contain more than ${MAX_EXEMPTED_MODULES} modules`,
    });
  });

  test.each([16, 18, 40])("accepts the frontend MC value %i", (maxMcs) => {
    expect(
      validateTimetableRequest({ required: [knownCodes[0]], maxMcs }).success,
    ).toBe(true);
  });

  test.each([15, 17, 41, 20.5, "20"])("rejects the invalid MC value %p", (maxMcs) => {
    expect(validateTimetableRequest({ required: [knownCodes[0]], maxMcs })).toEqual({
      success: false,
      error: "maxMcs must be an even integer between 16 and 40",
    });
  });

  test("rejects oversized preserved-semester arrays independently of MCs", () => {
    const result = validateTimetableRequest({
      required: [knownCodes[0]],
      preservedTimetable: {
        0: Array(MAX_MODULES_PER_PRESERVED_SEMESTER + 1).fill(knownCodes[1]),
      },
    });

    expect(result).toEqual({
      success: false,
      error: `preservedTimetable.0 cannot contain more than ${MAX_MODULES_PER_PRESERVED_SEMESTER} modules`,
    });
  });

  test("rejects unknown codes and target/exemption overlap", () => {
    expect(
      validateTimetableRequest({ required: ["NOT_A_MODULE"] }),
    ).toEqual({
      success: false,
      error: "Unknown module code in required: NOT_A_MODULE",
    });

    expect(
      validateTimetableRequest({
        required: [knownCodes[0]],
        exempted: [knownCodes[0]],
      }),
    ).toEqual({
      success: false,
      error: `A module cannot be both targeted and exempted: ${knownCodes[0]}`,
    });
  });
});
