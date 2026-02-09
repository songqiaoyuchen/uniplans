import { useMemo } from 'react';
import { useAppSelector } from '@/store'; 
import { makeIsModulePlannedSelector, makeIsModuleRelatedSelector, makeIsModuleSelectedSelector, makeIsSemesterDraggedOverSelector, makeSelectModuleCodesBySemesterId, makeSelectModuleStateByCode } from '@/store/timetableSelectors';
import { useGetModuleByCodeQuery } from '@/store/apiSlice';
import { ModuleData, ModuleStatus } from '@/types/plannerTypes';
import { useTheme } from '@mui/material';

export const useModuleState = (moduleCode: string | null) => {
  // 1. Get module from timetable if available
  const existingModule = useAppSelector(
    (state) => (moduleCode ? state.timetable.modules.entities[moduleCode] ?? null : null)
  );

  // 2. Fetch from RTK only if not already stored
  const {
    data: staticData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetModuleByCodeQuery(moduleCode!, {
    skip: moduleCode === null || !!existingModule,
  });

  // 2. Memoized selectors
  const selectModuleState = useMemo(
    () => (moduleCode ? makeSelectModuleStateByCode(moduleCode) : () => null),
    [moduleCode]
  );
  const isModuleSelectedSelector = useMemo(
    () => (moduleCode ? makeIsModuleSelectedSelector(moduleCode) : () => false),
    [moduleCode]
  );
  const isModulePlannedSelector = useMemo(
    () => (moduleCode ? makeIsModulePlannedSelector(moduleCode) : () => false),
    [moduleCode]
  );
  const isModuleRelatedSelector = useMemo(
    () => (moduleCode ? makeIsModuleRelatedSelector(moduleCode) : () => false),
    [moduleCode]
  );

  // 3. Use selectors
  const moduleState = useAppSelector(selectModuleState);
  const isSelected = useAppSelector(isModuleSelectedSelector);
  const isPlanned = useAppSelector(isModulePlannedSelector);
  const isRelated = useAppSelector(isModuleRelatedSelector);

  // 4. Compose final module
  const mod = useMemo<ModuleData | null>(() => {
    if (existingModule) return existingModule;
    if (!staticData) return null;
    if (!moduleState) return staticData;

    return {
      ...staticData,
      status: moduleState.status,
      issues: moduleState.issues,
    };
  }, [existingModule, staticData, moduleState]);

  return {
    mod,
    isLoading: !existingModule && isLoading,
    isFetching: !existingModule && isFetching,
    isError,
    isSelected,
    isPlanned,
    isRelated,
    refetch,
  };
};

export const useSemesterState = (semesterId: number) => {
  const selectModuleCodes = useMemo(() => makeSelectModuleCodesBySemesterId(semesterId), [semesterId]);
  const moduleCodes = useAppSelector(selectModuleCodes);

  const isDraggedOverSelector = useMemo(() => makeIsSemesterDraggedOverSelector(semesterId), [semesterId]);
  const isDraggedOver = useAppSelector(isDraggedOverSelector);

  return {
    moduleCodes,
    isDraggedOver,
  };
};

export function useModuleCardColors(status: ModuleStatus = ModuleStatus.Satisfied) {
  const theme = useTheme();

  const {
    backgroundColors,
    borderColors,
    selectedBorderWidth,
    selectedGlowWidth,
    selectedBorderColor,
    relatedBorderColor,
  } = theme.palette.custom.moduleCard;

  return {
    backgroundColor: backgroundColors[status],
    borderColor: borderColors[status],
    selectedBorderWidth,
    selectedGlowWidth,
    selectedBorderColor,
    relatedBorderColor,
  };
}


