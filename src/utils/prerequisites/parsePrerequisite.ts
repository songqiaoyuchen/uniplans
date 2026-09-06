import type {
  PrerequisiteCondition,
  PrerequisiteDiagnostic,
  PrerequisiteNode,
  PrerequisiteRule,
} from "../../types/prerequisiteTypes";
import { cohortYearBounds } from "./cohortYears";
import { isProgrammeType } from "./validateStudentContext";
import { isPlainRecord } from "./isPlainRecord";

export class PrerequisiteParseError extends Error {
  readonly diagnostic: PrerequisiteDiagnostic;

  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = "PrerequisiteParseError";
    this.diagnostic = { path, reason };
  }
}

function fail(path: string, reason: string): never {
  throw new PrerequisiteParseError(path, reason);
}

function record(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(path, "Expected a prerequisite object.");
  }
  if (!isPlainRecord(input)) {
    return fail(path, "Expected a plain prerequisite object.");
  }
  return input as Record<string, unknown>;
}

function assertKeys(value: Record<string, unknown>, allowed: string[], path: string): void {
  const unsupported = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unsupported.length) fail(path, `Unsupported fields: ${unsupported.join(", ")}.`);
}

export function parseCondition(kind: "cohort" | "programType", input: unknown, path: string): PrerequisiteCondition {
  const value = record(input, path);
  const field = kind === "cohort" ? "years" : "types";
  assertKeys(value, ["rule", field], path);
  if (value.rule !== "MUST_BE_IN" && value.rule !== "IF_IN") {
    fail(`${path}.rule`, `Unsupported rule: ${String(value.rule)}.`);
  }
  const rule: PrerequisiteRule = value.rule;
  const values = value[field];
  if (!Array.isArray(values) || values.length === 0 || Array.from(values).some((entry) => typeof entry !== "string" || entry.length === 0)) {
    fail(`${path}.${field}`, "Expected a nonempty array of strings.");
  }
  const strings = values as string[];
  if (kind === "cohort") {
    try {
      cohortYearBounds(strings);
    } catch (error) {
      fail(`${path}.years`, error instanceof Error ? error.message : "Invalid cohort interval.");
    }
    return { kind, rule, years: [...strings] };
  }
  if (strings.some((entry) => !isProgrammeType(entry))) {
    fail(`${path}.types`, "Unsupported programme category.");
  }
  return { kind, rule, types: [...strings] };
}

const MODULE_TOKEN = /^([A-Z]+[A-Z0-9]*%?)(?::([A-Z]+[+-]?))?$/i;

export function parsePrerequisite(input: unknown): PrerequisiteNode | null {
  if (input === null) return null;
  const ancestors = new Set<object>();
  const parse = (value: unknown, path: string): PrerequisiteNode => {
    if (typeof value === "string") {
      const match = MODULE_TOKEN.exec(value);
      if (!match || (!match[1].endsWith("%") && !/\d/.test(match[1]))) {
        return fail(path, `Invalid module token: ${JSON.stringify(value)}.`);
      }
      return {
        type: "module",
        moduleCode: match[1].toUpperCase(),
        ...(match[2] === undefined ? {} : { minimumGrade: match[2].toUpperCase() }),
      };
    }
    const object = record(value, path);
    if (ancestors.has(object)) return fail(path, "Cyclic prerequisite tree.");
    ancestors.add(object);
    try {
      const keys = Object.keys(object);
      const operators = ["and", "or", "nOf", "cohort", "programType"].filter((key) => keys.includes(key));
      if (operators.length !== 1) return fail(path, "Expected exactly one supported prerequisite operator.");
      const operator = operators[0];
      if (operator === "cohort" || operator === "programType") {
        assertKeys(object, [operator, "then"], path);
        const condition = parseCondition(operator, object[operator], `${path}.${operator}`);
        if (keys.includes("then")) {
          return { type: "conditional", condition, then: parse(object.then, `${path}.then`) };
        }
        if (condition.rule === "IF_IN") return fail(path, "IF_IN requires a then subtree.");
        return { type: "condition", condition };
      }
      assertKeys(object, [operator], path);
      let children = object[operator];
      let n = 0;
      if (operator === "nOf") {
        if (!Array.isArray(children) || children.length !== 2 || !Number.isSafeInteger(children[0]) || children[0] < 1) {
          return fail(`${path}.nOf`, "Expected [positive integer, prerequisite array].");
        }
        [n, children] = children;
      }
      if (!Array.isArray(children) || children.length === 0) {
        return fail(`${path}.${operator}`, "Prerequisite gates must have nonempty children.");
      }
      const childPath = operator === "nOf" ? `${path}.nOf[1]` : `${path}.${operator}`;
      const parsedChildren = Array.from(children, (child, index) => parse(child, `${childPath}[${index}]`));
      if (operator === "nOf") return { type: "NOF", n, children: parsedChildren };
      return { type: operator === "and" ? "AND" : "OR", children: parsedChildren };
    } finally {
      ancestors.delete(object);
    }
  };
  return parse(input, "$");
}
