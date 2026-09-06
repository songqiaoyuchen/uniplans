import { Semester, NormalisedGraph } from '@/types/graphTypes';
import { isModuleData, isNofNode } from './constants';

/**
 * Removes scheduled modules that are not part of a concrete prerequisite
 * witness for a target. For N-of-M nodes, only N satisfiable, distinct choices
 * are retained; already-preserved or exempted choices are preferred.
 */
export function cleanSemesters(
  semesters: Semester[],
  graph: NormalisedGraph,
  targetModules: Set<string>,
  preservedModules: Set<string> = new Set(),
  exemptedModules: Set<string> = new Set(),
): Semester[] {
  const codeToId = new Map<string, string>();
  const children = new Map<string, string[]>();

  for (const [id, node] of Object.entries(graph.nodes)) {
    children.set(id, []);
    if (isModuleData(node)) codeToId.set(node.code, id);
  }

  for (const edge of graph.edges) {
    const nodeChildren = children.get(edge.from) ?? [];
    nodeChildren.push(edge.to);
    children.set(edge.from, nodeChildren);
  }

  const scheduledIds = new Set(
    semesters
      .flatMap((semester) => semester.moduleCodes)
      .map((code) => codeToId.get(code))
      .filter((id): id is string => Boolean(id)),
  );
  const preservedIds = new Set(
    [...preservedModules]
      .map((code) => codeToId.get(code))
      .filter((id): id is string => Boolean(id)),
  );
  const exemptedIds = new Set(
    [...exemptedModules]
      .map((code) => codeToId.get(code))
      .filter((id): id is string => Boolean(id)),
  );

  const memo = new Map<string, Set<string> | null>();

  const findWitness = (nodeId: string, visiting = new Set<string>()): Set<string> | null => {
    if (memo.has(nodeId)) return memo.get(nodeId) ?? null;
    if (visiting.has(nodeId)) return null;

    const node = graph.nodes[nodeId];
    if (!node) return null;

    const nextVisiting = new Set(visiting).add(nodeId);

    if (isModuleData(node)) {
      if (!scheduledIds.has(nodeId) && !exemptedIds.has(nodeId)) {
        memo.set(nodeId, null);
        return null;
      }

      const witness = new Set<string>();
      if (!exemptedIds.has(nodeId)) witness.add(nodeId);
      if (exemptedIds.has(nodeId) || preservedIds.has(nodeId)) {
        memo.set(nodeId, witness);
        return witness;
      }

      for (const prerequisiteId of new Set(children.get(nodeId) ?? [])) {
        const prerequisiteWitness = findWitness(prerequisiteId, nextVisiting);
        if (!prerequisiteWitness) {
          memo.set(nodeId, null);
          return null;
        }
        prerequisiteWitness.forEach((id) => witness.add(id));
      }

      memo.set(nodeId, witness);
      return witness;
    }

    if (!isNofNode(node)) return null;

    const candidates = [...new Set(children.get(nodeId) ?? [])]
      .map((childId, index) => ({ childId, index, witness: findWitness(childId, nextVisiting) }))
      .filter((candidate): candidate is { childId: string; index: number; witness: Set<string> } =>
        candidate.witness !== null
      )
      .sort((left, right) => {
        const leftCost = [...left.witness].filter((id) => !preservedIds.has(id)).length;
        const rightCost = [...right.witness].filter((id) => !preservedIds.has(id)).length;
        return leftCost - rightCost || left.witness.size - right.witness.size || left.index - right.index;
      });

    if (candidates.length < node.n) {
      memo.set(nodeId, null);
      return null;
    }

    const witness = new Set<string>();
    for (const candidate of candidates.slice(0, node.n)) {
      candidate.witness.forEach((id) => witness.add(id));
    }
    memo.set(nodeId, witness);
    return witness;
  };

  const retainedIds = new Set<string>(preservedIds);
  for (const code of targetModules) {
    const targetId = codeToId.get(code);
    if (!targetId || !scheduledIds.has(targetId)) continue;

    retainedIds.add(targetId);
    for (const prerequisiteId of new Set(children.get(targetId) ?? [])) {
      findWitness(prerequisiteId)?.forEach((id) => retainedIds.add(id));
    }
  }

  return semesters
    .map((semester) => ({
      ...semester,
      moduleCodes: semester.moduleCodes.filter((code) => {
        if (preservedModules.has(code)) return true;
        const id = codeToId.get(code);
        return Boolean(id && retainedIds.has(id));
      }),
    }))
    .filter((semester) => semester.moduleCodes.length > 0);
}
