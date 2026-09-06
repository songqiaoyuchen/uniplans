import { parsePrerequisite, PrerequisiteParseError } from "./parsePrerequisite";

const cohort = { rule: "MUST_BE_IN", years: ["S:2017"] };
const programType = { rule: "IF_IN", types: ["CPE (Certificate)"] };

describe("parsePrerequisite", () => {
  test("only explicit null means no prerequisite tree", () => {
    expect(parsePrerequisite(null)).toBeNull();
    expect(() => parsePrerequisite(undefined)).toThrow(PrerequisiteParseError);
  });

  test("normalizes case and preserves grade metadata and wildcard pools", () => {
    expect(parsePrerequisite({ nOf: [8, ["ma%:D", "MA1101R:B+", "CFG1002:CS"]] })).toEqual({
      type: "NOF",
      n: 8,
      children: [
        { type: "module", moduleCode: "MA%", minimumGrade: "D" },
        { type: "module", moduleCode: "MA1101R", minimumGrade: "B+" },
        { type: "module", moduleCode: "CFG1002", minimumGrade: "CS" },
      ],
    });
  });

  test("preserves nested conditions and both predicate-plus-then rules", () => {
    expect(parsePrerequisite({ programType, then: { cohort, then: "CS1010:D" } })).toEqual({
      type: "conditional",
      condition: { kind: "programType", ...programType },
      then: {
        type: "conditional",
        condition: { kind: "cohort", ...cohort },
        then: { type: "module", moduleCode: "CS1010", minimumGrade: "D" },
      },
    });
    expect(parsePrerequisite({ cohort })).toEqual({ type: "condition", condition: { kind: "cohort", ...cohort } });
    expect(parsePrerequisite({ programType: { ...programType, rule: "MUST_BE_IN" } })).toEqual({
      type: "condition", condition: { kind: "programType", ...programType, rule: "MUST_BE_IN" },
    });
  });

  test("does not mutate or share mutable condition metadata with the source", () => {
    const raw = { cohort: { rule: "MUST_BE_IN", years: ["S:2017"] } };
    const before = JSON.stringify(raw);
    const tree = parsePrerequisite(raw);
    expect(JSON.stringify(raw)).toBe(before);
    raw.cohort.years.push("E:2020");
    expect(tree).toEqual({ type: "condition", condition: { kind: "cohort", rule: "MUST_BE_IN", years: ["S:2017"] } });
  });

  test.each([
    undefined, false, true, 0, 1, "", " ", "CS1010:", "CS1010:D:extra", "CS1010 B", "CS*", "CS%10", "%", "CS%%", "CS",
    [], {}, { xor: ["CS1010"] }, { and: [] }, { or: [] }, { and: [null] }, { or: [undefined] },
    { and: ["CS1010"], extra: "CS2040" }, { and: ["CS1010"], or: ["CS2040"] },
    { nOf: [1, []] }, { nOf: [0, ["CS1010"]] }, { nOf: [-1, ["CS1010"]] },
    { nOf: [1.5, ["CS1010"]] }, { nOf: [Infinity, ["CS1010"]] }, { nOf: ["1", ["CS1010"]] },
    { nOf: [1, [null]] }, { nOf: [1, ["CS1010"], "extra"] },
    { then: "CS1010" }, { cohort, then: null }, { cohort, then: undefined }, { cohort, programType },
    { cohort: { rule: "IF_IN", years: ["S:2017"] } },
    { cohort: { rule: "NOT_IN", years: ["S:2017"] } },
    { cohort: { rule: "MUST_BE_IN", years: [], extra: true } },
    { cohort: { rule: "MUST_BE_IN", years: [] } },
    { cohort: { rule: "MUST_BE_IN", years: ["2017"] } },
    { cohort: { rule: "MUST_BE_IN", years: ["S:17"] } },
    { cohort: { rule: "MUST_BE_IN", years: ["X:2017"] } },
    { cohort: { rule: "MUST_BE_IN", years: ["S:2017/19"] } },
    { cohort: { rule: "MUST_BE_IN", years: ["S:2017/2018"] } },
    { cohort: { rule: "MUST_BE_IN", years: ["S:2017", "S:2018"] } },
    { cohort: { rule: "MUST_BE_IN", years: ["S:2021", "E:2020"] } },
    { cohort: { rule: "MUST_BE_IN", years: ["S:2017", "E:2020", "S:2022"] } },
    { cohort: { rule: "MUST_BE_IN", years: [2017] } },
    { programType: { rule: "IF_IN", types: [] }, then: "CS1010" },
    { programType: { rule: "IF_IN", types: ["PhD"] }, then: "CS1010" },
    { programType: { rule: "IF_IN", types: ["undergraduate degree"] }, then: "CS1010" },
    { type: "constant", value: true }, { type: "blocked", reason: "Missing" }, new Date(),
  ])("rejects malformed or unsupported raw syntax: %j", (input) => {
    expect(() => parsePrerequisite(input)).toThrow(PrerequisiteParseError);
  });

  test("reports the full nested source path instead of dropping a bad child", () => {
    try {
      parsePrerequisite({ and: ["CS1010", { or: ["CS2040", { cohort: { rule: "NOT_IN", years: ["S:2017"] } }] }] });
      throw new Error("Expected parse failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PrerequisiteParseError);
      expect((error as PrerequisiteParseError).diagnostic.path).toBe("$.and[1].or[1].cohort.rule");
    }
  });

  test("rejects cyclic and sparse gates while permitting shared source subtrees", () => {
    const cycle: { and: unknown[] } = { and: [] };
    cycle.and.push(cycle);
    expect(() => parsePrerequisite(cycle)).toThrow("Cyclic prerequisite tree");
    expect(() => parsePrerequisite({ and: new Array(2) })).toThrow();
    expect(() => parsePrerequisite({ programType: { rule: "IF_IN", types: new Array(1) }, then: "CS1010" })).toThrow();
    const shared = { or: ["CS1010", "CS1010S"] };
    expect(() => parsePrerequisite({ and: [shared, shared] })).not.toThrow();
  });
});
