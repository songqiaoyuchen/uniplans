import axios from "axios";
import { Neo4jModuleData, Neo4jMiniModuleData } from "@/types/neo4jTypes";
import { MiniModuleData } from "@/types/plannerTypes";

const academicYear = "2026-2027";
const API_URL = `https://api.nusmods.com/v2/${academicYear}/`;

export async function fetchModuleData(): Promise<{
  full: Neo4jModuleData[];
  mini: MiniModuleData[];
}> {
  const MODULE_INFO_URL = `${API_URL}/moduleInfo.json`;
  const MODULE_LIST_URL = `${API_URL}/moduleList.json`;

  try {
    const [infoRes, listRes] = await Promise.all([
      axios.get<Neo4jModuleData[]>(MODULE_INFO_URL),
      axios.get<Neo4jMiniModuleData[]>(MODULE_LIST_URL),
    ]);

    // Rename `moduleCode` to `code` (For frontend use)
    const mini: MiniModuleData[] = listRes.data.map((mod) => ({
      code: mod.moduleCode,
      title: mod.title,
    }));

    const currentCodes = new Set(mini.map((mod) => mod.code));

    const filteredInfo = infoRes.data.filter((mod) =>
      currentCodes.has(mod.moduleCode),
    );

    return { full: filteredInfo, mini };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Error fetching module info:", error);
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else {
      console.error("Unexpected Error:", error);
    }
    return { full: [], mini: [] };
  }
}
