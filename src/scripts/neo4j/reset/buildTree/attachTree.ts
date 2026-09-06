/**
 * @author Kevin Zhang
 * @description Attaches prerequisite trees to module nodes in Neo4j
 * @created 2025-05-07
 */

import type { Session, Integer } from "neo4j-driver";
import type { PrerequisiteNode } from "../../../../types/prerequisiteTypes";
import { parsePrerequisite } from "../../../../utils/prerequisites/parsePrerequisite";
import { cleanupUnreachableLogicNodes } from "../deleteYSCModules";
import { handleLeaf } from "./handleLeaf";
import { handleNof } from "./handleNof";

export type Neo4jExecutor = Pick<Session, "run">;

const CLEAR_EXISTING = true; // Set to false if you want to preserve existing logic
export async function attachPrereqTree(
  moduleCode: string,
  tree: unknown | null,
  executor: Neo4jExecutor,
): Promise<void> {
  let parsed: PrerequisiteNode | null;
  try {
    parsed = parsePrerequisite(tree);
  } catch (error) {
    throw new Error(`Invalid prerequisite tree for ${moduleCode}: ${(error as Error).message}`);
  }

  const replace = async (transaction: Neo4jExecutor) => {
    const owner = await transaction.run(
      `MATCH (m:Module {moduleCode: $moduleCode})
       OPTIONAL MATCH (m)-[r:HAS_PREREQ]->()
       RETURN id(m) AS moduleId, count(r) AS rootCount`,
      { moduleCode },
    );
    if (owner.records.length !== 1) {
      throw new Error(`Expected one prerequisite owner Module for ${moduleCode}`);
    }
    const hadRoot = Number(owner.records[0].get("rootCount")) > 0;
    const nodeId = parsed === null ? null : await processParsedTree(parsed, transaction, moduleCode);

    if (nodeId === null) {
      if (CLEAR_EXISTING) {
        await transaction.run(
          `MATCH (m:Module {moduleCode: $moduleCode})-[r:HAS_PREREQ]->() DELETE r`,
          { moduleCode },
        );
      }
    } else {
      // Dynamically detect whether the returned node is a Logic or Module
      const result = await transaction.run(
        `MATCH (n) WHERE id(n) = $id RETURN labels(n) AS labels`,
        { id: nodeId },
      );
      if (result.records.length === 0) {
        throw new Error(`Prerequisite root for ${moduleCode} disappeared during construction`);
      }
      const labels = result.records[0].get("labels") as string[];
      const relTargetLabel = labels.includes("Logic") ? "Logic" : "Module";

      // First: delete the HAS_PREREQ relationship
      const attached = await transaction.run(
        `MATCH (m:Module {moduleCode: $moduleCode})
         MATCH (t:${relTargetLabel}) WHERE id(t) = $id
         OPTIONAL MATCH (m)-[old:HAS_PREREQ]->()
         WITH m, t, collect(old) AS previousRoots
         FOREACH (relationship IN CASE WHEN $clearExisting THEN previousRoots ELSE [] END |
           DELETE relationship)
         MERGE (m)-[:HAS_PREREQ]->(t)
         RETURN id(t) AS rootId`,
        { moduleCode, id: nodeId, clearExisting: CLEAR_EXISTING },
      );
      if (attached.records.length !== 1) {
        throw new Error(`Failed to replace prerequisite root for ${moduleCode}`);
      }
    }

    // Second: delete the entire logic subtree (only logic nodes!)
    if (CLEAR_EXISTING && hadRoot) {
      await cleanupUnreachableLogicNodes(transaction);
    }
  };

  if ("executeWrite" in executor && typeof executor.executeWrite === "function") {
    await (executor as Session).executeWrite(replace);
  } else {
    await replace(executor);
  }
}

// Core recursive function for constructing a prerequisite logic tree
export async function processTree(
  tree: unknown | null,
  executor: Neo4jExecutor,
  ownerModuleCode?: string,
): Promise<Integer | null> {
  const parsed = parsePrerequisite(tree);
  return parsed === null ? null : processParsedTree(parsed, executor, ownerModuleCode);
}

export async function processParsedTree(
  tree: PrerequisiteNode,
  executor: Neo4jExecutor,
  ownerModuleCode?: string,
): Promise<Integer> {
  switch (tree.type) {
  case "module":
    return handleLeaf(
      `${tree.moduleCode}${tree.minimumGrade ? `:${tree.minimumGrade}` : ""}`,
      executor,
      ownerModuleCode,
    );
  case "NOF":
    return handleNof(tree, executor, ownerModuleCode);
  case "AND":
  case "OR":
    return buildLogicGate(tree.type, tree.children, executor, ownerModuleCode);
  case "condition":
  case "conditional": {
    const result = await executor.run(
      `CREATE (l:Logic {type: $type, condition: $condition}) RETURN id(l) AS logicId`,
      { type: tree.type === "condition" ? "CONDITION" : "CONDITIONAL", condition: JSON.stringify(tree.condition) },
    );
    const logicId: Integer = result.records[0].get("logicId");
    if (tree.type === "conditional") {
      await connectLogicChild(logicId, await processParsedTree(tree.then, executor, ownerModuleCode), executor);
    }
    return logicId;
  }
  case "constant": {
    const result = await executor.run(
      `CREATE (l:Logic {type: "CONSTANT", value: $value}) RETURN id(l) AS logicId`,
      { value: tree.value },
    );
    return result.records[0].get("logicId");
  }
  case "blocked": {
    const result = await executor.run(
      `CREATE (l:Logic {type: "BLOCKED", reason: $reason, moduleCode: $moduleCode,
                        originalToken: $moduleCode, ownerModuleCode: $ownerModuleCode})
       RETURN id(l) AS logicId`,
      { reason: tree.reason, moduleCode: tree.moduleCode ?? null, ownerModuleCode: ownerModuleCode ?? null },
    );
    return result.records[0].get("logicId");
  }
  }
}

async function buildLogicGate(
  type: "AND" | "OR",
  children: PrerequisiteNode[],
  executor: Neo4jExecutor,
  ownerModuleCode?: string,
): Promise<Integer> {
  if (children.length === 0) {
    throw new Error(`Invalid empty ${type} prerequisite gate`);
  }
  const result = await executor.run(
    `CREATE (l:Logic {type: $type}) RETURN id(l) AS logicId`,
    { type },
  );
  const logicId: Integer = result.records[0].get("logicId");
  for (const child of children) {
    await connectLogicChild(logicId, await processParsedTree(child, executor, ownerModuleCode), executor);
  }
  return logicId;
}

export async function connectLogicChild(
  logicId: Integer,
  childId: Integer,
  executor: Neo4jExecutor,
): Promise<void> {
  // Dynamically determine edge type based on actual label of the returned node
  const labelRes = await executor.run(
    `MATCH (n) WHERE id(n) = $id RETURN labels(n) AS labels`,
    { id: childId },
  );
  if (labelRes.records.length === 0) {
    throw new Error(`Node ${childId} disappeared during processing`);
  }
  const labels = labelRes.records[0].get("labels") as string[];
  const rel = labels.includes("Module") ? "OPTION" : "REQUIRES";
  await executor.run(
    `MATCH (l:Logic) WHERE id(l) = $lid
     MATCH (t) WHERE id(t) = $tid
     MERGE (l)-[:${rel}]->(t)`,
    { lid: logicId, tid: childId },
  );
}
