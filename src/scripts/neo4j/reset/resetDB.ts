import { uploadModules } from "./uploadModules";
import { deduplicateLogicNodes } from "./deduplicateLogicNodes";
import { deleteGraph } from "./deleteGraph";
import { deleteYSCModules } from "./deleteYSCModules";
import { uploadAllPrereqTrees } from "./uploadPrerequisites";
import { getNeo4jDriver } from "../../../db/neo4j";
import { closeNeo4jDriver } from "../../../db/neo4j";

async function resetDB(): Promise<void> {
  const startTime = Date.now();
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    await deleteGraph(session);
    // Uncomment the following line to download the latest NUSMods data (Don't spam it!)
    // await downloadData();
    await uploadModules(session);
    await uploadAllPrereqTrees(session);
    await deduplicateLogicNodes(session);
    await deleteYSCModules(session);
    console.log("✅ Graph reset and rebuilt successfully.");
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Graph reset and rebuilt successfully in ${duration} seconds.`,
    );
  } catch (err) {
    console.error("❌ Error resetting and rebuilding graph:", err);
  } finally {
    await session.close();
    await closeNeo4jDriver();
  }
}

if (require.main === module) {
  resetDB().catch((err) => {
    console.error("❌ Failed to reset database:", err);
    process.exit(1);
  });
}
