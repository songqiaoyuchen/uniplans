import type { TimetableGenerationResult } from "@/types/graphTypes";
import reducer from "./timetableSlice";

describe("generated timetable results", () => {
  test("retains the proposed timetable when scheduler validation fails", () => {
    const payload: TimetableGenerationResult = {
      timetable: {
        semesters: [{ id: 0, moduleCodes: ["CS1010"] }],
      },
      isValid: false,
      validation: {
        isValid: false,
        errors: ["Target modules not completed"],
        warnings: [],
        stats: {
          totalModules: 1,
          totalSemesters: 1,
          totalCredits: 4,
          maxCreditsInSemester: 4,
          targetModulesCompleted: 0,
          targetModulesTotal: 1,
        },
      },
    };

    const state = reducer(undefined, {
      type: "api/executeQuery/fulfilled",
      payload,
      meta: {
        requestStatus: "fulfilled",
        arg: { endpointName: "getTimetable" },
      },
    });

    expect(state.semesters.entities[0]).toEqual({
      id: 0,
      moduleCodes: ["CS1010"],
    });
  });
});
