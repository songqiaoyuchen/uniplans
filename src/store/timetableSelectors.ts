import { createSelector } from "reselect";
import { RootState } from ".";
import { modulesAdapter, semestersAdapter } from "./timetableSlice";
import { flattenPrereqTree } from "@/utils/planner/flattenPrereqTree";
import { GRADE_VALUES } from "@/types/plannerTypes";
import { matchesModuleCode } from '@/utils/prerequisites/evaluatePrerequisite';

// --- selectors ---
export const {
  selectIds: selectSemesterIds,
  selectById: selectSemesterById,
} = semestersAdapter.getSelectors((s: RootState) => s.timetable.semesters);

export const {
  selectById: selectModuleByCode,
} = modulesAdapter.getSelectors((s: RootState) => s.timetable.modules);

export const selectStudentContext = (state: RootState) => state.timetable.studentContext ?? null;
export const selectSelectedModuleCode = (state: RootState) => state.timetable.selectedModuleCode;
export const selectDraggedOverSemesterId = (state: RootState) => state.timetable.draggedOverSemesterId;
export const selectIsMinimalView = (state: RootState) => state.timetable.isMinimalView;

// --- memoized selectors / selector factories ---
export const makeSelectModuleCodesBySemesterId = (semesterId: number) =>
  createSelector(
    (state: RootState) => state.timetable.semesters.entities[semesterId]?.moduleCodes ?? [],
    (moduleCodes) => [...moduleCodes]
  );

export const makeIsModuleSelectedSelector = (moduleCode: string) =>
  createSelector([selectSelectedModuleCode], (selectedCode) => selectedCode === moduleCode);

export const makeIsSemesterDraggedOverSelector = (semesterId: number) =>
  createSelector([selectDraggedOverSemesterId], (draggedOverSemesterId) => draggedOverSemesterId === semesterId);

export const makeIsModulePlannedSelector = (moduleCode: string) =>
  createSelector(
    (state: RootState) => state.timetable.semesters.entities,
    (semesters) =>
      Object.values(semesters).some((semester) =>
        semester?.moduleCodes.includes(moduleCode)
      )
  );

export const makeSelectModuleStateByCode = (moduleCode: string) =>
  createSelector(
    [(state: RootState) => state.timetable.modules.entities[moduleCode]],
    (moduleState) =>
      moduleState ? { ...moduleState } : null
  );

export const makeSelectSemesterHeaderInfo = () =>
  createSelector(
    [
      (state: RootState) => state.timetable.semesters.entities,
      (state: RootState) => state.timetable.modules.entities,
      (_state: RootState, semesterId: number) => semesterId
    ],
    (semesters, modules, semesterId) => {
      const semester = semesters[semesterId];
      
      // Handle missing semester gracefully
      if (!semester) {
        return { moduleCount: 0, totalCredits: 0, semesterGpa: null };
      }
      
      let totalCredits = 0;
      let totalPoints = 0;
      let gradedCredits = 0;

      // Single pass loop for efficiency
      for (const code of semester.moduleCodes) {
        const mod = modules[code];
        if (!mod) continue;

        // 1. Accumulate Total Credits (Workload)
        // We default to 0 to be safe
        totalCredits += (mod.credits ?? 0);

        // 2. Accumulate GPA Points
        // Only if grade exists and maps to a numeric value (not null like CS/IP)
        if (mod.grade) {
          const points = GRADE_VALUES[mod.grade];
          
          if (points !== null) {
            totalPoints += points * (mod.credits ?? 0);
            gradedCredits += (mod.credits ?? 0);
          }
        }
      }

      // Calculate GPA, avoiding division by zero
      const semesterGpa = gradedCredits > 0 
        ? (totalPoints / gradedCredits) 
        : null;
      
      return { 
        moduleCount: semester.moduleCodes.length, 
        totalCredits, 
        semesterGpa 
      };
    }
  );

export const selectTotalCredits = createSelector(
  [
    (state: RootState) => state.timetable.semesters.entities, 
    (state: RootState) => state.timetable.modules.entities
  ],
  (semesters, modules) => {
    return Object.values(semesters).reduce((total, semester) => {
      return total + semester.moduleCodes.reduce((sum, code) => {
        const mod = modules[code];
        return sum + (mod ? mod.credits : 0);
      }, 0);
    }, 0);
  }
);

export const selectCgpa = createSelector(
  [
    (state: RootState) => state.timetable.semesters.entities,
    (state: RootState) => state.timetable.modules.entities
  ],
  (semesters, modules) => {
    let totalPoints = 0;
    let totalGradedCredits = 0;

    Object.values(semesters).forEach((semester) => {
      if (!semester) return;

      semester.moduleCodes.forEach((code) => {
        const mod = modules[code];
        // Skip if module not found, has no grade, or grade is invalid
        if (!mod || !mod.grade) return;

        const points = GRADE_VALUES[mod.grade];

        // Only calculate if points is not null (skips CS, CU, IP)
        if (points !== null) {
          totalPoints += points * mod.credits;
          totalGradedCredits += mod.credits;
        }
      });
    });

    // Return 0.00 if no graded modules exist to prevent NaN
    return totalGradedCredits === 0 ? 0 : totalPoints / totalGradedCredits;
  }
);

export const selectLatestNormalSemester = createSelector(
  [(state: RootState) => state.timetable.semesters.entities],
  (semesters) => {
    const normalSemesters = Object.values(semesters).filter(
      (s) => s.id % 2 === 0
    );
    if (normalSemesters.length === 0) return 0;

    return normalSemesters.reduce((latest, current) =>
      current.id > latest.id ? current : latest
    ).id;
  }
);

export const makeIsModuleRelatedSelector = (code: string) =>
  createSelector(
    [
      (state: RootState) => state.timetable.selectedModuleCode,
      (state: RootState) => state.timetable.modules.entities,
      selectStudentContext,
    ],
    (selectedCode, modules, studentContext) => {
      if (!selectedCode || code === selectedCode) return false;

      const selectedModule = modules[selectedCode];
      if (!selectedModule) return false;

      const forwardSet = flattenPrereqTree(selectedModule.requires, studentContext);

      const isForward = [...forwardSet].some(pattern => matchesModuleCode(pattern, code));
      const isReverse = Object.values(modules).some((mod) => {
        if (!mod?.requires) return false;
        const prereqs = flattenPrereqTree(mod.requires, studentContext);
        return [...prereqs].some(pattern => matchesModuleCode(pattern, selectedCode)) && mod.code === code;
      });

      return isForward || isReverse;
    }
  );
