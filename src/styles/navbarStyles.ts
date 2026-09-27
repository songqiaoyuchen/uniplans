import { darken, decomposeColor, getContrastRatio, lighten, Theme } from "@mui/material/styles";

export function getNavbarColors({ palette }: Theme) {
  const background = palette.mode === "light" ? palette.primary.main : palette.background.paper;
  // Measure the existing translucent hover colour over the actual AppBar surface.
  // Only adjust foregrounds; keep the navbar background and hover styling intact.
  const overlay = decomposeColor(palette.action.hover).values;
  const base = decomposeColor(background).values;
  const opacity = overlay[3] ?? 1;
  const hoverBackground = `rgb(${base.slice(0, 3).map((channel, index) =>
    Math.round(channel * (1 - opacity) + overlay[index] * opacity)).join(", ")})`;
  const readableAccent = (accent: string, surface = background) => {
    const text = getContrastRatio(surface, "#000000") >= getContrastRatio(surface, "#ffffff")
      ? "#000000" : "#ffffff";
    for (let step = 0; step <= 100; step++) {
      const candidate = text === "#ffffff" ? lighten(accent, step / 100) : darken(accent, step / 100);
      if (getContrastRatio(candidate, surface) >= 4.5) {
        return candidate;
      }
    }
    return text;
  };
  const accent = palette.mode === "light" ? palette.secondary.main : palette.primary.light;

  return {
    background,
    text: readableAccent(palette.primary.contrastText),
    hoverBackground,
    textOnHover: readableAccent(palette.primary.contrastText, hoverBackground),
    highlight: readableAccent(accent),
    highlightOnHover: readableAccent(accent, hoverBackground),
    highlightHover: readableAccent(palette.mode === "light" ? palette.secondary.light : palette.primary.extraLight ?? palette.primary.light),
  };
}

export function navbarStyles(theme: Theme) {
  const colors = getNavbarColors(theme);
  return {
    bgcolor: colors.background,
    color: theme.palette.mode === "light" ? theme.palette.primary.contrastText : theme.palette.text.primary,
    backgroundImage: "none", caretColor: "transparent", userSelect: "none",
  } as const;
}

export function navbarTitleStyles(theme: Theme) {
  const colors = getNavbarColors(theme);
  return {
    fontFamily: "monospace",
    fontWeight: 700,
    fontSize: "1.5rem",
    letterSpacing: ".3rem",
    color: colors.highlight,
    textDecoration: "none",
    userSelect: "none",
    "&:hover": { color: colors.highlightHover },
  } as const;
}

export function navbarLinkStyles(theme: Theme, active: boolean) {
  const colors = getNavbarColors(theme);
  const filled = active && theme.palette.mode === "light";
  return {
    // Reverse the contrast-checked pair so selection survives similar text colours.
    color: filled ? colors.background : active ? colors.highlight : colors.text,
    bgcolor: filled ? colors.highlight : "transparent",
    borderRadius: 2,
    px: 2,
    py: 1,
    "&:hover": {
      bgcolor: filled ? colors.highlightOnHover : "action.hover",
      color: filled ? colors.hoverBackground : active ? colors.highlightOnHover : colors.textOnHover,
    },
  };
}
