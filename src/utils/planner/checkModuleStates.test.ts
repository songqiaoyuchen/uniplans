import { checkModuleStates } from './checkModuleStates';
import { ModuleData, ModuleStatus, PrereqTree } from '@/types/plannerTypes';
import type { StudentContext } from '@/types/prerequisiteTypes';
import { evaluatePrerequisite } from '@/utils/prerequisites/evaluatePrerequisite';

const moduleData = (code: string, requires?: PrereqTree): ModuleData => ({
  id: code, code, title: code, credits: 4, semestersOffered: [0, 1, 2, 3],
  exam: null, preclusions: [], requires, prerequisiteSchemaVersion: 2,
});
const moduleNode = (moduleCode: string): PrereqTree => ({ type: 'module', moduleCode });
const condition: PrereqTree = {
  type: 'condition',
  condition: { kind: 'cohort', rule: 'MUST_BE_IN', years: ['S:2024'] },
};
const context: StudentContext = { cohortYear: 2024, programmeType: 'Undergraduate Degree' };
const blocked: PrereqTree = { type: 'blocked', reason: 'Not available in the catalogue', moduleCode: 'BN2403' };

function check(tree: PrereqTree, studentContext: StudentContext | null = null, completed: string[] = []) {
  return checkModuleStates({
    semesterEntities: { 0: { id: 0, moduleCodes: ['CS4000'] } },
    moduleEntities: { CS4000: moduleData('CS4000', tree) },
    exemptedModules: completed,
    studentContext,
  })[0].changes;
}

