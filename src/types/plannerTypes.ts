// Normalized module data used by planner state and UI components.
export type ModuleData = StaticModuleData & DynamicModuleData;

export type DynamicModuleData = {
  plannedSemester?: number | null; // e.g. 5 = y3s2, 0 = y1s1 NO LONGER IN USE
  grade?: Grade; // e.g. A+, B, C, etc.
  status?: ModuleStatus;
  issues?: ModuleIssue[];
  tags?: string[];
};

export type StaticModuleData = {
  id: string; // neo4j node id or uuid
  code: string; // e.g. CS1101S
  title: string; // e.g. Data Structures and Algorithms
  credits: number; // number of MC
  semestersOffered: SemesterLabel[]; // e.g. ["First", "Second"]
  exam: Exam | null;
  preclusions: string[]; // module codes
  description?: string; // optional description
  faculty?: string; // optional faculty name
  department?: string; // optional department name
  requires?: PrereqTree; // module codes that this module requires (e.g. CS1010)
  unlocks?: string[]; // module codes that this module unlocks (e.g. CS1101S)
}


export type MiniModuleData = {
  code: string; // e.g. CS1101S
  title: string; // e.g. Data Structures and Algorithms
};

export type Exam = {
  startTime: string; // ISO 8601 format (e.g. '2025-12-01T09:00:00Z')
  durationMinutes: number;
};

export enum SemesterLabel {
  First,
  SpecialTerm1,
  Second,
  SpecialTerm2,
}

export enum ModuleStatus {
  Completed = 'Completed', // override status, disable checking
  Satisfied = 'Satisfied', // green status, no issues, can be taken in that semester
  Unsatisfied = 'Unsatisfied', // yellow status, prereq got issues
  Conflicted = 'Conflicted', // red, conflicted due to [exam clash, invalid sem, perclusion]
}

export type PrereqTree =
  | { type: "module"; moduleCode: string }
  | { type: "AND"; children: PrereqTree[] }
  | { type: "OR"; children: PrereqTree[] }
  | { type: "NOF"; n: number; children: PrereqTree[] };

export type ModuleIssue =
  | { type: 'PrereqUnsatisfied'}
  | { type: 'Precluded'; with: string[] }
  | { type: 'InvalidSemester' }
  | { type: 'ExamClash'; with: string[] }

export type Grade = 
  | "A+" | "A" | "A-" 
  | "B+" | "B" | "B-" 
  | "C+" | "C" 
  | "D+" | "D" 
  | "CS"
  | "IP";

// The GPA Mapping
// We use 'null' for grades that do not count towards GPA
export const GRADE_VALUES: Record<Grade, number | null> = {
  "A+": 5.0,
  "A":  5.0,
  "A-": 4.5,
  "B+": 4.0,
  "B":  3.5,
  "B-": 3.0,
  "C+": 2.5,
  "C":  2.0,
  "D+": 1.5,
  "D":  1.0,
  "CS": null, // Credits counted, GPA ignored
  "IP": null  // In Progress: ignore everything
};

// helper to check if a module is "Completed" based on grade
export const isCompletedGrade = (grade?: Grade | null): boolean => {
  if (!grade || grade === "IP") return false;
  return true;
};

export const AVAIL_GRADES = Object.keys(GRADE_VALUES) as Grade[];

export type TimetableSnapshot = {
  version: 1;
  semesters: string[][];                 // module codes per semester ID
  modules: Pick<ModuleData, "id" | "code" | "tags">[];
};
