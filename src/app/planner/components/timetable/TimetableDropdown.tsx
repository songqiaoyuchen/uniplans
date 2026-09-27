// components/TimetableDropdown.tsx
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  TextField,
  Box,
} from "@mui/material";
import { Snackbar, Alert } from "@mui/material";
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import ShareIcon from "@mui/icons-material/Share";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store";
import { importTimetableFromSnapshot, switchTimetable } from "@/store/plannerSlice"; // thunk
import {
  timetableAdded,
  timetableRemoved,
  timetableRenamed,
  timetableUpdated,
} from "@/store/plannerSlice";
import type { Timetable } from "@/store/plannerSlice";
import type { ModuleData, TimetableSnapshot } from "@/types/plannerTypes";
import type { EntityState } from "@reduxjs/toolkit";
import { cloneEntityState } from "@/utils/cloneEntityState";
import { serializeTimetable } from "@/utils/planner/shareTimetable";
import { useMemo, useState } from "react";
import ImportTimetableDialog from "./ImportTimetableDialog";
import { uniqueTimetableName } from "@/utils/planner/uniqueTimetableName";

const TimetableDropdown: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // timetable tabs
  const activeName = useSelector(
    (state: RootState) => state.planner.activeTimetableName
  );
  const allIds = useSelector(
    (state: RootState) => state.planner.timetables.ids
  ) as string[];
  const allEntities = useSelector(
    (state: RootState) => state.planner.timetables.entities
  ) as Record<string, Timetable | undefined>;

  const timetables: Timetable[] = useMemo(
    () => allIds.map((id) => allEntities[id]).filter(Boolean) as Timetable[],
    [allIds, allEntities]
  );

  const workingModules = useSelector((state: RootState) => state.timetable.modules);
  const workingSemesters = useSelector((state: RootState) => state.timetable.semesters);
  const workingStudentContext = useSelector((state: RootState) => state.timetable.studentContext);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const open = Boolean(anchorEl);
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const uniqueName = (base: string) => uniqueTimetableName(base, allIds);

  const onSwitch = (name: string) => {
    if (name !== activeName) {
      dispatch(switchTimetable(name));
    }
    handleClose();
  };

  const onCreateEmpty = () => {
    const name = uniqueName("New Timetable");
    dispatch(timetableAdded({ name }));     // create empty
    dispatch(switchTimetable(name));        // save current → set active → load new
    handleClose();
  };

  const onDuplicate = (nameToCopy: string) => {
    const src = allEntities[nameToCopy];
    if (!src && nameToCopy !== activeName) return;
    const dupName = uniqueName(`${nameToCopy} Copy`);

    // If duplicating the currently active timetable, use the working slice
    // (this contains any unsaved changes). Otherwise clone from stored src.
    const modulesSource = nameToCopy === activeName ? workingModules : src!.modules;
    const semestersSource = nameToCopy === activeName ? workingSemesters : src!.semesters;

    // clone modules and semesters from the chosen source
    const modulesClone = cloneEntityState<ModuleData>(
      modulesSource as EntityState<ModuleData, string>
    );
    const semestersClone = cloneEntityState(semestersSource);

    dispatch(timetableAdded({ name: dupName }));
    dispatch(
      timetableUpdated({
        name: dupName,
        modules: modulesClone,
        semesters: semestersClone,
        studentContext: (nameToCopy === activeName ? workingStudentContext : src!.studentContext) ?? null,
      })
    );
    dispatch(switchTimetable(dupName));
    handleClose();
  };

  const onDelete = (nameToDelete: string) => {
    if (nameToDelete === activeName) return;
    dispatch(timetableRemoved(nameToDelete));
  };

  const startRename = (name: string) => {
    setEditingName(name);
    setRenameValue(name);
  };

  const cancelRename = () => {
    setEditingName(null);
    setRenameValue("");
  };

  const commitRename = () => {
    if (!editingName) return;
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== editingName) {
      dispatch(timetableRenamed({ oldName: editingName, newName: trimmed }));
    }
    cancelRename();
  };

  // export / share
  const onShare = async (name: string) => {
    const stored = allEntities[name];
    if (!stored) return;

    const tt: Timetable =
      name === activeName
        ? { ...stored, modules: workingModules, semesters: workingSemesters }
        : stored;

    try {
      const snapshot = serializeTimetable(tt);

      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });

      if (!res.ok) throw new Error("Failed to create snapshot");

      const { id } = await res.json();
      const url = `${window.location.origin}/planner?id=${id}`;

      await navigator.clipboard.writeText(url);
      showSnackbar("Share link copied to clipboard", "success");
    } catch (err) {
      console.error(err);
      showSnackbar("Failed to share timetable", "error");
    }
  };


  // import / load
  const [importOpen, setImportOpen] = useState(false);

  function extractSnapshotId(input: string): string | null {
    const trimmed = input.trim();

    // Case 1: looks like a raw ID
    if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed)) {
      return trimmed;
    }

    // Case 2: try parsing as URL
    try {
      const url = new URL(trimmed);
      return url.searchParams.get("id");
    } catch {
      return null;
    }
  }

  const onImport = async (input: string) => {
    const id = extractSnapshotId(input);
    if (!id) {
      showSnackbar("Invalid link or snapshot ID", "error");
      return;
    }

    try {
      const res = await fetch(`/api/snapshot/${id}`);
      if (!res.ok) throw new Error("Snapshot not found");

      const snapshot: TimetableSnapshot = await res.json();
      if (snapshot.version !== 1) throw new Error("Unsupported snapshot version");

      const name = uniqueName("Imported Timetable");

      await dispatch(importTimetableFromSnapshot(snapshot, name));

      showSnackbar("Timetable imported. Set your own admission cohort and programme in Generate.", "info");
    } catch (err) {
      console.error(err);
      showSnackbar("Failed to import timetable", "error");
    } finally {
      setImportOpen(false);
      handleClose();
    }
  };


  type SnackbarState = {
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  };

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "info",
  });

  const showSnackbar = (
    message: string,
    severity: SnackbarState["severity"]
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <>
      <Box className="non-text-control" sx={{ display: "flex", alignItems: "center", gap: 0 }}>
        <Tooltip title="Create new timetable">
          <IconButton
            size="small"
            aria-label="Create new timetable"
            onClick={onCreateEmpty}
            sx={{
              color: "text.secondary",
              borderRadius: 1.5,
              width: 40,
              height: 40,
              p: 0,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <AddIcon sx={{ fontSize: 30 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Switch / manage timetables">
          <IconButton
            size="small"
            aria-label="Switch / manage timetables"
            onClick={handleOpen}
            sx={{
              color: "text.secondary",
              borderRadius: 1.5,
              p: 0,
              "&:hover": { bgcolor: "action.hover" }
            }}
          >
            <ArrowDropDownIcon sx={{ fontSize: 40 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 320, borderRadius: 2 } } }}
      >
        {timetables.map((tt) => {
          const name = tt.name;
          const isActive = name === activeName;
          return (
            <MenuItem
              key={name}
              dense
              onClick={() => onSwitch(name)}
              selected={isActive}
              sx={{ gap: 1 }}
            >
              {editingName === name ? (
                <TextField
                  variant="standard"
                  size="small"
                  autoFocus
                  fullWidth
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={commitRename}
                  slotProps={{ htmlInput: { "aria-label": `Rename ${name}` } }}
                  sx={{ minWidth: 0 }}
                />
              ) : (
                <ListItemText
                  primary={name}
                  slotProps={{ primary: {
                    noWrap: true,
                    fontWeight: isActive ? 600 : 400,
                  }}} />
              )}
              <Tooltip title="Rename">
                <IconButton
                  edge="end"
                  size="small"
                  onMouseDown={(e) => {
                    if (editingName === name) e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingName === name) {
                      commitRename();
                    } else {
                      startRename(name);
                    }
                  }}
                >
                  {editingName === name ? (
                    <CheckIcon fontSize="inherit" />
                  ) : (
                    <EditIcon fontSize="inherit" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicate">
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(name);
                  }}
                >
                  <ContentCopyIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Share">
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(name);
                  }}
                >
                  <ShareIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title={isActive ? "Cannot delete active timetable" : "Delete"}>
                <span>
                  <IconButton
                    edge="end"
                    size="small"
                    disabled={isActive}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(name);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          dense
          onClick={() => {
            setImportOpen(true);
            handleClose();
          }}
          sx={{ gap: 1 }}
        >
          <ListItemIcon>
            <FileUploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Import timetable" />
        </MenuItem>
      </Menu>
      <ImportTimetableDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={onImport}
      />

      {/* notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default TimetableDropdown;
