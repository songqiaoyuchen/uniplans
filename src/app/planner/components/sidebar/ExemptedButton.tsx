"use client";

import { memo } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import BlockIcon from "@mui/icons-material/Block";
import { useAppDispatch, useAppSelector } from "@/store";
import { RootState } from "@/store";
import { exemptedModuleAdded, exemptedModuleRemoved } from "@/store/timetableSlice";
import { MAX_EXEMPTED_MODULES } from "@/constants/plannerLimits";

interface ExemptedButtonProps {
  moduleCode: string;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
}

const ExemptedButton: React.FC<ExemptedButtonProps> = ({ moduleCode }) => {
  const dispatch = useAppDispatch();
  
  const exemptedModuleCodes = useAppSelector((state: RootState) => {
    const exempted = state.timetable.exemptedModules;
    return Array.isArray(exempted) ? exempted : [];
  });

  const isExempted = exemptedModuleCodes.includes(moduleCode);
  const isLimitReached =
    !isExempted && exemptedModuleCodes.length >= MAX_EXEMPTED_MODULES;

  const handleToggle = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    
    if (isExempted) {
      dispatch(exemptedModuleRemoved(moduleCode));
    } else if (!isLimitReached) {
      dispatch(exemptedModuleAdded(moduleCode));
    }
  };

  return (
    <Tooltip
      title={
        isLimitReached
          ? `Up to ${MAX_EXEMPTED_MODULES} exempted modules`
          : "Toggle exempted module"
      }
    >
      <span>
        <IconButton
          size="small"
          onClick={handleToggle}
          disabled={isLimitReached}
          aria-label={isExempted ? "Remove exempted module" : "Add exempted module"}
          sx={{ p: 0.5 }}
        >
          <BlockIcon
            fontSize="small"
            sx={{
              color: isExempted ? 'warning.main' : 'action.disabled',
              transition: 'color 0.2s',
            }}
          />
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default memo(ExemptedButton);
