import fs from "fs/promises";
import path from "path";
import type { Neo4jModuleData } from "../../../types/neo4jTypes";
import type { Neo4jExecutor } from "./buildTree/attachTree";

export async function uploadModules(executor: Neo4jExecutor, modules?: Neo4jModuleData[]): Promise<void> {
  const moduleList: Neo4jModuleData[] = modules ?? JSON.parse(
    await fs.readFile(path.join(process.cwd(), "src", "data", "moduleData.json"), "utf8"),
  );
  for (let offset = 0; offset < moduleList.length; offset += 250) {
    const rows = moduleList.slice(offset, offset + 250).map((mod) => ({
      moduleCode: mod.moduleCode,
      title: mod.title ?? null,
      description: mod.description ?? null,
      moduleCredit: mod.moduleCredit ?? null,
      department: mod.department ?? null,
      faculty: mod.faculty ?? null,
      workload: mod.workload ?? [],
      gradingBasisDescription: mod.gradingBasisDescription ?? null,
      prerequisite: mod.prerequisite ?? null,
      preclusion: mod.preclusion ?? null,
      attributes: JSON.stringify(mod.attributes ?? {}), // Neo4j node properties can only hold primitive values or arrays of primitives
      semesterData: JSON.stringify(mod.semesterData ?? []),
    }));
    const result = await executor.run(
      `UNWIND $rows AS row
       MERGE (m:Module {moduleCode: row.moduleCode})
       SET m += row
       RETURN count(m) AS uploadedCount`,
      { rows },
    );
    if (result.records.length !== 1 || Number(result.records[0].get("uploadedCount")) !== rows.length) {
      throw new Error(`Incomplete module upload at batch offset ${offset}`);
    }
  }
}
