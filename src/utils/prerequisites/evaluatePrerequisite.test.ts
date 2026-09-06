import rawPrerequisites from "../../data/modulePrereqInfo.json";
import type { PrerequisiteCondition, PrerequisiteNode, StudentContext } from "../../types/prerequisiteTypes";
import { evaluateCondition, evaluatePrerequisite, matchesModuleCode, resolvePrerequisite } from "./evaluatePrerequisite";
import { parsePrerequisite } from "./parsePrerequisite";

const undergraduate = (cohortYear: number | null): StudentContext => ({ cohortYear, programmeType: "Undergraduate Degree" });
const certificate: StudentContext = { cohortYear: null, programmeType: "CPE (Certificate)" };
const moduleNode = (moduleCode: string): PrerequisiteNode => ({ type: "module", moduleCode });
const missing: PrerequisiteNode = { type: "blocked", reason: "BN2403 is unavailable for BN4406", moduleCode: "BN2403" };
const cohortCondition: PrerequisiteCondition = { kind: "cohort", rule: "MUST_BE_IN", years: ["S:2021"] };
const cohortNode: PrerequisiteNode = { type: "condition", condition: cohortCondition };
const complete = (...codes: string[]) => new Set(codes);
const fixture = (code: keyof typeof rawPrerequisites) => parsePrerequisite(rawPrerequisites[code]);
const mathModules = Array.from({ length: 8 }, (_, index) => `MA${1000 + index}`);

describe("real prerequisite regressions", () => {
  test.each([
    ["AR3328", 2024, "AR2328A"],
    ["CN2105", 2025, "CN2109"],
  ] as const)("%s retains its consequent on the inclusive boundary", (code, boundary, prerequisite) => {
    const tree = fixture(code);
    expect(tree).toMatchObject({ type: "conditional", then: { moduleCode: prerequisite, minimumGrade: "D" } });
    expect(resolvePrerequisite(tree, undergraduate(boundary - 1))).toBeNull();
    expect(evaluatePrerequisite(tree, undergraduate(boundary - 1), complete())).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(boundary), complete())).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(boundary), complete(prerequisite))).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(boundary + 1), complete())).toBe(false);
    expect(resolvePrerequisite(tree, undergraduate(null))).toMatchObject({ type: "blocked", reason: expect.stringContaining("cohort") });
    expect(evaluatePrerequisite(tree, null, complete(prerequisite))).toBe(false);
  });

  test("ADS5201 applies to certificate students without inventing a programme for unset context", () => {
    const tree = fixture("ADS5201");
    expect(evaluatePrerequisite(tree, certificate, complete())).toBe(false);
    expect(evaluatePrerequisite(tree, certificate, complete("ADS5101"))).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(null), complete())).toBe(true);
    expect(resolvePrerequisite(tree, null)).toMatchObject({ type: "blocked", reason: expect.stringContaining("programme") });
    expect(evaluatePrerequisite(tree, null, complete("ADS5101"))).toBe(false);
  });

  test.each(["MA3310", "MA3312", "MA3313"] as const)("%s permits the newer cohort-only alternative without eight math modules", (code) => {
    const tree = fixture(code);
    expect(evaluatePrerequisite(tree, undergraduate(2020), complete())).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(2020), complete(...mathModules.slice(0, 7)))).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(2020), complete(...mathModules))).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2021), complete())).toBe(true);
    expect(resolvePrerequisite(tree, undergraduate(2021))).toBeNull();
    expect(evaluatePrerequisite(tree, null, complete(...mathModules))).toBe(false);
  });

  test("DBA3701 requires both an eligible cohort and either DAO2702 variant", () => {
    const tree = fixture("DBA3701");
    expect(resolvePrerequisite(tree, undergraduate(2017))).toEqual({ type: "module", moduleCode: "DAO2702%", minimumGrade: "D" });
    expect(evaluatePrerequisite(tree, undergraduate(2017), complete())).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(2017), complete("DAO2702"))).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2017), complete("DAO2702X"))).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2016), complete("DAO2702", "DAO2702X"))).toBe(false);
    expect(evaluatePrerequisite(tree, null, complete("DAO2702"))).toBe(false);
  });

  test("NM4660HM's MUST_BE_IN plus then is not a vacuously true implication", () => {
    const tree = fixture("NM4660HM");
    expect(tree).toMatchObject({ type: "conditional", condition: { rule: "MUST_BE_IN" } });
    const modules = complete(...Array.from({ length: 11 }, (_, index) => `NM${1000 + index}`));
    expect(evaluatePrerequisite(tree, undergraduate(2015), modules)).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(2016), modules)).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2020), modules)).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2021), modules)).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(2018), complete())).toBe(false);
  });

  test("PF3201's context-only OR branch retains the inclusive 2017/2018 split", () => {
    const tree = fixture("PF3201");
    expect(evaluatePrerequisite(tree, undergraduate(2017), complete())).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(2017), complete("PF2104"))).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2018), complete())).toBe(true);
  });

  test("CL4211 keeps the source AND pool while resolving its bounded cohort alternative", () => {
    const tree = fixture("CL4211");
    const modules = complete("CL1000", "CL1001", "CL1002", "CL1003", "CL1004");
    expect(evaluatePrerequisite(tree, undergraduate(2020), modules)).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(2021), modules)).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2025), modules)).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2026), modules)).toBe(true);
    expect(evaluatePrerequisite(tree, undergraduate(2026), complete())).toBe(false);
  });

  test("BL5699R preserves programme then cohort nesting", () => {
    const tree = fixture("BL5699R");
    const graduate = { cohortYear: 2024, programmeType: "Graduate Degree Coursework" };
    expect(evaluatePrerequisite(tree, graduate, complete())).toBe(true);
    expect(evaluatePrerequisite(tree, { ...graduate, cohortYear: 2023 }, complete())).toBe(false);
    expect(evaluatePrerequisite(tree, { ...graduate, cohortYear: null }, complete())).toBe(false);
    expect(evaluatePrerequisite(tree, undergraduate(null), complete())).toBe(true);
  });
});

