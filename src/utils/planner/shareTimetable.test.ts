import { deserializeTimetable, serializeTimetable } from './shareTimetable';
import type { Timetable } from '@/store/plannerSlice';
import type { TimetableSnapshot } from '@/types/plannerTypes';

const context = { cohortYear: 2024, programmeType: 'Undergraduate Degree' };
const timetable: Timetable = {
  name: 'Private timetable', studentContext: context,
  semesters: { ids: [0, 2], entities: { 0: { id: 0, moduleCodes: ['CS1010'] }, 2: { id: 2, moduleCodes: [] } } },
  modules: {
    ids: ['CS1010'],
    entities: { CS1010: {
      id: 'CS1010', code: 'CS1010', title: 'Programming', credits: 4,
      semestersOffered: [0, 2], exam: null, preclusions: [], grade: 'A', tags: ['core'],
      prerequisiteSchemaVersion: 2,
      requires: { type: 'condition', condition: { kind: 'cohort', rule: 'MUST_BE_IN', years: ['S:2024'] } },
    } },
  },
};

describe('shared timetable privacy', () => {
  test('keeps version 1 and an explicit allowlist excluding context and grades', () => {
    const snapshot = serializeTimetable(timetable);
    expect(snapshot).toEqual({
      version: 1, semesters: [['CS1010'], [], []], modules: [{ id: 'CS1010', code: 'CS1010', tags: ['core'] }],
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/studentContext|cohortYear|programmeType|Undergraduate|grade|requires/);
  });

  test('imported data starts unset even if a snapshot includes unexpected private fields', () => {
    const snapshot = { ...serializeTimetable(timetable), studentContext: context } as TimetableSnapshot;
    const imported = deserializeTimetable(snapshot);
    expect(imported.studentContext).toBeNull();
    expect(imported.modules.entities.CS1010.tags).toEqual(['core']);
    expect(imported.modules.entities.CS1010.grade).toBeUndefined();
    expect(imported.semesters.ids).toEqual([0, 1, 2]);
  });
});
