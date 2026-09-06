import fs from "fs/promises";
import path from "path";
import type { MiniModuleData } from "../../types/plannerTypes";

// For frontend use
export async function saveMiniModuleData(
  data: MiniModuleData[],
  outputDir = path.join(process.cwd(), "src", "data"),
): Promise<void> {
  // Target output: src/data/moduleList.json
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "miniModuleData.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
