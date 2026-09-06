import { downloadData } from "./downloadData";
import { loadLocalSnapshot, loadPreparedSnapshot } from "./catalogueSnapshot";
import { availableCatalogueCodes, type CatalogueSnapshot } from "./preflight";
import { publishSnapshot } from "./publishSnapshot";

export type ResetOptions = {
  apply: boolean;
  source: "local" | "snapshot" | "download";
  snapshotPath?: string;
  stagingPath?: string;
};

export function parseResetOptions(args: string[]): ResetOptions {
  const options: ResetOptions = { apply: false, source: "local" };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error(`Duplicate argument ${flag}`);
    seen.add(flag);
    if (flag === "--apply") options.apply = true;
    else if (flag === "--dry-run") options.apply = false;
    else if (flag === "--source" || flag === "--snapshot" || flag === "--stage") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
      if (flag === "--source") {
        if (value !== "local" && value !== "snapshot" && value !== "download") throw new Error(`Unknown source ${value}`);
        options.source = value;
      } else if (flag === "--snapshot") options.snapshotPath = value;
      else options.stagingPath = value;
    } else throw new Error(`Unknown argument ${flag}`);
  }
  if (seen.has("--apply") && seen.has("--dry-run")) throw new Error("Choose --apply or --dry-run, not both");
  if (options.snapshotPath && !seen.has("--source")) options.source = "snapshot";
  if ((options.source === "snapshot") !== Boolean(options.snapshotPath)) throw new Error("--source snapshot requires --snapshot <file>; other sources cannot use --snapshot");
  if (options.source === "download" && !options.stagingPath) throw new Error("--source download requires --stage <new file outside src/data>");
  if (options.source !== "download" && options.stagingPath) throw new Error("--stage is only valid with --source download");
  return options;
}

export async function resetDB(args = process.argv.slice(2)): Promise<CatalogueSnapshot | undefined> {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: npm run resetDB -- [--dry-run | --apply] [--source local | --source snapshot --snapshot <file> | --source download --stage <new file outside src/data>]");
    console.log("Defaults to read-only local preflight. Download requires network access; only --apply opens Neo4j. Deploy matching static data separately; filesystem and database publication are not jointly atomic.");
    return;
  }
  const options = parseResetOptions(args);
  const startTime = Date.now();
  let snapshot: CatalogueSnapshot;
  if (options.source === "download") {
    // Uncomment the following line to download the latest NUSMods data (Don't spam it!)
    snapshot = await downloadData(options.stagingPath);
  } else if (options.source === "snapshot") {
    snapshot = await loadPreparedSnapshot(options.snapshotPath!);
  } else {
    snapshot = await loadLocalSnapshot();
  }
  console.log(`Prepared ${snapshot.full.length} catalogue modules (${availableCatalogueCodes(snapshot).size} after exclusions); schema ${snapshot.schemaVersion}; fingerprint ${snapshot.fingerprint}`);
  console.log(`${snapshot.diagnostics.length} unavailable prerequisite references will remain blocked.`);
  for (const diagnostic of snapshot.diagnostics.slice(0, 10)) {
    console.log(`  ${diagnostic.moduleCode} ${diagnostic.path}: unavailable ${diagnostic.token}`);
  }
  if (!options.apply) {
    console.log("Dry-run complete. No database connection or active catalogue writes were made.");
    return snapshot;
  }
  const { getNeo4jDriver, closeNeo4jDriver } = await import("../../../db/neo4j");
  try {
    const session = getNeo4jDriver().session();
    try {
      await publishSnapshot(session, snapshot);
    } finally {
      await session.close();
    }
  } finally {
    await closeNeo4jDriver();
  }
  console.log(`Graph published atomically in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds. Static catalogue deployment is separate and must match fingerprint ${snapshot.fingerprint}.`);
  return snapshot;
}

if (require.main === module) {
  resetDB().catch((error) => {
    console.error("Failed to prepare or publish catalogue:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
