import { MiniModuleData, ModuleStatus } from '@/types/plannerTypes';

export type DisplayModule = Pick<MiniModuleData, 'code' | 'title'> & {
  status: ModuleStatus;
};

const UNAVAILABLE_MODULE_TITLE = 'No longer available in the current module catalogue';

/**
 * Keep persisted module selections visible even when a catalogue refresh removes
 * their metadata. This gives the user a way to remove stale selections.
 */
export const mapModuleCodesForDisplay = (
  moduleCodes: string[],
  catalogue: MiniModuleData[],
): DisplayModule[] => {
  const modulesByCode = new Map(catalogue.map((module) => [module.code, module]));

  return moduleCodes.map((code) => {
    const catalogueModule = modulesByCode.get(code);

    return {
      code,
      title: catalogueModule?.title ?? UNAVAILABLE_MODULE_TITLE,
      status: catalogueModule ? ModuleStatus.Satisfied : ModuleStatus.Conflicted,
    };
  });
};
