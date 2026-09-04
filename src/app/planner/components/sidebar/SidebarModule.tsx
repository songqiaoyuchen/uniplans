import { useDraggable } from "@dnd-kit/core";
import { memo, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ModuleTooltip from "./ModuleTooltip";
import { moduleSelected } from "@/store/timetableSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import ModuleTooltipPlaceholder from "@/components/placeholders/ModuleTooltipPlaceholder";
import type { MiniModuleData } from "@/types/plannerTypes";
import { makeIsModulePlannedSelector } from "@/store/timetableSelectors";

interface SidebarModuleProps {
  moduleCode: string;
  summary?: MiniModuleData;
  isLoading: boolean;
  isError: boolean;
};

const SidebarModule: React.FC<SidebarModuleProps> = ({
  moduleCode,
  summary,
  isLoading,
  isError,
}) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const existingModule = useAppSelector(
    (state) => state.timetable.modules.entities[moduleCode],
  );
  const isPlannedSelector = useMemo(
    () => makeIsModulePlannedSelector(moduleCode),
    [moduleCode],
  );
  const isPlanned = useAppSelector(isPlannedSelector);
  const mod = existingModule ?? summary;
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: moduleCode + '-sidebar',
    disabled: isPlanned,
    data: {
      type: 'module',
      source: 'sidebar',
      dragActivationConstraint: {
        distance: 5,
      },
    },
  });

  const handleClick = useCallback(() => {
    router.push(`?module=${moduleCode}`, { scroll: false });
    dispatch(moduleSelected(moduleCode))
  }, [moduleCode, dispatch, router]);

  if (isLoading && !existingModule) {
    return <ModuleTooltipPlaceholder />
  }
  if ((isError && !existingModule) || !mod) {
    return (
      <div style={{ 
        padding: '4px 8px',
        fontSize: '0.875rem',
        color: '#888',
        fontStyle: 'italic'
      }}>
        {moduleCode}
      </div>
    )
  }
  
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      style={{ touchAction: "none" }}
    >
      <ModuleTooltip 
        module={mod}
        isPlanned={isPlanned}
      />
    </div>
  )
}

export default memo(SidebarModule)
