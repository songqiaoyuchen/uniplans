// Utility to check the integrity of a graph: no hanging nodes or edges

import { NormalisedGraph, Edge } from "@/types/graphTypes";

export function checkGraph(
  graph: NormalisedGraph,
  requiredCodes: string[] = [],
): boolean {
  const nodeIds = new Set(Object.keys(graph.nodes));
  const incoming: Record<string, Edge[]> = {};
  const outgoing: Record<string, Edge[]> = {};

  // --- Build adjacency and check for invalid edges ---
  let valid = true;

  for (const e of graph.edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
      console.warn(`⚠️  Hanging edge: ${e.id} — from: ${e.from}, to: ${e.to}`);
      valid = false;
      continue;
    }

    (outgoing[e.from] ??= []).push(e);
    (incoming[e.to] ??= []).push(e);
  }

  // --- Check for hanging nodes ---
  const requiredSet = new Set(requiredCodes);

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.id !== id) {
      console.warn(`Graph node identity mismatch: ${id}`);
      valid = false;
    }
    if ("type" in node && (node.type !== "NOF" || !Number.isSafeInteger(node.n) || node.n < 1 || (node.blockedReason && (outgoing[id]?.length ?? 0) > 0))) {
      console.warn(`Invalid prerequisite gate: ${id}`);
      valid = false;
    }
    const inCount = (incoming[id] ?? []).length;
    const outCount = (outgoing[id] ?? []).length;

    if ("type" in node) {
      // Logic node (NOF, AND, etc.)
      if (inCount === 0 && outCount === 0) {
        console.warn(`⚠️  Hanging logic node (${node.type}) with no parents or children: ${id}`);
        valid = false;
      }
    } else {
      // Module node
      const isRequired = requiredSet.has(node.code);
      if (inCount === 0 && !isRequired) {
        console.warn(`⚠️  Hanging module node (unconnected & not required): ${node.code} (${id})`);
        valid = false;
      }
    }
  }

  if (valid) console.info("✅ Graph check passed — no hanging nodes or edges detected.");
  else console.warn("❌ Graph integrity issues found above.");

  return valid;
}
