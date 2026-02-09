import { useDraggable } from "@dnd-kit/core";
import { useModuleState } from "../../hooks";
import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import ModuleTooltip from "./ModuleTooltip";
import { moduleSelected } from "@/store/timetableSlice";
import { useDispatch } from "react-redux";
import ModuleTooltipPlaceholder from "@/components/placeholders/ModuleTooltipPlaceholder";

interface SidebarModuleProps {
  moduleCode: string;
};

const SidebarModule: React.FC<SidebarModuleProps> = ({ moduleCode }) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { mod, isPlanned, isLoading, isError } = useModuleState(moduleCode);
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: moduleCode + '-sidebar',
    disabled: isPlanned,
    data: {
      type: 'module',
      dragActivationConstraint: {
        distance: 5,
      },
    },
  });

  const handleClick = useCallback(() => {
    router.push(`?module=${moduleCode}`, { scroll: false });
    dispatch(moduleSelected(moduleCode))
  }, [moduleCode, dispatch, router]);

  if (isLoading) {
    return <ModuleTooltipPlaceholder />
  }
  if (isError || !mod) {
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
