import type { NormalisedGraph } from '@/types/graphTypes';
import type { ModuleData } from '@/types/plannerTypes';
import { runScheduler } from './schedule';

const course = (id: string, code: string): ModuleData => ({
  id, code, title: code, credits: 4, semestersOffered: [0, 2], exam: null, preclusions: [],
});

function competingPaths(direction: 'alternative' | 'target' = 'alternative'): NormalisedGraph {
  const alternative = course('alternative', 'MA3252');
  const target = course('dba', 'DBA3701');
  if (direction === 'alternative') alternative.preclusions = ['DBA3701'];
  else target.preclusions = ['MA3252'];
  return {
    nodes: {
      alternative,
      ma: course('ma', 'MA4254'),
      dba: target,
      math: course('math', 'MA2001'),
      dao: course('dao', 'DAO2702'),
      foundation: course('foundation', 'RE1702'),
      alternativeRequirement: { id: 'alternativeRequirement', type: 'NOF', n: 1 },
      maRequirement: { id: 'maRequirement', type: 'NOF', n: 1 },
      dbaRequirement: { id: 'dbaRequirement', type: 'NOF', n: 1 },
      daoRequirement: { id: 'daoRequirement', type: 'NOF', n: 1 },
    },
    edges: [
      ['alternative', 'alternativeRequirement'], ['alternativeRequirement', 'math'],
      ['ma', 'maRequirement'], ['maRequirement', 'alternative'], ['maRequirement', 'dba'],
      ['dba', 'dbaRequirement'], ['dbaRequirement', 'dao'],
      ['dao', 'daoRequirement'], ['daoRequirement', 'foundation'],
    ].map(([from, to], index) => ({ id: String(index), from, to })),
  };
}

describe('preclusions against requested targets', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  describe.each(['alternative', 'target'] as const)('preclusion listed on the %s', direction => {
    test.each([
      { targets: ['MA4254', 'DBA3701'], history: 'exempted' },
      { targets: ['DBA3701', 'MA4254'], history: 'exempted' },
      { targets: ['MA4254', 'DBA3701'], history: 'preserved' },
      { targets: ['DBA3701', 'MA4254'], history: 'preserved' },
    ])('protects $targets with $history mathematics prerequisites', ({ targets, history }) => {
      const preserved: Record<number, string[]> = history === 'preserved' ? { 0: ['MA2001'] } : {};
      const exempted = history === 'exempted' ? ['MA2001'] : [];
      const result = runScheduler(competingPaths(direction), targets, exempted, false, 20, preserved);
      const scheduled = result.timetable.semesters.flatMap(semester => semester.moduleCodes);
      expect(result.validation.errors).toEqual([]);
      expect(result.isValid).toBe(true);
      expect(scheduled).toEqual(expect.arrayContaining(['RE1702', 'DAO2702', 'DBA3701', 'MA4254']));
      expect(scheduled).not.toContain('MA3252');
      const semesterOf = (code: string) => result.timetable.semesters.find(semester => semester.moduleCodes.includes(code))!.id;
      expect(semesterOf('DAO2702')).toBeLessThan(semesterOf('DBA3701'));
      expect(semesterOf('DBA3701')).toBeLessThan(semesterOf('MA4254'));
    });
  });

  test('protects a later target even without exemptions or preserved semesters', () => {
    const graph = competingPaths();
    graph.nodes.foundation = { ...course('foundation', 'RE1702'), semestersOffered: [2] };
    const result = runScheduler(graph, ['MA4254', 'DBA3701'], [], false, 20);
    expect(result.isValid).toBe(true);
    const scheduled = result.timetable.semesters.flatMap(semester => semester.moduleCodes);
    expect(scheduled).toEqual(expect.arrayContaining(['DBA3701', 'MA4254']));
    expect(scheduled).not.toContain('MA3252');
  });

  test('still permits the alternative when DBA3701 is not a target', () => {
    const result = runScheduler(competingPaths(), ['MA4254'], ['MA2001'], false, 20);
    expect(result.isValid).toBe(true);
    expect(result.timetable.semesters.flatMap(semester => semester.moduleCodes)).toEqual(['MA3252', 'MA4254']);
  });

  test('does not waive a target preclusion against completed history', () => {
    const result = runScheduler(competingPaths(), ['DBA3701'], ['MA3252'], false, 20);
    expect(result.isValid).toBe(false);
    expect(result.timetable.semesters.flatMap(semester => semester.moduleCodes)).not.toContain('DBA3701');
  });

  test('does not manufacture a valid plan for mutually precluded targets', () => {
    const result = runScheduler(competingPaths(), ['MA3252', 'DBA3701'], ['MA2001'], false, 20);
    expect(result.isValid).toBe(false);
    const scheduled = result.timetable.semesters.flatMap(semester => semester.moduleCodes);
    expect(scheduled.includes('MA3252') && scheduled.includes('DBA3701')).toBe(false);
  });

  test('does not mistake a self-referential preclusion for another target', () => {
    const target = course('target', 'DAO2702');
    target.preclusions = ['DAO2702'];
    const result = runScheduler({ nodes: { target }, edges: [] }, ['DAO2702'], [], false, 20);
    expect(result.isValid).toBe(true);
    expect(result.timetable.semesters.flatMap(semester => semester.moduleCodes)).toEqual(['DAO2702']);
  });
});
