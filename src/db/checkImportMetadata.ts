import type { Session } from "neo4j-driver";
import moduleData from "@/data/moduleData.json";
import miniModuleData from "@/data/miniModuleData.json";
import modulePrereqInfo from "@/data/modulePrereqInfo.json";
import { computeCatalogueFingerprint, CURRENT_PREREQUISITE_SCHEMA_VERSION } from "@/utils/prerequisites/catalogueFingerprint";
import { GraphDataError } from "./graphDataError";

const fingerprint = computeCatalogueFingerprint(moduleData, miniModuleData, modulePrereqInfo);

export async function checkImportMetadata(session: Pick<Session, "run">): Promise<string> {
  const result = await session.run(
    `MATCH (metadata:ImportMetadata {name: "prerequisites"})
     RETURN metadata.schemaVersion AS schemaVersion, metadata.fingerprint AS fingerprint,
            metadata.status AS status, metadata.publicationId AS publicationId`,
  );
  const record = result.records[0];
  const storedVersion = record?.get("schemaVersion");
  const version = typeof storedVersion === "number" ? storedVersion : storedVersion?.toNumber?.();
  if (result.records.length !== 1 || version !== CURRENT_PREREQUISITE_SCHEMA_VERSION || record?.get("status") !== "ready") {
    throw new GraphDataError("Prerequisite graph needs a validated rebuild before generation is available");
  }
  if (record.get("fingerprint") !== fingerprint) {
    throw new GraphDataError("Prerequisite graph and application catalogue differ; deploy matching validated snapshots before generating");
  }
  const publicationId = record.get("publicationId");
  if (typeof publicationId !== "string" || !publicationId) throw new GraphDataError("Prerequisite graph publication cannot be verified");
  return publicationId;
}
