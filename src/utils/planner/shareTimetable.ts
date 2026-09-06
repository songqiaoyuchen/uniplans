import type { Timetable } from "@/store/plannerSlice";
import type { TimetableSliceState } from "@/store/timetableSlice";
import type { TimetableSnapshot } from "@/types/plannerTypes";
import type { ModuleData } from "@/types/plannerTypes";
import { modulesAdapter, semestersAdapter } from "@/store/timetableSlice";

/**
 * Serialize a timetable into a minimal snapshot for sharing.
 */
export function serializeTimetable(tt: Timetable): TimetableSnapshot {
  // 1️⃣ Semesters: preserve empty ones up to max ID
  const maxId = tt.semesters.ids.length
    ? Math.max(...tt.semesters.ids)
    : -1;
  const semesters: string[][] = [];
  for (let id = 0; id <= maxId; id++) {
    const sem = tt.semesters.entities[id];
    semesters.push(sem?.moduleCodes ?? []);
  }

  // 2️⃣ Modules: only id, code, tags
  const modules = Object.values(tt.modules.entities)
    .filter(Boolean)
    .map((mod) => ({
      id: mod!.id,
      code: mod!.code,
      tags: mod!.tags ?? [],
    }));

  return { version: 1, semesters, modules };
}

/**
 * Deserialize a snapshot into timetable entity states.
 */
export function deserializeTimetable(snapshot: TimetableSnapshot): {
  modules: TimetableSliceState["modules"];
  semesters: TimetableSliceState["semesters"];
  studentContext: null;
} {
  // 1️⃣ Build modules entity state
  const modules = modulesAdapter.setAll(
    modulesAdapter.getInitialState(),
    snapshot.modules.map((mod) => ({
      id: mod.id,
      code: mod.code,
      title: mod.code, // fallback; title can be fetched later if needed
      credits: 0,      // placeholder
      semestersOffered: [], // placeholder
      exam: null,
      preclusions: [],
      tags: mod.tags ?? [],
    })) as ModuleData[]
  );

  // 2️⃣ Build semesters entity state
  const semesters = semestersAdapter.setAll(
    semestersAdapter.getInitialState(),
    snapshot.semesters.map((codes, id) => ({
      id,
      moduleCodes: codes,
    }))
  );

  return { modules, semesters, studentContext: null };
}
