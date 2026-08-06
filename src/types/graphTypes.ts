// src/types/graphTypes.ts

import { ModuleData } from "./plannerTypes";

export type LogicNode = OrNode | AndNode | NofNode;

export type OrNode = { id: string; type: "OR" };
export type AndNode = { id: string; type: "AND" };
export type NofNode = { id: string; type: "NOF"; n: number };

export type Edge = {
  id: string;
  from: string;
  to: string;
};

export type EdgeMap = {
  [key: string]: EdgeMapEntry;
}

export type EdgeMapEntry = {
  out: string[];
  in: string[];
}

export type FormattedGraph = {
  nodes: Record<string, ModuleData | LogicNode>;
  relationships: Edge[];
};

export type NormalisedGraph = {
  nodes: Record<string, ModuleData | NofNode>;
  edges: Edge[];
};

export type FinalGraph = {
  nodes: Record<string, ModuleData>;
  edges: Edge[];
};

export type LogicStatus = {
  satisfied: boolean;
  requires: number;
  satisfiedCount: number;
  satisfiedChildren: Set<string>;
};

export type PlannerState = {
  availableModules: Set<string>;
  redundantModules: Set<string>;
  completedModules: Set<string>;
  logicStatus: Record<string, LogicStatus>;
  satisfiedLogicNodes: Set<string>;
};

export interface ScoredModule {
  code: string;
  score: number;
  nodeId: string;
}
export interface ChainLengthInfo {
  maxChainToTarget: number;
  maxChainFromStart: number;
  criticalPathLength: number;
}

export type TimetableData = {
  semesters: Semester[];
}

export type Semester = {
  id: number;
  moduleCodes: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalModules: number;
    totalSemesters: number;
    totalCredits: number;
    maxCreditsInSemester: number;
    targetModulesCompleted: number;
    targetModulesTotal: number;
  };

}
export type TimetableGenerationResult = {
  timetable: TimetableData;
  isValid: boolean;
  validation: ValidationResult;
};
