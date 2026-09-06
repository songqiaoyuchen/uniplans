import { parseStaticPrereq } from "@/utils/planner/parseStaticPrereq";
import { PrereqTree } from "@/types/plannerTypes";
import modulePrereqInfo from "@/data/modulePrereqInfo.json";
import miniModuleData from "@/data/miniModuleData.json";
import { markUnavailablePrerequisites } from "@/utils/prerequisites/markUnavailablePrerequisites";

const catalogue = new Set(miniModuleData.map(({ code }) => code).filter((code) => !code.startsWith("YSC")));

export async function getModuleRequires(
  moduleCode: string,
): Promise<PrereqTree | null> {
  // Use static data instead of database query to avoid large graph traversals
  if (!Object.hasOwn(modulePrereqInfo, moduleCode)) {
    throw new Error(`Missing prerequisite data for ${moduleCode}`);
  }
  const prereqData = (modulePrereqInfo as Record<string, unknown>)[moduleCode];
  return markUnavailablePrerequisites(parseStaticPrereq(prereqData), catalogue);
}

