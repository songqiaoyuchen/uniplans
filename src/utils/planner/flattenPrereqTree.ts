// utils/planner/flattenPrereqTree.ts
import { PrereqTree } from "@/types/plannerTypes";
import type { StudentContext } from '@/types/prerequisiteTypes';
import { resolvePrerequisite } from '@/utils/prerequisites/evaluatePrerequisite';

export function flattenPrereqTree(tree: PrereqTree | null | undefined, context?: StudentContext | null): Set<string> {
  const result = new Set<string>();
  if (!tree) return result;

  function traverse(node: PrereqTree) {
    if (node.type === "module") {
      result.add(node.moduleCode);
    } else if ("children" in node) {
      node.children.forEach(traverse);
    }
  }

  const resolved = resolvePrerequisite(tree, context);
  if (resolved) traverse(resolved);
  return result;
}
