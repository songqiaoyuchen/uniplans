import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { sanitizeThemeColors, ThemeColorOverrides, ThemeMode } from "@/styles/themeColors";

interface ThemeState {
  mode: ThemeMode;
  customColors: Partial<Record<ThemeMode, ThemeColorOverrides>>;
}

const initialState: ThemeState = {
  mode: "dark",
  customColors: {},
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.mode = action.payload;
    },
    toggleTheme: (state) => {
      state.mode = state.mode === "light" ? "dark" : "light";
    },
    saveThemeColors: (state, action: PayloadAction<{ mode: ThemeMode; colors: ThemeColorOverrides }>) => {
      // Older saved preferences only contain `mode`.
      state.customColors ??= {};
      state.customColors[action.payload.mode] = sanitizeThemeColors(action.payload.colors);
    },
    resetThemeColors: (state, action: PayloadAction<ThemeMode>) => {
      if (state.customColors) delete state.customColors[action.payload];
    },
  },
});

export const { setTheme, toggleTheme, saveThemeColors, resetThemeColors } = themeSlice.actions;
export default themeSlice.reducer;
