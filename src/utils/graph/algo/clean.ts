import { Semester, NormalisedGraph } from '@/types/graphTypes';
import { isModuleData } from './constants';

/**
 * Removes unnecessary modules from the timetable.
 * A module is kept if it is in the target set or if it is a prerequisite
 * (directly or indirectly) of a kept module.
 */
export function cleanSemesters(
  semesters: Semester[],
  graph: NormalisedGraph,
  targetModules: Set<string>
): Semester[] {
  const moduleCodeToId = new Map<string, string>();
  const outgoingEdges = new Map<string, string[]>();

  // Build maps
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (isModuleData(node)) {
      moduleCodeToId.set(node.code, id);
    }
    outgoingEdges.set(id, []);
  }

  // In NormalisedGraph, edges are directed from Dependent -> Prerequisite
  // (based on check.ts: "modules point TO their prerequisites")
  for (const edge of graph.edges) {
    if (!outgoingEdges.has(edge.from)) {
      outgoingEdges.set(edge.from, []);
    }
    outgoingEdges.get(edge.from)!.push(edge.to);
  }

  // Convert target modules to IDs
  const targetNodeIds = new Set<string>();
  for (const code of targetModules) {
    const id = moduleCodeToId.get(code);
    if (id) targetNodeIds.add(id);
  }

  const prerequisiteSet = new Set<string>();

  // Helper to add prerequisites recursively
  const addPrerequisites = (nodeId: string) => {
    const prereqs = outgoingEdges.get(nodeId) || [];
    for (const prereqId of prereqs) {
      if (!prerequisiteSet.has(prereqId)) {
        prerequisiteSet.add(prereqId);
        
        const node = graph.nodes[prereqId];
        // If it's not a module (i.e., it's a LogicNode), we must recurse immediately
        // to find the underlying modules that satisfy it.
        if (node && !isModuleData(node)) {
          addPrerequisites(prereqId);
        }
      }
    }
  };

  const newSemesters: Semester[] = [];
  // Iterate backwards from the last semester
  const reversedSemesters = [...semesters].reverse();

  for (const semester of reversedSemesters) {
    const keptModules: string[] = [];
    
    for (const moduleCode of semester.moduleCodes) {
      const id = moduleCodeToId.get(moduleCode);
      
      // Always keep if it's explicitly in the target set (which includes preserved modules)
      // This ensures preserved modules are kept even if they aren't in the graph
      if (targetModules.has(moduleCode)) {
        keptModules.push(moduleCode);
        if (id) addPrerequisites(id);
        continue;
      }

      if (id) {
        const isTarget = targetNodeIds.has(id);
        const isPrereq = prerequisiteSet.has(id);
        
        if (isTarget || isPrereq) {
          keptModules.push(moduleCode);
          // Add prerequisites for this kept module
          addPrerequisites(id);
        }
      }
    }
    
    if (keptModules.length > 0) {
      newSemesters.push({
        ...semester,
        moduleCodes: keptModules
      });
    }
  }

  return newSemesters.reverse();
}
