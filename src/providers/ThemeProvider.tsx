"use client";

import { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createAppTheme } from "@/styles/themes";
import { RootState } from "@/store";
import { toggleTheme } from "@/store/themeSlice";
import { createContext, useContext } from "react";

const ThemeContext = createContext({
  mode: "light" as "light" | "dark",
  toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch();
  const mode = useSelector((state: RootState) => state.theme.mode);
  const colors = useSelector((state: RootState) => state.theme.customColors?.[mode]);

  const theme = useMemo(
    () => createAppTheme(mode, colors),
    [mode, colors],
  );

  return (
    <ThemeContext.Provider
      value={{ mode, toggleTheme: () => dispatch(toggleTheme()) }}
    >
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
