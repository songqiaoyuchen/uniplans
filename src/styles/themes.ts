import { ModuleStatus } from "@/types/plannerTypes";
import { alpha, createTheme, darken, getContrastRatio, lighten, ThemeOptions } from "@mui/material/styles";
import { sanitizeThemeColors, ThemeColors, ThemeColorOverrides, ThemeMode } from "./themeColors";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/jetbrains-mono";

// ================= COMMON OPTIONS =================
const commonOptions: Partial<ThemeOptions> = {
  typography: {
    fontFamily: "Plus Jakarta Sans, Roboto, Arial, sans-serif",
    h1: { fontSize: "2.5rem", fontWeight: 700 },
    h2: { fontSize: "2rem", fontWeight: 600 },
    h3: { fontSize: "1.75rem", fontWeight: 500 },
    h4: { fontSize: "1.5rem", fontWeight: 500 },
    h5: { fontSize: "1.25rem", fontWeight: 400 },
    h6: { fontSize: "1rem", fontWeight: 400 },
    body1: { fontSize: "1rem", fontWeight: 400 },
    body2: { fontSize: "0.875rem", fontWeight: 400 },
    button: { fontSize: "0.875rem", fontWeight: 500 },
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          textTransform: "none",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
  },
};

// ================= LIGHT THEME =================
export const lightTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: "light",
    primary: { main: "#6741c3" },
    secondary: { main: "#ff80c8" },
    info: { main: "#40ace6" },
    success: { main: "#40ed48" },
    warning: { main: "#ef8937" },
    error: { main: "#ff240b" },
    background: { default: "#f6f8fb", paper: "#f1f3f6" },
    text: { primary: "#111827", secondary: "#4b5563" },
    custom: {
      moduleCard: {
        selectedBorderWidth: "2px",
        selectedGlowWidth: "5px",
        selectedBorderColor: "#8048dad2",
        relatedBorderColor: "#40c3d4cc",

        backgroundColors: {
          [ModuleStatus.Completed]:   "#DCEFE5", // Green-ish
          [ModuleStatus.Satisfied]:   "#EFEBF7", // Purple-ish (Added to match Dark Theme)
          [ModuleStatus.Unsatisfied]: "#F1E8CA", // Yellow-ish
          [ModuleStatus.Conflicted]:  "#F3D8D8", // Red-ish
        },
        borderColors: {
          [ModuleStatus.Completed]:   "#44a87666", // Adjusted alpha for visibility
          [ModuleStatus.Satisfied]:   "#6741c366", // Matches Primary
          [ModuleStatus.Unsatisfied]: "#a88b3a66", // Fixed invalid hex typo
          [ModuleStatus.Conflicted]:  "#c25a5a66", 
        },
      },
    },
  },
  components: {
    ...commonOptions.components,
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          "*::-webkit-scrollbar": { width: "8px", height: "8px" },
          "*::-webkit-scrollbar-track": { background: "#f2f4f6" },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: "#bfc6cc",
            borderRadius: "4px",
          },
          "*::-webkit-scrollbar-thumb:hover": { backgroundColor: "#9ea7ad" },
          "*": { scrollbarColor: "#bfc6cc #f2f4f6", scrollbarWidth: "normal" },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: "#000000" },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        input: { color: "#111827" },
        notchedOutline: { borderColor: "#e6e9ef" },
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#bea6f7",
          }, // primary.extraLight
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#6741c3",
          }, // primary.main
        },
      },
    },
  },
});

// ================= DARK THEME =================
export const darkTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: "dark",
    primary: { main: "#6741c3", extraLight: "#bea6f7" },
    secondary: { main: "#ff80c8" },
    info: { main: "#40ace6" },
    success: { main: "#40ed48" },
    warning: { main: "#ef8937" },
    error: { main: "#c92b19" },
    background: { default: "#1f1f1f", paper: "#2b2b2b" },
    text: { primary: "#ececec", secondary: "#acacac" },
    custom: {
      moduleCard: {
        selectedBorderWidth: "2px",         
        selectedGlowWidth: "5px",           
        selectedBorderColor: "#47fcb0cc",   
        relatedBorderColor: "#45c2d3ff",
        backgroundColors: {
          [ModuleStatus.Completed]:   "#1A3023",  
          [ModuleStatus.Satisfied]:   "#292341ff",
          [ModuleStatus.Unsatisfied]: "#2B2411",  
          [ModuleStatus.Conflicted]:  "#2E1212",  
        },

        borderColors: {
          [ModuleStatus.Completed]:   "#45C962CC",  
          [ModuleStatus.Satisfied]:   "#4f438bcc",  
          [ModuleStatus.Unsatisfied]: "#756229ff",  
          [ModuleStatus.Conflicted]:  "#E15A5ACC",
        },
      },
    },


  },
  components: {
    ...commonOptions.components,
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          "*::-webkit-scrollbar": { width: "8px", height: "8px" },
          "*::-webkit-scrollbar-track": { background: "#2d2d2d" },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: "#555555",
            borderRadius: "4px",
          },
          "*::-webkit-scrollbar-thumb:hover": { backgroundColor: "#888888" },
          "*": { scrollbarColor: "#555555 #2d2d2d", scrollbarWidth: "thin" },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: "#ededed" },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        input: { color: "#ececec" },
        notchedOutline: { borderColor: "#2b2b2b" },
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#bea6f7",
          }, // primary.extraLight
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#6741c3",
          }, // primary.main
        },
      },
    },
  },
});