describe("Boolean resolution and unavailable requirements", () => {
  test("known predicate truth, falsehood, and unknown are distinct", () => {
    expect(evaluateCondition(cohortCondition, undergraduate(2021))).toBe(true);
    expect(evaluateCondition(cohortCondition, undergraduate(2020))).toBe(false);
    expect(evaluateCondition(cohortCondition)).toBeNull();
    expect(resolvePrerequisite(cohortNode, undergraduate(2021))).toBeNull();
    expect(resolvePrerequisite(cohortNode, undergraduate(2020))).toMatchObject({ type: "blocked" });
    expect(resolvePrerequisite(cohortNode)).toMatchObject({ type: "blocked" });
  });

  test.each(["IF_IN", "MUST_BE_IN"] as const)("%s conditions distinguish cohort and programme fields", (rule) => {
    const condition: PrerequisiteCondition = { kind: "programType", rule, types: ["Undergraduate Degree"] };
    expect(evaluateCondition(condition, undergraduate(null))).toBe(true);
    expect(evaluateCondition(condition, certificate)).toBe(false);
    expect(evaluateCondition(condition, { cohortYear: 2024, programmeType: null })).toBeNull();
    expect(evaluateCondition(cohortCondition, { cohortYear: 2024, programmeType: null })).toBe(true);
  });

  test("unknown-dependent AND paths block but independent OR alternatives survive", () => {
    const and: PrerequisiteNode = { type: "AND", children: [cohortNode, moduleNode("CS1010")] };
    const or: PrerequisiteNode = { type: "OR", children: [and, moduleNode("CS1010S")] };
    expect(evaluatePrerequisite(and, null, complete("CS1010"))).toBe(false);
    expect(evaluatePrerequisite(or, null, complete("CS1010"))).toBe(false);
    expect(evaluatePrerequisite(or, null, complete("CS1010S"))).toBe(true);
    expect(evaluatePrerequisite(or, undergraduate(2021), complete("CS1010"))).toBe(true);
  });

  test("missing mandatory modules cannot disappear, and genuine alternatives remain usable", () => {
    const and: PrerequisiteNode = { type: "AND", children: [missing, moduleNode("CS1010")] };
    const or: PrerequisiteNode = { type: "OR", children: [missing, moduleNode("CS1010")] };
    expect(resolvePrerequisite(and)).toEqual(missing);
    expect(evaluatePrerequisite(and, null, complete("CS1010", "BN2403"))).toBe(false);
    expect(evaluatePrerequisite(or, null, complete("CS1010"))).toBe(true);
    expect(evaluatePrerequisite(or, null, complete())).toBe(false);
    expect(evaluatePrerequisite(fixture("BN4406"), null, complete())).toBe(false);
    expect(evaluatePrerequisite({ type: "OR", children: [missing] }, null, complete())).toBe(false);
  });

  test("constants implement Boolean identities without turning malformed empty gates into true", () => {
    const truth: PrerequisiteNode = { type: "constant", value: true };
    const falsehood: PrerequisiteNode = { type: "constant", value: false };
    expect(resolvePrerequisite({ type: "AND", children: [truth, moduleNode("CS1010")] })).toEqual(moduleNode("CS1010"));
    expect(resolvePrerequisite({ type: "OR", children: [truth, missing] })).toBeNull();
    expect(resolvePrerequisite({ type: "AND", children: [falsehood, truth] })).toMatchObject({ type: "blocked" });
    expect(resolvePrerequisite({ type: "AND", children: [truth, truth] })).toBeNull();
    expect(resolvePrerequisite({ type: "AND", children: [] })).toMatchObject({ type: "blocked" });
    expect(resolvePrerequisite({ type: "OR", children: [] })).toMatchObject({ type: "blocked" });
    expect(evaluatePrerequisite(null, null, complete())).toBe(true);
    expect(evaluatePrerequisite(undefined, undefined, complete())).toBe(true);
    expect(resolvePrerequisite({ type: "conditional", condition: { ...cohortCondition, rule: "IF_IN" }, then: truth })).toBeNull();
  });

  test("NOF reduces thresholds for true constants only, not false, unknown or missing options", () => {
    const tree: PrerequisiteNode = { type: "NOF", n: 3, children: [cohortNode, missing, moduleNode("CS1010")] };
    expect(resolvePrerequisite(tree, undergraduate(2021))).toMatchObject({ type: "NOF", n: 2, children: [missing, moduleNode("CS1010")] });
    expect(resolvePrerequisite(tree, undergraduate(2020))).toMatchObject({ type: "NOF", n: 3 });
    expect(resolvePrerequisite(tree, null)).toMatchObject({ type: "NOF", n: 3 });
    expect(evaluatePrerequisite(tree, undergraduate(2021), complete("CS1010"))).toBe(false);
    const two: PrerequisiteNode = { ...tree, n: 2 };
    expect(evaluatePrerequisite(two, undergraduate(2021), complete("CS1010"))).toBe(true);
    expect(evaluatePrerequisite(two, null, complete("CS1010"))).toBe(false);
    expect(resolvePrerequisite({ type: "NOF", n: 1, children: [cohortNode] }, undergraduate(2021))).toBeNull();
    expect(resolvePrerequisite({ type: "NOF", n: 2, children: [missing] })).toMatchObject({ type: "blocked" });
    expect(evaluatePrerequisite({ type: "NOF", n: 1, children: [] }, null, complete())).toBe(false);
  });
});

