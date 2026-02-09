"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ModuleCard from "./ModuleCard";
import { memo, useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { moduleSelected, moduleUnselected } from "@/store/timetableSlice";
import { useModuleState } from "../../hooks";
import { useRouter } from "next/navigation";
import MiniModuleCard from "./MiniModuleCard";
import ModuleCardPlaceholder from "@/components/placeholders/ModuleCardPlaceholder";
import ErrorModuleCard from "@/components/placeholders/ErrorModuleCard";
import MiniModuleCardPlaceholder from "@/components/placeholders/MiniModuleCardPlaceholder";
import MiniErrorModuleCard from "@/components/placeholders/ErrorMiniModuleCard";

interface TimetableModuleProps {
  moduleCode: string;
  semesterId: number
}

const TimetableModule: React.FC<TimetableModuleProps> = ({ moduleCode, semesterId }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isMinimalView = useAppSelector((state) => state.timetable.isMinimalView);

  const { mod, isFetching, isError, isSelected, isRelated, refetch } = useModuleState(moduleCode);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: moduleCode,
    data: {
      type: 'module', 
      semesterId: semesterId,
    },
  });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      margin: 0,
      backgroundColor: "transparent",
      opacity: isDragging ? 0.4 : 1,
      touchAction: "none",
    }),
    [transform, transition, isDragging]
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      dispatch(moduleUnselected());
      router.push("?", { scroll: false });
    } else {
      dispatch(moduleSelected(moduleCode))
      router.push(`?module=${moduleCode}`, { scroll: false });
    }
  }, [dispatch, isSelected, moduleCode, router]);

  if (isFetching) {
    const Placeholder = isMinimalView
      ? MiniModuleCardPlaceholder
      : ModuleCardPlaceholder;

    return (
      <div
        style={style}
      >
        <Placeholder />
      </div>
    );
  }

  if (isError || !mod) {
    const ErrorPlaceholder = isMinimalView
      ? MiniErrorModuleCard
      : ErrorModuleCard;

    return (
      <div
        style={style}
        onClick={(e) => {
          e.stopPropagation();
          refetch();
        }}
      >
        <ErrorPlaceholder moduleCode={moduleCode} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
    >
      {isMinimalView 
        ? (<MiniModuleCard module={mod} isSelected={isSelected} isRelated={isRelated} />) 
        : (<ModuleCard module={mod} isSelected={isSelected} isRelated={isRelated} />)}
    </div>
  );
};

export default memo(TimetableModule);

