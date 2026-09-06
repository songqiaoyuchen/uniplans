/**
 * @author Kevin Zhang
 * @description Handles the case where logic gate is OR
 * @created 2025-05-08
 */

import type { Integer } from "neo4j-driver";
import type { Neo4jExecutor } from "./attachTree";
import { resolveModuleCodes } from "./resolveModuleCodes";

// === Handle leaf case: a single string module prerequisite
export async function handleLeaf(
  tree: string,
  session: Neo4jExecutor,
  ownerModuleCode?: string,
): Promise<Integer> {
  // Resolve module node IDs that match the given moduleCode (handles % wildcards internally)
  const ids = await resolveModuleCodes(tree, session);

  if (ids.length === 0) {
    return createBlockedRequirement(tree, session, ownerModuleCode);
  }

  // If it's a wildcard with multiple matches (e.g. "CS2040%"), create an OR logic gate
  if (tree.includes("%") && ids.length > 1) {
    const logicRes = await session.run(
      `CREATE (l:Logic {type: "OR"}) RETURN id(l) AS logicId`,
    );
    const logicId = logicRes.records[0].get("logicId");

    // Link each matching module to the OR node via OPTION relationship
    for (const moduleId of ids) {
      await session.run(
        `MATCH (l) WHERE id(l) = $lid
           MATCH (m) WHERE id(m) = $mid
           MERGE (l)-[:OPTION]->(m)`, // connect logic node to each module via OPTION
        { lid: logicId, mid: moduleId },
      );
    }

    return logicId;
  }

  return ids[0];
}

export async function createBlockedRequirement(
  token: string,
  executor: Neo4jExecutor,
  ownerModuleCode?: string,
): Promise<Integer> {
  const result = await executor.run(
    `CREATE (l:Logic {type: "BLOCKED", reason: $reason, moduleCode: $moduleCode,
                      originalToken: $originalToken, ownerModuleCode: $ownerModuleCode})
     RETURN id(l) AS logicId`,
    {
      reason: `Unavailable prerequisite ${token}${ownerModuleCode ? ` for ${ownerModuleCode}` : ""}`,
      moduleCode: token.split(":")[0].toUpperCase(),
      originalToken: token,
      ownerModuleCode: ownerModuleCode ?? null,
    },
  );
  return result.records[0].get("logicId");
}
