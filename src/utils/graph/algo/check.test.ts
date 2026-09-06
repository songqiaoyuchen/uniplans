import type { NormalisedGraph, TimetableData } from '@/types/graphTypes';
import type { ModuleData } from '@/types/plannerTypes';
import { validateSchedule } from './check';

const moduleNode = (id: string, code: string): ModuleData => ({
  id,
  code,
  title: code,
  credits: 4,
  semestersOffered: [],
  exam: null,
  preclusions: [],
});

const timetableWith = (moduleCode: string): TimetableData => ({
  semesters: [{ id: 0, moduleCodes: [moduleCode] }],
});

describe('validateSchedule exemptions', () => {
  test('accepts an exempted direct prerequisite', () => {
    const graph: NormalisedGraph = {
      nodes: {
        target: moduleNode('target', 'CS2000'),
        prerequisite: moduleNode('prerequisite', 'CS1000'),
      },
      edges: [
        { id: 'target-requires-prerequisite', from: 'target', to: 'prerequisite' },
      ],
    };

    const result = validateSchedule(
      timetableWith('CS2000'),
      graph,
      ['CS2000'],
      20,
      ['CS1000']
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('propagates exemptions through an N-of prerequisite before semester one', () => {
    const graph: NormalisedGraph = {
      nodes: {
        target: moduleNode('target', 'CS3000'),
        requirement: { id: 'requirement', type: 'NOF', n: 1 },
        optionA: moduleNode('optionA', 'CS1000'),
        optionB: moduleNode('optionB', 'CS1001'),
      },
      edges: [
        { id: 'target-requires-logic', from: 'target', to: 'requirement' },
        { id: 'logic-option-a', from: 'requirement', to: 'optionA' },
        { id: 'logic-option-b', from: 'requirement', to: 'optionB' },
      ],
    };

    const result = validateSchedule(
      timetableWith('CS3000'),
      graph,
      ['CS3000'],
      20,
      ['CS1001']
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('still rejects an unsatisfied prerequisite', () => {
    const graph: NormalisedGraph = {
      nodes: {
        target: moduleNode('target', 'CS2000'),
        prerequisite: moduleNode('prerequisite', 'CS1000'),
      },
      edges: [
        { id: 'target-requires-prerequisite', from: 'target', to: 'prerequisite' },
      ],
    };

    const result = validateSchedule(
      timetableWith('CS2000'),
      graph,
      ['CS2000'],
      20
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Module CS2000 taken in semester 0 but prerequisite CS1000 not completed'
    );
  });
  test('treats preserved semesters as trusted history', () => {
    const preserved = moduleNode('preserved', 'HIST1000');
    preserved.credits = 30;

    const graph: NormalisedGraph = {
      nodes: {
        target: moduleNode('target', 'CS3000'),
        preserved,
      },
      edges: [
        { id: 'target-requires-preserved', from: 'target', to: 'preserved' },
      ],
    };
    const timetable: TimetableData = {
      semesters: [
        { id: 0, moduleCodes: ['HIST1000', 'UNRELATED1000'] },
        { id: 2, moduleCodes: ['CS3000'] },
      ],
    };

    const result = validateSchedule(
      timetable,
      graph,
      ['CS3000'],
      20,
      [],
      { 0: ['HIST1000', 'UNRELATED1000'] }
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).not.toContain(
      'Module UNRELATED1000 in timetable but not found in graph'
    );
  });

});

describe('semester continuity warnings', () => {
  function validateSemesters(ids: number[]) {
    const graph: NormalisedGraph = {
      nodes: Object.fromEntries(ids.map(id => [`module-${id}`, moduleNode(`module-${id}`, `TEST${id}`)])),
      edges: [],
    };
    return validateSchedule({ semesters: ids.map(id => ({ id, moduleCodes: [`TEST${id}`] })) }, graph, ids.map(id => `TEST${id}`));
  }

  test.each([
    { ids: [0, 2, 4, 6] },
    { ids: [0, 1, 2, 4] },
    { ids: [1, 2, 3, 4] },
    { ids: [2, 4] },
    { ids: [] },
    { ids: [1] },
  ])('does not warn when only optional special terms are absent: $ids', ({ ids }) => {
    expect(validateSemesters(ids).warnings).toEqual([]);
  });

  test.each([
    [0, 4],
    [1, 3],
    [0, 3],
    [1, 4],
    [3, 5],
    [4, 8],
  ])('still reports a missing regular semester between %i and %i', (previous, next) => {
    expect(validateSemesters([previous, next]).warnings).toEqual([`Gap in semesters: ${previous} to ${next}`]);
  });
});
