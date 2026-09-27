"use client";

import { useState } from "react";
import {
  Alert, Box, Button, Chip, Container, Divider, Paper, Stack,
  Tab, Tabs, Typography,
} from "@mui/material";
import { alpha, ThemeProvider } from "@mui/material/styles";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import { useAppDispatch, useAppSelector } from "@/store";
import { resetThemeColors, saveThemeColors, setTheme } from "@/store/themeSlice";
import { createAppTheme, darkTheme, getThemeColors, lightTheme } from "@/styles/themes";
import {
  sanitizeThemeColors, themeColorFields, ThemeColors, ThemeMode,
} from "@/styles/themeColors";
import { generateThemeColors, getPresetSeeds, themePresets, themeSeedFields, ThemeSeeds } from "@/styles/themeSeeds";
import { ModuleStatus } from "@/types/plannerTypes";
import { navbarLinkStyles, navbarStyles, navbarTitleStyles } from "@/styles/navbarStyles";

const previewModules = [
  { code: "CS1101S", title: "Programming Methodology", status: ModuleStatus.Completed },
  { code: "CS2030S", title: "Programming Methodology II", status: ModuleStatus.Satisfied },
  { code: "CS2040S", title: "Data Structures and Algorithms", status: ModuleStatus.Unsatisfied },
  { code: "MA1521", title: "Calculus for Computing", status: ModuleStatus.Conflicted },
];