describe('browser prerequisite semantics', () => {
  test('requires missing context only on dependent paths', () => {
    expect(check(condition).issues).toContainEqual({
      type: 'PrerequisiteContext', message: expect.stringContaining('admission cohort'),
    });
    expect(check(condition, context).status).toBe(ModuleStatus.Satisfied);
    expect(check({ type: 'OR', children: [condition, moduleNode('CS1010')] }, null, ['CS1010']))
      .toEqual({ status: ModuleStatus.Satisfied, issues: [] });
  });

  test('context-only OR alternatives do not impose the historical module path', () => {
    const tree: PrereqTree = { type: 'OR', children: [condition, { type: 'AND', children: [moduleNode('MA2101'), moduleNode('MA2108')] }] };
    expect(check(tree, context).status).toBe(ModuleStatus.Satisfied);
    expect(check(tree, { ...context, cohortYear: 2023 }).status).toBe(ModuleStatus.Unsatisfied);
    expect(check(tree, { ...context, cohortYear: 2023 }, ['MA2101', 'MA2108']).status).toBe(ModuleStatus.Satisfied);
  });

  test('conditional programme requirements are implications, not unconditional requirements', () => {
    const tree: PrereqTree = {
      type: 'conditional',
      condition: { kind: 'programType', rule: 'IF_IN', types: ['Graduate Degree Coursework'] },
      then: moduleNode('ADS5101'),
    };
    expect(check(tree, context).status).toBe(ModuleStatus.Satisfied);
    expect(check(tree, { ...context, programmeType: 'Graduate Degree Coursework' }).status).toBe(ModuleStatus.Unsatisfied);
    expect(check(tree, { ...context, programmeType: 'Graduate Degree Coursework' }, ['ADS5101']).status).toBe(ModuleStatus.Satisfied);
    expect(check(tree).issues).toContainEqual({ type: 'PrerequisiteContext', message: expect.stringContaining('programme') });
  });

  test('missing requirements block AND but do not poison satisfied OR alternatives', () => {
    expect(check({ type: 'AND', children: [moduleNode('CS1010'), blocked] }, null, ['CS1010']).issues)
      .toContainEqual({ type: 'PrerequisiteUnavailable', message: 'BN2403: Not available in the catalogue' });
    expect(check({ type: 'OR', children: [moduleNode('CS1010'), blocked] }, null, ['CS1010']).issues).toEqual([]);
  });

  test('NOF wildcard pools count distinct completed courses without lowering thresholds', () => {
    const tree: PrereqTree = { type: 'NOF', n: 2, children: [moduleNode('MA%'), moduleNode('MA2%'), moduleNode('MA2101'), blocked] };
    expect(check(tree, null, ['MA2101']).status).toBe(ModuleStatus.Unsatisfied);
    expect(check(tree, null, ['MA2101', 'MA2108']).status).toBe(ModuleStatus.Satisfied);
  });

  test('keeps legacy grade suffixes and trailing-star tokens safe while using shared evaluation', () => {
    expect(check(moduleNode('CS1010:D'), null, ['CS1010']).status).toBe(ModuleStatus.Satisfied);
    expect(check(moduleNode('MA2*'), null, ['MA2101']).status).toBe(ModuleStatus.Satisfied);
  });

  test.each<PrereqTree>([
    condition, blocked, { type: 'constant', value: true }, { type: 'constant', value: false },
    { type: 'AND', children: [condition, moduleNode('CS1010')] },
    { type: 'OR', children: [condition, moduleNode('CS1010')] },
    { type: 'NOF', n: 3, children: [moduleNode('CS%'), blocked] },
  ])('agrees with the shared evaluator for %j', tree => {
    for (const studentContext of [null, context, { ...context, cohortYear: 2023 }]) {
      for (const codes of [[], ['CS1010'], ['CS1010', 'CS2040']]) {
        expect(check(tree, studentContext, codes).status === ModuleStatus.Satisfied)
          .toBe(evaluatePrerequisite(tree, studentContext, new Set(codes)));
      }
    }
  });

  test('uses only earlier semesters, never a same-semester completed grade', () => {
    const modules = { CS1010: { ...moduleData('CS1010'), status: ModuleStatus.Completed }, CS2040: moduleData('CS2040', moduleNode('CS1010')) };
    const sameSemester = checkModuleStates({
      semesterEntities: { 0: { id: 0, moduleCodes: ['CS1010', 'CS2040'] } },
      moduleEntities: modules, exemptedModules: [], studentContext: context,
    });
    expect(sameSemester.find(update => update.id === 'CS2040')?.changes.status).toBe(ModuleStatus.Unsatisfied);
    const priorSemester = checkModuleStates({
      semesterEntities: { 0: { id: 0, moduleCodes: ['CS1010'] }, 2: { id: 2, moduleCodes: ['CS2040'] } },
      moduleEntities: modules, exemptedModules: [], studentContext: context,
    });
    expect(priorSemester.find(update => update.id === 'CS2040')?.changes.status).toBe(ModuleStatus.Satisfied);
  });

  test('does not count earlier unsatisfied modules as completed and tolerates missing metadata', () => {
    const changes = checkModuleStates({
      semesterEntities: { 0: { id: 0, moduleCodes: ['MISSING1000', 'CS1010'] }, 2: { id: 2, moduleCodes: ['CS2040'] } },
      moduleEntities: { CS1010: moduleData('CS1010', condition), CS2040: moduleData('CS2040', moduleNode('CS1010')) },
      exemptedModules: [], studentContext: null,
    });
    expect(changes.find(update => update.id === 'CS2040')?.changes.status).toBe(ModuleStatus.Unsatisfied);
  });

  test('explicit completion overrides context eligibility for the completed module', () => {
    const changes = checkModuleStates({
      semesterEntities: { 0: { id: 0, moduleCodes: ['CS1010'] }, 2: { id: 2, moduleCodes: ['CS2040'] } },
      moduleEntities: { CS1010: { ...moduleData('CS1010', condition), status: ModuleStatus.Completed }, CS2040: moduleData('CS2040', moduleNode('CS1010')) },
      exemptedModules: [], studentContext: null,
    });
    expect(changes.find(update => update.id === 'CS2040')?.changes.status).toBe(ModuleStatus.Satisfied);
  });
});
