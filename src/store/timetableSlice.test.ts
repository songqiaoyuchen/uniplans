import type { TimetableGenerationResult } from "@/types/graphTypes";
import { ModuleStatus, type ModuleData } from "@/types/plannerTypes";
import reducer, {
  exemptedModuleAdded,
  maxMcsUpdated,
  moduleAdded,
  semesterAdded,
  targetModuleAdded,
  timetableLoaded,
} from "./timetableSlice";
import {
  MAX_EXEMPTED_MODULES,
  MAX_TARGET_MODULES,
} from "@/constants/plannerLimits";

const moduleData = (
  code: string,
  dynamicData: Partial<ModuleData> = {}
): ModuleData => ({
  id: code,
  code,
  title: code,
  credits: 4,
  semestersOffered: [],
  exam: null,
  preclusions: [],
  ...dynamicData,
});

const generationResult = (
  semesters: TimetableGenerationResult["timetable"]["semesters"]
): TimetableGenerationResult => ({
  timetable: { semesters },
  isValid: true,
  validation: {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      totalModules: semesters.reduce(
        (total, semester) => total + semester.moduleCodes.length,
        0
      ),
      totalSemesters: semesters.length,
      totalCredits: 0,
      maxCreditsInSemester: 0,
      targetModulesCompleted: 0,
      targetModulesTotal: 0,
    },
  },
});

const fulfilledGeneration = (
  payload: TimetableGenerationResult,
  preserveTimetable = false,
  preservedData: Record<number, string[]> = {}
) => ({
  type: "api/executeQuery/fulfilled",
  payload,
  meta: {
    requestStatus: "fulfilled",
    arg: {
      endpointName: "getTimetable",
      originalArgs: {
        requiredModuleCodes: [],
        exemptedModuleCodes: [],
        preserveTimetable,
        preservedData,
      },
    },
  },
});
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

  test("preserves metadata for modules in preserved semesters", () => {
    const initialState = reducer(
      undefined,
      timetableLoaded({
        modules: [
          moduleData("CS1010", {
            grade: "A",
            status: ModuleStatus.Completed,
            tags: ["foundation"],
          }),
          moduleData("MA1521", { grade: "B+" }),
        ],
        semesters: [
          { id: 0, moduleCodes: ["CS1010"] },
          { id: 2, moduleCodes: ["MA1521"] },
        ],
      })
    );

    const state = reducer(
      initialState,
      fulfilledGeneration(
        generationResult([
          { id: 0, moduleCodes: ["CS1010"] },
          { id: 2, moduleCodes: ["CS2040"] },
        ]),
        true,
        { 0: ["CS1010"] }
      )
    );

    expect(state.modules.entities.CS1010).toMatchObject({
      grade: "A",
      status: ModuleStatus.Completed,
      tags: ["foundation"],
    });
    expect(state.modules.entities.MA1521).toBeUndefined();
  });

  test("clears old module metadata when preservation is disabled", () => {
    const initialState = reducer(
      undefined,
      timetableLoaded({
        modules: [moduleData("CS1010", { grade: "A" })],
        semesters: [{ id: 0, moduleCodes: ["CS1010"] }],
      })
    );

    const state = reducer(
      initialState,
      fulfilledGeneration(
        generationResult([{ id: 0, moduleCodes: ["CS1010"] }])
      )
    );

    expect(state.modules.entities.CS1010).toBeUndefined();
  });
});

describe("timetable and exemption mutual exclusivity", () => {
  test("exempting a scheduled module removes every timetable occurrence", () => {
    let state = reducer(undefined, semesterAdded({ id: 0 }));
    state = reducer(state, moduleAdded({ module: moduleData("CS1010"), destSemesterId: 0 }));

    state = reducer(state, exemptedModuleAdded("CS1010"));

    expect(state.exemptedModules).toEqual(["CS1010"]);
    expect(state.semesters.entities[0]?.moduleCodes).toEqual([]);
  });

  test("explicitly adding an exempted module removes its exemption", () => {
    let state = reducer(undefined, semesterAdded({ id: 0 }));
    state = reducer(state, exemptedModuleAdded("CS1010"));

    state = reducer(state, moduleAdded({ module: moduleData("CS1010"), destSemesterId: 0 }));

    expect(state.exemptedModules).toEqual([]);
    expect(state.semesters.entities[0]?.moduleCodes).toEqual(["CS1010"]);
  });
});

describe("planner input limits", () => {
  test("caps target modules at the shared frontend limit", () => {
    let state = reducer(undefined, { type: "test/init" });

    for (let index = 0; index <= MAX_TARGET_MODULES; index++) {
      state = reducer(state, targetModuleAdded(`TARGET${index}`));
    }

    expect(state.targetModules).toHaveLength(MAX_TARGET_MODULES);
    expect(state.targetModules).not.toContain(`TARGET${MAX_TARGET_MODULES}`);
  });

  test("caps exempted modules at the shared frontend limit", () => {
    let state = reducer(undefined, { type: "test/init" });

    for (let index = 0; index <= MAX_EXEMPTED_MODULES; index++) {
      state = reducer(state, exemptedModuleAdded(`EXEMPTED${index}`));
    }

    expect(state.exemptedModules).toHaveLength(MAX_EXEMPTED_MODULES);
    expect(state.exemptedModules).not.toContain(`EXEMPTED${MAX_EXEMPTED_MODULES}`);
  });

  test("keeps target and exemption state mutually exclusive", () => {
    let state = reducer(undefined, targetModuleAdded("CS1010"));
    state = reducer(state, exemptedModuleAdded("CS1010"));

    expect(state.targetModules).toEqual([]);
    expect(state.exemptedModules).toEqual(["CS1010"]);

    state = reducer(state, targetModuleAdded("CS1010"));

    expect(state.targetModules).toEqual(["CS1010"]);
    expect(state.exemptedModules).toEqual([]);
  });

  test("accepts only MC values exposed by the frontend", () => {
    let state = reducer(undefined, maxMcsUpdated(40));
    expect(state.maxMcsPerSemester).toBe(40);

    state = reducer(state, maxMcsUpdated(17));
    expect(state.maxMcsPerSemester).toBe(40);

    state = reducer(state, maxMcsUpdated(18));
    expect(state.maxMcsPerSemester).toBe(18);
  });
});
