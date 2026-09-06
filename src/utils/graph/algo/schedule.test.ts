import { NormalisedGraph } from '@/types/graphTypes';
import { ModuleData, SemesterLabel } from '@/types/plannerTypes';
import { cleanSemesters } from './clean';
import { initialise } from './initialise';
import { runScheduler } from './schedule';
import { selectModulesForSemester } from './select';

function moduleNode(id: string, code: string, semestersOffered = Object.values(SemesterLabel).filter(
  (value): value is SemesterLabel => typeof value === 'number'
)): ModuleData {
  return {
    id,
    code,
    title: code,
    credits: 4,
    semestersOffered,
    exam: null,
    preclusions: [],
  };
}

function edgeMapFor(graph: NormalisedGraph) {
  const edgeMap: Record<string, { out: string[]; in: string[] }> = {};
  Object.keys(graph.nodes).forEach((id) => {
    edgeMap[id] = { out: [], in: [] };
  });
  graph.edges.forEach((edge) => {
    edgeMap[edge.from].out.push(edge.to);
    edgeMap[edge.to].in.push(edge.from);
  });
  return edgeMap;
}

describe('scheduler choice handling', () => {
  test('preserved A satisfying A OR B neither schedules nor retains B', () => {
    const graph: NormalisedGraph = {
      nodes: {
        A: moduleNode('A', 'A'),
        B: moduleNode('B', 'B'),
        T: moduleNode('T', 'T'),
        choice: { id: 'choice', type: 'NOF', n: 1 },
      },
      edges: [
        { id: 't-choice', from: 'T', to: 'choice' },
        { id: 'choice-a', from: 'choice', to: 'A' },
        { id: 'choice-b', from: 'choice', to: 'B' },
      ],
    };

    const result = runScheduler(graph, ['T'], [], true, 20, { 0: ['A'] });
    const scheduled = result.timetable.semesters.flatMap((semester) => semester.moduleCodes);

    expect(scheduled).toEqual(['A', 'T']);
    expect(scheduled).not.toContain('B');

    const cleaned = cleanSemesters(
      [
        { id: 0, moduleCodes: ['A'] },
        { id: 1, moduleCodes: ['B'] },
        { id: 2, moduleCodes: ['T'] },
      ],
      graph,
      new Set(['T']),
      new Set(['A']),
    );
    expect(cleaned.flatMap((semester) => semester.moduleCodes)).toEqual(['A', 'T']);
  });

  test('zero-impact modules are not selected', () => {
    const graph: NormalisedGraph = {
      nodes: { unused: moduleNode('unused', 'UNUSED') },
      edges: [],
    };
    const edgeMap = edgeMapFor(graph);
    const plannerState = initialise(graph, edgeMap, []);

    const selected = selectModulesForSemester(
      new Set(['unused']),
      plannerState,
      edgeMap,
      new Map([['UNUSED', 'unused']]),
      graph,
      new Set(),
      20,
    );

    expect(selected).toEqual([]);
    expect(plannerState.completedModules).not.toContain('unused');
  });

  test('duplicate exempted and preserved identity counts once for N-of-M', () => {
    const graph: NormalisedGraph = {
      nodes: {
        A: moduleNode('A', 'A'),
        B: moduleNode('B', 'B', []),
        T: moduleNode('T', 'T', [SemesterLabel.SpecialTerm1]),
        threshold: { id: 'threshold', type: 'NOF', n: 2 },
      },
      edges: [
        { id: 't-threshold', from: 'T', to: 'threshold' },
        { id: 'threshold-a', from: 'threshold', to: 'A' },
        { id: 'threshold-b', from: 'threshold', to: 'B' },
      ],
    };
    const edgeMap = edgeMapFor(graph);

    // This is the merged scheduler input when A is both exempted and preserved.
    const plannerState = initialise(graph, edgeMap, ['A', 'A']);

    expect(plannerState.logicStatus.threshold.satisfiedCount).toBe(1);
    expect(plannerState.logicStatus.threshold.satisfiedChildren).toEqual(new Set(['A']));
    expect(plannerState.logicStatus.threshold.satisfied).toBe(false);

    const result = runScheduler(graph, ['T'], ['A'], true, 20, { 0: ['A'] });
    expect(result.timetable.semesters.flatMap((semester) => semester.moduleCodes))
      .not.toContain('T');
  });
});

describe('cleanup of prerequisite chains backed by trusted history', () => {
  const prerequisiteChain = (): NormalisedGraph => ({
    nodes: {
      foundation: moduleNode('foundation', 'RE1702', []),
      dao: moduleNode('dao', 'DAO2702'),
      daoX: moduleNode('daoX', 'DAO2702X'),
      dba: moduleNode('dba', 'DBA3701'),
      target: moduleNode('target', 'MA4254'),
      daoRequirement: { id: 'daoRequirement', type: 'NOF', n: 1 },
      daoXRequirement: { id: 'daoXRequirement', type: 'NOF', n: 1 },
      choice: { id: 'choice', type: 'NOF', n: 1 },
      targetRequirement: { id: 'targetRequirement', type: 'NOF', n: 1 },
    },
    edges: [
      ['target', 'targetRequirement'], ['targetRequirement', 'dba'],
      ['dba', 'choice'], ['choice', 'dao'], ['choice', 'daoX'],
      ['dao', 'daoRequirement'], ['daoRequirement', 'foundation'],
      ['daoX', 'daoXRequirement'], ['daoXRequirement', 'foundation'],
    ].map(([from, to], index) => ({ id: String(index), from, to })),
  });

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  describe.each(['exempted', 'preserved', 'both'] as const)('%s prerequisites', (history) => {
    test.each(['DAO2702', 'DAO2702X'])('retains DBA3701 before MA4254 when %s has unmet historical prerequisites', (code) => {
      const preserved: Record<number, string[]> = history === 'exempted' ? {} : { 0: [code] };
      const exempted = history === 'preserved' ? [] : [code];
      const result = runScheduler(prerequisiteChain(), ['MA4254'], exempted, false, 20, preserved);
      const semesters = result.timetable.semesters;
      const expected = history === 'exempted' ? ['DBA3701', 'MA4254'] : [code, 'DBA3701', 'MA4254'];

      expect(result.validation.errors).toEqual([]);
      expect(result.isValid).toBe(true);
      expect(semesters.flatMap(semester => semester.moduleCodes)).toEqual(expected);
      expect(semesters.find(semester => semester.moduleCodes.includes('DBA3701'))!.id)
        .toBeLessThan(semesters.find(semester => semester.moduleCodes.includes('MA4254'))!.id);
    });
  });

  test('an exempted module can satisfy a chain even when its own requirement is explicitly blocked', () => {
    const graph = prerequisiteChain();
    graph.nodes.daoRequirement = { id: 'daoRequirement', type: 'NOF', n: 1, blockedReason: 'Historical prerequisite unavailable' };
    graph.edges = graph.edges.filter(edge => edge.from !== 'daoRequirement');
    const result = runScheduler(graph, ['MA4254'], ['DAO2702'], false, 20);
    expect(result.isValid).toBe(true);
    expect(result.timetable.semesters.flatMap(semester => semester.moduleCodes)).toEqual(['DBA3701', 'MA4254']);
  });

  test('untrusted modules still need their own prerequisites', () => {
    const result = runScheduler(prerequisiteChain(), ['MA4254'], [], false, 20);
    expect(result.isValid).toBe(false);
    expect(result.timetable.semesters.flatMap(semester => semester.moduleCodes)).not.toContain('MA4254');
  });
});
