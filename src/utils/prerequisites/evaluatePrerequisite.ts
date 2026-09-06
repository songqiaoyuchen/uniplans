import type { PrerequisiteCondition, PrerequisiteNode, StudentContext } from "../../types/prerequisiteTypes";
import { cohortYearBounds } from "./cohortYears";
import { isCohortYear, isProgrammeType } from "./validateStudentContext";

export function evaluateCondition(
  condition: PrerequisiteCondition,
  context?: StudentContext | null,
): boolean | null {
  if (condition.rule !== "IF_IN" && condition.rule !== "MUST_BE_IN") return null;
  if (condition.kind === "cohort") {
    if (!isCohortYear(context?.cohortYear)) return null;
    try {
      const { start, end } = cohortYearBounds(condition.years);
      return context.cohortYear >= start && context.cohortYear <= end;
    } catch {
      return null;
    }
  }
  if (condition.kind === "programType") {
    if (!isProgrammeType(context?.programmeType) || !Array.isArray(condition.types) || condition.types.length === 0 || !condition.types.every(isProgrammeType)) {
      return null;
    }
    return condition.types.includes(context.programmeType);
  }
  return null;
}

function blocked(reason: string): PrerequisiteNode {
  return { type: "blocked", reason };
}

function conditionFailure(condition: PrerequisiteCondition, unknown: boolean): PrerequisiteNode {
  if (condition.kind === "cohort") {
    return blocked(unknown
      ? "Set a valid admission cohort year to evaluate this prerequisite."
      : `Admission cohort does not meet the required interval (${condition.years.join(", ")}).`);
  }
  return blocked(unknown
    ? "Set a supported programme type to evaluate this prerequisite."
    : `Programme type must be one of: ${condition.types.join(", ")}.`);
}

export function resolvePrerequisite(
  node: PrerequisiteNode | null,
  context?: StudentContext | null,
): PrerequisiteNode | null {
  if (node === null) return null;
  switch (node.type) {
  case "module":
  case "blocked":
    return node;
  case "constant":
    return node.value ? null : blocked("This prerequisite is not satisfied.");
  case "condition": {
    const value = evaluateCondition(node.condition, context);
    return value === true ? null : conditionFailure(node.condition, value === null);
  }
  case "conditional": {
    const value = evaluateCondition(node.condition, context);
    if (value === false && node.condition.rule === "IF_IN") return null;
    if (value === true) return resolvePrerequisite(node.then, context);
    if (node.condition.rule === "IF_IN" && resolvePrerequisite(node.then, context) === null) return null;
    return conditionFailure(node.condition, value === null);
  }
  case "AND": {
    if (node.children.length === 0) return blocked("Malformed empty AND prerequisite.");
    const children: PrerequisiteNode[] = [];
    for (const child of node.children) {
      const resolved = resolvePrerequisite(child, context);
      if (resolved?.type === "blocked") return resolved;
      if (resolved !== null) children.push(resolved);
    }
    if (children.length === 0) return null;
    return children.length === 1 ? children[0] : { type: "AND", children };
  }
  case "OR": {
    if (node.children.length === 0) return blocked("Malformed empty OR prerequisite.");
    const children: PrerequisiteNode[] = [];
    for (const child of node.children) {
      const resolved = resolvePrerequisite(child, context);
      if (resolved === null) return null;
      children.push(resolved);
    }
    if (children.every((child) => child.type === "blocked")) {
      return blocked(children.map((child) => child.reason).join(" "));
    }
    return children.length === 1 ? children[0] : { type: "OR", children };
  }
  case "NOF": {
    if (!Number.isSafeInteger(node.n) || node.n < 0) return blocked("Invalid NOF prerequisite threshold.");
    if (node.n === 0) return null;
    if (node.children.length === 0) return blocked(`At least ${node.n} prerequisites are required, but none are available.`);
    let n = node.n;
    const children: PrerequisiteNode[] = [];
    for (const child of node.children) {
      const resolved = resolvePrerequisite(child, context);
      if (resolved === null) {
        n -= 1;
      } else {
        children.push(resolved.type === "module" && child.type !== "module"
          ? { type: "OR", children: [resolved] }
          : resolved);
      }
    }
    if (n <= 0) return null;
    if (children.length === 0 || children.every((child) => child.type === "blocked")) {
      return blocked(`At least ${n} more prerequisites are required. ${children.map((child) => child.type === "blocked" ? child.reason : "").join(" ")}`.trim());
    }
    return { type: "NOF", n, children };
  }
  }
}

export function matchesModuleCode(pattern: string, candidate: string): boolean {
  if (!/^[A-Z]+[A-Z0-9]*%?$/i.test(pattern) || !/^[A-Z]+[A-Z0-9]*\d[A-Z0-9]*$/i.test(candidate)) return false;
  const normalizedPattern = pattern.toUpperCase();
  const normalizedCandidate = candidate.toUpperCase();
  return normalizedPattern.endsWith("%")
    ? normalizedCandidate.startsWith(normalizedPattern.slice(0, -1))
    : normalizedCandidate === normalizedPattern;
}

export function evaluatePrerequisite(
  node: PrerequisiteNode | null | undefined,
  context: StudentContext | null | undefined,
  completedCodes: ReadonlySet<string>,
): boolean {
  if (node === null || node === undefined) return true;
  const resolved = resolvePrerequisite(node, context);
  const completed = new Set(Array.from(completedCodes, (code) => code.toUpperCase()));
  const evaluate = (requirement: PrerequisiteNode | null): boolean => {
    if (requirement === null) return true;
    switch (requirement.type) {
    case "module":
      return [...completed].some((code) => matchesModuleCode(requirement.moduleCode, code));
    case "blocked":
      return false;
    case "constant":
      return requirement.value;
    case "AND":
      return requirement.children.length > 0 && requirement.children.every(evaluate);
    case "OR":
      return requirement.children.some(evaluate);
    case "NOF": {
      const matchedCodes = new Set<string>();
      let satisfiedExpressions = 0;
      for (const child of requirement.children) {
        if (child.type === "module") {
          for (const code of completed) {
            if (matchesModuleCode(child.moduleCode, code)) matchedCodes.add(code);
          }
        } else if (evaluate(child)) {
          satisfiedExpressions += 1;
        }
      }
      return matchedCodes.size + satisfiedExpressions >= requirement.n;
    }
    case "condition":
    case "conditional":
      return evaluate(resolvePrerequisite(requirement, context));
    }
  };
  return evaluate(resolved);
}
