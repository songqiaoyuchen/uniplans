jest.mock('redux-persist/lib/storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined),
}));
jest.mock('redux-persist', () => ({ ...jest.requireActual('redux-persist'), persistStore: jest.fn() }));

import { normalizePersistedPlannerState, rootReducer, RootState } from './index';
import { currentTimetableSet, timetableAdded } from './plannerSlice';
import { moduleAdded, semesterAdded, studentContextUpdated } from './timetableSlice';
import { ModuleStatus } from '@/types/plannerTypes';

const context = { cohortYear: 2024, programmeType: 'Undergraduate Degree' };

function persistedState(): RootState {
  let state = rootReducer(undefined, { type: 'test/init' });
  state = rootReducer(state, timetableAdded({ name: 'One' }));
  state = rootReducer(state, timetableAdded({ name: 'Two' }));
  state = rootReducer(state, currentTimetableSet('One'));
  state = rootReducer(state, semesterAdded({ id: 2 }));
  state = rootReducer(state, moduleAdded({ destSemesterId: 2, module: {
    id: 'CS1010', code: 'CS1010', title: 'Programming', credits: 4, semestersOffered: [0, 2],
    exam: null, preclusions: [], grade: 'A', status: ModuleStatus.Completed, tags: ['core'],
  } }));
  return state;
}

describe('private planner persistence normalization', () => {
  test('migrates old plans without guessing context or losing grades, tags and layout', () => {
    const original = persistedState();
    const legacy = JSON.parse(JSON.stringify(original));
    delete legacy.timetable.studentContext;
    delete legacy.planner.timetables.entities.One.studentContext;
    delete legacy.planner.timetables.entities.Two.studentContext;
    legacy.timetable.isMinimalView = true;
    legacy.timetable.isVerticalView = false;
    const state = normalizePersistedPlannerState(legacy);
    expect(state.timetable.studentContext).toBeNull();
    expect(state.planner.timetables.entities.One.studentContext).toBeNull();
    expect(state.planner.timetables.entities.Two.studentContext).toBeNull();
    expect(state.timetable.modules.entities.CS1010).toMatchObject({
      grade: 'A', status: ModuleStatus.Completed, tags: ['core'], requires: { type: 'blocked' },
    });
    expect(state.timetable.semesters).toEqual(original.timetable.semesters);
    expect(state.timetable.isMinimalView).toBe(true);
    expect(state.timetable.isVerticalView).toBe(false);
  });

  test('keeps unsaved working context through reload and resets request identities', () => {
    const state = rootReducer(persistedState(), studentContextUpdated(context));
    const saved = JSON.parse(JSON.stringify(state));
    saved.timetable.generationRequestId = 'old-generation';
    saved.timetable.moduleStateRequestId = 'old-check';
    const restored = normalizePersistedPlannerState(saved);
    expect(restored.timetable.studentContext).toEqual(context);
    expect(restored.planner.timetables.entities.One.studentContext).toEqual(context);
    expect(restored.planner.timetables.entities.Two.studentContext).toBeNull();
    expect(restored.timetable.generationRequestId).toBeNull();
    expect(restored.timetable.moduleStateRequestId).toBeNull();
  });

  test('does not replace current prerequisite metadata or retain malformed saved context', () => {
    const saved = JSON.parse(JSON.stringify(persistedState()));
    saved.timetable.modules.entities.CS1010.prerequisiteSchemaVersion = 2;
    saved.timetable.modules.entities.CS1010.requires = { type: 'constant', value: true };
    saved.timetable.studentContext = { cohortYear: '2024', programmeType: 'Guessed programme' };
    const state = normalizePersistedPlannerState(saved);
    expect(state.timetable.studentContext).toBeNull();
    expect(state.timetable.modules.entities.CS1010.requires).toEqual({ type: 'constant', value: true });
  });
});
