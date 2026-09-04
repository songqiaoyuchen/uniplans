import { createSlice, createEntityAdapter, PayloadAction, EntityState, createAsyncThunk } from "@reduxjs/toolkit";
import { modulesAdapter, semestersAdapter, timetableLoaded, updateModuleStates, type Semester } from "./timetableSlice";
import { ModuleData, TimetableSnapshot } from "@/types/plannerTypes";
import { AppDispatch, RootState } from ".";
import { uniqueTimetableName } from "@/utils/planner/uniqueTimetableName";
import {
  createStarterTimetableState,
  STARTER_TIMETABLE_NAME,
} from "@/data/starterTimetable";

export interface Timetable {
  name: string;
  modules: EntityState<ModuleData, string>;
  semesters: EntityState<Semester, number>;
}

export interface PlannerState {
  timetables: EntityState<Timetable, string>;
  activeTimetableName: string | null;
}

const timetableAdapter = createEntityAdapter({
  selectId: (t: Timetable) => t.name,
});

const initialState: PlannerState = {
  timetables: timetableAdapter.getInitialState(),
  activeTimetableName: null,
};

export const plannerSlice = createSlice({
  name: "planner",
  initialState,
  reducers: {
    // Called once on app init to ensure first-time visitors have an editable example.
    plannerInitialised: (state) => {
      if (state.timetables.ids.length === 0) {
        const starterTimetable = createStarterTimetableState();
        timetableAdapter.addOne(state.timetables, {
          name: STARTER_TIMETABLE_NAME,
          ...starterTimetable,
        });
        state.activeTimetableName = STARTER_TIMETABLE_NAME;
      }
    },

    timetableAdded: (state, action: PayloadAction<{ name: string }>) => {
      timetableAdapter.addOne(state.timetables, {
        name: action.payload.name,
        modules: { ids: [], entities: {} },
        semesters: { ids: [], entities: {} },
      });
    },

    timetableRemoved: (state, action: PayloadAction<string>) => {
      timetableAdapter.removeOne(state.timetables, action.payload);
      if (state.activeTimetableName === action.payload) {
        const firstId = state.timetables.ids[0] as string | undefined;
        state.activeTimetableName = firstId ?? null;
      }
    },

    timetableRenamed: (
      state,
      action: PayloadAction<{ oldName: string; newName: string }>
    ) => {
      const { oldName, newName } = action.payload;
      if (oldName === newName) return;

      const timetable = state.timetables.entities[oldName];
      if (timetable) {
        const uniqueName = uniqueTimetableName(
          newName,
          state.timetables.ids as string[],
          oldName,
        );
        if (uniqueName === oldName) return;

        timetableAdapter.removeOne(state.timetables, oldName);
        timetableAdapter.addOne(state.timetables, {
          ...timetable,
          name: uniqueName,
        });
        if (state.activeTimetableName === oldName) {
          state.activeTimetableName = uniqueName;
        }
      }
    },

    currentTimetableSet: (state, action: PayloadAction<string>) => {
      if (state.timetables.ids.includes(action.payload)) {
        state.activeTimetableName = action.payload;
      }
    },

    timetableUpdated: (
      state,
      action: PayloadAction<{
        name: string;
        modules?: EntityState<ModuleData, string>;
        semesters?: EntityState<Semester, number>;
      }>
    ) => {
      const { name, modules, semesters } = action.payload;
      timetableAdapter.updateOne(state.timetables, {
        id: name,
        changes: {
          ...(modules && { modules }),
          ...(semesters && { semesters }),
        },
      });
    },

  },
});

export const {
  plannerInitialised,
  timetableAdded,
  timetableRemoved,
  timetableRenamed,
  currentTimetableSet,
  timetableUpdated,
} = plannerSlice.actions;

export default plannerSlice.reducer;

export const plannerSelectors = timetableAdapter.getSelectors(
  (state: { planner: PlannerState }) => state.planner.timetables
);

export const switchTimetable = createAsyncThunk<void, string, { state: RootState }>(
  'planner/switchTimetable',
  async (nextName, { getState, dispatch }) => {
    const state = getState()
    const current = state.planner.activeTimetableName

    // Save the current working timetable (if one exists)
    if (current && current !== nextName) {
      dispatch(
        timetableUpdated({
          name: current,
          modules: state.timetable.modules,
          semesters: state.timetable.semesters,
        })
      )
    }

    // Switch the active timetable
    dispatch(currentTimetableSet(nextName))

    // Load the newly selected timetable into the working slice
    const next = plannerSelectors.selectById(getState(), nextName)
    if (next) {
      dispatch(
        timetableLoaded({
          modules: Object.values(next.modules.entities).filter(Boolean),
          semesters: Object.values(next.semesters.entities).filter(Boolean),
        })
      )
    }
  }
)

export const importTimetableFromSnapshot =
  (snapshot: TimetableSnapshot, name: string) =>
    async (dispatch: AppDispatch) => {

      // fetch full module data
      const modulesData: ModuleData[] = (
      await Promise.all(
        snapshot.modules.map(async ({ code, tags }) => {
          try {
            const res = await fetch(`/api/modules/${encodeURIComponent(code)}`);
            if (!res.ok) return null;
            const mod = (await res.json()) as ModuleData;
            if (tags?.length) mod.tags = tags;
            return mod;
          } catch {
            return null;
          }
        })
      )
    ).filter(Boolean) as ModuleData[];

      // nuild entity states
      const modules = modulesAdapter.setAll(
        modulesAdapter.getInitialState(),
        modulesData
      );

      const semesters = semestersAdapter.setAll(
        semestersAdapter.getInitialState(),
        snapshot.semesters.map((codes, id) => ({
          id,
          moduleCodes: codes,
        }))
      );

      // update store
      dispatch(timetableAdded({ name }));
      dispatch(timetableUpdated({ name, modules, semesters }));
      dispatch(switchTimetable(name));
      dispatch(updateModuleStates());
    };