export function getThemeColors(mode: ThemeMode): ThemeColors {
  const { palette } = mode === "light" ? lightTheme : darkTheme;
  const backgrounds = palette.custom.moduleCard.backgroundColors;
  return {
    primary: palette.primary.main,
    secondary: palette.secondary.main,
    background: palette.background.default,
    surface: palette.background.paper,
    text: palette.text.primary,
    mutedText: palette.text.secondary,
    completed: backgrounds[ModuleStatus.Completed].slice(0, 7),
    satisfied: backgrounds[ModuleStatus.Satisfied].slice(0, 7),
    unsatisfied: backgrounds[ModuleStatus.Unsatisfied].slice(0, 7),
    conflicted: backgrounds[ModuleStatus.Conflicted].slice(0, 7),
  };
}

export function createAppTheme(mode: ThemeMode, overrides?: ThemeColorOverrides) {
  const base = mode === "light" ? lightTheme : darkTheme;
  const valid = sanitizeThemeColors(overrides);
  if (Object.keys(valid).length === 0) return base;
  const colors = { ...getThemeColors(mode), ...valid };
  const primary = base.palette.augmentColor({ color: { main: colors.primary } });
  const secondary = base.palette.augmentColor({ color: { main: colors.secondary } });
  for (const accent of [primary, secondary]) {
    accent.contrastText = getContrastRatio(accent.main, "#000000") >= getContrastRatio(accent.main, "#ffffff")
      ? "#000000" : "#ffffff";
  }
  const moduleCard = base.palette.custom.moduleCard;
  const backgroundColors = { ...moduleCard.backgroundColors };
  const borderColors = { ...moduleCard.borderColors };
  const statuses = {
    completed: ModuleStatus.Completed,
    satisfied: ModuleStatus.Satisfied,
    unsatisfied: ModuleStatus.Unsatisfied,
    conflicted: ModuleStatus.Conflicted,
  } as const;
  for (const [key, status] of Object.entries(statuses)) {
    const value = valid[key as keyof typeof statuses];
    if (value) {
      backgroundColors[status] = value;
      borderColors[status] = mode === "dark" ? lighten(value, 0.35) : darken(value, 0.3);
    }
  }
  return createTheme({
    ...base,
    palette: {
      ...base.palette,
      primary: { ...primary, extraLight: lighten(colors.primary, 0.65) },
      secondary,
      background: { default: colors.background, paper: colors.surface },
      text: { primary: colors.text, secondary: colors.mutedText, disabled: alpha(colors.text, 0.38) },
      divider: alpha(colors.text, 0.16),
      action: {
        ...base.palette.action,
        active: alpha(colors.text, 0.65),
        hover: alpha(colors.text, 0.08),
        selected: alpha(colors.text, 0.16),
        disabled: alpha(colors.text, 0.3),
        disabledBackground: alpha(colors.text, 0.12),
        focus: alpha(colors.text, 0.12),
      },
      custom: { moduleCard: {
        ...moduleCard, backgroundColors, borderColors,
        selectedBorderColor: alpha(colors.primary, 0.8),
        relatedBorderColor: alpha(colors.secondary, 0.8),
      } },
    },
    components: {
      ...base.components,
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            "*::-webkit-scrollbar": { width: "8px", height: "8px" },
            "*::-webkit-scrollbar-track": { background: colors.background },
            "*::-webkit-scrollbar-thumb": { backgroundColor: alpha(colors.text, 0.3), borderRadius: "4px" },
            "*::-webkit-scrollbar-thumb:hover": { backgroundColor: alpha(colors.text, 0.5) },
            "*": { scrollbarColor: `${alpha(colors.text, 0.3)} ${colors.background}`, scrollbarWidth: "thin" },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { color: colors.mutedText } } },
      MuiOutlinedInput: {
        styleOverrides: {
          input: { color: colors.text },
          notchedOutline: { borderColor: alpha(colors.text, 0.25) },
          root: {
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: primary.light },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: primary.main },
          },
        },
      },
    },
  });
}
