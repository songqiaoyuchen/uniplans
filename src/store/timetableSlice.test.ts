import type { TimetableGenerationResult } from "@/types/graphTypes";
import { ModuleStatus, type ModuleData } from "@/types/plannerTypes";
import reducer, {
  exemptedModuleAdded,
  maxMcsUpdated,
  moduleAdded,
  moduleCached,
  studentContextUpdated,
  updateModuleStates,
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
    requestId: 'generation-request',
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
const pendingGeneration = (requestId = 'generation-request') => ({
  type: 'api/executeQuery/pending',
  meta: { requestStatus: 'pending', requestId, arg: { endpointName: 'getTimetable' } },
});

const applyGeneration = (state: ReturnType<typeof reducer> | undefined, action: Parameters<typeof reducer>[1]) =>
  reducer(reducer(state, pendingGeneration()), action);

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

    const state = applyGeneration(undefined, {
      type: "api/executeQuery/fulfilled",
      payload,
      meta: {
        requestStatus: "fulfilled",
        requestId: 'generation-request',
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

    const state = applyGeneration(
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

    const state = applyGeneration(
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

describe('private student context and prerequisite cache', () => {
  const context = { cohortYear: 2024, programmeType: 'Undergraduate Degree' };

  test('defaults legacy timetables to unset, without inheriting the previous context', () => {
    let state = reducer(undefined, studentContextUpdated(context));
    expect(state.studentContext).toEqual(context);
    state = reducer(state, timetableLoaded({ modules: [], semesters: [] }));
    expect(state.studentContext).toBeNull();
  });

  test('refreshes lossy prerequisites while preserving dynamic metadata', () => {
    const oldModule = moduleData('CS2040', { grade: 'A', tags: ['core'], status: ModuleStatus.Completed });
    const legacy = reducer(undefined, timetableLoaded({ modules: [oldModule], semesters: [{ id: 0, moduleCodes: ['CS2040'] }] }));
    expect(legacy.modules.entities.CS2040.requires?.type).toBe('blocked');
    const fresh = moduleData('CS2040', { prerequisiteSchemaVersion: 2, requires: { type: 'module', moduleCode: 'CS1010' } });
    const state = reducer(legacy, moduleCached({ module: fresh }));
    expect(state.modules.entities.CS2040).toMatchObject({
      prerequisiteSchemaVersion: 2,
      requires: fresh.requires,
      grade: 'A',
      tags: ['core'],
      status: ModuleStatus.Completed,
    });
    expect(state.semesters).toBe(legacy.semesters);
    expect(reducer(state, moduleCached({ module: oldModule })).modules).toBe(state.modules);
    const cleared = reducer(state, moduleCached({ module: { ...fresh, requires: undefined } }));
    expect(cleared.modules.entities.CS2040.requires).toBeUndefined();
  });

  test('ignores generation responses after context changes, including changes back', () => {
    let state = reducer(undefined, studentContextUpdated(context));
    state = reducer(state, pendingGeneration());
    state = reducer(state, studentContextUpdated(null));
    state = reducer(state, studentContextUpdated(context));
    const result = reducer(state, fulfilledGeneration(generationResult([{ id: 0, moduleCodes: ['CS1010'] }])));
    expect(result.semesters.ids).toEqual([]);
  });

  test('ignores responses after loading a different timetable or starting a newer request', () => {
    let state = reducer(undefined, pendingGeneration());
    state = reducer(state, timetableLoaded({ modules: [], semesters: [{ id: 4, moduleCodes: [] }], studentContext: context }));
    state = reducer(state, pendingGeneration('new-request'));
    const result = reducer(state, fulfilledGeneration(generationResult([{ id: 0, moduleCodes: ['CS1010'] }])));
    expect(result.semesters.ids).toEqual([4]);
  });

  test('ignores prerequisite checks computed for a previous context', () => {
    let state = reducer(undefined, moduleCached({ module: moduleData('CS1010') }));
    state = reducer(state, updateModuleStates.pending('old-check', undefined));
    state = reducer(state, studentContextUpdated(context));
    const result = reducer(state, updateModuleStates.fulfilled([
      { id: 'CS1010', changes: { status: ModuleStatus.Satisfied, issues: [] } },
    ], 'old-check', undefined));
    expect(result.modules.entities.CS1010.status).toBeUndefined();
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
