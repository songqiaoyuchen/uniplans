/**
 * @author Kevin Zhang
 * @description Clears all nodes and relationships from the Neo4j database.
 * @created 2025-06-28
 */

import type { Neo4jExecutor } from "./buildTree/attachTree";

export async function deleteGraph(executor: Neo4jExecutor): Promise<void> {
  await executor.run(`MATCH (n) WHERE n:Module OR n:Logic DETACH DELETE n`);
}