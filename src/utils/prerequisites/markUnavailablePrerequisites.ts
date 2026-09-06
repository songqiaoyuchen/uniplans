import type { PrerequisiteNode } from "@/types/prerequisiteTypes";
import { matchesModuleCode } from "./evaluatePrerequisite";

export function markUnavailablePrerequisites(
  tree: PrerequisiteNode | null,
  catalogue: ReadonlySet<string>,
): PrerequisiteNode | null {
  if (!tree) return null;
  if (tree.type === "module") {
    const available = /[%*]/.test(tree.moduleCode)
      ? [...catalogue].some((code) => matchesModuleCode(tree.moduleCode, code))
      : catalogue.has(tree.moduleCode);
    return available ? tree : {
      type: "blocked",
      moduleCode: tree.moduleCode,
      reason: `Prerequisite ${tree.moduleCode} is unavailable in the current catalogue`,
    };
  }
  if (tree.type === "conditional") {
    return { ...tree, then: markUnavailablePrerequisites(tree.then, catalogue)! };
  }
  if ("children" in tree) {
    return { ...tree, children: tree.children.map((child) => markUnavailablePrerequisites(child, catalogue)!) };
  }
  return tree;
}
