jest.mock('redux-persist/lib/storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined),
}));
jest.mock('redux-persist', () => ({ ...jest.requireActual('redux-persist'), persistStore: jest.fn() }));

import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from './index';
import { listenerMiddleware } from './listenerMiddleware';
import { apiSlice } from './apiSlice';
import { importTimetableFromSnapshot, switchTimetable, timetableAdded, timetableUpdated } from './plannerSlice';
import { moduleCached, studentContextUpdated, timetableLoaded } from './timetableSlice';
import { ModuleData, ModuleStatus, TimetableSnapshot } from '@/types/plannerTypes';

const context = { cohortYear: 2024, programmeType: 'Undergraduate Degree' };
const moduleData: ModuleData = {
  id: 'CS1010', code: 'CS1010', title: 'Programming', credits: 4,
  semestersOffered: [0, 2], exam: null, preclusions: [], prerequisiteSchemaVersion: 2,
  requires: { type: 'condition', condition: { kind: 'cohort', rule: 'MUST_BE_IN', years: ['S:2024'] } },
};
const createStore = () => configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware().prepend(listenerMiddleware.middleware).concat(apiSlice.middleware),
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('private context lifecycle listeners', () => {
  test('context edits revalidate immediately and autosave only to the active timetable', async () => {
    const store = createStore();
    store.dispatch(timetableAdded({ name: 'One' }));
    store.dispatch(timetableAdded({ name: 'Two' }));
    await store.dispatch(switchTimetable('One'));
    store.dispatch(timetableLoaded({ modules: [moduleData], semesters: [{ id: 0, moduleCodes: ['CS1010'] }] }));
    await jest.advanceTimersByTimeAsync(0);
    expect(store.getState().timetable.modules.entities.CS1010.status).toBe(ModuleStatus.Unsatisfied);
    store.dispatch(studentContextUpdated(context));
    await jest.advanceTimersByTimeAsync(0);
    expect(store.getState().timetable.modules.entities.CS1010.status).toBe(ModuleStatus.Satisfied);
    await jest.advanceTimersByTimeAsync(600);
    expect(store.getState().planner.timetables.entities.One.studentContext).toEqual(context);
    expect(store.getState().planner.timetables.entities.Two.studentContext).toBeNull();
    store.dispatch(apiSlice.util.resetApiState());
  });

  test('switch saves working context before debounce, and duplication can use the unsaved working state', async () => {
    const store = createStore();
    store.dispatch(timetableAdded({ name: 'One' }));
    store.dispatch(timetableAdded({ name: 'Two' }));
    await store.dispatch(switchTimetable('One'));
    store.dispatch(studentContextUpdated(context));
    const working = store.getState().timetable;
    expect(store.getState().planner.timetables.entities.One.studentContext).toBeNull();
    store.dispatch(timetableAdded({ name: 'One Copy' }));
    store.dispatch(timetableUpdated({ name: 'One Copy', modules: working.modules, semesters: working.semesters, studentContext: working.studentContext }));
    await store.dispatch(switchTimetable('One Copy'));
    expect(store.getState().timetable.studentContext).toEqual(context);
    await store.dispatch(switchTimetable('Two'));
    expect(store.getState().timetable.studentContext).toBeNull();
    await store.dispatch(switchTimetable('One'));
    expect(store.getState().timetable.studentContext).toEqual(context);
    store.dispatch(apiSlice.util.resetApiState());
  });

  test('refreshes lossy saved modules from the current per-code cache without losing user metadata', async () => {
    const store = createStore();
    await store.dispatch(apiSlice.util.upsertQueryData('getModuleByCode', 'CS1010', moduleData));
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network prohibited in test'));
    store.dispatch(timetableLoaded({
      modules: [{ ...moduleData, prerequisiteSchemaVersion: undefined, requires: undefined, grade: 'A', tags: ['core'], status: ModuleStatus.Completed }],
      semesters: [{ id: 0, moduleCodes: ['CS1010'] }],
    }));
    await jest.advanceTimersByTimeAsync(0);
    expect(store.getState().timetable.modules.entities.CS1010).toMatchObject({
      prerequisiteSchemaVersion: 2, requires: moduleData.requires, grade: 'A', tags: ['core'], status: ModuleStatus.Completed,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    store.dispatch(apiSlice.util.resetApiState());
  });

  test('refetches legacy per-code query data rather than reusing its lossy requires', async () => {
    const store = createStore();
    await store.dispatch(apiSlice.util.upsertQueryData('getModuleByCode', 'CS1010', { ...moduleData, prerequisiteSchemaVersion: undefined, requires: undefined }));
    const OriginalRequest = global.Request;
    global.Request = class extends OriginalRequest {
      constructor(input: string | URL | Request, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init);
      }
    };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(moduleData), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    try {
      store.dispatch(timetableLoaded({ modules: [{ ...moduleData, prerequisiteSchemaVersion: undefined, requires: undefined, tags: ['core'] }], semesters: [{ id: 0, moduleCodes: ['CS1010'] }] }));
      await jest.advanceTimersByTimeAsync(100);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(store.getState().timetable.modules.entities.CS1010).toMatchObject({ prerequisiteSchemaVersion: 2, requires: moduleData.requires, tags: ['core'] });
    } finally {
      global.Request = OriginalRequest;
      store.dispatch(apiSlice.util.resetApiState());
    }
  });

  test('failed prerequisite refresh remains blocked and keeps the local timetable intact', async () => {
    const store = createStore();
    const OriginalRequest = global.Request;
    global.Request = class extends OriginalRequest {
      constructor(input: string | URL | Request, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init);
      }
    };
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Offline'));
    try {
      store.dispatch(timetableLoaded({
        modules: [{ ...moduleData, prerequisiteSchemaVersion: undefined, requires: undefined, tags: ['core'] }],
        semesters: [{ id: 0, moduleCodes: ['CS1010'] }],
      }));
      await jest.advanceTimersByTimeAsync(100);
      expect(store.getState().timetable.modules.entities.CS1010).toMatchObject({
        tags: ['core'], requires: { type: 'blocked' }, status: ModuleStatus.Unsatisfied,
        issues: expect.arrayContaining([{ type: 'PrerequisiteUnavailable', message: expect.stringContaining('refreshed') }]),
      });
      expect(store.getState().timetable.semesters.entities[0].moduleCodes).toEqual(['CS1010']);
    } finally {
      global.Request = OriginalRequest;
      store.dispatch(apiSlice.util.resetApiState());
    }
  });

  test.each(['context', 'switch'])('ignores async generation and metadata hydration after a %s change', async change => {
    const store = createStore();
    store.dispatch(timetableAdded({ name: 'One' }));
    store.dispatch(timetableAdded({ name: 'Two' }));
    await store.dispatch(switchTimetable('One'));
    const OriginalRequest = global.Request;
    global.Request = class extends OriginalRequest {
      constructor(input: string | URL | Request, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init);
      }
    };
    let resolveFetch!: (response: Response) => void;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => new Promise<Response>(resolve => { resolveFetch = resolve; }));
    try {
      const request = store.dispatch(apiSlice.endpoints.getTimetable.initiate({
        requiredModuleCodes: ['CS2040'], exemptedModuleCodes: [], studentContext: null, clientTimetableName: 'One',
      }, { subscribe: false }));
      await jest.advanceTimersByTimeAsync(0);
      if (change === 'context') store.dispatch(studentContextUpdated(context));
      else await store.dispatch(switchTimetable('Two'));
      resolveFetch(new Response(JSON.stringify({
        timetable: { semesters: [{ id: 0, moduleCodes: ['CS2040'] }] }, isValid: true,
        validation: { isValid: true, errors: [], warnings: [], stats: {} },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      await request;
      await jest.advanceTimersByTimeAsync(0);
      expect(store.getState().timetable.semesters.ids).toEqual([]);
      expect(store.getState().timetable.modules.ids).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      global.Request = OriginalRequest;
      store.dispatch(apiSlice.util.resetApiState());
    }
  });

  test('snapshot imports never inherit the sender or currently active student context', async () => {
    const store = createStore();
    store.dispatch(timetableAdded({ name: 'One' }));
    await store.dispatch(switchTimetable('One'));
    store.dispatch(studentContextUpdated(context));
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(moduleData), { status: 200 }));
    const snapshot = { version: 1, semesters: [['CS1010']], modules: [{ id: 'CS1010', code: 'CS1010', tags: ['shared'] }], studentContext: context } as TimetableSnapshot;
    await store.dispatch(importTimetableFromSnapshot(snapshot, 'Imported'));
    expect(store.getState().timetable.studentContext).toBeNull();
    expect(store.getState().planner.timetables.entities.Imported.studentContext).toBeNull();
    expect(store.getState().planner.timetables.entities.One.studentContext).toEqual(context);
    expect(store.getState().timetable.modules.entities.CS1010.tags).toEqual(['shared']);
    store.dispatch(apiSlice.util.resetApiState());
  });

  test('static refreshes of existing entities recompute prerequisite issues', async () => {
    const store = createStore();
    store.dispatch(timetableLoaded({ modules: [{ ...moduleData, requires: undefined }], semesters: [{ id: 0, moduleCodes: ['CS1010'] }] }));
    await jest.advanceTimersByTimeAsync(0);
    expect(store.getState().timetable.modules.entities.CS1010.status).toBe(ModuleStatus.Satisfied);
    store.dispatch(moduleCached({ module: moduleData }));
    await jest.advanceTimersByTimeAsync(0);
    expect(store.getState().timetable.modules.entities.CS1010.issues).toContainEqual({ type: 'PrerequisiteContext', message: expect.stringContaining('admission cohort') });
    store.dispatch(apiSlice.util.resetApiState());
  });
});
