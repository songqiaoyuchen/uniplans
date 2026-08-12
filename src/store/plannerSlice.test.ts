import reducer, {
  currentTimetableSet,
  plannerInitialised,
  timetableAdded,
  timetableRenamed,
  timetableUpdated,
} from "./plannerSlice";
import { ModuleStatus } from "@/types/plannerTypes";

describe("planner first-run timetable", () => {
  test("creates a four-semester example with completed grades", () => {
    const state = reducer(undefined, plannerInitialised());
    const example = state.timetables.entities["Example Plan"];

    expect(state.activeTimetableName).toBe("Example Plan");
    expect(example?.semesters.ids).toEqual([0, 2, 4, 6]);
    expect(example?.modules.entities.CS1101S).toMatchObject({
      grade: "A-",
      status: ModuleStatus.Completed,
    });
    expect(example?.modules.entities.CS2040S?.grade).toBeUndefined();
  });

  test("does not replace an existing timetable", () => {
    let state = reducer(undefined, { type: "test/init" });
    state = reducer(state, timetableAdded({ name: "My Plan" }));

    const nextState = reducer(state, plannerInitialised());

    expect(nextState).toBe(state);
    expect(nextState.timetables.ids).toEqual(["My Plan"]);
  });
});

function addTimetable(state: ReturnType<typeof reducer>, name: string, code: string) {
  const added = reducer(state, timetableAdded({ name }));
  return reducer(
    added,
    timetableUpdated({
      name,
      semesters: {
        ids: [0],
        entities: { 0: { id: 0, moduleCodes: [code] } },
      },
    }),
  );
}

describe("planner timetable renaming", () => {
  test("uses a serial suffix on collision and preserves both timetables", () => {
    let state = reducer(undefined, { type: "test/init" });
    state = addTimetable(state, "My Plan", "CS1010");
    state = addTimetable(state, "Other", "MA1521");
    state = reducer(state, currentTimetableSet("Other"));

    state = reducer(
      state,
      timetableRenamed({ oldName: "Other", newName: "My Plan" }),
    );

    expect(state.timetables.ids).toEqual(["My Plan", "My Plan (2)"]);
    expect(state.timetables.entities["My Plan"]?.semesters.entities[0]?.moduleCodes)
      .toEqual(["CS1010"]);
    expect(state.timetables.entities["My Plan (2)"]?.semesters.entities[0]?.moduleCodes)
      .toEqual(["MA1521"]);
    expect(state.activeTimetableName).toBe("My Plan (2)");
  });

  test("increments past existing serial suffixes", () => {
    let state = reducer(undefined, { type: "test/init" });
    state = addTimetable(state, "My Plan", "CS1010");
    state = addTimetable(state, "My Plan (2)", "CS2030S");
    state = addTimetable(state, "Other", "CS2040S");

    state = reducer(
      state,
      timetableRenamed({ oldName: "Other", newName: "My Plan" }),
    );

    expect(state.timetables.ids).toEqual([
      "My Plan",
      "My Plan (2)",
      "My Plan (3)",
    ]);
    expect(state.timetables.entities["My Plan (3)"]?.semesters.entities[0]?.moduleCodes)
      .toEqual(["CS2040S"]);
  });

  test("renaming to the unchanged current name is a no-op", () => {
    let state = reducer(undefined, { type: "test/init" });
    state = addTimetable(state, "My Plan", "CS1010");

    const nextState = reducer(
      state,
      timetableRenamed({ oldName: "My Plan", newName: "My Plan" }),
    );

    expect(nextState).toBe(state);
  });
});
