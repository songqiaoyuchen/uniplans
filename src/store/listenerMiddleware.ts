import { createListenerMiddleware, addListener, isAnyOf } from '@reduxjs/toolkit'
import type { RootState, AppDispatch } from '.'
import { exemptedModuleAdded, exemptedModuleRemoved, generationInvalidated, moduleAdded, moduleCached, moduleGradeUpdated, moduleMoved, moduleRemoved, moduleReordered, moduleSelected, moduleTagsUpdated, moduleUnselected, semesterAdded, semesterRemoved, studentContextUpdated, timetableLoaded, timetableActions, updateModuleStates } from './timetableSlice'
import { closeSidebar, openSidebar, setActiveTab } from './sidebarSlice'
import { apiSlice } from './apiSlice'
import { currentTimetableSet, plannerInitialised, switchTimetable, timetableRemoved, timetableRenamed, timetableUpdated } from './plannerSlice';
export const listenerMiddleware = createListenerMiddleware()

export const startAppListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>()
export type AppStartListening = typeof startAppListening

export const addAppListener = addListener.withTypes<RootState, AppDispatch>()
export type AppAddListener = typeof addAppListener

const addTimetableListeners = (startAppListening: AppStartListening) => {
  // Open sidebar and switch to Details tab on module selected
  startAppListening({
    actionCreator: moduleSelected,
    effect: async (_, api) => {
      api.dispatch(openSidebar());
      api.dispatch(setActiveTab(0)); // Switch to Details tab (tab 0)
    },
  });

  // Close sidebar on module unselected
  startAppListening({
    actionCreator: moduleUnselected,
    effect: async (_, api) => {
      api.dispatch(closeSidebar());
    },
  });

  // module status updates
  // - listen to module/semester change actions and debounce an autosave
  // - also keep a separate listener for explicit timetableUpdated to trigger state checks
  const AUTOSAVE_DELAY_MS = 500;

  startAppListening({
    matcher: isAnyOf(
      moduleMoved,
      moduleAdded,
      moduleRemoved,
      exemptedModuleAdded,
      exemptedModuleRemoved,
      moduleGradeUpdated,
      moduleTagsUpdated,
      moduleReordered,
      moduleCached,
      semesterAdded,
      semesterRemoved,
      studentContextUpdated,
      timetableLoaded,
      apiSlice.endpoints.getTimetable.matchFulfilled
    ),
    effect: async (_action, api) => {
      // Debounce: cancel any pending autosave and state checks
      api.cancelActiveListeners();

      // Recompute module states immediately for UI responsiveness
      api.dispatch(updateModuleStates());

      // Wait for a short idle period before persisting the working timetable
      await api.delay(AUTOSAVE_DELAY_MS);

      const state = api.getState() as RootState;
      const active = state.planner.activeTimetableName;
      if (active) {
        api.dispatch(
          // Persist the working timetable into the saved timetables
          // so duplicating or switching will use latest changes
          timetableUpdated({
            name: active,
            modules: state.timetable.modules,
            semesters: state.timetable.semesters,
            studentContext: state.timetable.studentContext ?? null,
          })
        );
      }
    },
  });

  // If something explicitly updates a saved timetable, ensure module states are recomputed
  startAppListening({
    actionCreator: timetableUpdated,
    effect: async (_action, api) => {
      api.cancelActiveListeners();
      api.dispatch(updateModuleStates());
    },
  });

  startAppListening({
    matcher: isAnyOf(timetableLoaded, moduleAdded),
    effect: async (_, api) => {
      const initial = api.getState();
      const codes = new Set([
        ...initial.timetable.modules.ids,
        ...Object.values(initial.timetable.semesters.entities).flatMap(semester => semester.moduleCodes),
      ]);
      await Promise.all([...codes].map(async code => {
        if (initial.timetable.modules.entities[code]?.prerequisiteSchemaVersion === 2) return;
        const cached = apiSlice.endpoints.getModuleByCode.select(code)(api.getState()).data;
        const result = await api.dispatch(apiSlice.endpoints.getModuleByCode.initiate(code, {
          subscribe: false,
          forceRefetch: cached?.prerequisiteSchemaVersion !== 2,
        }));
        const current = api.getState();
        if (current.planner.activeTimetableName !== initial.planner.activeTimetableName ||
            current.timetable.semesters !== initial.timetable.semesters) return;
        if (result.data) api.dispatch(moduleCached({ module: result.data }));
      }));
    },
  });

  startAppListening({
    matcher: apiSlice.endpoints.getModuleByCode.matchFulfilled,
    effect: async (action, api) => {
      const moduleData = action.payload;
      const moduleCode = moduleData.code;
      const state = api.getState() as RootState;

      // Check if this module code exists in any semester
      const isInTimetable = Object.values(state.timetable.semesters.entities).some(semester =>
        semester?.moduleCodes.includes(moduleCode)
      );

      // If it's part of the timetable, add it to the slice
      if (isInTimetable || state.timetable.modules.entities[moduleCode]) {
        api.dispatch(timetableActions.moduleCached({
          module: moduleData,
        }));
      }
    },
  });

  startAppListening({
    matcher: apiSlice.endpoints.getTimetable.matchFulfilled,
    effect: async (action, api) => {
      if (api.getState().timetable.generationRequestId !== action.meta.requestId) return;
      api.cancelActiveListeners();
      // Extract module codes from the fetched timetable
      const semesters = action.payload.timetable.semesters;
      const uniqueModuleCodes = [
        ...new Set(semesters.flatMap((s) => s.moduleCodes)),
      ];
      // Reuse RTK Query's per-code cache. A cached query does not emit another
      // fulfilled action, so explicitly copy every result into timetable state.
      const modules = await Promise.all(
        uniqueModuleCodes.map(async (code) => {
          const cached = apiSlice.endpoints.getModuleByCode.select(code)(api.getState()).data;
          const result = await api.dispatch(
            apiSlice.endpoints.getModuleByCode.initiate(code, {
              subscribe: false,
              forceRefetch: cached?.prerequisiteSchemaVersion !== 2,
            })
          );
          return result.data ?? null;
        })
      );

      if (api.getState().timetable.generationRequestId !== action.meta.requestId) return;
      modules.forEach((module) => {
        if (module) {
          api.dispatch(timetableActions.moduleCached({ module }));
        }
      });

      // Now all available static data is in timetable state, so check issues.
      api.dispatch(updateModuleStates());
    },
  });
};

const addPlannerListeners = (startAppListening: AppStartListening) => {
  startAppListening({
    matcher: isAnyOf(currentTimetableSet, timetableRemoved, timetableRenamed),
    effect: (_, api) => {
      if (api.getOriginalState().planner.activeTimetableName !== api.getState().planner.activeTimetableName) {
        api.dispatch(generationInvalidated());
      }
    },
  });

  // On app init: ensure a timetable exists and load it (via thunk)
  startAppListening({
    actionCreator: plannerInitialised,
    effect: async (_, api) => {
      const state = api.getState() as RootState;
      const active = state.planner.activeTimetableName;
      if (active) {
        api.dispatch(switchTimetable(active));
      }
    },
  });

};

addPlannerListeners(startAppListening);
addTimetableListeners(startAppListening)