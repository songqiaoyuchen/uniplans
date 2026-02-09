"use client";

import { memo } from "react";
import IconButton from "@mui/material/IconButton";
import BlockIcon from "@mui/icons-material/Block";
import { useAppDispatch, useAppSelector } from "@/store";
import { RootState } from "@/store";
import { exemptedModuleAdded, exemptedModuleRemoved, targetModuleRemoved } from "@/store/timetableSlice";

interface ExemptedButtonProps {
  moduleCode: string;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
}

const ExemptedButton: React.FC<ExemptedButtonProps> = ({ moduleCode }) => {
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
    
    if (isExempted) {
      dispatch(exemptedModuleRemoved(moduleCode));
    } else {
      // Remove from targeted if it was targeted
      if (isTargeted) {
        dispatch(targetModuleRemoved(moduleCode));
      }
      dispatch(exemptedModuleAdded(moduleCode));
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
      <BlockIcon 
        fontSize="small"
        sx={{ 
          color: isExempted ? 'warning.main' : 'action.disabled',
          transition: 'color 0.2s',
        }} 
      />
    </IconButton>
  );
};

export default memo(ExemptedButton);