export default function CustomisationPage() {
  const dispatch = useAppDispatch();
  const { mode, customColors } = useAppSelector((state) => state.theme);
  const [drafts, setDrafts] = useState<Partial<Record<ThemeMode, ThemeColors>>>({});
  const [message, setMessage] = useState("");
  const defaults = getThemeColors(mode);
  const saved = { ...defaults, ...sanitizeThemeColors(customColors?.[mode]) };
  const draft = drafts[mode] ?? saved;
  const dirty = themeColorFields.some(({ key }) => draft[key].toLowerCase() !== saved[key].toLowerCase());
  const overrides = Object.fromEntries(themeColorFields
    .filter(({ key }) => draft[key].toLowerCase() !== defaults[key].toLowerCase())
    .map(({ key }) => [key, draft[key]]));
  const previewTheme = createAppTheme(mode, overrides);
  const { palette } = previewTheme;

  function updateColors(seeds: ThemeSeeds) {
    setDrafts((current) => ({ ...current, [mode]: generateThemeColors(seeds) }));
    setMessage("");
  }

  function saveColors() {
    dispatch(saveThemeColors({ mode, colors: overrides }));
    setMessage(`${mode === "light" ? "Light" : "Dark"} theme saved in this browser.`);
  }

  function resetColors() {
    dispatch(resetThemeColors(mode));
    setDrafts((current) => ({ ...current, [mode]: defaults }));
    setMessage(`${mode === "light" ? "Light" : "Dark"} theme restored to defaults.`);
  }

  return (
    // Keep the editor readable even if the saved palette has very low contrast.
    <ThemeProvider theme={mode === "light" ? lightTheme : darkTheme}>
      <Box component="main" sx={{ flex: 1, bgcolor: "background.default", color: "text.primary", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary", mb: 1.5 }}>
            <PaletteOutlinedIcon fontSize="small" />
            <Typography variant="overline" sx={{ letterSpacing: "0.12em" }}>Make it yours</Typography>
          </Stack>
          <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, mb: 1.5 }}>
            Customisation
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 620, mb: 4 }}>
            Pick a ready-made theme or choose three colours you love.
            We’ll take care of the text, panels and module colours for you.
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" }, gap: 4, alignItems: "start" }}>
            <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 }, backgroundImage: "none" }}>
              <Tabs
                value={mode}
                onChange={(_, value: ThemeMode) => { dispatch(setTheme(value)); setMessage(""); }}
                aria-label="Theme mode to customise"
                variant="fullWidth"
                sx={{ mb: 3 }}
              >
                <Tab value="light" label="Light mode" icon={<LightModeOutlinedIcon fontSize="small" />} iconPosition="start" />
                <Tab value="dark" label="Dark mode" icon={<DarkModeOutlinedIcon fontSize="small" />} iconPosition="start" />
              </Tabs>
              <Typography component="h2" variant="h5" fontWeight={700}>Choose a look</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                Start with a favourite, then make it your own.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, mb: 3 }}>
                {themePresets.map((preset) => {
                  const seeds = getPresetSeeds(preset, mode);
                  const colours = generateThemeColors(seeds);
                  const selected = themeColorFields.every(({ key }) => draft[key].toLowerCase() === colours[key].toLowerCase());
                  return (
                    <Button
                      key={preset.name}
                      variant="outlined"
                      color="inherit"
                      aria-pressed={selected}
                      onClick={() => updateColors(seeds)}
                      sx={{ p: 1.5, borderRadius: 2, borderColor: selected ? "primary.main" : "divider", bgcolor: selected ? "action.selected" : undefined }}
                    >
                      <Stack spacing={1} alignItems="center">
                        <Stack direction="row" spacing={0.5} aria-hidden="true">
                          {Object.values(seeds).map((colour, index) => (
                            <Box key={index} sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: colour, border: "1px solid", borderColor: "divider" }} />
                          ))}
                        </Stack>
                        <Box component="span">{preset.name}{selected ? " ✓" : ""}</Box>
                      </Stack>
                    </Button>
                  );
                })}
              </Box>
              <Typography component="h2" variant="h6" fontWeight={700} sx={{ mb: 2 }}>Make it yours</Typography>
              <Stack spacing={2.5}>
                {themeSeedFields.map(({ key, label, description }) => (
                  <Box key={key}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
                      <Box sx={{ flex: "1 1 150px" }}>
                        <Typography component="label" htmlFor={`${key}-colour`} variant="body2" fontWeight={600} sx={{ display: "block", cursor: "pointer" }}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary">{description}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box
                          component="input"
                          type="color"
                          id={`${key}-colour`}
                          value={draft[key]}
                          onChange={(event) => updateColors({ ...draft, [key]: event.target.value })}
                          aria-label={`${label} picker`}
                          sx={{
                            width: 56, height: 44, p: 0.5, border: "1px solid", borderColor: "divider",
                            borderRadius: 1.5, bgcolor: "background.default", cursor: "pointer",
                            caretColor: "transparent", userSelect: "none",
                            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                          }}
                        />
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ my: 3 }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="contained" onClick={saveColors} disabled={!dirty} startIcon={<CheckRoundedIcon />}>
                  Save colours
                </Button>
                <Button color="inherit" onClick={resetColors} startIcon={<RestartAltIcon />}>
                  Reset {mode} mode
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                Saved on this device in this browser. Each mode has its own palette.
              </Typography>
              {message && <Alert severity="success" role="status" sx={{ mt: 2 }}>{message}</Alert>}
            </Paper>

            <Box sx={{ position: { md: "sticky" }, top: 88, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography component="h2" variant="h5" fontWeight={700}>Live preview</Typography>
                <Chip size="small" label={dirty ? "Unsaved changes" : "Saved palette"} variant="outlined" />
              </Stack>
              <ThemeProvider theme={previewTheme}>
                <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 3, bgcolor: "background.default", backgroundImage: "none" }}>
                  <Box sx={(theme) => ({ ...navbarStyles(theme), px: 3, py: 2 })}>
                    <Typography sx={navbarTitleStyles}>UNIPLANS</Typography>
                    <Stack direction="row" sx={{ mt: 1, flexWrap: "wrap" }}>
                      {["Home", "Planner", "Customise"].map((page) => (
                        <Button key={page} component="span" tabIndex={-1} disableRipple sx={(theme) => navbarLinkStyles(theme, page === "Planner")}>
                          {page}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                  <Box sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="overline" color="text.secondary">Your academic plan</Typography>
                    <Typography variant="h4" component="h3" sx={{ mt: 0.5, mb: 2, fontWeight: 700 }}>A little more you.</Typography>
                    <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, backgroundImage: "none" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={600}>Year 1 · Semester 1</Typography>
                        <Chip label="16 units" size="small" color="secondary" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        A sample of your planner with these colours.
                      </Typography>
                    </Paper>
                    <Stack spacing={1.5}>
                      {previewModules.map(({ code, title, status }) => (
                        <Box key={code} sx={{
                          p: 2, borderRadius: 2, border: "2px solid",
                          bgcolor: palette.custom.moduleCard.backgroundColors[status],
                          borderColor: palette.custom.moduleCard.borderColors[status],
                          color: "text.primary",
                        }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="body2" fontWeight={700}>{code}</Typography>
                            <Typography variant="caption" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha(palette.text.primary, 0.08) }}>{status}</Typography>
                          </Stack>
                          <Typography variant="body2" sx={{ mt: 0.75 }}>{title}</Typography>
                          <Typography variant="caption" color="text.secondary">4 units</Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                      <Button variant="contained" tabIndex={-1} sx={{ pointerEvents: "none" }}>Add module</Button>
                      <Button variant="outlined" color="secondary" tabIndex={-1} sx={{ pointerEvents: "none" }}>View plan</Button>
                    </Stack>
                  </Box>
                </Paper>
              </ThemeProvider>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.7 }}>
                Text and card colours adjust automatically as you choose.
                Save your colours when you’re happy with the preview.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
