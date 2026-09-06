import { fetchModuleData } from "../../scrapers/fetchModuleData";
import { fetchPrereqInfo } from "../../scrapers/fetchPrereqInfo";
import { CatalogueSnapshot, prepareCatalogue } from "./preflight";
import { savePreparedSnapshot } from "./catalogueSnapshot";

export async function downloadData(stagingPath?: string): Promise<CatalogueSnapshot> {
  const { full, mini } = await fetchModuleData();
  const prereq = await fetchPrereqInfo(full);
  const snapshot = prepareCatalogue(full, mini, prereq);
  if (stagingPath !== undefined) await savePreparedSnapshot(snapshot, stagingPath);
  return snapshot;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const task = args.length === 2 && args[0] === "--stage"
    ? downloadData(args[1])
    : Promise.reject(new Error("Usage: downloadData --stage <new snapshot file outside src/data>"));
  task.then((snapshot) => {
    console.log(`Prepared ${snapshot.full.length} modules; fingerprint ${snapshot.fingerprint}`);
  }).catch((error) => {
    console.error("Failed to prepare catalogue:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
