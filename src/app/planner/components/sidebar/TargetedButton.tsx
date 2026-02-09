"use client";

import { memo } from "react";
import IconButton from "@mui/material/IconButton";
import FlagIcon from "@mui/icons-material/Flag";
import { useAppDispatch, useAppSelector } from "@/store";
import { RootState } from "@/store";
import { targetModuleAdded, targetModuleRemoved, exemptedModuleRemoved } from "@/store/timetableSlice";

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

  const exemptedModuleCodes = useAppSelector((state: RootState) => {
    const exempted = state.timetable.exemptedModules;
    return Array.isArray(exempted) ? exempted : [];
  });

  const isTargeted = targetModuleCodes.includes(moduleCode);
  const isExempted = exemptedModuleCodes.includes(moduleCode);

  const handleToggle = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    
    if (isTargeted) {
      dispatch(targetModuleRemoved(moduleCode));
    } else {
      // Remove from exempted if it was exempted
      if (isExempted) {
        dispatch(exemptedModuleRemoved(moduleCode));
      }
      dispatch(targetModuleAdded(moduleCode));
    }
  };

  return (
    <IconButton 
      size="small" 
      onClick={handleToggle}
      sx={{ 
        p: 0.5,
      }}
    >
      <FlagIcon 
        fontSize="small"
        sx={{ 
          color: isTargeted ? 'primary.main' : 'action.disabled',
          transition: 'color 0.2s',
        }} 
      />
    </IconButton>
  );
};

export default memo(TargetedButton);