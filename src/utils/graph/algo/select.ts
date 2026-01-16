/**
 * Module selection with greedy scoring.
 * Built from scratch for clarity and correctness.
 */

import { EdgeMap, NormalisedGraph, PlannerState } from '@/types/graphTypes';
import { isModuleData, isNofNode, MAX_MCS_PER_SEMESTER } from './constants';

/**
 * Selects modules for a single semester using greedy scoring.
 */
export function selectModulesForSemester(
  availableSnapshot: Set<string>, // Now contains IDs
  plannerState: PlannerState,
  edgeMap: EdgeMap,
  codetoIdMap: Map<string, string>, // Map from code to ID
  graph: NormalisedGraph,
  targetModules: Set<string>, // Now contains IDs
  maxMcsPerSemester: number
): string[] {
  const selected: string[] = [];
  let usedCredits = 0;

  // Create working copy of available modules
  const remainingModules = new Set(availableSnapshot);

  while (remainingModules.size > 0 && usedCredits < maxMcsPerSemester) {
    // Find best module (O(n) optimization)
    const bestModuleId = findBestModule(remainingModules, plannerState, edgeMap, graph, targetModules);

    if (!bestModuleId) break;

    const node = graph.nodes[bestModuleId];
    if (!isModuleData(node)) throw new Error("Node is not ModuleData");
    
    // Check if this module is precluded by any already completed modules
    let isPrecluded = false;
    
    for (const completedModuleId of plannerState.completedModules) {
      const completedNode = graph.nodes[completedModuleId];
      if (isModuleData(completedNode) && node.preclusions.includes(completedNode.code)) {
        isPrecluded = true;
        console.log(`Module ${node.code} is precluded because completed module ${completedNode.code} is in its preclusions`);
        break;
      }
      if (isModuleData(completedNode) && completedNode.preclusions.includes(node.code)) {
        isPrecluded = true;
        console.log(`Module ${node.code} is precluded because it is in the preclusions of completed module ${completedNode.code}`);
        break;
      }
    }
    
    // If this module is precluded by completed modules, skip it
    if (isPrecluded) {
      remainingModules.delete(bestModuleId);
      plannerState.redundantModules.add(bestModuleId);
      continue;
    }
    
    const credits = node.credits || 4;

    // Prevent exceeding MCS limit
    if (usedCredits + credits > maxMcsPerSemester) break;

    // Select the module
    selected.push(bestModuleId);
    usedCredits += credits;
    remainingModules.delete(bestModuleId);
    
    // Handle exam clashes
    const selectedModuleData = graph.nodes[bestModuleId];
    if (!isModuleData(selectedModuleData)) {
      throw new Error("Selected module is a logic node, not ModuleData");
    }

    if (selectedModuleData?.exam) {
      // Check all remaining modules for exam clashes with the selected module
      for (const remainingId of Array.from(remainingModules)) {
        const remainingModuleData = graph.nodes[remainingId];
        
        if (!isModuleData(remainingModuleData)) {
          continue;
        }
        
        if (remainingModuleData?.exam) {
          // Check if exams clash (overlap in time)
          const selectedStart = new Date(selectedModuleData.exam.startTime).getTime();
          const selectedEnd = selectedStart + selectedModuleData.exam.durationMinutes * 60 * 1000;
          
          const remainingStart = new Date(remainingModuleData.exam.startTime).getTime();
          const remainingEnd = remainingStart + remainingModuleData.exam.durationMinutes * 60 * 1000;
          
          // Check for overlap (allowing back-to-back exams)
          if (selectedStart < remainingEnd && remainingStart < selectedEnd) {
            remainingModules.delete(remainingId);
            plannerState.redundantModules.add(remainingId);
          }
        }
      }
    }
    
    plannerState.completedModules.add(bestModuleId);

    // Immediately update logic satisfaction to prevent redundant selections
    updateLogicSatisfaction(bestModuleId, plannerState, edgeMap, graph);
  }

  return selected;
}

/**
 * Finds the best module using pure impact scoring (O(n)).
 */
function findBestModule(
  available: Set<string>, // Now contains IDs
  plannerState: PlannerState,
  edgeMap: EdgeMap,
  graph: NormalisedGraph,
  targetModules: Set<string> // Now contains IDs
): string | null {
  let bestModule: string | null = null;
  let bestImpact = -1;

  for (const moduleId of available) {
    const impact = calculateValue(moduleId, plannerState, edgeMap, graph, targetModules);
    
    if (impact > bestImpact) {
      bestImpact = impact;
      bestModule = moduleId;
    }
  }

  return bestModule;
}

// /**
//  * Pure impact scoring: targets = 1.0, others based on path to targets.
//  */
// function calculateImpact(
//   moduleId: string, // Now expects ID
//   plannerState: PlannerState,
//   edgeMap: EdgeMap,
//   graph: NormalisedGraph,
//   targetModules: Set<string> // Now contains IDs
// ): number {
//   // Target modules get maximum impact
//   if (targetModules.has(moduleId)) {
//     return 100;
//   }

