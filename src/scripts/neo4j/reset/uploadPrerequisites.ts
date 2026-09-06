/**
 * @author Kevin Zhang
 * @description Attaches prerequisite trees to module nodes in Neo4j
 * @created 2025-05-07
 */

import fs from "fs";
import path from "path";
import type { Session } from "neo4j-driver";
import { parsePrerequisite } from "../../../utils/prerequisites/parsePrerequisite";
import { attachPrereqTree, type Neo4jExecutor } from "./buildTree/attachTree";

export async function uploadAllPrereqTrees(
  executor: Neo4jExecutor,
  prereqMap?: Record<string, unknown>,
  availableCodes?: ReadonlySet<string>,
): Promise<void> {
  const source: unknown = prereqMap === undefined ? JSON.parse(fs.readFileSync(path.join(
    process.cwd(),
    "src",
    "data",
    "modulePrereqInfo.json",
  ), "utf8")) : prereqMap;
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("Prerequisite source must be a module-code map");
  }
  const entries = Object.entries(source).filter(([moduleCode]) =>
    availableCodes === undefined || availableCodes.has(moduleCode),
  );
  if (availableCodes) {
    for (const moduleCode of availableCodes) {
      if (!Object.prototype.hasOwnProperty.call(source, moduleCode)) {
        throw new Error(`Missing prerequisite source entry for ${moduleCode}`);
      }
    }
  }
  for (const [moduleCode, tree] of entries) {
    try {
      parsePrerequisite(tree);
    } catch (error) {
      throw new Error(`Invalid prerequisite tree for ${moduleCode}: ${(error as Error).message}`);
    }
  }

  const upload = async (transaction: Neo4jExecutor) => {
    for (const [moduleCode, tree] of entries) {
      await attachPrereqTree(moduleCode, tree, transaction);
    }
  };
  if ("executeWrite" in executor && typeof executor.executeWrite === "function") {
    await (executor as Session).executeWrite(upload);
  } else {
    await upload(executor);
  }
}
