import type { MouseEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { rootReducer } from '@/store';
import { closeSidebar, openSidebar, resolveSidebarOpen, toggleSidebar } from '@/store/sidebarSlice';
import TimetableHeader from './TimetableHeader';

jest.mock('./TimetableDropdown', () => ({ __esModule: true, default: () => null }));
jest.mock('@mui/material/useMediaQuery', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@mui/material/IconButton', () => ({
  __esModule: true,
  default: jest.fn(({ children, 'aria-label': label }: IconButtonProps) => <button aria-label={label}>{children}</button>),
}));
jest.mock('redux-persist', () => ({ ...jest.requireActual('redux-persist'), persistStore: jest.fn() }));
jest.mock('redux-persist/lib/storage', () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

describe('responsive search button', () => {
  beforeEach(() => {
    jest.mocked(useMediaQuery).mockReturnValue(true);
    jest.mocked(IconButton).mockClear();
  });

  function searchButton(store: ReturnType<typeof createStore>, name: string) {
    jest.mocked(IconButton).mockClear();
    renderToStaticMarkup(<Provider store={store}><TimetableHeader /></Provider>);
    const button = jest.mocked(IconButton).mock.calls.find(([props]) => props['aria-label'] === name)?.[0];
    expect(button).toBeDefined();
    return button!;
  }

  function createStore() {
    return configureStore({ reducer: rootReducer });
  }

  test('opens the default-closed mobile drawer on the first tap and closes on the next', () => {
    const store = createStore();
    expect(store.getState().sidebar.isOpen).toBeNull();
    searchButton(store, 'Search modules').onClick?.({} as MouseEvent<HTMLButtonElement>);
    expect(store.getState().sidebar.isOpen).toBe(true);
    expect(resolveSidebarOpen(store.getState().sidebar.isOpen, true)).toBe(true);
    searchButton(store, 'Close module search').onClick?.({} as MouseEvent<HTMLButtonElement>);
    expect(store.getState().sidebar.isOpen).toBe(false);
  });

  test.each([true, false])('respects an explicitly stored open state of %s', (open) => {
    const store = createStore();
    store.dispatch(open ? openSidebar() : closeSidebar());
    searchButton(store, open ? 'Close module search' : 'Search modules').onClick?.({} as MouseEvent<HTMLButtonElement>);
    expect(store.getState().sidebar.isOpen).toBe(!open);
  });

  test('keeps the existing desktop default-open toggle behavior', () => {
    const store = createStore();
    expect(resolveSidebarOpen(store.getState().sidebar.isOpen, false)).toBe(true);
    store.dispatch(toggleSidebar());
    expect(resolveSidebarOpen(store.getState().sidebar.isOpen, false)).toBe(false);
  });
});
