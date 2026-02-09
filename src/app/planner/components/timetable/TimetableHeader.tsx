import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import BarChartIcon from '@mui/icons-material/BarChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import { toggleSidebar } from "@/store/sidebarSlice";
import CheckIcon from "@mui/icons-material/Check";
import { useAppSelector } from "@/store";
import { minimalViewToggled } from "@/store/timetableSlice";
import { useDispatch } from "react-redux";
import { useState, useEffect } from "react";
import {
  selectCgpa,
  selectLatestNormalSemester,
  selectTotalCredits,
} from "@/store/timetableSelectors";
import { timetableRenamed } from "@/store/plannerSlice";
import TimetableDropdown from "./TimetableDropdown"; 

const TimetableHeader: React.FC = () => {
  const dispatch = useDispatch();

  const isMinimalView = useAppSelector((state) => state.timetable.isMinimalView);
  const sidebarIsOpen = useAppSelector((state) => state.sidebar.isOpen);

  // active timetable name from plannerSlice
  const activeName = useAppSelector(
    (state) => state.planner.activeTimetableName
  ) ?? "New Timetable";

  // Title editing mirrors active timetable name
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(activeName);
  useEffect(() => setTempName(activeName), [activeName]);

  const totalCredits = useAppSelector(selectTotalCredits);
  const Cgpa = useAppSelector(selectCgpa);
  const latestNormalSemester = useAppSelector(selectLatestNormalSemester) ?? 0;
  const estimatedTrackDuration = latestNormalSemester / 4 + 0.5;

  const theme = useTheme();

  const [statsAnchor, setStatsAnchor] = useState<HTMLElement | null>(null);
  const openStats = Boolean(statsAnchor);
  const handleOpenStats = (e: React.MouseEvent<HTMLElement>) => setStatsAnchor(e.currentTarget);
  const handleCloseStats = () => setStatsAnchor(null);

  const commitRename = () => {
    const trimmed = tempName.trim();
    if (!trimmed || trimmed === activeName) {
      setIsEditingName(false);
      setTempName(activeName);
      return;
    }
    dispatch(timetableRenamed({ oldName: activeName, newName: trimmed }));
    setIsEditingName(false);
  };

  return (
    <Box sx={{ px: 0.5, py: { xs: 0.25, md: 1 } }}>
      {/* Desktop: single row layout */}
      <Stack
        direction="row"
        spacing={0}
        alignItems="center"
        flexWrap="nowrap"
        useFlexGap
        sx={{ 
          width: '100%', 
          overflow: 'hidden', 
          gap: 3,
          display: { xs: 'none', md: 'flex' }
        }}
      >
        {/* LEFT: Title actions */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          {isEditingName ? (
            <TextField
              variant="standard"
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setIsEditingName(false);
                  setTempName(activeName);
                }
              }}
              sx={{
                minWidth: 0,
                maxWidth: 300,
                '& .MuiInput-input': {
                  fontSize: '1.5rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          ) : (
            <Typography
              variant="h4"
              onClick={() => setIsEditingName(true)}
              sx={{
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 300,
                py: 0.85,
                fontSize: '1.5rem',
                lineHeight: 1.15,
              }}
              title={activeName}
            >
              {activeName}
            </Typography>
          )}

          <Tooltip title={isEditingName ? "Save name" : "Edit name"}>
            <IconButton
              size="small"
              onClick={() => (isEditingName ? commitRename() : setIsEditingName(true))}
              sx={{ 
                color: isEditingName ? "success.main" : "text.secondary",
                borderRadius: 1.5,
                "&:hover": { bgcolor: { xs: "transparent", md: "action.hover" } }
              }}
            >
              {isEditingName ? <CheckIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <TimetableDropdown />
        </Stack>

        {/* CENTER: Stats inline */}
        <Typography variant="body1" color="text.secondary" marginLeft="auto">
          <b>{totalCredits}</b> Units
          <Box component="span" sx={{ mx: 1 }}>/</Box>
          CGPA: <b>{Cgpa.toFixed(2)}</b>
          <Box component="span" sx={{ mx: 1 }}>/</Box>
          <b>{estimatedTrackDuration}</b> Years
        </Typography>

        {/* RIGHT: View controls (grouped) */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup
            value={isMinimalView ? "minimal" : "detailed"}
            exclusive
            onChange={(e, newView) => {
              if (newView !== null) dispatch(minimalViewToggled());
            }}
            size="small"
            sx={{ height: 32 }}
          >
            <ToggleButton value="detailed" aria-label="Detailed view">
              <Tooltip title="Detailed view">
                <ViewModuleIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="minimal" aria-label="Minimal view">
              <Tooltip title="Minimal view">
                <ViewCompactIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Mobile: two-row layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {/* Row 1: Title + Dropdown */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0, mb: 0.5 }}>
          {isEditingName ? (
            <TextField
              variant="standard"
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setIsEditingName(false);
                  setTempName(activeName);
                }
              }}
              sx={{
                minWidth: 0,
                flex: 1,
                '& .MuiInput-input': {
                  fontSize: '1rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          ) : (
            <Typography
              variant="h4"
              onClick={() => setIsEditingName(true)}
              sx={{
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                py: 0.35,
                fontSize: '0.95rem',
                lineHeight: 1.15,
              }}
              title={activeName}
            >
              {activeName}
            </Typography>
          )}

          <Tooltip title={isEditingName ? "Save" : "Edit name"}>
            <IconButton
              size="small"
              onClick={() => (isEditingName ? commitRename() : setIsEditingName(true))}
              sx={{ 
                color: isEditingName ? "success.main" : "text.secondary",
                borderRadius: 1.5,
                "&:hover": { bgcolor: "action.hover" }
              }}
            >
              {isEditingName ? <CheckIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <TimetableDropdown />
        </Stack>

        {/* Row 2: View controls */}
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Left: Sidebar toggle (Search when closed, Close when open) */}
          <Tooltip title={sidebarIsOpen ? "Close sidebar" : "Open sidebar"}>
            <IconButton
              size="small"
              onClick={() => dispatch(toggleSidebar())}
              sx={{ 
                color: "text.secondary",
                borderRadius: 1.5,
                "&:hover": { bgcolor: "action.hover" }
              }}
            >
              {sidebarIsOpen ? <CloseIcon fontSize="small" /> : <SearchIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Insights icon */}
          <Tooltip title="View stats">
            <IconButton 
              size="small" 
              onClick={handleOpenStats} 
              sx={{ 
                color: "text.secondary",
                borderRadius: 1.5,
                "&:hover": { bgcolor: "action.hover" }
              }}
            >
              <BarChartIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Spacer / margin */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Right: Toggle group */}
          <ToggleButtonGroup
            value={isMinimalView ? "minimal" : "detailed"}
            exclusive
            onChange={(e, newView) => {
              if (newView !== null) dispatch(minimalViewToggled());
            }}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="detailed" aria-label="Detailed view">
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="minimal" aria-label="Minimal view">
              <ViewCompactIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      {/* Mobile stats menu */}
      <Menu anchorEl={statsAnchor} open={openStats} onClose={handleCloseStats} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem disabled>
          <ListItemText primary={`${totalCredits} Units`} secondary={`CGPA: ${Cgpa.toFixed(2)} / ${estimatedTrackDuration} Years`} />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TimetableHeader;
