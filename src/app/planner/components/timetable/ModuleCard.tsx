"use client";

import { ModuleData, ModuleStatus } from "@/types/plannerTypes";
import { useTheme, alpha } from "@mui/material/styles";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { memo } from "react";
import { useModuleCardColors } from "../../hooks";
import Box from "@mui/material/Box";
import Tag from "@/components/ui/Tag";
import ModuleGradeDropdown from "./ModuleGradeDropdown";

interface ModuleCardProps {
  module: Pick<ModuleData, "code" | "title" | "status" | "credits" | "grade">;
  isSelected?: boolean;
  isRelated?: boolean;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module, isSelected = false, isRelated = false }) => {
  const theme = useTheme();
  const status = module.status ?? ModuleStatus.Satisfied;
  const {
    backgroundColor,
    borderColor,
    selectedBorderWidth,
    selectedGlowWidth,
    selectedBorderColor,
    relatedBorderColor,
  } = useModuleCardColors(status);

  const glowBlurPx = parseFloat(String(selectedGlowWidth || 8)) || 8;
  const glow = alpha(selectedBorderColor, 0.45);
  const selectedShadow = `0 0 0 1px ${selectedBorderColor}, 0 0 ${glowBlurPx}px ${Math.max(
    2,
    Math.round(glowBlurPx / 4)
  )}px ${glow}`;
  const relatedShadow = `0 0 0 1px ${alpha(relatedBorderColor, 0.9)}`;
  const baseBorder = `2px solid ${borderColor}`;
  const selectedBorder = `${selectedBorderWidth || "2px"} solid ${selectedBorderColor}`;
  const relatedBorder = `2px solid ${alpha(relatedBorderColor, 0.8)}`;

  return (
    <Card
      sx={{
        minWidth: "225px",
        height: "105px",
        cursor: "pointer",
        userSelect: "none",
        backgroundColor,
        border: isSelected
          ? selectedBorder
          : isRelated
            ? relatedBorder
            : baseBorder,

        boxShadow: isSelected
          ? selectedShadow
          : isRelated
            ? relatedShadow
            : theme.shadows[2], 

        transition:
          "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.2s ease",

        "&:hover": isSelected
          ? { boxShadow: selectedShadow }
          : {
            boxShadow: theme.shadows[8],
            transform: "translateY(-3px)",
          },
        color: theme.palette.text.primary,
      }}
    >
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          p: 1.5,
        }}
      >
        {/* title and grade */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <Box component="span" fontWeight="bold">
              {module.code}
            </Box>{" "}
            {module.title}
          </Typography>
          <ModuleGradeDropdown 
            moduleCode={module.code} 
            currentGrade={module.grade} 
          />
        </Box>

        {/* unit and tags */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "flex-end",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
            {module.credits} Units
          </Typography>

          {/* tags (future) */}
          {/* <Box
            sx={{
              display: "flex",
              flexWrap: "wrap-reverse",
              flexDirection: "row-reverse",
              gap: 0.5,
              overflow: "hidden",
              alignContent: "flex-end",
              justifyContent: "flex-start",
              flexGrow: 1,
            }}
          >
            <Tag text="Sample" />
            <Tag text="Sample" />
          </Box> */}
        </Box>
      </Box>
    </Card>
  );
};

export default memo(ModuleCard);
