import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import { rootReducer } from '@/store';
import { useLazyGetTimetableQuery } from '@/store/apiSlice';
import type { TimetableGenerationResult } from '@/types/graphTypes';
import Generate from './Generate';

jest.mock('@/store/apiSlice', () => ({ ...jest.requireActual('@/store/apiSlice'), useLazyGetTimetableQuery: jest.fn() }));
jest.mock('../timetable/MiniModuleCard', () => ({ __esModule: true, default: () => null }));
jest.mock('redux-persist', () => ({ ...jest.requireActual('redux-persist'), persistStore: jest.fn() }));
jest.mock('redux-persist/lib/storage', () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

function renderResult(isValid: boolean) {
  const data: TimetableGenerationResult = {
    timetable: { semesters: [{ id: 0, moduleCodes: ['MA4254'] }] },
    isValid,
    validation: {
      isValid,
      errors: isValid ? [] : ['Target modules not completed: DBA3701'],
      warnings: ['Gap in semesters: 4 to 8'],
      stats: { totalModules: 1, totalSemesters: 1, totalCredits: 4, maxCreditsInSemester: 4, targetModulesCompleted: 1, targetModulesTotal: 2 },
    },
  };
  jest.mocked(useLazyGetTimetableQuery).mockReturnValue([
    jest.fn(), { isFetching: false, isSuccess: true, requestId: 'generation-test', currentData: data }, {},
  ] as unknown as ReturnType<typeof useLazyGetTimetableQuery>);
  const initial = rootReducer(undefined, { type: 'test/init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...initial,
      timetable: {
        ...initial.timetable,
        generationRequestId: 'generation-test',
        studentContext: { cohortYear: 2024, programmeType: 'Undergraduate Degree' },
        targetModules: ['MA4254', 'DBA3701'],
      },
    },
  });
  return { markup: renderToStaticMarkup(<Provider store={store}><Generate /></Provider>), data };
}

describe('generation warning copy', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows only the short generation-error warning for an invalid proposal', () => {
    const { markup, data } = renderResult(false);
    expect(markup).toContain('>Generation error<');
    expect(markup).not.toContain('this proposed timetable failed validation');
    expect(markup).not.toContain('Target modules not completed: DBA3701');
    expect(markup).not.toContain('Gap in semesters: 4 to 8');
    expect(data.validation.errors).toEqual(['Target modules not completed: DBA3701']);
  });

  test('retains nonfatal warnings for valid proposals', () => {
    const { markup } = renderResult(true);
    expect(markup).not.toContain('Generation error');
    expect(markup).toContain('Gap in semesters: 4 to 8');
  });
});
