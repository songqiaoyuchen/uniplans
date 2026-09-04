import type { EntityState } from "@reduxjs/toolkit";

import type { Semester } from "@/store/timetableSlice";
import {
  ModuleStatus,
  SemesterLabel,
  type Grade,
  type ModuleData,
  type PrereqTree,
} from "@/types/plannerTypes";

export const STARTER_TIMETABLE_NAME = "Example Plan";

type StarterModuleDefinition = {
  code: string;
  title: string;
  grade?: Grade;
  requires?: PrereqTree;
};

type StarterTimetableState = {
  modules: EntityState<ModuleData, string>;
  semesters: EntityState<Semester, number>;
};

const starterModuleDefinitions: StarterModuleDefinition[] = [
  { code: "CS1101S", title: "Programming Methodology", grade: "A-" },
  { code: "MA1521", title: "Calculus for Computing", grade: "B+" },
  { code: "GEA1000", title: "Quantitative Reasoning with Data", grade: "CS" },
  { code: "CS1231S", title: "Discrete Structures", grade: "A" },
  {
    code: "CS2030S",
    title: "Programming Methodology II",
    grade: "B+",
    requires: { type: "module", moduleCode: "CS1101S" },
  },
  { code: "IS1108", title: "Digital and AI Ethics", grade: "A-" },
  {
    code: "CS2040S",
    title: "Data Structures and Algorithms",
    requires: {
      type: "AND",
      children: [
        { type: "module", moduleCode: "CS1101S" },
        { type: "module", moduleCode: "CS1231S" },
      ],
    },
  },
  {
    code: "CS2100",
    title: "Computer Organisation",
    requires: { type: "module", moduleCode: "CS1101S" },
  },
  { code: "ES2660", title: "Communicating in the Information Age" },
  {
    code: "CS2103T",
    title: "Software Engineering",
    requires: {
      type: "AND",
      children: [
        { type: "module", moduleCode: "CS2030S" },
        { type: "module", moduleCode: "CS2040S" },
      ],
    },
  },
  { code: "CS2101", title: "Effective Communication for Computing Professionals" },
  {
    code: "CS2106",
    title: "Introduction to Operating Systems",
    requires: { type: "module", moduleCode: "CS2100" },
  },
  {
    code: "CS2102",
    title: "Database Systems",
    requires: {
      type: "AND",
      children: [
        { type: "module", moduleCode: "CS1231S" },
        {
          type: "OR",
          children: [
            { type: "module", moduleCode: "CS2030S" },
            { type: "module", moduleCode: "CS2040S" },
          ],
        },
      ],
    },
  },
];

const starterSemesters: Semester[] = [
  { id: 0, moduleCodes: ["CS1101S", "MA1521", "GEA1000"] },
  { id: 2, moduleCodes: ["CS1231S", "CS2030S", "IS1108"] },
  { id: 4, moduleCodes: ["CS2040S", "CS2100", "ES2660"] },
  { id: 6, moduleCodes: ["CS2103T", "CS2101", "CS2106", "CS2102"] },
];

function makeStarterModule(definition: StarterModuleDefinition): ModuleData {
  const isCompleted = definition.grade !== undefined && definition.grade !== "IP";

  return {
    id: `starter-${definition.code}`,
    code: definition.code,
    title: definition.title,
    credits: 4,
    semestersOffered: [SemesterLabel.First, SemesterLabel.Second],
    exam: null,
    preclusions: [],
    faculty: definition.code.startsWith("CS") ? "Computing" : undefined,
    department: definition.code.startsWith("CS") ? "Computer Science" : undefined,
    grade: definition.grade,
    requires: definition.requires,
    status: isCompleted ? ModuleStatus.Completed : ModuleStatus.Satisfied,
    issues: [],
  };
}

export function createStarterTimetableState(): StarterTimetableState {
  const modules = starterModuleDefinitions.map(makeStarterModule);

  return {
    modules: {
      ids: modules.map((module) => module.code),
      entities: Object.fromEntries(modules.map((module) => [module.code, module])),
    },
    semesters: {
      ids: starterSemesters.map((semester) => semester.id),
      entities: Object.fromEntries(
        starterSemesters.map((semester) => [semester.id, { ...semester, moduleCodes: [...semester.moduleCodes] }]),
      ),
    },
  };
}
