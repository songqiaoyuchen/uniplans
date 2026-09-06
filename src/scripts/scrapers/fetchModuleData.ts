import axios from "axios";
import type { Neo4jModuleData, Neo4jMiniModuleData } from "../../types/neo4jTypes";
import type { MiniModuleData } from "../../types/plannerTypes";

const academicYear = "2026-2027";
const API_URL = `https://api.nusmods.com/v2/${academicYear}/`;

export async function fetchModuleData(): Promise<{
  full: Neo4jModuleData[];
  mini: MiniModuleData[];
}> {
  const MODULE_INFO_URL = `${API_URL}moduleInfo.json`;
  const MODULE_LIST_URL = `${API_URL}moduleList.json`;
  const [infoRes, listRes] = await Promise.all([
    axios.get<Neo4jModuleData[]>(MODULE_INFO_URL),
    axios.get<Neo4jMiniModuleData[]>(MODULE_LIST_URL),
  ]);
  if (!Array.isArray(infoRes.data) || !Array.isArray(listRes.data) || !infoRes.data.length || !listRes.data.length) {
    throw new Error("NUSMods returned an empty or invalid module catalogue");
  }

  // Rename `moduleCode` to `code` (For frontend use)
  const mini: MiniModuleData[] = listRes.data.map((mod) => ({
    code: mod.moduleCode,
    title: mod.title,
  }));
  const currentCodes = new Set(mini.map((mod) => mod.code));
  const filteredInfo = infoRes.data.filter((mod) => currentCodes.has(mod.moduleCode));
  return { full: filteredInfo, mini };
}
