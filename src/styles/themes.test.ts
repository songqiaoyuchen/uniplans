jest.mock("@fontsource/plus-jakarta-sans/400.css", () => ({}));
jest.mock("@fontsource/plus-jakarta-sans/500.css", () => ({}));
jest.mock("@fontsource/plus-jakarta-sans/600.css", () => ({}));
jest.mock("@fontsource/plus-jakarta-sans/700.css", () => ({}));
jest.mock("@fontsource/jetbrains-mono", () => ({}));

import { getContrastRatio } from "@mui/material/styles";
import { ModuleStatus } from "@/types/plannerTypes";
import { createAppTheme, darkTheme, getThemeColors, lightTheme } from "./themes";
import { isHexColor } from "./themeColors";
import { getNavbarColors } from "./navbarStyles";
import { generateThemeColors, getPresetSeeds, themePresets } from "./themeSeeds";

describe("custom theme generation", () => {
  test("preserves the original palettes for defaults and malformed saved colours", () => {
    expect(createAppTheme("dark")).toBe(darkTheme);
    expect(createAppTheme("light", { primary: "broken", surface: "#ff" })).toBe(lightTheme);
    expect(Object.values(getThemeColors("dark")).every(isHexColor)).toBe(true);
    expect(Object.values(getThemeColors("light")).every(isHexColor)).toBe(true);
  });

  test("recalculates derived accent colours and maps custom module backgrounds", () => {
    const theme = createAppTheme("dark", {
      primary: "#ffff00", secondary: "#009688", text: "#ffffff",
      background: "#101820", surface: "#152535", completed: "#345678",
    });
    expect(theme.palette.primary.main).toBe("#ffff00");
    expect(theme.palette.primary.light).not.toBe(darkTheme.palette.primary.light);
    expect(getContrastRatio(theme.palette.primary.main, theme.palette.primary.contrastText)).toBeGreaterThan(4.5);
    expect(theme.palette.background).toEqual({ default: "#101820", paper: "#152535" });
    expect(theme.palette.custom.moduleCard.backgroundColors[ModuleStatus.Completed]).toBe("#345678");
    expect(theme.palette.custom.moduleCard.borderColors[ModuleStatus.Completed]).not.toBe(darkTheme.palette.custom.moduleCard.borderColors[ModuleStatus.Completed]);
    expect(theme.palette.custom.moduleCard.backgroundColors[ModuleStatus.Conflicted]).toBe(darkTheme.palette.custom.moduleCard.backgroundColors[ModuleStatus.Conflicted]);
    expect(theme.components?.MuiOutlinedInput?.styleOverrides?.input).toEqual({ color: "#ffffff" });
    expect(darkTheme.palette.primary.main).toBe("#6741c3");
  });
});

describe.each(["light", "dark"] as const)("%s navbar contrast", (mode) => {
  const palettes = [
    { name: "Default", colors: undefined },
    ...themePresets.map((preset) => ({ name: preset.name, colors: generateThemeColors(getPresetSeeds(preset, mode)) })),
    ...["#000000", "#ffffff", "#777777", "#ffff00"].map((color) => ({
      name: color,
      colors: { primary: color, secondary: color, surface: color },
    })),
  ];

  test.each(palettes)("$name title and links stay readable, including hover", ({ colors }) => {
    const navbar = getNavbarColors(createAppTheme(mode, colors));
    for (const foreground of [navbar.text, navbar.highlight, navbar.highlightHover]) {
      expect(getContrastRatio(foreground, navbar.background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const foreground of [navbar.textOnHover, navbar.highlightOnHover]) {
      expect(getContrastRatio(foreground, navbar.hoverBackground)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
