import { createAsyncThunk, createEntityAdapter, createSlice, EntityState, PayloadAction } from '@reduxjs/toolkit';
import { Grade, ModuleData, ModuleStatus } from "@/types/plannerTypes";
import { RootState } from '.';
import { apiSlice } from './apiSlice';
import { arrayMove } from '@dnd-kit/sortable';
import { checkModuleStates, CheckModuleStatesArgs, ModuleUpdatePayload } from '@/utils/planner/checkModuleStates';
import {
  DEFAULT_MCS_PER_SEMESTER,
  isAllowedMaxMcs,
  MAX_EXEMPTED_MODULES,
  MAX_TARGET_MODULES,
} from '@/constants/plannerLimits';

export interface Semester {
  id: number; // e.g., 0 for Y1S1, 1 for Y1Winter, 2 for Y1S2, 3 for Y1Summer
  moduleCodes: string[]; // ordered list of module codes
}

export interface TimetableSliceState {
  modules: EntityState<ModuleData, string>;
  semesters: EntityState<Semester, number>; 
  selectedModuleCode: string | null; // for Sidebar and TimetableModule
  draggedOverSemesterId: number | null; // for TimetableSemester
  isMinimalView: boolean // for Timetable
  isVerticalView: boolean // for Timetable
  useSpecialTerms: boolean; // for Scheduler
  maxMcsPerSemester: number; // for Scheduler
  preserveTimetable: boolean; // for Scheduler
  preserveSemesters: number; // for Scheduler
  targetModules: string[]; // list of target module codes for generation
  exemptedModules: string[]; // list of exempted module codes
}

export const modulesAdapter = createEntityAdapter({
  selectId: (m: ModuleData) => m.code,
});

export const semestersAdapter = createEntityAdapter({
  selectId: (s: Semester) => s.id,
});

