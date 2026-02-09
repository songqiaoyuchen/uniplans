/**
 * @path src/utils/planner/checkModuleStates.ts
 * @description check the modules in timetable for issues and prerequisites
 */

import { isEqual } from 'lodash';
import {
  ModuleStatus,
  ModuleIssue,
  PrereqTree,
  ModuleData,
  SemesterLabel,
  StaticModuleData,
} from '@/types/plannerTypes';
import { Semester } from '@/store/timetableSlice';

export interface CheckModuleStatesArgs {
  semesterEntities: Record<number, Semester>;
  moduleEntities: Record<string, ModuleData>;
  exemptedModules: string[];
}
export type ModuleUpdatePayload = {
  id: string;
  changes: Pick<ModuleData, 'status' | 'issues'>;
};

export function checkModuleStates(
  args: CheckModuleStatesArgs
): ModuleUpdatePayload[] {
  const { semesterEntities, moduleEntities, exemptedModules } = args;

  // Map each planned module to its semester
  const moduleToSemester = new Map<string, number>();
  Object.values(semesterEntities).forEach(sem => {
    sem.moduleCodes.forEach(code => moduleToSemester.set(code, sem.id));
  });

  // Build conflict issues for all modules
  const conflictMap = buildIssuesMap(moduleEntities, moduleToSemester);

  // Track seen modules to evaluate prerequisites
  const modulesSeen: Record<string, ModuleStatus> = {};

  // Track computed states for comparison later
  const newStates: Record<string, { status: ModuleStatus; issues: ModuleIssue[] }> = {};

  for (const code of exemptedModules) {
    modulesSeen[code] = ModuleStatus.Satisfied;
  }

  // Process semesters in order
  const semesterIds = Object.keys(semesterEntities)
    .map(Number)
    .sort((a, b) => a - b);

  for (const semesterId of semesterIds) {
    const semester = semesterEntities[semesterId];
    if (!semester) continue;

    // Hold computed results for this semester
    const semesterResults: Record<string, { status: ModuleStatus; issues: ModuleIssue[] }> = {};

    for (const code of semester.moduleCodes) {
      const current = moduleEntities[code];
      if (!current) continue;

      const mod = moduleEntities[code];
      let status: ModuleStatus;
      let issues: ModuleIssue[] = conflictMap.get(code) || [];

      if (current.status === ModuleStatus.Completed) {
        status = ModuleStatus.Completed;
        issues = []; // Completed clears all issues
      } else {
        // Start with any known conflict issues
        issues = conflictMap.get(code) || [];

        // Always check for prereq satisfaction
        const prereqSatisfied = !mod?.requires || evaluatePrereqTree(
          mod.requires,
          (prereqRaw) => {
            const prereq = stripQualifier(prereqRaw);
            // Support wildcard prerequisites like "EC%", "MA2*" etc.
            if (hasWildcard(prereq)) {
              for (const [seenCode, seenStatus] of Object.entries(modulesSeen)) {
                if (
                  matchesWildcard(prereq, seenCode) &&
                  (seenStatus === ModuleStatus.Completed || seenStatus === ModuleStatus.Satisfied)
                ) {
                  return true;
                }
              }
              return false;
            }

            const seen = modulesSeen[prereq];
            return seen === ModuleStatus.Completed || seen === ModuleStatus.Satisfied;
          },
          (patternRaw) => {
            const pattern = stripQualifier(patternRaw);
            if (!hasWildcard(pattern)) {
              const ok = modulesSeen[pattern];
              return ok === ModuleStatus.Completed || ok === ModuleStatus.Satisfied ? 1 : 0;
            }
            let count = 0;
            for (const [seenCode, seenStatus] of Object.entries(modulesSeen)) {
              if (
                matchesWildcard(pattern, seenCode) &&
                (seenStatus === ModuleStatus.Completed || seenStatus === ModuleStatus.Satisfied)
              ) {
                count += 1;
              }
            }
            return count;
          }
        );

        if (!prereqSatisfied) {
          issues.push({ type: 'PrereqUnsatisfied' });
        }

        // Decide status
        if ((conflictMap.get(code)?.length ?? 0) > 0) {
          status = ModuleStatus.Conflicted;
        } else if (!prereqSatisfied) {
          status = ModuleStatus.Unsatisfied;
        } else {
          status = ModuleStatus.Satisfied;
        }
      }


      semesterResults[code] = { status, issues };
    }

    // After all modules in this semester are evaluated, commit them
    for (const [code, result] of Object.entries(semesterResults)) {
      newStates[code] = result;
      modulesSeen[code] = result.status;
    }
  }


  // Compare against current state and collect deltas
  const updates: ModuleUpdatePayload[] = [];
  for (const [code, current] of Object.entries(moduleEntities)) {
    let { status, issues } = newStates[code] || {
      status: ModuleStatus.Satisfied,
      issues: [],
    };

    // clear issues for completed modules
    if (current.status === ModuleStatus.Completed) {
      status = ModuleStatus.Completed;
      issues = [];
    }

    if (status !== current.status || !isEqual(current.issues, issues)) {
      updates.push({ id: code, changes: { status, issues } });
    }
  }

  return updates;
}



// --- Helper Functions ---

