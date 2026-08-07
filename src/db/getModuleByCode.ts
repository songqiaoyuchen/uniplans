import { SemesterLabel, type ModuleData } from "@/types/plannerTypes";
import type { Neo4jModuleData } from "@/types/neo4jTypes";
import moduleDataArray from "@/data/moduleData.json";
import { getModuleRequires } from "./getModuleRequires";

// TS/Editor may infer JSON imports as `{}`. Cast the import to the expected
// raw catalogue type so downstream code sees proper fields.
const dataArray = moduleDataArray as unknown as readonly Neo4jModuleData[];

// Construct the index once in the server process rather than scanning the
// nine-megabyte catalogue for every requested module.
const modulesByCode = new Map<string, Neo4jModuleData>(
  dataArray.map((module) => [module.moduleCode.toUpperCase(), module] as const),
);

export async function getModuleByCode(
  moduleCode: string,
): Promise<ModuleData | null> {
  const normalizedCode = moduleCode.toUpperCase();
  const rawModule = modulesByCode.get(normalizedCode);
  
  if (!rawModule) {
    return null;
  }

  // Extract preclusions from string (same logic as mapModuleData)
  const preclusions: string[] = [];
  if (typeof rawModule.preclusion === "string") {
    const matches: string[] | null = rawModule.preclusion.match(/\b[A-Z]{2,3}\d{4}[A-Z]?\b/g);
    if (matches) {
      const ownCode = normalizedCode;

      // Exclude self-referential preclusions
      preclusions.push(
        ...matches.filter(code => code.toUpperCase() !== ownCode)
      );
    }
  }

  // Convert semester numbers to SemesterLabel enum (align with mapModuleData)
  const semestersOffered: SemesterLabel[] = [];
  if (Array.isArray(rawModule.semesterData)) {
    for (const semData of rawModule.semesterData) {
      switch (semData.semester) {
      case 1:
        semestersOffered.push(SemesterLabel.First);
        break;
      case 2:
        semestersOffered.push(SemesterLabel.Second);
        break;
      case 3:
        semestersOffered.push(SemesterLabel.SpecialTerm1);
        break;
      case 4:
        semestersOffered.push(SemesterLabel.SpecialTerm2);
        break;
      default:
        break;
      }
    }
  }

  // Transform raw module data to match ModuleData type
  const mod: ModuleData = {
    id: "", // neo4j node id not available in static data
    code: rawModule.moduleCode,
    title: rawModule.title ?? rawModule.moduleCode,
    credits: typeof rawModule.moduleCredit === "number"
      ? rawModule.moduleCredit
      : parseInt(String(rawModule.moduleCredit ?? "0"), 10),
    semestersOffered,
    exam: null, // Not in static data
    preclusions: preclusions,
    description: rawModule.description,
    faculty: rawModule.faculty,
    department: rawModule.department,
  };

  // Fetch and attach prerequisites
  const requires = await getModuleRequires(normalizedCode);
  if (requires) {
    mod.requires = requires;
  }

  return mod;
}
