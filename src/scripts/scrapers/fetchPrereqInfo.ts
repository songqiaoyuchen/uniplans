/**
 * @author Kevin Zhang
 * @description Fetches prerequisite trees from NUSMods API for all modules in data/moduleList.json
 * @created 2025-05-07
 */

import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { Prerequisite, Neo4jModuleData } from "@/types/neo4jTypes";

const academicYear = "2025-2026";
const API_URL = `https://api.nusmods.com/v2/${academicYear}/modules/`;

export async function fetchPrereqInfo(): Promise<Prerequisite> {
  const moduleDataPath = path.join(
    process.cwd(),
    "src",
    "data",
    "moduleData.json",
  );
  const fileData = await fs.readFile(moduleDataPath, "utf-8");
  const moduleData: Neo4jModuleData[] = JSON.parse(fileData);

  const results: Prerequisite = {};

  for (const mod of moduleData) {
    const code = mod.moduleCode;
    try {
      const res = await axios.get(`${API_URL}${code}.json`);
      const tree = res.data.prereqTree;

      if (tree) {
        results[code] = tree;
        console.log(`✅ ${code}`);
      } else {
        results[code] = null;
        console.warn(`⚠️ ${code} has no prerequisites`);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.warn(
          `⚠️ Skipping ${code}:`,
          err.response?.status ?? err.message,
        );
      } else {
        console.warn(
          `⚠️ Skipping ${code}: Unexpected error`,
          (err as Error).message,
        );
      }
    }
  }

  return results;
}
