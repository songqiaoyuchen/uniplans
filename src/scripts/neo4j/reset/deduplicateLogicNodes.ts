import type { LogicType } from "../../../types/neo4jTypes";
import type { Neo4jExecutor } from "./buildTree/attachTree";

export async function deduplicateLogicNodes(session: Neo4jExecutor) {
  try {
    const types = ["OR", "AND", "NOF"];
    let globalChanged = true;
    let globalIteration = 1;

    // Keep running until no changes occur across all types
    while (globalChanged) {
      console.log(`🔄 Global deduplication iteration ${globalIteration}`);
      globalChanged = false;

      for (const logicType of types) {
        try {
          const typeChanged = await deduplicateLogicType(
            session,
            logicType as LogicType,
          );
          if (typeChanged) {
            globalChanged = true;
          }
        } catch (err) {
          console.error(`❌ Error during ${logicType} deduplication:`, err);
          // Continue with other types even if one fails
          throw err;
        }
      }

      if (globalChanged) {
        console.log(`🔄 Changes detected, running another global iteration...`);
        globalIteration++;
      } else {
        console.log(`🎉 No more duplicates found across all types!`);
      }
    }

    console.log(
      `🎉 All logic node deduplication completed successfully after ${globalIteration} global iterations.`,
    );
  } catch (err) {
    console.error("❌ Failed to connect to Neo4j:", err);
    throw err;
  }
}

async function deduplicateLogicType(session: Neo4jExecutor, logicType: LogicType) {
  const cypher = buildDeduplicationQuery(logicType);

  let totalMerged = 0;
  let mergedGroups = -1;
  let iteration = 1;
  let typeChanged = false;

  while (mergedGroups !== 0) {
    const result = await session.run(cypher);
    mergedGroups = result.records[0].get("mergedGroups").toNumber();
    totalMerged += mergedGroups;

    if (mergedGroups > 0) {
      typeChanged = true;
      console.log(
        `  ✅ ${logicType} iteration ${iteration}: Merged ${mergedGroups} groups`,
      );
      iteration++;
    }
  }

  if (totalMerged > 0) {
    console.log(
      `  🚀 ${logicType} complete: ${totalMerged} total groups merged`,
    );
  } else {
    console.log(`  ✓ ${logicType}: No duplicates found`);
  }

  return typeChanged;
}

function buildDeduplicationQuery(logicType: LogicType) {
  // Build the initial MATCH and WITH clauses based on logic type
  let matchClause, withClause;

  switch (logicType) {
  case "NOF":
    // For NOF: group by threshold + ALL outgoing relationships
    matchClause = `MATCH (l:Logic {type: "NOF"})
                     OPTIONAL MATCH (l)-[:OPTION]->(opt)
                     OPTIONAL MATCH (l)-[:REQUIRES]->(req)`;
    withClause = `WITH l, l.threshold AS threshold, 
                         apoc.coll.sort(collect(DISTINCT id(opt))) AS optionChildren,
                         apoc.coll.sort(collect(DISTINCT id(req))) AS requiresChildren
                    WITH threshold, optionChildren, requiresChildren, collect(l) AS logicGroup`;
    break;

  case "AND":
    // For AND: group by ALL outgoing relationships
    matchClause = `MATCH (l:Logic {type: "AND"})
                     OPTIONAL MATCH (l)-[:REQUIRES]->(req)
                     OPTIONAL MATCH (l)-[:OPTION]->(opt)`;
    withClause = `WITH l, 
                         apoc.coll.sort(collect(DISTINCT id(req))) AS requiresChildren,
                         apoc.coll.sort(collect(DISTINCT id(opt))) AS optionChildren
                    WITH requiresChildren, optionChildren, collect(l) AS logicGroup`;
    break;

  case "OR":
  default:
    // For OR: group by ALL outgoing relationships
    matchClause = `MATCH (l:Logic {type: "OR"})
                     OPTIONAL MATCH (l)-[:OPTION]->(opt)
                     OPTIONAL MATCH (l)-[:REQUIRES]->(req)`;
    withClause = `WITH l, 
                         apoc.coll.sort(collect(DISTINCT id(opt))) AS optionChildren,
                         apoc.coll.sort(collect(DISTINCT id(req))) AS requiresChildren
                    WITH optionChildren, requiresChildren, collect(l) AS logicGroup`;
    break;
  }

  return `
    ${matchClause}
    ${withClause}
    WHERE size(logicGroup) > 1
    
    CALL {
      WITH logicGroup
      WITH logicGroup[0] AS survivor, logicGroup[1..] AS duplicates
      UNWIND duplicates AS dup
      
      // Match all possible relationships first
      OPTIONAL MATCH (parent1)-[r1:HAS_PREREQ]->(dup)
      OPTIONAL MATCH (parent2)-[r2:REQUIRES]->(dup)
      OPTIONAL MATCH (dup)-[r3:OPTION]->(child1)
      OPTIONAL MATCH (dup)-[r4:REQUIRES]->(child2)
      
      // Rewire incoming HAS_PREREQ relationships
      FOREACH (_ IN CASE WHEN r1 IS NOT NULL THEN [1] ELSE [] END |
        MERGE (parent1)-[:HAS_PREREQ]->(survivor)
        DELETE r1
      )
      
      // Rewire incoming REQUIRES relationships  
      FOREACH (_ IN CASE WHEN r2 IS NOT NULL THEN [1] ELSE [] END |
        MERGE (parent2)-[:REQUIRES]->(survivor)
        DELETE r2
      )
      
      // Rewire outgoing OPTION relationships
      FOREACH (_ IN CASE WHEN r3 IS NOT NULL THEN [1] ELSE [] END |
        MERGE (survivor)-[:OPTION]->(child1)
        DELETE r3
      )
      
      // Rewire outgoing REQUIRES relationships
      FOREACH (_ IN CASE WHEN r4 IS NOT NULL THEN [1] ELSE [] END |
        MERGE (survivor)-[:REQUIRES]->(child2)
        DELETE r4
      )
      
      // Clean up the duplicate node
      DETACH DELETE dup
      RETURN count(*) AS rewired
    }
    
    RETURN count(logicGroup) AS mergedGroups;
  `;
}