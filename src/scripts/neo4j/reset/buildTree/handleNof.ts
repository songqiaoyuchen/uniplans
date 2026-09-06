// /src/scripts/neo4j/handleNof.ts
// Handles the case where logic gate is Nof
import type { Integer } from "neo4j-driver";
import { connectLogicChild, processParsedTree, type Neo4jExecutor } from "./attachTree";
import { resolveModuleCodes } from "./resolveModuleCodes";
import { createBlockedRequirement } from "./handleLeaf";
import type { PrerequisiteNode } from "../../../../types/prerequisiteTypes";

export async function handleNof(
  tree: Extract<PrerequisiteNode, { type: "NOF" }>,
  session: Neo4jExecutor,
  ownerModuleCode?: string,
): Promise<Integer> {
  const logicRes = await session.run(
    `CREATE (l:Logic {type: "NOF", threshold: $threshold}) RETURN id(l) AS logicId`,
    { threshold: tree.n },
  );
  const logicId: Integer = logicRes.records[0].get("logicId");
  const linked = new Set<string>();

  for (const child of tree.children) {
    // Special handling for wildcards in NOF - flatten them directly
    if (child.type === "module" && child.moduleCode.includes("%")) {
      const token = `${child.moduleCode}${child.minimumGrade ? `:${child.minimumGrade}` : ""}`;
      const moduleIds = await resolveModuleCodes(token, session);
      if (moduleIds.length === 0) {
        await connectLogicChild(logicId, await createBlockedRequirement(token, session, ownerModuleCode), session);
      }
      for (const moduleId of moduleIds) {
        if (linked.has(moduleId.toString())) continue;
        linked.add(moduleId.toString());
        await session.run(
          `MATCH (l) WHERE id(l) = $lid
           MATCH (m) WHERE id(m) = $mid
           MERGE (l)-[:OPTION]->(m)`,
          { lid: logicId, mid: moduleId },
        );
      }
    } else {
      const childId = await processParsedTree(child, session, ownerModuleCode);
      if (linked.has(childId.toString())) continue;
      linked.add(childId.toString());

      // Use same logic as buildLogicGate - check actual node type
      await connectLogicChild(logicId, childId, session);
    }
  }

  return logicId;
}