const timetableSlice = createSlice({
  name: 'timetable',
  initialState: {
    modules: modulesAdapter.getInitialState(),
    semesters: semestersAdapter.getInitialState(),
    selectedModuleCode: null,
    draggedOverSemesterId: null,
    isMinimalView: false,
    isVerticalView: true,
    useSpecialTerms: true,
    maxMcsPerSemester: DEFAULT_MCS_PER_SEMESTER,
    preserveTimetable: false,
    preserveSemesters: 0,
    targetModules: [] as string[],
    exemptedModules: [],
  } as TimetableSliceState,
  reducers: {
    timetableLoaded(
      state,
      action: PayloadAction<{
        modules: ModuleData[];
        semesters: Semester[];
      }>
    ) {
      modulesAdapter.setAll(state.modules, action.payload.modules);
      semestersAdapter.setAll(state.semesters, action.payload.semesters);
      const scheduledCodes = new Set(action.payload.semesters.flatMap((semester) => semester.moduleCodes));
      state.exemptedModules = [...new Set(state.exemptedModules)].filter(
        (code) => !scheduledCodes.has(code)
      );
    },
    
    // handles adding a module to the timeable
    moduleAdded(
      state,
      action: PayloadAction<{ 
        module: ModuleData; 
        destSemesterId: number 
      }>
    ) {
      const { module, destSemesterId } = action.payload;

      const exists = state.modules.entities[module.code];
      if (!exists) { // defensive check
        modulesAdapter.addOne(state.modules, module);
      }

      const semester = state.semesters.entities[destSemesterId];
      if (semester && !semester.moduleCodes.includes(module.code)) { // defensive checks
        semester.moduleCodes.push(module.code);
        state.exemptedModules = state.exemptedModules.filter(code => code !== module.code);
      }
    },

    moduleCached(
      state,
      action: PayloadAction<{ 
        module: ModuleData; 
      }>
    ) {
      const { module } = action.payload;

      const exists = state.modules.entities[module.code];
      if (!exists) { // defensive check
        modulesAdapter.addOne(state.modules, module);
      }
    },

    semesterAdded: (state, action: PayloadAction<{ id: number }>) => {
      const { id } = action.payload;
      if (!state.semesters.entities[id]) {
        state.semesters.entities[id] = {
          id,
          moduleCodes: [],
        };
        state.semesters.ids.push(id);
      }
    },
    semesterRemoved: (state, action: PayloadAction<{ semesterId: number }>) => {
      const { semesterId } = action.payload;
      semestersAdapter.removeOne(state.semesters, semesterId);
    },


    // for intra-semester reordering only
    moduleReordered(
      state,
      action: PayloadAction<{
        semesterId: number;
        activeModuleCode: string;
        overModuleCode: string | null;
      }>
    ) {
      const { semesterId, activeModuleCode, overModuleCode } = action.payload;
      const sem = state.semesters.entities[semesterId];
      if (!sem) return;

      const oldIndex = sem.moduleCodes.indexOf(activeModuleCode);
      const newIndex = overModuleCode
        ? sem.moduleCodes.indexOf(overModuleCode)
        : sem.moduleCodes.length;

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      sem.moduleCodes = arrayMove(sem.moduleCodes, oldIndex, newIndex);
    },

    // for inter-semester moves only
    moduleMoved(
      state,
      action: PayloadAction<{
        activeModuleCode: string;
        overModuleCode: string | null;
        sourceSemesterId: number;
        destSemesterId: number;
      }>
    ) {
      const {
        activeModuleCode,
        overModuleCode,
        sourceSemesterId,
        destSemesterId,
      } = action.payload;

      if (sourceSemesterId === destSemesterId) return; // handled by moduleReordered

      const src = state.semesters.entities[sourceSemesterId];
      const dst = state.semesters.entities[destSemesterId];
      if (!src || !dst) return;

      // prevent duplication if dropped on empty area
      if (!overModuleCode || activeModuleCode === overModuleCode) {
        const stillPlanned = dst.moduleCodes.includes(activeModuleCode);
        if (stillPlanned) return;
      }

      // remove from source
      src.moduleCodes = src.moduleCodes.filter(code => code !== activeModuleCode);
      const termOffset = src.id % 4;
      const isSpecialTerm = termOffset === 1 || termOffset === 3;

      if (src.moduleCodes.length === 0 && isSpecialTerm) {
        // If no modules left, remove the semester
        semestersAdapter.removeOne(state.semesters, src.id);
      }

      // determine insert index in destination
      const insertIndex =
        overModuleCode && dst.moduleCodes.includes(overModuleCode)
          ? dst.moduleCodes.indexOf(overModuleCode)
          : dst.moduleCodes.length;

      dst.moduleCodes.splice(insertIndex, 0, activeModuleCode);
      state.exemptedModules = state.exemptedModules.filter(code => code !== activeModuleCode);
    },

    // for module removal
    moduleRemoved: (state, action: PayloadAction<{ moduleCode: string }>) => {
      const { moduleCode } = action.payload;

      // Remove from the modules entity
      modulesAdapter.removeOne(state.modules, moduleCode);

      // Remove the moduleCode from any semester.moduleCodes it's in
      Object.values(state.semesters.entities).forEach((semester) => {
        semester.moduleCodes = semester.moduleCodes.filter(code => code !== moduleCode);
        const termOffset = semester.id % 4;
        const isSpecialTerm = termOffset === 1 || termOffset === 3;
        if (semester.moduleCodes.length === 0 && isSpecialTerm) {
          // If no modules left, remove the semester
          semestersAdapter.removeOne(state.semesters, semester.id);
        }
      });

      // Deselect if the removed module was selected
      if (state.selectedModuleCode === moduleCode) {
        state.selectedModuleCode = null;
      }
    },

    // handles activeModuleCode
    moduleSelected(state, action: PayloadAction<string>) {
      state.selectedModuleCode = action.payload;
    },
    moduleUnselected(state) {
      state.selectedModuleCode = null;
    },

    // handles dragOverSemesterId
    semesterDraggedOverSet(state, action: PayloadAction<number>) {
      state.draggedOverSemesterId = action.payload
    },
    semesterDraggedOverCleared(state) {
      state.draggedOverSemesterId = null
    },

    // handles timetable view mode
    minimalViewToggled: (state) => {
      state.isMinimalView = !state.isMinimalView;
    },
    verticalViewToggled: (state) => {
      state.isVerticalView = !state.isVerticalView;
    },
    specialTermsToggled: (state) => {
      state.useSpecialTerms = !state.useSpecialTerms;
    },
    maxMcsUpdated(state, action: PayloadAction<number>) {
      if (isAllowedMaxMcs(action.payload)) {
        state.maxMcsPerSemester = action.payload;
      }
    },
    preserveTimetableToggled: (state) => {
      state.preserveTimetable = !state.preserveTimetable;
    },
    preserveSemestersUpdated(state, action: PayloadAction<number>) {
      state.preserveSemesters = action.payload;
    },
    // handles target modules
    targetModuleAdded: (state, action: PayloadAction<string>) => {
      const moduleCode = action.payload;
      if (!state.targetModules.includes(moduleCode)) {
        if (state.targetModules.length >= MAX_TARGET_MODULES) return;
        state.targetModules.push(moduleCode);
      }
      state.exemptedModules = state.exemptedModules.filter(
        (code) => code !== moduleCode
      );
    },
    targetModuleRemoved: (state, action: PayloadAction<string>) => {
      state.targetModules = state.targetModules.filter(code => code !== action.payload);
    },
    targetModulesCleared: (state) => {
      state.targetModules = [];
    },

    // handles exempted modules
    exemptedModuleAdded: (state, action: PayloadAction<string>) => {
      const moduleCode = action.payload;
      if (!state.exemptedModules.includes(moduleCode)) {
        if (state.exemptedModules.length >= MAX_EXEMPTED_MODULES) return;
        state.exemptedModules.push(moduleCode);
      }
      state.targetModules = state.targetModules.filter(
        (code) => code !== moduleCode
      );

      // Last explicit action wins: exemption removes every scheduled occurrence.
      for (const semester of Object.values(state.semesters.entities)) {
        semester.moduleCodes = semester.moduleCodes.filter(code => code !== moduleCode);
      }

      const emptySpecialTermIds = Object.values(state.semesters.entities)
        .filter((semester) => semester.moduleCodes.length === 0 && semester.id % 2 === 1)
        .map((semester) => semester.id);
      semestersAdapter.removeMany(state.semesters, emptySpecialTermIds);
    },
    exemptedModuleRemoved: (state, action: PayloadAction<string>) => {
      state.exemptedModules = state.exemptedModules.filter(code => code !== action.payload);
    },

    // handles module grades
    moduleGradeUpdated: (
      state, 
      action: PayloadAction<{ code: string; grade: Grade }>
    ) => {
      const { code, grade } = action.payload;
      
      // if completed grade, set status to Completed
      const newStatus = grade !== 'IP'
        ? ModuleStatus.Completed 
        : undefined

      modulesAdapter.updateOne(state.modules, {
        id: code,
        changes: {
          grade: grade,
          status: newStatus,
        }
      });
    },

    moduleTagsUpdated: (
      state,
      action: PayloadAction<{ code: string; tags: string[] }>
    ) => {
      const { code, tags } = action.payload;
      const mod = state.modules.entities[code];
      if (mod) {
        mod.tags = tags;
      }
    }
  },

  extraReducers: (builder) => {
    // update status when modules moved / added
    builder.addCase(updateModuleStates.fulfilled, (state, action) => {
      modulesAdapter.updateMany(state.modules, action.payload);
    });
    builder.addMatcher(
      apiSlice.endpoints.getTimetable.matchFulfilled,
      (state, action) => {
        // Ensure there are no gaps in EVEN semester IDs (main terms).
        // Odd semester IDs (special terms) are optional and only included if present.
        const incoming = action.payload.timetable.semesters ?? [];
        if (incoming.length > 0) {
          const presentById = new Map(incoming.map((s) => [s.id, s]));

          // Find all even ids present
          const evenIds = incoming.map((s) => s.id).filter((id) => id % 2 === 0);

          if (evenIds.length > 0) {
            const minEven = Math.min(...evenIds);
            const maxEven = Math.max(...evenIds);
            const normalized: { id: number; moduleCodes: string[] }[] = [];

            // Walk full range from minEven to maxEven and ensure every even id exists.
            for (let id = minEven; id <= maxEven; id++) {
              if (id % 2 === 0) {
                const found = presentById.get(id);
                normalized.push(found ?? { id, moduleCodes: [] });
              } else {
                // odd id: include only if present in incoming
                const found = presentById.get(id);
                if (found) normalized.push(found);
              }
            }

            semestersAdapter.setAll(state.semesters, normalized);
          } else {
            // No even semesters present — fall back to dense range behaviour
            const ids = incoming.map((s) => s.id);
            const minId = Math.min(...ids);
            const maxId = Math.max(...ids);
            const normalized: { id: number; moduleCodes: string[] }[] = [];
            for (let id = minId; id <= maxId; id++) {
              const found = presentById.get(id);
              normalized.push(found ?? { id, moduleCodes: [] });
            }
            semestersAdapter.setAll(state.semesters, normalized);
          }
        } else {
          semestersAdapter.setAll(state.semesters, []);
        }

        const incomingModuleCodes = new Set(
          incoming.flatMap((semester) => semester.moduleCodes)
        );
        state.exemptedModules = [...new Set(state.exemptedModules)].filter(
          (code) => !incomingModuleCodes.has(code)
        );

        const generationArgs = action.meta.arg.originalArgs;
        if (!generationArgs) {
          modulesAdapter.removeAll(state.modules);
          return;
        }

        const preservedModuleCodes = generationArgs.preserveTimetable
          ? new Set(Object.values(generationArgs.preservedData ?? {}).flat())
          : new Set<string>();
        // Generated timetables only contain module codes. Keep the existing
        // entities for explicitly preserved modules so dynamic metadata such as
        // grades and tags survives while the remaining modules are refetched.
        const moduleIdsToRemove = state.modules.ids.filter(
          (moduleCode) =>
            !preservedModuleCodes.has(moduleCode) ||
            !incomingModuleCodes.has(moduleCode)
        );
        modulesAdapter.removeMany(state.modules, moduleIdsToRemove);
      }
    );
  }
});

