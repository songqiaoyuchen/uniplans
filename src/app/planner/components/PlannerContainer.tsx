"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  rectIntersection,
} from "@dnd-kit/core";

import Sidebar from "./sidebar";
import Box from "@mui/material/Box";
import Timetable from "./timetable";
import ModuleCard from "./timetable/ModuleCard";
import { useAppDispatch, useAppSelector } from "@/store";
import { moduleAdded, moduleMoved, moduleRemoved, moduleReordered, semesterDraggedOverCleared, semesterDraggedOverSet } from "@/store/timetableSlice";
import { useModuleState } from "../hooks";
import DeleteZone from "./DeleteZone";
import MiniModuleCard from "./timetable/MiniModuleCard";
import { useSearchParams } from "next/navigation";
import { importTimetableFromSnapshot } from "@/store/plannerSlice";
import { TimetableSnapshot } from "@/types/plannerTypes";

const PlannerContainer: React.FC = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // drag overlay states
  const [draggingModuleCode, setDraggingModuleCode] = useState<string | null>(null);
  const { mod: draggingModule, isPlanned } = useModuleState(draggingModuleCode);
  const isMinimalView = useAppSelector((state) => state.timetable.isMinimalView);

  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const snapshotId = searchParams.get("id");

  // helper to ensure an import name doesn't collide with existing ones
  const existingTimetableNames = useAppSelector((s) => s.planner.timetables.ids);
  const uniqueImportName = useCallback((base: string) => {
    if (!existingTimetableNames.includes(base)) return base;
    let i = 2;
    while (existingTimetableNames.includes(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }, [existingTimetableNames]);

  useEffect(() => {
    if (!snapshotId) return;

    (async () => {
      try {
        const res = await fetch(`/api/snapshot/${snapshotId}`);
        if (!res.ok) throw new Error("Snapshot not found");

        const snapshot: TimetableSnapshot = await res.json();
        const name = uniqueImportName(`Imported Timetable`);
        // await so we only remove the id parameter after import completes
        await dispatch(importTimetableFromSnapshot(snapshot, name));

        // remove ?id= from URL without navigation
        const url = new URL(window.location.href);
        url.searchParams.delete("id");
        window.history.replaceState({}, "", url.toString());
      } catch (err) {
        console.error(err);
      }
    })();
  }, [dispatch, snapshotId, uniqueImportName]);
  
  const handleDragStart = (event: DragStartEvent) => {
    setDraggingModuleCode(event.active.id.toString().split('-')[0]);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    let targetSemesterId: number | null = null;

    if (over) {
      const overData = over.data.current;
      if (overData?.semesterId !== undefined) {
        targetSemesterId = overData.semesterId;
      }
    }

    if (targetSemesterId !== null) {
      dispatch(semesterDraggedOverSet(targetSemesterId));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setDraggingModuleCode(null);
    dispatch(semesterDraggedOverCleared());

    if (!over || active.id === over.id) return;

    const [draggingModuleCode, source] = (active.id as string).split('-');

    if (over?.id === "delete-zone") {
      dispatch(moduleRemoved({ moduleCode: draggingModuleCode }));
      return;
    }

    const sourceSemesterId = active.data.current?.semesterId;
    const destSemesterId = over.data.current?.semesterId;

    // Sidebar drop
    if (source === "sidebar") {
      if (typeof destSemesterId !== "number" || !draggingModule) return;
      dispatch(moduleAdded({ module: draggingModule, destSemesterId }));
      return;
    }

    // Drop must be over a semester
    if (typeof sourceSemesterId !== "number" || typeof destSemesterId !== "number") return;

    const overModuleCode =
      over.data.current?.type === "module"
        ? (over.id as string).split("-")[0]
        : null;

    if (sourceSemesterId === destSemesterId) {
      dispatch(
        moduleReordered({
          semesterId: sourceSemesterId,
          activeModuleCode: draggingModuleCode,
          overModuleCode,
        })
      );
    } else {
      dispatch(
        moduleMoved({
          activeModuleCode: draggingModuleCode,
          overModuleCode,
          sourceSemesterId,
          destSemesterId,
        })
      );
    }
  };


  return (
    <Box sx={{ display: "flex", flexDirection: "row", flex: 1 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Sidebar />  
        <Timetable />

        {/* overlay modulecard */}
        {createPortal(
          <DragOverlay zIndex={1400}>
            {draggingModuleCode && draggingModule && (
              isMinimalView 
                ? <MiniModuleCard module={draggingModule} isDragging/>
                : <ModuleCard module={draggingModule} />
            )}
          </DragOverlay>,
          document.body,
        )}

        {draggingModuleCode && isPlanned &&
          createPortal(<DeleteZone />, document.body)
        }

      </DndContext>
    </Box>
  );
};

export default PlannerContainer;
