import { createListenerMiddleware, addListener, isAnyOf } from '@reduxjs/toolkit'
import type { RootState, AppDispatch } from '.'
import { exemptedModuleAdded, exemptedModuleRemoved, moduleAdded, moduleGradeUpdated, moduleMoved, moduleRemoved, moduleSelected, moduleUnselected, timetableActions, updateModuleStates } from './timetableSlice'
import { closeSidebar, openSidebar, setActiveTab } from './sidebarSlice'
import { apiSlice } from './apiSlice'
import {  plannerInitialised, switchTimetable, timetableUpdated } from './plannerSlice';
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
      moduleGradeUpdated
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
      if (isInTimetable) {
        api.dispatch(timetableActions.moduleCached({
          module: moduleData,
        }));
      }
    },
  });

  startAppListening({
    matcher: apiSlice.endpoints.getTimetable.matchFulfilled,
    effect: async (action, api) => {
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
          const result = await api.dispatch(
            apiSlice.endpoints.getModuleByCode.initiate(code, { subscribe: false })
          );
          return result.data ?? null;
        })
      );

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