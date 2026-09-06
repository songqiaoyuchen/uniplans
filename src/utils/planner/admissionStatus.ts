import type { StudentContext } from '@/types/prerequisiteTypes';
import { isCohortYear } from '@/utils/prerequisites/validateStudentContext';

export const DEFAULT_PROGRAMME_TYPE = 'Undergraduate Degree';

export function getAdmissionContext(context?: StudentContext | null): StudentContext {
  return {
    cohortYear: context?.cohortYear ?? null,
    programmeType: context?.programmeType ?? DEFAULT_PROGRAMME_TYPE,
  };
}

export function getAdmissionCohortOptions(selectedYear?: number | null, currentYear = new Date().getUTCFullYear()) {
  const firstYear = 2020;
  const lastYear = currentYear + 1;
  const years = new Set(Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, index) => firstYear + index));
  if (isCohortYear(selectedYear)) years.add(selectedYear);
  return [...years].sort((a, b) => b - a).map(year => ({
    value: year,
    label: `AY${year}/${String(year + 1).slice(-2)}`,
  }));
}
