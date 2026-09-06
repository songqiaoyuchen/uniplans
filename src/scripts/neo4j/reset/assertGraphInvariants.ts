import type { Neo4jExecutor } from "./buildTree/attachTree";
import { availableCatalogueCodes, type CatalogueSnapshot } from "./preflight";
import { parsePrerequisite } from "../../../utils/prerequisites/parsePrerequisite";

export async function assertGraphInvariants(executor: Neo4jExecutor, snapshot: CatalogueSnapshot): Promise<void> {
  const available = availableCatalogueCodes(snapshot);
  const modules = await executor.run(
    `MATCH (m:Module)
     OPTIONAL MATCH (m)-[r:HAS_PREREQ]->()
     RETURN elementId(m) AS moduleId, m.moduleCode AS code, count(r) AS rootCount`,
  );
  const seen = new Set<string>();
  for (const row of modules.records) {
    const code = row.get("code") as string;
    if (!available.has(code) || seen.has(code)) throw new Error(`Graph invariant failed: unexpected or duplicate Module ${code}`);
    seen.add(code);
    const expected = snapshot.prereq[code] === null ? 0 : 1;
    if (Number(row.get("rootCount")) !== expected) throw new Error(`Graph invariant failed: prerequisite root count for ${code}`);
  }
  if (seen.size !== available.size) throw new Error("Graph invariant failed: incomplete module catalogue");

  const invalidEdges = await executor.run(
    `MATCH (a)-[r:HAS_PREREQ|REQUIRES|OPTION]->(b)
     WHERE NOT ((type(r) = 'HAS_PREREQ' AND a:Module AND (b:Module OR b:Logic))
       OR (type(r) = 'REQUIRES' AND a:Logic AND b:Logic)
       OR (type(r) = 'OPTION' AND a:Logic AND b:Module))
     RETURN count(r) AS invalidCount`,
  );
  if (Number(invalidEdges.records[0]?.get("invalidCount")) !== 0) throw new Error("Graph invariant failed: invalid prerequisite relationship");

  const unreachable = await executor.run(
    `MATCH (logic:Logic)
     WHERE NOT EXISTS {
       MATCH (:Module)-[:HAS_PREREQ]->(root)
       MATCH (root)-[:REQUIRES|OPTION*0..]->(logic)
     }
     RETURN count(logic) AS unreachableCount`,
  );
  if (Number(unreachable.records[0]?.get("unreachableCount")) !== 0) throw new Error("Graph invariant failed: unreachable logic");

  const cycles = await executor.run(
    `MATCH (logic:Logic) WHERE EXISTS { MATCH (logic)-[:REQUIRES*1..]->(logic) }
     RETURN count(logic) AS cycleCount`,
  );
  if (Number(cycles.records[0]?.get("cycleCount")) !== 0) throw new Error("Graph invariant failed: cyclic logic");

  const logic = await executor.run(
    `MATCH (logic:Logic)
     OPTIONAL MATCH (logic)-[r:REQUIRES|OPTION]->()
     RETURN elementId(logic) AS logicId, properties(logic) AS properties, count(r) AS childCount`,
  );
  const blocked = new Set<string>();
  for (const row of logic.records) {
    const properties = row.get("properties") as Record<string, unknown>;
    const children = Number(row.get("childCount"));
    const type = properties.type;
    if (type === "AND" || type === "OR" || type === "NOF") {
      if (children < 1) throw new Error(`Graph invariant failed: empty ${type} gate`);
      if (type === "NOF" && (!Number.isSafeInteger(Number(properties.threshold)) || Number(properties.threshold) < 1)) {
        throw new Error("Graph invariant failed: invalid NOF threshold");
      }
    } else if (type === "CONDITION" || type === "CONDITIONAL") {
      if (children !== (type === "CONDITIONAL" ? 1 : 0) || typeof properties.condition !== "string") {
        throw new Error("Graph invariant failed: invalid condition gate");
      }
      const condition = JSON.parse(properties.condition) as Record<string, unknown>;
      const { kind, ...rule } = condition;
      if (kind !== "cohort" && kind !== "programType") throw new Error("Graph invariant failed: invalid condition kind");
      parsePrerequisite({ [kind]: rule, ...(type === "CONDITIONAL" ? { then: "CS0000" } : {}) });
    } else if (type === "BLOCKED") {
      if (children !== 0 || typeof properties.reason !== "string" || !properties.reason) throw new Error("Graph invariant failed: invalid blocked requirement");
      blocked.add(JSON.stringify([properties.ownerModuleCode, properties.originalToken]));
    } else if (type === "CONSTANT") {
      if (children !== 0 || typeof properties.value !== "boolean") throw new Error("Graph invariant failed: invalid constant requirement");
    } else {
      throw new Error(`Graph invariant failed: unknown logic type ${String(type)}`);
    }
  }
  for (const diagnostic of snapshot.diagnostics) {
    if (!blocked.has(JSON.stringify([diagnostic.moduleCode, diagnostic.token.toUpperCase()]))) {
      throw new Error(`Graph invariant failed: missing blocked reference ${diagnostic.moduleCode} -> ${diagnostic.token}`);
    }
  }
}