export const {
  timetableLoaded,
  moduleAdded,
  moduleCached,
  semesterAdded,
  semesterRemoved,
  moduleMoved,
  moduleReordered,
  moduleRemoved,
  moduleSelected,
  moduleUnselected,
  semesterDraggedOverSet,
  semesterDraggedOverCleared,
  minimalViewToggled,
  verticalViewToggled,
  specialTermsToggled,
  maxMcsUpdated,
  preserveTimetableToggled,
  preserveSemestersUpdated,
  targetModuleAdded,
  targetModuleRemoved,
  targetModulesCleared,
  exemptedModuleAdded,
  exemptedModuleRemoved,
  moduleGradeUpdated,
  moduleTagsUpdated,
} = timetableSlice.actions;

export default timetableSlice.reducer;
export const timetableActions = timetableSlice.actions;


// --- async thunks ---
export const updateModuleStates = createAsyncThunk<
  ModuleUpdatePayload[],
  void,                  
  { state: RootState }   
>(
  'timetable/updateModuleStates',
  async (_, { getState }) => {
    const state = getState();
    
    const { semesters: semesterEntities, modules: moduleEntities } = state.timetable;

    const args: CheckModuleStatesArgs = {
      semesterEntities: semesterEntities.entities,
      moduleEntities: moduleEntities.entities,
      exemptedModules: state.timetable.exemptedModules,
    };

    const deltas = checkModuleStates(args);

    return deltas;
  }
);
