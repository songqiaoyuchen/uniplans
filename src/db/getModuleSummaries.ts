import miniModuleData from '@/data/miniModuleData.json';
import type { MiniModuleData } from '@/types/plannerTypes';

const summariesByCode = new Map<string, MiniModuleData>(
  miniModuleData.map((module) => [module.code.toUpperCase(), module] as const),
);

/**
 * Return only the fields needed to label lightweight module references.
 * This module is consumed by route handlers, never by client components.
 */
export function getModuleSummaries(codes: readonly string[]): MiniModuleData[] {
  const summaries: MiniModuleData[] = [];

  for (const code of codes) {
    const summary = summariesByCode.get(code.toUpperCase());
    if (summary) summaries.push(summary);
  }

  return summaries;
}
