// src/db/getMergedPrereqTree.ts
// get prerequisite subgraphs for multiple modules and return a merged tree as RawGraph
// merges prerequisite subgraphs for multiple modules using APOC subgraphAll from Neo4j.

import type { Node as NeoNode, Relationship as NeoRel } from "neo4j-driver";
import type { Record as NeoRecord } from "neo4j-driver";
import { getNeo4jDriver } from "./neo4j";
import { mapGraph } from "@/utils/graph/mapGraph";
import { FormattedGraph } from "@/types/graphTypes";
import { checkImportMetadata } from "./checkImportMetadata";
import { GraphDataError } from "./graphDataError";

/**
 * Merges prerequisite subgraphs for multiple modules in a single Cypher call,
 * eliminates duplicates via DISTINCT, and returns plain JSON arrays.
 */
export async function getMergedTree(
  moduleCodes: string[],
): Promise<FormattedGraph> {
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const publicationId = await checkImportMetadata(session);
    // Single Cypher query to unwind, collect, and dedupe subgraphs
    const result = await session.run(
      `
        UNWIND $moduleCodes AS code
        MATCH (m:Module { moduleCode: code })
        CALL apoc.path.subgraphAll(
          m,
          {
            relationshipFilter: "HAS_PREREQ>|REQUIRES>|OPTION>",
            labelFilter: "Module|Logic"
          }
        ) YIELD nodes, relationships

        WITH collect(nodes) AS groupedNodes, collect(relationships) AS groupedRels
        WITH apoc.coll.toSet(apoc.coll.flatten(groupedNodes)) AS nodes,
            apoc.coll.toSet(apoc.coll.flatten(groupedRels)) AS relationships
        RETURN nodes, relationships
      `,
      { moduleCodes },
    );
    if (await checkImportMetadata(session) !== publicationId) {
      throw new GraphDataError("Prerequisite graph changed during retrieval; retry generation");
    }

    if (!result.records.length || !result.records[0].has("nodes")) {
      return { nodes: {}, relationships: [] };
    }

    const record: NeoRecord = result.records[0];
    const neoNodes = record.get("nodes") as NeoNode[];
    const neoRels = record.get("relationships") as NeoRel[];

    const mapped = mapGraph({ nodes: neoNodes, relationships: neoRels });
    return mapped;
  } finally {
    await session.close();
  }
}
