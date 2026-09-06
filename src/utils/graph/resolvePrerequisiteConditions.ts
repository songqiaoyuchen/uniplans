import type { FormattedGraph } from "@/types/graphTypes";
import type { PrerequisiteNode, StudentContext } from "@/types/prerequisiteTypes";
import { resolvePrerequisite } from "@/utils/prerequisites/evaluatePrerequisite";
import { v4 as uuid } from "uuid";

export function resolvePrerequisiteConditions(
  graph: FormattedGraph,
  context?: StudentContext | null,
  requiredCodes?: readonly string[],
): FormattedGraph {
  const children = new Map<string, string[]>();
  const moduleIds = new Map<string, string>();
  const result: FormattedGraph = { nodes: {}, relationships: [] };
  for (const [id, node] of Object.entries(graph.nodes)) {
    children.set(id, []);
    if ("code" in node) {
      moduleIds.set(node.code, id);
      result.nodes[id] = { ...node, id };
    }
  }
  for (const edge of graph.relationships) {
    if (!graph.nodes[edge.from] || !graph.nodes[edge.to]) throw new Error(`Missing graph node for relationship ${edge.id}`);
    const list = children.get(edge.from)!;
    if (!list.includes(edge.to)) list.push(edge.to);
  }

  const expressions = new Map<string, PrerequisiteNode>();
  function expression(id: string, visiting = new Set<string>()): PrerequisiteNode {
    const node = graph.nodes[id];
    if ("code" in node) return { type: "module", moduleCode: node.code };
    const cached = expressions.get(id);
    if (cached) return cached;
    if (visiting.has(id)) throw new Error(`Cycle between prerequisite logic nodes at ${id}`);
    const next = new Set(visiting).add(id);
    const childIds = children.get(id)!;
    let tree: PrerequisiteNode;
    switch (node.type) {
    case "CONDITION":
      if (childIds.length) throw new Error(`Condition ${id} has unexpected children`);
      tree = { type: "condition", condition: node.condition };
      break;
    case "CONDITIONAL":
      if (childIds.length !== 1) throw new Error(`Conditional ${id} must have exactly one consequent`);
      tree = { type: "conditional", condition: node.condition, then: expression(childIds[0], next) };
      break;
    case "CONSTANT":
      if (childIds.length) throw new Error(`Constant ${id} has unexpected children`);
      tree = { type: "constant", value: node.value };
      break;
    case "BLOCKED":
      if (childIds.length) throw new Error(`Blocked prerequisite ${id} has unexpected children`);
      tree = { type: "blocked", reason: node.reason, moduleCode: node.moduleCode };
      break;
    case "AND":
      if (!childIds.length) throw new Error(`Empty AND prerequisite ${id}`);
      tree = { type: "AND", children: childIds.map((child) => expression(child, next)) };
      break;
    case "OR":
      tree = childIds.length
        ? { type: "OR", children: childIds.map((child) => expression(child, next)) }
        : { type: "blocked", reason: "No available prerequisite alternatives" };
      break;
    case "NOF":
      if (!Number.isSafeInteger(node.n) || node.n < 1) throw new Error(`Invalid prerequisite threshold at ${id}`);
      tree = node.blockedReason
        ? { type: "blocked", reason: node.blockedReason }
        : { type: "NOF", n: node.n, children: childIds.map((child) => expression(child, next)) };
      break;
    }
    expressions.set(id, tree);
    return tree;
  }

  const emitted = new Map<string, string>();
  function emit(tree: PrerequisiteNode): string {
    if (tree.type === "module") {
      const id = moduleIds.get(tree.moduleCode);
      return id ?? emit({ type: "blocked", reason: `Prerequisite ${tree.moduleCode} is unavailable in the current catalogue`, moduleCode: tree.moduleCode });
    }
    if (tree.type === "condition" || tree.type === "conditional" || tree.type === "constant") {
      throw new Error("Unresolved prerequisite condition reached graph construction");
    }
    const childIds = "children" in tree ? [...new Set(tree.children.map(emit))] : [];
    const signature = JSON.stringify(tree.type === "blocked"
      ? [tree.type, tree.reason, tree.moduleCode]
      : [tree.type, tree.type === "NOF" ? tree.n : null, [...childIds].sort()]);
    const cached = emitted.get(signature);
    if (cached) return cached;
    const id = uuid();
    emitted.set(signature, id);
    result.nodes[id] = tree.type === "blocked"
      ? { id, type: "NOF", n: 1, blockedReason: tree.reason }
      : tree.type === "NOF"
        ? { id, type: "NOF", n: tree.n }
        : { id, type: tree.type };
    for (const to of childIds) result.relationships.push({ id: uuid(), from: id, to });
    return id;
  }

  for (const id of moduleIds.values()) {
    const roots = children.get(id)!;
    const raw = roots.length === 0 ? null : roots.length === 1
      ? expression(roots[0])
      : { type: "AND" as const, children: roots.map((root) => expression(root)) };
    const resolved = resolvePrerequisite(raw, context);
    if (resolved) result.relationships.push({ id: uuid(), from: id, to: emit(resolved) });
  }

  if (requiredCodes) {
    const outgoing = new Map<string, string[]>();
    for (const edge of result.relationships) {
      const list = outgoing.get(edge.from) ?? [];
      list.push(edge.to);
      outgoing.set(edge.from, list);
    }
    const reachable = new Set<string>();
    const stack = requiredCodes.flatMap((code) => moduleIds.has(code) ? [moduleIds.get(code)!] : []);
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      stack.push(...(outgoing.get(id) ?? []));
    }
    result.nodes = Object.fromEntries(Object.entries(result.nodes).filter(([id]) => reachable.has(id)));
    result.relationships = result.relationships.filter((edge) => reachable.has(edge.from) && reachable.has(edge.to));
  }
  return result;
}
