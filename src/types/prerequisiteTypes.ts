export type StudentContext = {
  cohortYear: number | null;
  programmeType: string | null;
};

export const PROGRAMME_TYPES = [
  "Undergraduate Degree",
  "Graduate Degree Coursework",
  "Graduate Degree Research",
  "CPE (Certificate)",
] as const;

export const EMPTY_STUDENT_CONTEXT: StudentContext = Object.freeze({
  cohortYear: null,
  programmeType: null,
});

export type PrerequisiteRule = "MUST_BE_IN" | "IF_IN";

export type PrerequisiteCondition =
  | { kind: "cohort"; rule: PrerequisiteRule; years: string[] }
  | { kind: "programType"; rule: PrerequisiteRule; types: string[] };

export type PrerequisiteNode =
  | { type: "module"; moduleCode: string; minimumGrade?: string }
  | { type: "AND" | "OR"; children: PrerequisiteNode[] }
  | { type: "NOF"; n: number; children: PrerequisiteNode[] }
  | { type: "condition"; condition: PrerequisiteCondition }
  | { type: "conditional"; condition: PrerequisiteCondition; then: PrerequisiteNode }
  | { type: "constant"; value: boolean }
  | { type: "blocked"; reason: string; moduleCode?: string };

export type RawPrerequisiteNode =
  | null
  | string
  | { and: RawPrerequisiteNode[] }
  | { or: RawPrerequisiteNode[] }
  | { nOf: [number, RawPrerequisiteNode[]] }
  | {
      cohort: { rule: PrerequisiteRule; years: string[] };
      then?: RawPrerequisiteNode;
    }
  | {
      programType: { rule: PrerequisiteRule; types: string[] };
      then?: RawPrerequisiteNode;
    };

export type PrerequisiteDiagnostic = {
  moduleCode?: string;
  path: string;
  reason: string;
};
