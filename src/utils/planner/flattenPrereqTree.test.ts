import { flattenPrereqTree } from './flattenPrereqTree';
import type { PrereqTree } from '@/types/plannerTypes';

const conditional: PrereqTree = {
  type: 'conditional', condition: { kind: 'cohort', rule: 'IF_IN', years: ['S:2024'] },
  then: { type: 'module', moduleCode: 'AR2328A' },
};

describe('context-aware prerequisite traversal', () => {
  test('only relates modules in applicable conditional paths', () => {
    expect([...flattenPrereqTree(conditional, { cohortYear: 2024, programmeType: null })]).toEqual(['AR2328A']);
    expect([...flattenPrereqTree(conditional, { cohortYear: 2023, programmeType: null })]).toEqual([]);
    expect([...flattenPrereqTree(conditional, null)]).toEqual([]);
  });

  test.each<PrereqTree | null>([
    null,
    { type: 'constant', value: true },
    { type: 'constant', value: false },
    { type: 'blocked', reason: 'Unavailable', moduleCode: 'BN2403' },
    { type: 'condition', condition: { kind: 'programType', rule: 'MUST_BE_IN', types: ['Graduate Degree Coursework'] } },
  ])('does not assume leaf nodes have children: %j', tree => {
    expect([...flattenPrereqTree(tree)]).toEqual([]);
  });

  test('retains independent alternatives while omitting blocked paths', () => {
    expect([...flattenPrereqTree({ type: 'OR', children: [conditional, { type: 'module', moduleCode: 'CS1010' }] })])
      .toEqual(['CS1010']);
  });
});
