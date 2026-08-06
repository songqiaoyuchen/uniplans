import { ModuleStatus } from '@/types/plannerTypes';
import { mapModuleCodesForDisplay } from './mapModuleCodesForDisplay';

describe('mapModuleCodesForDisplay', () => {
  const catalogue = [
    { code: 'CS1010', title: 'Programming Methodology' },
  ];

  test('keeps modules that still exist in the catalogue', () => {
    expect(mapModuleCodesForDisplay(['CS1010'], catalogue)).toEqual([
      {
        code: 'CS1010',
        title: 'Programming Methodology',
        status: ModuleStatus.Satisfied,
      },
    ]);
  });

  test('keeps stale selections visible so they can be removed', () => {
    expect(mapModuleCodesForDisplay(['OLD1000'], catalogue)).toEqual([
      {
        code: 'OLD1000',
        title: 'No longer available in the current module catalogue',
        status: ModuleStatus.Conflicted,
      },
    ]);
  });
});
