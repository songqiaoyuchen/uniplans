import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
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
import timetableReducer from "./timetableSlice"
import plannerReducer from './plannerSlice'
import { apiSlice } from "./apiSlice";
import { useDispatch, useSelector } from "react-redux";
import { listenerMiddleware } from './listenerMiddleware'

const persistConfig = {
  key: "root",
  storage,
  blacklist: [apiSlice.reducerPath],
};

const rootReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  theme: themeReducer,
  sidebar: sidebarReducer,
  timetable: timetableReducer,
  planner: plannerReducer
});

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