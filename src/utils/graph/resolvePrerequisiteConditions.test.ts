import type { FormattedGraph, LogicNode } from "@/types/graphTypes";
import type { StudentContext } from "@/types/prerequisiteTypes";
import { runScheduler } from "./algo/schedule";
import { normaliseNodes } from "./normaliseNodes";
import { resolvePrerequisiteConditions } from "./resolvePrerequisiteConditions";

const context: StudentContext = { cohortYear: 2024, programmeType: "Undergraduate Degree" };

function graph(nodes: Record<string, LogicNode>, edges: [string, string][], courses = ["AR3328", "AR2328A"]): FormattedGraph {
  return {
    nodes: {
      ...Object.fromEntries(courses.map((code) => [code, { id: code, code, title: code, credits: 4, semestersOffered: [0, 2], exam: null, preclusions: [] }])),
      ...nodes,
    },
    relationships: edges.map(([from, to], index) => ({ id: String(index), from, to })),
  };
}

function generate(source: FormattedGraph, student = context, target = "AR3328") {
  const resolved = resolvePrerequisiteConditions(source, student, [target]);
  return runScheduler(normaliseNodes(resolved), [target], [], false, 20);
}

function codes(result: ReturnType<typeof generate>) {
  return result.timetable.semesters.flatMap((semester) => semester.moduleCodes);
}

describe("context-aware graph resolution", () => {
  beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  const conditional = (): FormattedGraph => graph({
    condition: { id: "condition", type: "CONDITIONAL", condition: { kind: "cohort", rule: "IF_IN", years: ["S:2024/25"] } },
  }, [["AR3328", "condition"], ["condition", "AR2328A"]]);

  test("requires the conditional consequent for an applicable cohort", () => {
    const result = generate(conditional());
    expect(result.isValid).toBe(true);
    expect(codes(result)).toEqual(["AR2328A", "AR3328"]);
    expect(result.timetable.semesters[0].id).toBeLessThan(result.timetable.semesters[1].id);
  });

  test("does not schedule an inapplicable consequent", () => {
    const result = generate(conditional(), { ...context, cohortYear: 2023 });
    expect(result.isValid).toBe(true);
    expect(codes(result)).toEqual(["AR3328"]);
  });

  test("unknown context blocks the dependent path with an explanation", () => {
    const result = generate(conditional(), { cohortYear: null, programmeType: null });
    expect(result.isValid).toBe(false);
    expect(codes(result)).toEqual([]);
    expect(result.validation.errors.join(" ")).toMatch(/AR3328.*cohort/);
  });

  test("a true context-only OR alternative imposes no extra courses", () => {
    const source = graph({
      choice: { id: "choice", type: "OR" },
      condition: { id: "condition", type: "CONDITION", condition: { kind: "cohort", rule: "MUST_BE_IN", years: ["S:2021"] } },
    }, [["AR3328", "choice"], ["choice", "condition"], ["choice", "AR2328A"]]);
    const result = generate(source);
    expect(result.isValid).toBe(true);
    expect(codes(result)).toEqual(["AR3328"]);
  });

  test("a valid OR alternative remains usable when another condition is unknown", () => {
    const source = conditional();
    source.nodes.choice = { id: "choice", type: "OR" };
    source.relationships = [
      { id: "0", from: "AR3328", to: "choice" },
      { id: "1", from: "choice", to: "condition" },
      { id: "2", from: "choice", to: "AR2328A" },
      { id: "3", from: "condition", to: "AR2328A" },
    ];
    const result = generate(source, { cohortYear: null, programmeType: null });
    expect(result.isValid).toBe(true);
    expect(result.validation.errors).toEqual([]);
    expect(codes(result)).toEqual(["AR2328A", "AR3328"]);
  });

  test("an unavailable mandatory reference blocks generation without losing its explanation", () => {
    const source = graph({
      all: { id: "all", type: "AND" },
      missing: { id: "missing", type: "BLOCKED", reason: "BN2403 is unavailable" },
    }, [["AR3328", "all"], ["all", "AR2328A"], ["all", "missing"]]);
    const result = generate(source);
    expect(result.isValid).toBe(false);
    expect(codes(result)).toEqual([]);
    expect(result.validation.errors).toContain("AR3328: BN2403 is unavailable");
  });

  test("a non-applicable implication is satisfied even when its consequent is unavailable", () => {
    const source = graph({
      condition: { id: "condition", type: "CONDITIONAL", condition: { kind: "programType", rule: "IF_IN", types: ["CPE (Certificate)"] } },
      missing: { id: "missing", type: "BLOCKED", reason: "Missing certificate course" },
    }, [["AR3328", "condition"], ["condition", "missing"]]);
    expect(codes(generate(source))).toEqual(["AR3328"]);
    expect(codes(generate(source, { ...context, programmeType: "CPE (Certificate)" }))).toEqual([]);
  });

  test("MUST_BE_IN with a consequent requires both membership and courses", () => {
    const source = conditional();
    source.nodes.condition = { id: "condition", type: "CONDITIONAL", condition: { kind: "cohort", rule: "MUST_BE_IN", years: ["E:2020"] } };
    expect(codes(generate(source))).toEqual([]);
    expect(codes(generate(source, { ...context, cohortYear: 2020 }))).toEqual(["AR2328A", "AR3328"]);
  });

  test("rejects a conditional gate that lost its consequent", () => {
    const source = conditional();
    source.relationships = source.relationships.slice(0, 1);
    expect(() => generate(source)).toThrow("exactly one consequent");
  });

  test("does not mutate the persisted expression while resolving different contexts", () => {
    const source = conditional();
    const original = structuredClone(source);
    generate(source);
    generate(source, { ...context, cohortYear: 2020 });
    expect(source).toEqual(original);
  });
});
