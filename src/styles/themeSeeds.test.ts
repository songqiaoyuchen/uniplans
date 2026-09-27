import { getContrastRatio } from "@mui/material/styles";
import { isHexColor } from "./themeColors";
import { generateThemeColors, getPresetSeeds, themePresets } from "./themeSeeds";

describe("themes from three colour choices", () => {
  const cases = [
    ...themePresets.flatMap((preset) => [getPresetSeeds(preset, "light"), getPresetSeeds(preset, "dark")]),
    ...["#000000", "#ffffff", "#777777", "#ff0000", "#ffff00", "#0000ff", "#00ff00"].map((background) => ({
      primary: "#ff00ff", secondary: "#00ffff", background,
    })),
  ];

  test.each(cases)("generates readable text for $background with $primary", (seeds) => {
    const colours = generateThemeColors(seeds);
    expect(colours).toMatchObject(seeds);
    expect(Object.values(colours).every(isHexColor)).toBe(true);
    for (const background of [colours.background, colours.surface, colours.completed, colours.satisfied, colours.unsatisfied, colours.conflicted]) {
      expect(getContrastRatio(colours.text, background)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(colours.mutedText, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(new Set([colours.completed, colours.satisfied, colours.unsatisfied, colours.conflicted]).size).toBe(4);
  });

  test("changing a seed updates the automatically filled colours", () => {
    const original = getPresetSeeds(themePresets[0], "light");
    const before = generateThemeColors(original);
    const after = generateThemeColors({ ...original, primary: "#00aa88", background: "#101820" });
    expect(after.satisfied).not.toBe(before.satisfied);
    expect(after.surface).not.toBe(before.surface);
    expect(after.text).not.toBe(before.text);
    expect(after.completed).not.toBe(before.completed);
  });
});
