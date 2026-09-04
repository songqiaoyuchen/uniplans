import reducer, {
  closeSidebar,
  openSidebar,
  resolveSidebarOpen,
  toggleSidebar,
} from "./sidebarSlice";

describe("sidebar responsive default", () => {
  test("opens on desktop and stays closed on mobile before a choice is stored", () => {
    const state = reducer(undefined, { type: "test/init" });

    expect(resolveSidebarOpen(state.isOpen, false)).toBe(true);
    expect(resolveSidebarOpen(state.isOpen, true)).toBe(false);
  });

  test("persists explicit open and closed choices across viewport sizes", () => {
    const opened = reducer(undefined, openSidebar());
    const closed = reducer(opened, closeSidebar());

    expect(resolveSidebarOpen(opened.isOpen, true)).toBe(true);
    expect(resolveSidebarOpen(closed.isOpen, false)).toBe(false);
  });

  test("the first desktop toggle closes the default-open sidebar", () => {
    const state = reducer(undefined, toggleSidebar());

    expect(state.isOpen).toBe(false);
  });
});