describe("wildcards and distinct NOF pools", () => {
  test.each([
    ["DAO2702%", "DAO2702", true], ["DAO2702%", "DAO2702X", true],
    ["DAO2702", "DAO2702X", false], ["cs%", "CS1010", true],
    ["cs1010", "cs1010", true], ["MA%", "XMA1100", false],
    ["CS%", "CS%", false], ["%", "CS1010", false], ["CS%10", "CS1010", false],
  ])("matches %s against %s: %s", (pattern, candidate, expected) => {
    expect(matchesModuleCode(pattern as string, candidate as string)).toBe(expected);
  });

  test("a single prefix contributes multiple distinct completed courses", () => {
    const tree = parsePrerequisite({ nOf: [8, ["MA%:D"]] });
    expect(evaluatePrerequisite(tree, null, complete(...mathModules))).toBe(true);
    expect(evaluatePrerequisite(tree, null, complete(...mathModules.slice(0, 7)))).toBe(false);
    expect(resolvePrerequisite(tree)).toMatchObject({ type: "NOF", n: 8 });
  });

  test("exact and overlapping wildcard leaves count each course only once", () => {
    const tree = parsePrerequisite({ nOf: [3, ["CS%", "CS1%", "CS1010", "cs1010", "CS1010%"]] });
    expect(evaluatePrerequisite(tree, null, complete("CS1010", "cs1010"))).toBe(false);
    expect(evaluatePrerequisite(tree, null, complete("CS1010", "CS1010S"))).toBe(false);
    expect(evaluatePrerequisite(tree, null, complete("CS1010", "CS1010S", "CS2040"))).toBe(true);
  });

  test("unavailable wildcard matches and underpopulated concrete options do not lower n", () => {
    const tree = parsePrerequisite({ nOf: [2, ["ZZ%", "CS1010"]] });
    expect(resolvePrerequisite(tree)).toMatchObject({ type: "NOF", n: 2 });
    expect(evaluatePrerequisite(tree, null, complete("CS1010"))).toBe(false);
    expect(evaluatePrerequisite(parsePrerequisite({ nOf: [2, ["CS1010", "CS1010"]] }), null, complete("CS1010"))).toBe(false);
  });

  test("compound NOF options stay Boolean options after simplification, not wildcard pools", () => {
    const tree = parsePrerequisite({ nOf: [2, [{ or: ["CS%"] }]] });
    const completed = complete("CS1010", "CS2040");
    expect(evaluatePrerequisite(tree, null, completed)).toBe(false);
    expect(evaluatePrerequisite(resolvePrerequisite(tree), null, completed)).toBe(false);
    const two = parsePrerequisite({ nOf: [2, [{ and: ["CS1010", "CS2040"] }, "MA%"]] });
    expect(evaluatePrerequisite(two, null, complete("CS1010", "CS2040"))).toBe(false);
    expect(evaluatePrerequisite(two, null, complete("CS1010", "CS2040", "MA1100"))).toBe(true);
  });
});
