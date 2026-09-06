import type { Session } from "neo4j-driver";
import { randomUUID } from "node:crypto";
import type { Neo4jExecutor } from "./buildTree/attachTree";
import { deleteGraph } from "./deleteGraph";
import { uploadModules } from "./uploadModules";
import { deleteYSCModules, cleanupUnreachableLogicNodes } from "./deleteYSCModules";
import { uploadAllPrereqTrees } from "./uploadPrerequisites";
import { deduplicateLogicNodes } from "./deduplicateLogicNodes";
import { assertGraphInvariants } from "./assertGraphInvariants";
import { availableCatalogueCodes, validateSnapshot, type CatalogueSnapshot } from "./preflight";

export const IMPORT_METADATA_NAME = "prerequisites";

export async function acquirePublicationLock(executor: Neo4jExecutor): Promise<void> {
  const result = await executor.run(
    `MATCH (anchor)
     WHERE (anchor:ImportMetadata AND anchor.name = $name) OR anchor:Module OR anchor:Logic
     WITH anchor ORDER BY CASE WHEN anchor:ImportMetadata THEN 0 ELSE 1 END, elementId(anchor)
     LIMIT 1
     SET anchor._prerequisitePublicationLock = coalesce(anchor._prerequisitePublicationLock, 0) + 1
     RETURN elementId(anchor) AS anchorId`,
    { name: IMPORT_METADATA_NAME },
  );
  if (result.records.length !== 1 || !result.records[0].get("anchorId")) {
    throw new Error("Publication requires an existing application lock anchor; initialize one ImportMetadata {name: 'prerequisites', status: 'uninitialized'} node under exclusive maintenance before importing an empty database");
  }
  const metadata = await executor.run(
    `MATCH (metadata:ImportMetadata {name: $name}) RETURN count(metadata) AS metadataCount`,
    { name: IMPORT_METADATA_NAME },
  );
  if (metadata.records.length !== 1 || ![0, 1].includes(Number(metadata.records[0].get("metadataCount")))) {
    throw new Error("Publication refused: ambiguous import metadata, possibly a concurrent initial publication");
  }
}

export type PublicationSteps = {
  deleteGraph: typeof deleteGraph;
  uploadModules: typeof uploadModules;
  deleteYSCModules: typeof deleteYSCModules;
  uploadAllPrereqTrees: typeof uploadAllPrereqTrees;
  deduplicateLogicNodes: typeof deduplicateLogicNodes;
  cleanupUnreachableLogicNodes: typeof cleanupUnreachableLogicNodes;
  assertGraphInvariants: typeof assertGraphInvariants;
};

export async function publishSnapshot(
  session: Pick<Session, "beginTransaction">,
  input: CatalogueSnapshot,
  overrides: Partial<PublicationSteps> = {},
): Promise<void> {
  const snapshot = validateSnapshot(JSON.parse(JSON.stringify(input)));
  const available = availableCatalogueCodes(snapshot);
  const steps: PublicationSteps = {
    deleteGraph, uploadModules, deleteYSCModules, uploadAllPrereqTrees,
    deduplicateLogicNodes, cleanupUnreachableLogicNodes, assertGraphInvariants, ...overrides,
  };
  const transaction = session.beginTransaction();
  try {
    await acquirePublicationLock(transaction);
    await steps.deleteGraph(transaction);
    await steps.uploadModules(transaction, snapshot.full);
    await steps.deleteYSCModules(transaction);
    await steps.uploadAllPrereqTrees(transaction, snapshot.prereq, available);
    await steps.deduplicateLogicNodes(transaction);
    await steps.cleanupUnreachableLogicNodes(transaction);
    await steps.assertGraphInvariants(transaction, snapshot);
    const metadata = await transaction.run(
      `MERGE (metadata:ImportMetadata {name: $name})
       SET metadata.schemaVersion = $schemaVersion,
           metadata.fingerprint = $fingerprint,
           metadata.status = 'ready',
           metadata.publicationId = $publicationId,
           metadata.moduleCount = $moduleCount
       RETURN count(metadata) AS metadataCount`,
      {
        name: IMPORT_METADATA_NAME,
        schemaVersion: snapshot.schemaVersion,
        fingerprint: snapshot.fingerprint,
        publicationId: randomUUID(),
        moduleCount: available.size,
      },
    );
    if (metadata.records.length !== 1 || Number(metadata.records[0].get("metadataCount")) !== 1) {
      throw new Error("Publication refused: import metadata was not written exactly once");
    }
    await transaction.commit();
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], "Publication failed and rollback could not be confirmed");
    }
    throw error;
  }
}
