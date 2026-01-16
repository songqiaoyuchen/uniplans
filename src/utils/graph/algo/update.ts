import { EdgeMap, NormalisedGraph, PlannerState } from '@/types/graphTypes';
import { isModuleData, isNofNode } from './constants';
import { SemesterLabel } from '@/types/plannerTypes';

/**
 * Calculate snapshot of modules available for a semester.
 * Only updated at semester start.
 */
export function calculateAvailableModules(
  currentSemester: number,
  plannerState: PlannerState,
  edgeMap: EdgeMap,
  graph: NormalisedGraph,
  useSpecialTerms: boolean = true
): Set<string> {
  const available = new Set<string>();

  // Map semester ID to actual semester type
  // 0 = Y1S1, 1 = Y1Winter, 2 = Y1S2, 3 = Y1Summer, 4 = Y2S1, etc.
  const semesterType = currentSemester % 4;
  const isSpecialTerm = semesterType === 1 || semesterType === 3;

  // If special terms are disabled and this is a special term, return empty set
  if (!useSpecialTerms && isSpecialTerm) {
    return available;
  }

  for (const [moduleId, node] of Object.entries(graph.nodes)) {
    if (!isModuleData(node)) continue;
    
    // Skip if already completed
    if (plannerState.completedModules.has(moduleId) || plannerState.redundantModules.has(moduleId)) continue;

    // Check if all prerequisites are satisfied before adding to available
    const prerequisites = edgeMap[moduleId]?.out || [];

    const allPrereqsSatisfied = prerequisites.every((prereqId) => {
      const prereqNode = graph.nodes[prereqId];
      if (!prereqNode) return false;
      // Module prereq: must already be completed
      if (isModuleData(prereqNode)) {
        return plannerState.completedModules.has(prereqId);
      }
      // Any logic node prereq (NOF/AND/OR): use tracked satisfaction state
      const status = plannerState.logicStatus[prereqId];
      return Boolean(status?.satisfied);
    });
    
    const actualSem = semesterType === 0 ? SemesterLabel.First 
            : semesterType === 1 ? SemesterLabel.SpecialTerm1
            : semesterType === 2 ? SemesterLabel.Second
            : SemesterLabel.SpecialTerm2;
    const isOffered = node.semestersOffered.some((sem) => sem === actualSem);

    if (allPrereqsSatisfied && isOffered) {
      available.add(moduleId);
    }
  }

  return available;
}
