"use client";

import { memo } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FlagIcon from "@mui/icons-material/Flag";
import { useAppDispatch, useAppSelector } from "@/store";
import { RootState } from "@/store";
import { targetModuleAdded, targetModuleRemoved } from "@/store/timetableSlice";
import { MAX_TARGET_MODULES } from "@/constants/plannerLimits";

interface TargetedButtonProps {
  moduleCode: string;
}

const TargetedButton: React.FC<TargetedButtonProps> = ({ 
  moduleCode
}) => {
  const dispatch = useAppDispatch();
  
  const targetModuleCodes = useAppSelector((state: RootState) => {
    const targeted = state.timetable.targetModules;
    return Array.isArray(targeted) ? targeted : [];
  });

  const isTargeted = targetModuleCodes.includes(moduleCode);
  const isLimitReached =
    !isTargeted && targetModuleCodes.length >= MAX_TARGET_MODULES;

  const handleToggle = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    
    if (isTargeted) {
      dispatch(targetModuleRemoved(moduleCode));
    } else if (!isLimitReached) {
      dispatch(targetModuleAdded(moduleCode));
    }
  };

  return (
    <Tooltip
      title={
        isLimitReached
          ? `Up to ${MAX_TARGET_MODULES} target modules`
          : "Toggle target module"
      }
    >
      <span>
        <IconButton
          size="small"
          onClick={handleToggle}
          disabled={isLimitReached}
          aria-label={isTargeted ? "Remove target module" : "Add target module"}
          sx={{ p: 0.5 }}
        >
          <FlagIcon
            fontSize="small"
            sx={{
              color: isTargeted ? 'primary.main' : 'action.disabled',
              transition: 'color 0.2s',
            }}
          />
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default memo(TargetedButton);
