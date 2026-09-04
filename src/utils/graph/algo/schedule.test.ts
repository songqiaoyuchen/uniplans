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
