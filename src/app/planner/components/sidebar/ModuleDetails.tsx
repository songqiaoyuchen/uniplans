"use client";

import { ModuleData, ModuleIssue, SemesterLabel } from "@/types/plannerTypes";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ExpandableText from "@/components/ui/ExpandableText";
import PrereqTreeView from "./PrereqTreeView";
import DraggableAddButton from "./DraggableAddButton";
import { memo } from "react";
import TargetedButton from "./TargetedButton";
import ExemptedButton from "./ExemptedButton";
import { useAppSelector } from "@/store";
import { RootState } from "@/store";

interface ModuleDetailsProps {
  module: ModuleData;
  isPlanned: boolean;
}

const ModuleDetails: React.FC<ModuleDetailsProps> = ({ module, isPlanned }) => {

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.2,
        width: "100%",
        px: '6px',
        whiteSpace: "normal",
        wordBreak: "break-word",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: 'nowrap' }}>
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {module.code}
        </Typography>
        {!isPlanned && <DraggableAddButton moduleCode={module.code} />}
        
        {/* Toggle Buttons for Target/Exempt */}
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <TargetedButton moduleCode={module.code} />
          <ExemptedButton moduleCode={module.code} />
        </Box>
      </Box>

      <Typography variant="subtitle2" fontWeight={500} color="text.secondary">
        {module.title}
      </Typography>

      {module.faculty && (
        <Typography variant="body2" color="text.secondary">
          Faculty: {module.faculty}
        </Typography>
      )}

      {module.department && (
        <Typography variant="body2" color="text.secondary">
          Department: {module.department}
        </Typography>
      )}

      {module.description && <ExpandableText text={module.description} />}

      <Divider flexItem sx={{ my: 1.5 }} />

      {module.issues && module.issues.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight={600}>
            Issues
          </Typography>
          <Box component="ul" sx={{ pl: 3, my: 1, color: "error.main" }}>
            {module.issues.map((issue, idx) => (
              <li key={idx}>
                <Typography variant="body2">{renderIssue(issue)}</Typography>
              </li>
            ))}
          </Box>
          <Divider flexItem sx={{ my: 1.5 }} />
        </>
      )}

      {/* Prerequisite Tree Section */}
      {module.requires && (
        <>
          <Typography variant="subtitle1" fontWeight={600}>
            Prerequisites
          </Typography>
          <PrereqTreeView prereqTree={module.requires} />
          <Divider flexItem sx={{ my: 1.5 }} />
        </>
      )}

      <Typography variant="body1">
        Offered: {formatSemesters(module.semestersOffered || [])}
      </Typography>

      {module.exam && (
        <Typography variant="body1">
          Exam: {formatExam(module.exam.startTime)} (
          {module.exam.durationMinutes} min)
        </Typography>
      )}

      {module.grade && (
        <Typography variant="body1">Grade: {module.grade}</Typography>
      )}

      {module.preclusions?.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          Preclusions: {module.preclusions.join(", ")}
        </Typography>
      )}
    </Box>
  );
};

export default memo(ModuleDetails);

// Helpers
function formatExam(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSemesters(semesters: SemesterLabel[]): string {
  return semesters
    .map((s) => {
      switch (s) {
      case SemesterLabel.First:
        return "Semester 1";
      case SemesterLabel.Second:
        return "Semester 2";
      case SemesterLabel.SpecialTerm1:
        return "Special Term 1";
      case SemesterLabel.SpecialTerm2:
        return "Special Term 2";
      default:
        return "Unknown";
      }
    })
    .join(", ");
}

function renderIssue(issue: ModuleIssue): string {
  switch (issue.type) {
  case "PrereqUnsatisfied":
    return "Prerequisites not satisfied.";
  case "Precluded":
    return `Precluded by: ${issue.with.join(", ")}`;
  case "InvalidSemester":
    return "Not offered in this semester.";
  case "ExamClash":
    return `Exam clash with: ${issue.with.join(", ")}`;
  default:
    return "Unknown issue.";
  }
}