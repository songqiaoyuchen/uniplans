export type ThemeMode = "light" | "dark";

export const themeColorFields = [
  { key: "primary", label: "Primary", description: "Buttons, links and highlights" },
  { key: "secondary", label: "Secondary", description: "Secondary accents" },
  { key: "background", label: "Background", description: "Main page background" },
  { key: "surface", label: "Surface", description: "Panels, menus and inputs" },
  { key: "text", label: "Main text", description: "Headings and body text" },
  { key: "mutedText", label: "Secondary text", description: "Descriptions and labels" },
  { key: "completed", label: "Completed", description: "Completed module cards" },
  { key: "satisfied", label: "Satisfied", description: "Modules with prerequisites met" },
  { key: "unsatisfied", label: "Unsatisfied", description: "Modules with missing prerequisites" },
  { key: "conflicted", label: "Conflicted", description: "Modules with scheduling conflicts" },
] as const;

export type ThemeColorKey = (typeof themeColorFields)[number]["key"];
export type ThemeColors = Record<ThemeColorKey, string>;
export type ThemeColorOverrides = Partial<ThemeColors>;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

// Validate persisted values before passing them to MUI's color utilities.
export function sanitizeThemeColors(value: unknown): ThemeColorOverrides {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(themeColorFields.flatMap(({ key }) =>
    isHexColor(source[key]) ? [[key, source[key]]] : [],
  ));
}
