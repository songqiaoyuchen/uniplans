import rawPrerequisites from "../../data/modulePrereqInfo.json";
import moduleData from "../../data/moduleData.json";
import { PROGRAMME_TYPES, PrerequisiteCondition, PrerequisiteNode } from "../../types/prerequisiteTypes";
import { parsePrerequisite } from "./parsePrerequisite";
import { evaluateCondition } from "./evaluatePrerequisite";
import { cohortYearBounds } from "./cohortYears";

const data = new Map((moduleData as { moduleCode: string; prerequisite?: string }[]).map((entry) => [entry.moduleCode, entry]));
const encodings = new Map<string, { condition: PrerequisiteCondition; hasThen: boolean; moduleCode: string }>();
const counts = new Map<string, number>();
const programmeTypes = new Set<string>();
const grades = new Set<string>();

function visit(node: PrerequisiteNode | null, moduleCode: string): void {
  if (node === null) return;
  if (node.type === "module" && node.minimumGrade) grades.add(node.minimumGrade);
  if (node.type === "condition" || node.type === "conditional") {
    const key = JSON.stringify({ condition: node.condition, hasThen: node.type === "conditional" });
    if (!encodings.has(key)) encodings.set(key, { condition: node.condition, hasThen: node.type === "conditional", moduleCode });
    const shape = `${node.condition.kind}:${node.condition.rule}:${node.type}`;
    counts.set(shape, (counts.get(shape) ?? 0) + 1);
    if (node.condition.kind === "programType") node.condition.types.forEach((type) => programmeTypes.add(type));
  }
  if ("children" in node) node.children.forEach((child) => visit(child, moduleCode));
  if (node.type === "conditional") visit(node.then, moduleCode);
}

const parseErrors: string[] = [];
for (const [code, tree] of Object.entries(rawPrerequisites)) {
  try {
    const parsed = parsePrerequisite(tree);
    if ((parsed === null) !== (tree === null)) parseErrors.push(`${code}: prerequisite disappeared`);
    visit(parsed, code);
  } catch (error) {
    parseErrors.push(`${code}: ${String(error)}`);
  }
}

test("all 6,855 local module entries parse without weakening or unsupported shapes", () => {
  expect(Object.keys(rawPrerequisites)).toHaveLength(6855);
  expect(parseErrors).toEqual([]);
  expect(Object.fromEntries(counts)).toEqual({
    "cohort:MUST_BE_IN:condition": 623,
    "cohort:IF_IN:conditional": 125,
    "cohort:MUST_BE_IN:conditional": 1,
    "programType:IF_IN:conditional": 223,
  });
  expect([...programmeTypes].sort()).toEqual([...PROGRAMME_TYPES].sort());
  expect([...grades].sort()).toEqual(["A", "A-", "B", "B+", "B-", "C", "CS", "D", "P", "S"]);
});

test.each([...encodings].map(([encoding, entry]) => ({ encoding, ...entry })))(
  "$moduleCode source prose and inclusive boundaries agree with $encoding",
  ({ condition, moduleCode }) => {
    const text = data.get(moduleCode)?.prerequisite;
    expect(text).toBeDefined();
    if (condition.kind === "programType") {
      condition.types.forEach((type) => {
        expect(text).toContain(type);
        expect(evaluateCondition(condition, { cohortYear: null, programmeType: type })).toBe(true);
      });
      return;
    }
    const { start, end } = cohortYearBounds(condition.years);
    const phrase = Number.isFinite(start) && Number.isFinite(end)
      ? `cohorts from ${start} to ${end}(?: Semester 1)? inclusive`
      : Number.isFinite(start)
        ? `cohorts from ${start} inclusive`
        : `cohorts (?:prior to|to) ${end} inclusive`;
    expect(text).toMatch(new RegExp(phrase, "i"));
    const context = (cohortYear: number) => ({ cohortYear, programmeType: null });
    if (Number.isFinite(start)) {
      expect(evaluateCondition(condition, context(start))).toBe(true);
      expect(evaluateCondition(condition, context(start - 1))).toBe(false);
    }
    if (Number.isFinite(end)) {
      expect(evaluateCondition(condition, context(end))).toBe(true);
      expect(evaluateCondition(condition, context(end + 1))).toBe(false);
    }
    expect(evaluateCondition(condition, null)).toBeNull();
  },
);
