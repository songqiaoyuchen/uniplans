/**
 * @author Kevin Zhang
 * @description Fetches prerequisite trees from NUSMods API for all modules in data/moduleList.json
 * @created 2025-05-07
 */

import axios from "axios";
import fs from "fs/promises";
import path from "path";
import type { Neo4jModuleData } from "../../types/neo4jTypes";

const academicYear = "2026-2027";
const API_URL = `https://api.nusmods.com/v2/${academicYear}/modules/`;

export async function fetchPrereqInfo(moduleData?: readonly Neo4jModuleData[]): Promise<Record<string, unknown>> {
  if (moduleData === undefined) {
    const moduleDataPath = path.join(process.cwd(), "src", "data", "moduleData.json");
    moduleData = JSON.parse(await fs.readFile(moduleDataPath, "utf-8")) as Neo4jModuleData[];
  }
  if (!Array.isArray(moduleData) || moduleData.length === 0) throw new Error("Cannot fetch prerequisites for an empty catalogue");
  const results: Record<string, unknown> = {};
  for (const mod of moduleData) {
    const code = mod.moduleCode;
    if (!code || Object.prototype.hasOwnProperty.call(results, code)) throw new Error(`Invalid or duplicate module code ${code}`);
    try {
      const res = await axios.get(`${API_URL}${encodeURIComponent(code)}.json`);
      if (!res.data || typeof res.data !== "object" || Array.isArray(res.data) || res.data.moduleCode !== code) {
        throw new Error("Invalid or mismatched module response");
      }
      if (res.data.prereqTree === undefined && typeof res.data.prerequisite === "string" && res.data.prerequisite.trim()) {
        throw new Error("Prerequisite text was returned without a prerequisite tree");
      }
      results[code] = res.data.prereqTree === undefined ? null : res.data.prereqTree;
    } catch (error) {
      throw new Error(`Failed to fetch prerequisites for ${code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return results;
}
