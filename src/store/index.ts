import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  type PersistedState,
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

import themeReducer from "./themeSlice";
import sidebarReducer from "./sidebarSlice";
import timetableReducer, { normalizeCachedModule, normalizeStudentContext, type TimetableSliceState } from "./timetableSlice"
import plannerReducer from './plannerSlice'
import { apiSlice } from "./apiSlice";
import { useDispatch, useSelector } from "react-redux";
import { listenerMiddleware } from './listenerMiddleware'

export const rootReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  theme: themeReducer,
  sidebar: sidebarReducer,
  timetable: timetableReducer,
  planner: plannerReducer
});

export function normalizePersistedPlannerState(state: RootState): RootState {
  const normalizeModules = (modules: TimetableSliceState['modules']) => ({
    ...modules,
    entities: Object.fromEntries(Object.entries(modules.entities).map(([code, module]) =>
      [code, normalizeCachedModule(module)])),
  });
  const normalized = {
    ...state,
    timetable: state.timetable && {
      ...state.timetable,
      studentContext: normalizeStudentContext(state.timetable.studentContext),
      generationRequestId: null,
      moduleStateRequestId: null,
      modules: normalizeModules(state.timetable.modules),
    },
    planner: state.planner && {
      ...state.planner,
      timetables: {
        ...state.planner.timetables,
        entities: Object.fromEntries(Object.entries(state.planner.timetables.entities).map(([name, timetable]) => [name, {
          ...timetable,
          studentContext: normalizeStudentContext(timetable.studentContext),
          modules: normalizeModules(timetable.modules),
        }])),
      },
    },
  };
  const active = normalized.planner?.activeTimetableName;
  if (active && normalized.planner.timetables.entities[active] && normalized.timetable) {
    normalized.planner.timetables.entities[active] = {
      ...normalized.planner.timetables.entities[active],
      modules: normalized.timetable.modules,
      semesters: normalized.timetable.semesters,
      studentContext: normalized.timetable.studentContext,
    };
  }
  return normalized;
}

const persistConfig = {
  key: "root",
  version: 2,
  storage,
  blacklist: [apiSlice.reducerPath],
  migrate: async (state: PersistedState): Promise<PersistedState> =>
    state && { ...state, ...normalizePersistedPlannerState(state as unknown as RootState) },
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
      .concat(apiSlice.middleware)
      .prepend(listenerMiddleware.middleware), 
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

export const persistor = persistStore(store);
export default store;