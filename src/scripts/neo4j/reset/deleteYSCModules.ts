import type { Session } from "neo4j-driver";
import type { Neo4jExecutor } from "./buildTree/attachTree";

export async function deleteYSCModules(executor: Neo4jExecutor): Promise<void> {
  const remove = async (transaction: Neo4jExecutor) => {
    const attached = await transaction.run(
      `MATCH ()-[r:HAS_PREREQ|REQUIRES|OPTION]->() RETURN count(r) AS attachedCount`,
    );
    if (Number(attached.records[0].get("attachedCount")) > 0) {
      throw new Error("YSC exclusions must run before prerequisite construction");
    }
    await transaction.run(
      `MATCH (m:Module)
       WHERE m.moduleCode STARTS WITH 'YSC'
       DETACH DELETE m`,
    );
  };

  if ("executeWrite" in executor && typeof executor.executeWrite === "function") {
    await (executor as Session).executeWrite(remove);
  } else {
    await remove(executor);
  }
}

export async function cleanupUnreachableLogicNodes(executor: Neo4jExecutor): Promise<void> {
  await executor.run(
    `MATCH (logic:Logic)
     WHERE NOT EXISTS {
       MATCH (:Module)-[:HAS_PREREQ]->(root)
       MATCH (root)-[:REQUIRES|OPTION*0..]->(logic)
     }
     DETACH DELETE logic`,
  );
}