/**
 * @param staticModulesData: Record of moduleCode to static info
 * @param moduleToSemesterMap: Map of moduleCode to its planned semester
 * @returns examClashMap: Map of moduleCodes to an array of moduleCodes that it clashes with
 */
function buildExamClashMap(
  moduleData: Record<string, ModuleData>,
  moduleToSemesterMap: Map<string, number>
): Map<string, string[]> {

  type ExamWindow = {
    start: number;
    end: number;
    code: string;
  };

  const examsBySemester: Record<number, ExamWindow[]> = {};
  const clashMap = new Map<string, string[]>();

  // collect exam windows
  for (const code of moduleToSemesterMap.keys()) {
    const mod = moduleData[code];
    const semId = moduleToSemesterMap.get(code);
    if (mod?.exam && semId !== undefined) {
      const start = new Date(mod.exam.startTime).getTime();
      const end = start + mod.exam.durationMinutes * 60 * 1000;

      if (!examsBySemester[semId]) examsBySemester[semId] = [];
      examsBySemester[semId].push({ start, end, code });
    }
  }

  // detect overlaps within each semester
  for (const windows of Object.values(examsBySemester)) {
    windows.sort((a, b) => a.start - b.start);
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const a = windows[i];
        const b = windows[j];

        // we are allowing back-to-back exams here
        if (b.start > a.end) break; 
        if (a.start < b.end && b.start < a.end) {
          if (!clashMap.has(a.code)) clashMap.set(a.code, []);
          if (!clashMap.has(b.code)) clashMap.set(b.code, []);
          clashMap.get(a.code)!.push(b.code);
          clashMap.get(b.code)!.push(a.code);
        }
      }
    }
  }

  return clashMap;
}

/**
 * @param staticModulesData: Record of moduleCode to static info
 * @param moduleToSemesterMap: Map of moduleCode to its planned semester
 * @returns issuesMap: Map of moduleCodes to an array of ModuleIssues containing all Conflicts
 */
function buildIssuesMap(
  staticModulesData: Record<string, StaticModuleData>,
  moduleToSemesterMap: Map<string, number>,
): Map<string, ModuleIssue[]> {
  // calling helper to build ExamClash conflicts
  const examClashes = buildExamClashMap(staticModulesData, moduleToSemesterMap);
  const issuesMap = new Map<string, ModuleIssue[]>();

  for (const code of moduleToSemesterMap.keys()) {
    const mod = staticModulesData[code];
    const issues: ModuleIssue[] = [];

    const semId = moduleToSemesterMap.get(code)!;
    const actualSem = semId % 4 as SemesterLabel;
    if (!mod.semestersOffered.includes(actualSem)) {
      issues.push({ type: 'InvalidSemester' });
    }

    // Only check precluded modules in semesters <= current module's semester
    const precluded = mod.preclusions.filter(p => {
      const precludedSemId = moduleToSemesterMap.get(p);
      return precludedSemId !== undefined && precludedSemId <= semId;
    });
    if (precluded.length > 0) {
      issues.push({ type: 'Precluded', with: precluded });
    }

    const clashes = examClashes.get(code);
    if (clashes && clashes.length > 0) {
      issues.push({ type: 'ExamClash', with: clashes });
    }

    if (issues.length > 0) {
      issuesMap.set(code, issues);
    }
  }

  return issuesMap;
}

/**
 * Recursively evaluate a prerequisite tree against a satisfaction predicate
 */
function evaluatePrereqTree(
  tree: PrereqTree,
  isSatisfied: (code: string) => boolean,
  countMatches: (code: string) => number
): boolean {
  switch (tree.type) {
  case 'module':
    return isSatisfied(tree.moduleCode);
  case 'AND':
    return tree.children.every(ch => evaluatePrereqTree(ch, isSatisfied, countMatches));
  case 'OR':
    return tree.children.some(ch => evaluatePrereqTree(ch, isSatisfied, countMatches));
  case 'NOF': {
    // Count satisfied children; wildcard module children count all matching satisfied modules
    let count = 0;
    for (const ch of tree.children) {
      if (ch.type === 'module' && hasWildcard(stripQualifier(ch.moduleCode))) {
        count += countMatches(ch.moduleCode);
      } else {
        count += evaluatePrereqTree(ch, isSatisfied, countMatches) ? 1 : 0;
      }
    }
    return count >= (tree.n ?? 1);
  }
  default:
    return false;
  }
}

/**
 * Wildcard helpers: support '%' (SQL-like) and '*' as multi-char wildcards.
 * Examples: 'EC%' matches 'EC3303', 'MA2*' matches 'MA2101'.
 */
function hasWildcard(pattern: string): boolean {
  return pattern.includes('%') || pattern.includes('*');
}

function matchesWildcard(pattern: string, candidate: string): boolean {
  // Escape regex special chars except our wildcards
  const escaped = pattern
    .replace(/[.+^${}()|\[\]\\]/g, '\\$&')
    .replace(/[%\*]/g, '.*');
  const re = new RegExp(`^${escaped}$`, 'i');
  return re.test(candidate);
}

// Remove trailing grade/qualifier like ':D', ':C' from prerequisite tokens
function stripQualifier(token: string): string {
  const idx = token.indexOf(':');
  return idx >= 0 ? token.slice(0, idx) : token;
}