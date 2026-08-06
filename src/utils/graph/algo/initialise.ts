/**
 * Initializes the planner state by analyzing the graph structure.
 * Identifies initially available modules, sets up logic node tracking,
 * and establishes the starting conditions for scheduling.
 */
import { NormalisedGraph, LogicStatus, PlannerState, EdgeMap } from '@/types/graphTypes';
import { isNofNode } from './constants';
import { updateLogicSatisfaction } from './select';

export function initialise(
  graph: NormalisedGraph,
  edgeMap: EdgeMap,
  exemptedIds: string[]
): PlannerState {
  const distinctExemptedIds = [...new Set(exemptedIds)];
  const availableModules = new Set<string>();
  // Exempted modules are effectively completed and satisfy prerequisites
  const completedModules = new Set<string>(distinctExemptedIds);
  const redundantModules = new Set<string>(distinctExemptedIds);

  // Satisfaction status of logic nodes
  const logicStatus: Record<string, LogicStatus> = {};
  const satisfiedLogicNodes = new Set<string>();

  // Initialize all logic nodes with 0 count first
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (isNofNode(node)) {
      const satisfied = node.n === 0;
      logicStatus[id] = {
        satisfied,
        requires: node.n,
        satisfiedCount: 0,
        satisfiedChildren: new Set<string>(),
      };
      if (satisfied) satisfiedLogicNodes.add(id);
    }
  }

  const plannerState: PlannerState = { 
    availableModules, 
    completedModules, 
    redundantModules, 
    logicStatus, 
    satisfiedLogicNodes 
  };

  // Now propagate the effect of all exempted/preserved modules
  // This ensures that logic nodes (AND/OR) are correctly updated based on the history
  for (const moduleId of distinctExemptedIds) {
    updateLogicSatisfaction(moduleId, plannerState, edgeMap, graph);
  }

  return plannerState;
}
