import type { RootState } from '.';
import reducer, { moduleSelected, studentContextUpdated, timetableLoaded } from './timetableSlice';
import { makeIsModuleRelatedSelector } from './timetableSelectors';
import type { ModuleData } from '@/types/plannerTypes';

const modules: ModuleData[] = ['CS1010', 'CS2040', 'CS4000'].map(code => ({
  id: code, code, title: code, credits: 4, semestersOffered: [0, 2], exam: null, preclusions: [], prerequisiteSchemaVersion: 2,
}));
modules[2].requires = {
  type: 'conditional', condition: { kind: 'cohort', rule: 'IF_IN', years: ['S:2024'] },
  then: { type: 'NOF', n: 2, children: [{ type: 'module', moduleCode: 'CS%' }] },
};

test('related module selectors reevaluate context and support wildcard modules in both directions', () => {
  let timetable = reducer(undefined, timetableLoaded({ modules, semesters: [] }));
  timetable = reducer(timetable, moduleSelected('CS4000'));
  const related = makeIsModuleRelatedSelector('CS1010');
  expect(related({ timetable } as RootState)).toBe(false);
  timetable = reducer(timetable, studentContextUpdated({ cohortYear: 2024, programmeType: null }));
  expect(related({ timetable } as RootState)).toBe(true);
  timetable = reducer(timetable, studentContextUpdated({ cohortYear: 2023, programmeType: null }));
  expect(related({ timetable } as RootState)).toBe(false);
  timetable = reducer(timetable, moduleSelected('CS1010'));
  const reverse = makeIsModuleRelatedSelector('CS4000');
  expect(reverse({ timetable } as RootState)).toBe(false);
  timetable = reducer(timetable, studentContextUpdated({ cohortYear: 2024, programmeType: null }));
  expect(reverse({ timetable } as RootState)).toBe(true);
});
