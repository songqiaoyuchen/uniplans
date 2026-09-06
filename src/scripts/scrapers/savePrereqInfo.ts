/**
 * @author Kevin Zhang
 * @description Saves all fetched prerequisite trees to disk
 * @created 2025-05-07
 */

import fs from "fs/promises";
import path from "path";

export async function savePrereqInfo(
  data: Record<string, unknown>,
  outputDir = path.join(process.cwd(), "src", "data"),
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "modulePrereqInfo.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
