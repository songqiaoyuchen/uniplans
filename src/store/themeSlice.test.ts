import reducer, { resetThemeColors, saveThemeColors, toggleTheme } from "./themeSlice";

describe("custom theme preferences", () => {
  test("keeps independent palettes when toggling or resetting a mode", () => {
    let state = reducer(undefined, saveThemeColors({ mode: "dark", colors: { primary: "#abcdef" } }));
    state = reducer(state, saveThemeColors({ mode: "light", colors: { background: "#fafafa" } }));
    state = reducer(state, toggleTheme());
    expect(state.mode).toBe("light");
    expect(state.customColors.dark).toEqual({ primary: "#abcdef" });
    state = reducer(state, resetThemeColors("light"));
    expect(state.customColors.light).toBeUndefined();
    expect(state.customColors.dark).toEqual({ primary: "#abcdef" });
  });

  test("supports preferences saved before custom colours existed", () => {
    const legacy = JSON.parse('{"mode":"dark"}');
    expect(reducer(legacy, resetThemeColors("dark"))).toEqual(legacy);
    const state = reducer(legacy, saveThemeColors({ mode: "dark", colors: { primary: "#008080" } }));
    expect(state.customColors.dark).toEqual({ primary: "#008080" });
  });

  test("discards incomplete and unsupported colours before saving", () => {
    const state = reducer(undefined, saveThemeColors({
      mode: "light", colors: { primary: "#ab", text: "red", surface: "#FAFAFA" },
    }));
    expect(state.customColors.light).toEqual({ surface: "#FAFAFA" });
  });
});
