/**
 * @author Kevin Zhang
 * @description Returns node IDs of the corresponding course(s) in Neo4j
 * @created 2025-05-08
 */

import type { Integer } from "neo4j-driver";
import type { Neo4jExecutor } from "./attachTree";

// === Resolve one or more module IDs from a raw moduleCode (e.g., "CS2040", "CS2040%", "CS2040:D")
export async function resolveModuleCodes(
  tree: string,
  session: Neo4jExecutor,
): Promise<Integer[]> {
  let rawCode = tree.split(":")[0].toUpperCase();
  let moduleIds: Integer[] = [];

  if (rawCode.includes("%")) {
    rawCode = rawCode.replace("%", "");
    const res = await session.run(
      `MATCH (m:Module) WHERE m.moduleCode STARTS WITH $rawCode RETURN id(m) AS id`,
      { rawCode },
    );
    moduleIds = res.records.map((r) => r.get("id"));
  } else {
    const res = await session.run(
      `MATCH (m:Module {moduleCode: $moduleCode}) RETURN id(m) AS id`,
      { moduleCode: rawCode },
    );
    moduleIds = res.records.map((r) => r.get("id"));
  }

  return [...new Map(moduleIds.map((id) => [id.toString(), id])).values()];
}
