// check.ts
/**
 * Validates a generated timetable against scheduling constraints.
 * Checks for duplicate modules, prerequisite satisfaction,
 * credit limits, and target module completion.
 **/

import { NormalisedGraph, TimetableData, ValidationResult } from '@/types/graphTypes';
import { isNofNode, isModuleData, MAX_MCS_PER_SEMESTER } from './constants';

/**
 * Validates that a generated timetable satisfies all constraints
 */
export function validateSchedule(
  timetable: TimetableData,
  graph: NormalisedGraph,
  targetModules: string[],
  maxMcsPerSemester: number = MAX_MCS_PER_SEMESTER
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const bySemester: Record<number, Array<{code: string, semester: number}>> = {};
  const flatTimetable: Array<{code: string, semester: number}> = [];
  
  for (const semester of timetable.semesters) {
    bySemester[semester.id] = [];
    for (const moduleCode of semester.moduleCodes) {
      const item = { code: moduleCode, semester: semester.id };
      bySemester[semester.id].push(item);
      flatTimetable.push(item);
    }
  }

  // Track completed modules as we go through semesters
  const completedModules = new Set<string>();
  const moduleToNode = new Map<string, string>();
  const logicNodeStatus = new Map<string, { satisfied: boolean; count: number; requires: number }>();
  
  // Build module code to node ID mapping and initialize logic node status
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (isModuleData(node)) {
      moduleToNode.set(node.code, id);
    } else if (isNofNode(node)) {
      logicNodeStatus.set(id, { satisfied: false, count: 0, requires: node.n });
    }
  }

  // Check for duplicate modules
  const allModules = flatTimetable.map(item => item.code);
  const duplicates = allModules.filter((code, index) => allModules.indexOf(code) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate modules scheduled: ${[...new Set(duplicates)].join(', ')}`);
  }

  // Validate each semester
  let maxCredits = 0;
  const semesters = Object.keys(bySemester).map(Number).sort((a, b) => a - b);
  
  for (const semester of semesters) {
    const modules = bySemester[semester];
    let semesterCredits = 0;
        
    // Get modules being taken in this semester (cannot be used as prerequisites)
    const currentSemesterModules = new Set(modules.map(m => m.code));

    // Check prerequisites for each module in this semester
    for (const { code } of modules) {
      const nodeId = moduleToNode.get(code);
      
      if (!nodeId) {
        errors.push(`Module ${code} in semester ${semester} not found in graph`);
        continue;
      }
      
      const node = graph.nodes[nodeId];
      if (!isModuleData(node)) {
        errors.push(`Node for ${code} is not a module`);
        continue;
      }
      
      const credits = node.credits || 4;
      semesterCredits += credits;
      
      // Check prerequisites - modules point TO their prerequisites
      const prerequisites = graph.edges.filter(e => e.from === nodeId);
      
      for (const prereq of prerequisites) {
        const prereqNode = graph.nodes[prereq.to];
        
        if (isModuleData(prereqNode)) {
          // Direct prerequisite: must be completed in a PREVIOUS semester
          if (!completedModules.has(prereqNode.code)) {
            errors.push(`Module ${code} taken in semester ${semester} but prerequisite ${prereqNode.code} not completed`);
          }
          // Additional check: cannot be satisfied by module in same semester
          if (currentSemesterModules.has(prereqNode.code)) {
            errors.push(`Module ${code} taken in semester ${semester} but prerequisite ${prereqNode.code} is also taken in the same semester`);
          }
        } else if (isNofNode(prereqNode)) {
          // Logic node prerequisite: check if N-of-M requirement is satisfied by PREVIOUS semesters only
          const logicStatus = logicNodeStatus.get(prereq.to);
          if (!logicStatus?.satisfied) {
            // Check if this logic node could be satisfied by modules in current semester
            const logicOptions = graph.edges.filter(e => e.from === prereq.to);
            const currentSemesterCanSatisfy = logicOptions.some(opt => {
              const optNode = graph.nodes[opt.to];
              return isModuleData(optNode) && currentSemesterModules.has(optNode.code);
            });
            
            if (currentSemesterCanSatisfy) {
              errors.push(`Module ${code} taken in semester ${semester} but prerequisite logic node cannot be satisfied by modules in the same semester`);
            } else {
              const logicNodeLabel = getLogicNodeLabel(graph, prereq.to);
              errors.push(`Module ${code} taken in semester ${semester} but prerequisite logic node ${logicNodeLabel} not satisfied`);
            }
          }
        }
      }
    }
    
    // Check credit limit
    if (semesterCredits > maxMcsPerSemester) {
      errors.push(`Semester ${semester} has ${semesterCredits} MCs, exceeding limit of ${maxMcsPerSemester}`);
    }
    
    maxCredits = Math.max(maxCredits, semesterCredits);
    
    // Mark modules as completed AFTER checking prerequisites
    for (const { code } of modules) {
      completedModules.add(code);
    }

    // Update logic node satisfaction after completing all modules in this semester
    updateLogicNodeSatisfaction(graph, logicNodeStatus, completedModules);
  }

  // Check if all target modules were completed
  const completedTargets = targetModules.filter(code => completedModules.has(code));
  const missingTargets = targetModules.filter(code => !completedModules.has(code));
  
  if (missingTargets.length > 0) {
    errors.push(`Target modules not completed: ${missingTargets.join(', ')}`);
  }

  // Check for modules that appear in timetable but aren't in graph
  for (const { code } of flatTimetable) {
    if (!moduleToNode.has(code)) {
      warnings.push(`Module ${code} in timetable but not found in graph`);
    }
  }

  // Check semester continuity
  if (semesters.length > 0) {
    for (let i = 1; i < semesters.length; i++) {
      if (semesters[i] !== semesters[i-1] + 1) {
        warnings.push(`Gap in semesters: ${semesters[i-1]} to ${semesters[i]}`);
      }
    }
  }

  const stats = {
    totalModules: flatTimetable.length,
    totalSemesters: semesters.length,
    totalCredits: flatTimetable.reduce((sum, item) => {
      const node = graph.nodes[moduleToNode.get(item.code) || ''];
      return sum + (isModuleData(node) ? (node.credits || 4) : 4);
    }, 0),
    maxCreditsInSemester: maxCredits,
    targetModulesCompleted: completedTargets.length,
    targetModulesTotal: targetModules.length
  };

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    stats
  };
}

/**
 * Updates logic node satisfaction based on completed modules
 */
function updateLogicNodeSatisfaction(
  graph: NormalisedGraph,
  logicNodeStatus: Map<string, { satisfied: boolean; count: number; requires: number }>,
  completedModules: Set<string>
): void {
  // Keep updating until no more changes occur (handle nested logic nodes)
  let changed = true;
  while (changed) {
    changed = false;
    
    for (const [logicId, status] of logicNodeStatus) {
      if (status.satisfied) continue;
      
      const logicNode = graph.nodes[logicId];
      if (!isNofNode(logicNode)) continue;
      
      let count = 0;
      // Logic nodes point TO their options
      const options = graph.edges.filter(e => e.from === logicId);
      
      for (const edge of options) {
        const optionNode = graph.nodes[edge.to];
        
        if (isModuleData(optionNode) && completedModules.has(optionNode.code)) {
          count++;
        } else if (isNofNode(optionNode) && logicNodeStatus.get(edge.to)?.satisfied) {
          count++;
        }
      }
      
      if (count !== status.count) {
        status.count = count;
        changed = true;
      }
      
      if (count >= status.requires && !status.satisfied) {
        status.satisfied = true;
        changed = true;
      }
    }
  }
}

/**
 * Generates a detailed report of the validation results
 */
export function generateValidationReport(result: ValidationResult, maxMcsPerSemester: number = MAX_MCS_PER_SEMESTER): string {
  const lines: string[] = [];
    
  lines.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}\n`);
  
  lines.push('Statistics:');
  lines.push(`  - Total modules: ${result.stats.totalModules}`);
  lines.push(`  - Total semesters: ${result.stats.totalSemesters}`);
  lines.push(`  - Total credits: ${result.stats.totalCredits}`);
  lines.push(`  - Max credits in a semester: ${result.stats.maxCreditsInSemester}/${maxMcsPerSemester}`);
  lines.push(`  - Target modules completed: ${result.stats.targetModulesCompleted}/${result.stats.targetModulesTotal}`);
  lines.push('');
  
  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    result.errors.forEach((error, i) => {
      lines.push(`  ${i + 1}. ${error}`);
    });
    lines.push('');
  }
  
  if (result.warnings.length > 0) {
    lines.push(`Warnings (${result.warnings.length}):`);
    result.warnings.forEach((warning, i) => {
      lines.push(`  ${i + 1}. ${warning}`);
    });
    lines.push('');
  }
  
  lines.push('=== END OF REPORT ===');
  
  return lines.join('\n');
}

function getLogicNodeLabel(graph: NormalisedGraph, logicId: string): string {
  const logicNode = graph.nodes[logicId];
  if (logicNode && isNofNode(logicNode)) {
    const options = graph.edges
      .filter(e => e.from === logicId)
      .map(e => {
        const optNode = graph.nodes[e.to];
        if (isModuleData(optNode)) return optNode.code;
        if (isNofNode(optNode)) return `LOGIC-${e.to}`;
        return e.to;
      });
    return `LOGIC-${logicId} [needs ${logicNode.n} of: ${options.join(', ')}]`;
  }
  return `LOGIC-${logicId}`;
}