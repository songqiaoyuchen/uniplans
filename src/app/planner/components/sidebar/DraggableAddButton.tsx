"use client";

import { useDraggable } from "@dnd-kit/core";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import { memo } from "react";

interface DraggableAddButtonProps {
  moduleCode: string;
}

const DraggableAddButton: React.FC<DraggableAddButtonProps> = ({ moduleCode }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${moduleCode}-sidebar`,
    data: { type: "module", code: moduleCode, source: "sidebar" },
  });

  return (
    <Box
      component="span"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      sx={{
        ml: 1,
        display: "inline-flex",
        alignItems: "center",
        opacity: isDragging ? 0 : 1,
        touchAction: "none",
        transition: "opacity 0.2s ease",
      }}
    >
      <IconButton size="small" sx={{ 
        p: 0.5,
        cursor: "grab",
        "&:active": { cursor: "grabbing" }
      }}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default memo(DraggableAddButton);