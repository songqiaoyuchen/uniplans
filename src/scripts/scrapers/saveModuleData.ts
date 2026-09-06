/**
 * @author Kevin Zhang
 * @description Writes to a file for later use
 * @created 2025-05-07
 */

import fs from "fs/promises";
import path from "path";
import type { Neo4jModuleData } from "../../types/neo4jTypes";

export async function saveModuleData(
  response: Neo4jModuleData[],
  outputDir = path.join(process.cwd(), "src", "data"),
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "moduleData.json");
  await fs.writeFile(filePath, JSON.stringify(response, null, 2), "utf-8");
}
