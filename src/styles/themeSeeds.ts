import { getContrastRatio } from "@mui/material/styles";
import { ThemeColors, ThemeMode } from "./themeColors";

export const themeSeedFields = [
  { key: "primary", label: "Main colour", description: "Your buttons and main highlights" },
  { key: "secondary", label: "Highlight colour", description: "A little extra colour for badges and details" },
  { key: "background", label: "Page colour", description: "The backdrop for your planner" },
] as const;

export type ThemeSeeds = Pick<ThemeColors, (typeof themeSeedFields)[number]["key"]>;

export const themePresets = [
  { name: "Lavender", primary: "#7952cc", secondary: "#c95c9f", light: "#f7f5fc", dark: "#201c2b" },
  { name: "Ocean", primary: "#287bb5", secondary: "#289e99", light: "#f1f7fb", dark: "#18242e" },
  { name: "Forest", primary: "#39805e", secondary: "#bd8840", light: "#f3f7f2", dark: "#1b2721" },
  { name: "Sunset", primary: "#bd5941", secondary: "#b56898", light: "#fcf5f0", dark: "#2b201f" },
] as const;

export function getPresetSeeds(preset: (typeof themePresets)[number], mode: ThemeMode): ThemeSeeds {
  return { primary: preset.primary, secondary: preset.secondary, background: preset[mode] };
}

function mix(from: string, to: string, amount: number): string {
  const channels = [1, 3, 5].map((offset) => {
    const start = parseInt(from.slice(offset, offset + 2), 16);
    const end = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

// Only the three seed colours are user choices. Derive readable text and gently
// tinted panels/cards even when someone chooses an unusually bright backdrop.
export function generateThemeColors(seeds: ThemeSeeds): ThemeColors {
  const { primary, secondary, background } = seeds;
  const text = getContrastRatio(background, "#000000") >= getContrastRatio(background, "#ffffff")
    ? "#000000" : "#ffffff";
  const surface = mix(background, text === "#000000" ? "#ffffff" : "#000000", 0.12);
  const card = (colour: string) => {
    for (let weight = 0.16; weight > 0; weight -= 0.02) {
      const tint = mix(surface, colour, weight);
      if (getContrastRatio(text, tint) >= 4.5) return tint;
    }
    return surface;
  };
  const cards = {
    completed: card("#37a66b"),
    satisfied: card(primary),
    unsatisfied: card("#dca329"),
    conflicted: card("#db5252"),
  };
  const backgrounds = [background, surface, ...Object.values(cards)];
  let mutedText = text;
  for (let weight = 0.3; weight > 0; weight -= 0.025) {
    const candidate = mix(text, background, weight);
    if (backgrounds.every((colour) => getContrastRatio(candidate, colour) >= 4.5)) {
      mutedText = candidate;
      break;
    }
  }
  return { primary, secondary, background, surface, text, mutedText, ...cards };
}