//   let totalImpact = 0;

//   // All modules have a parent logic node
//   // Find logic nodes that have this module as a requirement
//   if (!edgeMap[moduleId]) {
//     throw new Error(`Module ${moduleId} not found in edgeMap`);
//   }
//   const parentLogicNodes = edgeMap[moduleId].in || [];

//   for (const logicNode of parentLogicNodes) {
//     // If parent logic is already satisfied, zero additional impact
//     if (plannerState.logicStatus[logicNode]?.satisfied) continue;

//     const unlockValue = calculateUnlockValue(logicNode, edgeMap, graph, targetModules, plannerState);
    
//     totalImpact += unlockValue;
//   }

//   return totalImpact;
// }

// /**
//  * Calculate the value of satisfying a logic node (what it unlocks toward targets).
//  */
// function calculateUnlockValue(
//   logicId: string,
//   edgeMap: EdgeMap,
//   graph: NormalisedGraph,
//   targetModules: Set<string>,
//   plannerState: PlannerState
// ): number {
//   // Find what modules/logics require this logic node
//   const unlockedNodes = edgeMap[logicId].in || [];

//   let unlockValue = 0;

//   for (const nodeId of unlockedNodes) {
//     const node = graph.nodes[nodeId];
    
//     if (isModuleData(node)) {
//       // Direct target unlock
//       // if (targetModules.has(nodeId)) {
//       //   unlockValue += 100;  // High value for direct target unlock
//       // } else {
//       //   unlockValue += 0;  // Some value for unlocking any module
//       // }
//       unlockValue += 0.8 * calculateImpact(nodeId, plannerState, edgeMap, graph, targetModules);
//     } else if (isNofNode(node)) {
//       // Recursively calculate value of unlocking this logic
//       unlockValue += calculateUnlockValue(nodeId, edgeMap, graph, targetModules, plannerState);
//     }
//   }

//   return unlockValue;
// }

function calculateValue(
  startID: string,
  plannerState: PlannerState,
  edgeMap: EdgeMap,
  graph: NormalisedGraph,
  targetModules: Set<string>,
): number {
  // Store [CurrentID, Depth]
  const stack = [] as Array<[string, number]>; 
  const visited = new Set<string>(); // CRITICAL ADDITION
  
  let score = 0;
  
  stack.push([startID, 0]);
  visited.add(startID);

  while (stack.length > 0) {
    const [currentID, depth] = stack.pop() as [string, number]; // Renamed variable

    const node = graph.nodes[currentID];

    // 1. Score Calculation
    // If we reached a module that is a target, score it.
    // Note: This includes the starting module itself if it is a target.
    if (isModuleData(node) && targetModules.has(currentID)) {
      score += 100 * Math.pow(0.8, depth); 
    }

    // 2. Traversal
    // Get parents (nodes that require the current node)
    const parents = edgeMap[currentID]?.in || [];

    for (const parentID of parents) {
      // STOP if we've seen this parent in this specific search
      if (visited.has(parentID)) continue;

      const parentNode = graph.nodes[parentID];

      // STOP if this path is blocked by an already satisfied requirement.
      // If the parent is a Logic Node and it is already satisfied, 
      // adding more modules to it yields 0 marginal value.
      if (isNofNode(parentNode)) {
         const status = plannerState.logicStatus[parentID];
         if (status?.satisfied) continue;
      }

      visited.add(parentID);
      stack.push([parentID, depth + 1]);
    }
  }

  const startCode = isModuleData(graph.nodes[startID]) ? graph.nodes[startID].code : startID;
  const isGradModule = (code: string) => /^[a-zA-Z]*[56].*$/.test(code);
  if (isGradModule(startCode)) {
    score *= 0.1; // Deprioritise grad modules slightly
  }

  return score;
}

/**
 * Immediately update logic satisfaction when a module is selected.
 */
export function updateLogicSatisfaction(
  selectedModuleId: string,
  plannerState: PlannerState,
  edgeMap: EdgeMap,
  graph: NormalisedGraph
): void {
  // Find parent logic nodes and start cascading updates
  const parentLogics = edgeMap[selectedModuleId].in || [];

  const toCheck = new Set(parentLogics);

  while (toCheck.size > 0) {
    // Get and remove first item
    const iterator = toCheck.values();
    const logicId = iterator.next().value as string;
    toCheck.delete(logicId);

    const logicStatus = plannerState.logicStatus[logicId];
    const logicNode = graph.nodes[logicId];
    
    // If logic is already satisfied or not a logic node, skip
    if (!logicStatus || logicStatus.satisfied || !isNofNode(logicNode)) {
      continue;
    }

    logicStatus.satisfiedCount += 1;

    if (logicStatus.satisfiedCount >= logicStatus.requires) {
      logicStatus.satisfied = true;
      plannerState.satisfiedLogicNodes.add(logicId);

      // Recursively check its parents too
      const grandparentLogics = edgeMap[logicId].in || [];

      for (const parentId of grandparentLogics) {
          toCheck.add(parentId);
      }
    }
  }
}