/**
 * Main scheduler coordinator - clean implementation from scratch.
 * Handles semester-by-semester planning with snapshot-based availability.
 */

import { NormalisedGraph, Semester, TimetableData } from '@/types/graphTypes';
import { initialise } from './initialise';
import { selectModulesForSemester} from './select';
import { calculateAvailableModules } from './update';
import { MAX_SEMESTERS } from './constants';
import { validateSchedule, generateValidationReport } from './check';
import { isModuleData } from './constants';
import { cleanSemesters } from './clean';

/**
 * Runs the complete scheduling algorithm.
 */
export function runScheduler(
  graph: NormalisedGraph,
  targetModules: string[] = [], // module codes
  exemptedModules: string[] = [], // module codes
  useSpecialTerms: boolean = true,
  maxMcsPerSemester: number = 20,
  preservedTimetable: Record<number, string[]> = {}
): TimetableData {
  
  // Build a map from node id to its edges
  const edgeMap: Record<string, { out: string[]; in: string[] }> = {};

  for (const nodeId of Object.keys(graph.nodes)) {
    edgeMap[nodeId] = { out: [], in: [] };
  }

  for (const edge of graph.edges) {
    // edge.to is prerequisite for edge.from
    edgeMap[edge.from].out.push(edge.to);    // 'from' requires 'to' (prerequisite)
    edgeMap[edge.to].in.push(edge.from);     // 'to' unlocks 'from' (dependent)
  }
  
  // Convert module codes to IDs
  const codeToIdMap = new Map<string, string>();
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (isModuleData(node)) {
      codeToIdMap.set(node.code, id);
    }
  }

  // Convert target and completed modules from codes to IDs
  const targetIds = targetModules.map(code => codeToIdMap.get(code)).filter(Boolean) as string[];
  const exemptedIds = exemptedModules.map(code => codeToIdMap.get(code)).filter(Boolean) as string[];

  // Convert preserved modules to IDs
  const preservedIds: string[] = [];
  Object.values(preservedTimetable).flat().forEach(code => {
    // Try exact match first, then uppercase
    let id = codeToIdMap.get(code);
    if (!id) {
      id = codeToIdMap.get(code.toUpperCase());
    }
    if (id) preservedIds.push(id);
  });

  const missingTargets = targetModules.filter(code => !codeToIdMap.has(code));
  if (missingTargets.length > 0) {
    throw new Error(`Target modules not found in graph: ${missingTargets.join(', ')}`);
  }
    
  // Initialize planner state
  // Treat preserved modules as exempted (already completed) for the purpose of state initialization
  const plannerState = initialise(graph, edgeMap, [...exemptedIds, ...preservedIds]);

  const targetSet = new Set(targetIds);
  
  // Pre-fill semesters with preserved data
  const semesters: Semester[] = [];
  let maxPreservedSemester = -1;
  
  for (const [semStr, codes] of Object.entries(preservedTimetable)) {
    const semId = Number.parseInt(semStr, 10);
    if (Number.isNaN(semId)) continue;
    semesters.push({ id: semId, moduleCodes: Array.isArray(codes) ? codes : [] });
    if (semId > maxPreservedSemester) maxPreservedSemester = semId;
  }

  // Sort semesters to ensure order
  semesters.sort((a, b) => a.id - b.id);

  // Start scheduling from the next available semester
  const startSemester = maxPreservedSemester + 1;

  for (let semester = startSemester; semester <= MAX_SEMESTERS; semester++) {
    // Check if all targets completed
    const allTargetsPlanned = targetIds.every((id) =>
      plannerState.completedModules.has(id)
    );

    if (allTargetsPlanned) {
      console.log(`All target modules completed by semester ${semester}. Stopping planning.`);
      break;
    }
      
    // Calculate available modules snapshot for this semester
    const availableThisSemester = calculateAvailableModules(semester, plannerState, edgeMap, graph, useSpecialTerms);
    
    if (availableThisSemester.size === 0) {
      console.log(`No available modules for semester ${semester}. Skipping to next.`);
      continue;
    }

    // Select modules for this semester
    const selectedModuleIds = selectModulesForSemester(
      availableThisSemester,
      plannerState,
      edgeMap,
      codeToIdMap,
      graph,
      targetSet,
      maxMcsPerSemester
    );

    // Build semester data - collect all codes for this semester
    const semesterCodes: string[] = [];
    for (const moduleId of selectedModuleIds) {
      plannerState.completedModules.add(moduleId);
      const node = graph.nodes[moduleId];
      if (isModuleData(node)) {
        semesterCodes.push(node.code);
      }
    }
    
    // Only add semester if it has modules
    if (semesterCodes.length > 0) {
      semesters.push({ 
        id: semester, 
        moduleCodes: semesterCodes 
      });
    }
  }

  // Ensure preserved modules are kept during cleanup
  const cleanupTargets = new Set([...targetModules, ...Object.values(preservedTimetable).flat()]);
  const cleanedSemesters = cleanSemesters(semesters, graph, cleanupTargets);

  const timetableData: TimetableData = { semesters: cleanedSemesters };

  const validation = validateSchedule(timetableData, graph, targetModules, maxMcsPerSemester);
  const report = generateValidationReport(validation, maxMcsPerSemester);
  console.log('Validation Report:', report);

  return timetableData;
}