// store/sidebarSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from ".";

interface SidebarState {
  // null means the user has not chosen yet: open on desktop, closed on mobile.
  isOpen: boolean | null;
  activeTab: number; // 0 = Details, 1 = Generate
}

const initialState: SidebarState = {
  isOpen: null,
  activeTab: 0,
};

const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      // The only default-open toggle is the desktop chevron.
      state.isOpen = state.isOpen === null ? false : !state.isOpen;
    },
    openSidebar: (state) => {
      state.isOpen = true;
    },
    closeSidebar: (state) => {
      state.isOpen = false;
    },
    setActiveTab: (state, action: PayloadAction<number>) => {
      state.activeTab = action.payload;
    },
  },
});

export const { toggleSidebar, openSidebar, closeSidebar, setActiveTab } =
  sidebarSlice.actions;
export default sidebarSlice.reducer;

// --- selectors ---
export const selectIsSidebarOpen = (state: RootState) => state.sidebar.isOpen;
export const selectActiveTab = (state: RootState) => state.sidebar.activeTab;

export const resolveSidebarOpen = (
  storedIsOpen: boolean | null,
  isMobile: boolean,
): boolean => storedIsOpen ?? !isMobile;
