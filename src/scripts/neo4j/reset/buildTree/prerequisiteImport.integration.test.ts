import neo4j, { type Driver, type Session } from "neo4j-driver";
import { attachPrereqTree, type Neo4jExecutor } from "./attachTree";
import { cleanupUnreachableLogicNodes, deleteYSCModules } from "../deleteYSCModules";
import { deduplicateLogicNodes } from "../deduplicateLogicNodes";
import { uploadAllPrereqTrees } from "../uploadPrerequisites";

const integration = process.env.UNIPLANS_NEO4J_TEST_ENABLED === "1" ? describe : describe.skip;

integration("prerequisite importer against an explicitly configured empty disposable Neo4j database", () => {
  let driver: Driver | undefined;
  let session: Session | undefined;
  let verifiedEmpty = false;

  beforeAll(async () => {
    const required = (name: string): string => {
      const value = process.env[name];
      if (!value) throw new Error(`Integration tests require explicit ${name}; application DB settings are never used`);
      return value;
    };
    if (required("UNIPLANS_NEO4J_TEST_CONFIRM") !== "EMPTY_DISPOSABLE_DATABASE") {
      throw new Error("Integration tests require confirmation of an empty disposable test database");
    }
    const uri = required("UNIPLANS_NEO4J_TEST_URI");
    const user = required("UNIPLANS_NEO4J_TEST_USER");
    const password = required("UNIPLANS_NEO4J_TEST_PASSWORD");
    const database = required("UNIPLANS_NEO4J_TEST_DATABASE");
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    session = driver.session({ database });
    const result = await session.run("MATCH (n) RETURN count(n) AS count");
    if (Number(result.records[0].get("count")) !== 0) {
      throw new Error("Refusing to run importer integration tests against a nonempty database");
    }
    verifiedEmpty = true;
  }, 30000);

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    try {
      if (verifiedEmpty) await session!.run("MATCH (n) DETACH DELETE n");
    } finally {
      jest.restoreAllMocks();
    }
  });

  afterAll(async () => {
    await session?.close();
    await driver?.close();
  });

  const modules = async (...codes: string[]) => {
    await session!.run("UNWIND $codes AS code CREATE (:Module {moduleCode: code})", { codes });
  };

  const snapshot = async () => {
    const nodes = await session!.run(
      "MATCH (n) RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS properties ORDER BY id",
    );
    const relationships = await session!.run(
      "MATCH (a)-[r]->(b) RETURN elementId(a) AS source, type(r) AS type, elementId(b) AS target ORDER BY source, type, target",
    );
    return {
      nodes: nodes.records.map((record) => record.toObject()),
      relationships: relationships.records.map((record) => record.toObject()),
    };
  };

  const totals = async () => {
    const nodes = await session!.run("MATCH (n) RETURN count(n) AS count");
    const relationships = await session!.run("MATCH ()-[r]->() RETURN count(r) AS count");
    return [Number(nodes.records[0].get("count")), Number(relationships.records[0].get("count"))];
  };

  test("null replacement preserves shared roots and nested logic until the final owner is cleared", async () => {
    await modules("TEST1000", "TEST2000", "TEST3000", "TEST4000");
    await session!.run(`
      MATCH (a:Module {moduleCode: 'TEST1000'}), (b:Module {moduleCode: 'TEST2000'}),
            (c:Module {moduleCode: 'TEST3000'}), (d:Module {moduleCode: 'TEST4000'})
      CREATE (nested:Logic {type: 'OR'}), (root:Logic {type: 'AND'})
      CREATE (a)-[:HAS_PREREQ]->(root), (root)-[:REQUIRES]->(nested),
             (b)-[:HAS_PREREQ]->(nested), (nested)-[:OPTION]->(c), (nested)-[:OPTION]->(d)
    `);
    await attachPrereqTree("TEST1000", null, session!);
    const remaining = await session!.run(`
      MATCH (:Module {moduleCode: 'TEST2000'})-[:HAS_PREREQ]->(l:Logic)-[:OPTION]->(m:Module)
      RETURN l.type AS type, collect(m.moduleCode) AS codes
    `);
    expect(remaining.records).toHaveLength(1);
    expect(remaining.records[0].get("type")).toBe("OR");
    expect(remaining.records[0].get("codes").sort()).toEqual(["TEST3000", "TEST4000"]);
    expect(await totals()).toEqual([5, 3]);
    await attachPrereqTree("TEST2000", null, session!);
    expect(await totals()).toEqual([4, 0]);
  });

  test("attached empty NOF/BLOCKED gates survive cleanup while unreachable logic is removed", async () => {
    await modules("CN3109", "BN4406");
    await session!.run(`
      MATCH (a:Module {moduleCode: 'CN3109'}), (b:Module {moduleCode: 'BN4406'})
      CREATE (n:Logic {type: 'NOF', threshold: 2}),
             (blocked:Logic {type: 'BLOCKED', reason: 'Unavailable prerequisite BN2403', moduleCode: 'BN2403'}),
             (garbage:Logic {type: 'OR'}), (orphan:Logic {type: 'NOF', threshold: 1})
      CREATE (a)-[:HAS_PREREQ]->(n), (b)-[:HAS_PREREQ]->(blocked), (garbage)-[:REQUIRES]->(orphan)
    `);
    await cleanupUnreachableLogicNodes(session!);
    expect(await totals()).toEqual([4, 2]);
    const result = await session!.run("MATCH (l:Logic) RETURN l.type AS type ORDER BY type");
    expect(result.records.map((record) => record.get("type"))).toEqual(["BLOCKED", "NOF"]);
  });

  test("a real session transaction rolls back root replacement and cleanup on failure", async () => {
    await modules("TEST1000", "TEST2000", "TEST3000");
    await attachPrereqTree("TEST1000", { or: ["TEST2000"] }, session!);
    const before = await snapshot();
    const failingSession = {
      run: session!.run.bind(session),
      executeWrite: (work: (executor: Neo4jExecutor) => Promise<void>) => session!.executeWrite(async (transaction) => {
        const executor: Neo4jExecutor = {
          run: (query, parameters) => {
            if (typeof query === "string" && query.includes("WHERE NOT EXISTS")) {
              throw new Error("Injected cleanup failure after root replacement");
            }
            return transaction.run(query, parameters);
          },
        };
        await work(executor);
      }),
    };
    await expect(attachPrereqTree("TEST1000", { and: ["TEST3000"] }, failingSession))
      .rejects.toThrow("Injected cleanup failure");
    expect(await snapshot()).toEqual(before);
  });

  test("parse failure occurs before any mutation and explicit null clears an old root", async () => {
    await modules("TEST1000", "TEST2000");
    await attachPrereqTree("TEST1000", { or: ["TEST2000"] }, session!);
    const before = await snapshot();
    await expect(attachPrereqTree("TEST1000", { invalid: true }, session!)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
    await attachPrereqTree("TEST1000", null, session!);
    expect(await totals()).toEqual([2, 0]);
  });

  test("deduplication rewires multi-parent shared subtrees and repeated import/dedup is idempotent", async () => {
    await modules("TEST1000", "TEST2000", "TEST3000", "TEST4000", "TEST5000");
    const source = {
      TEST1000: { and: [{ or: ["TEST3000", "TEST4000"] }, "TEST5000"] },
      TEST2000: { and: [{ or: ["TEST3000", "TEST4000"] }, "TEST5000"] },
    };
    const rebuild = async () => {
      await session!.executeWrite(async (transaction) => {
        await uploadAllPrereqTrees(transaction, source);
        await deduplicateLogicNodes(transaction);
        await cleanupUnreachableLogicNodes(transaction);
      });
    };
    await rebuild();
    const initialTotals = await totals();
    expect(initialTotals).toEqual([7, 6]);
    const paths = await session!.run(`
      MATCH (m:Module)-[:HAS_PREREQ]->(root:Logic)-[:REQUIRES]->(choice:Logic)-[:OPTION]->(leaf:Module)
      RETURN m.moduleCode AS owner, elementId(root) AS root, collect(leaf.moduleCode) AS leaves ORDER BY owner
    `);
    expect(paths.records).toHaveLength(2);
    expect(paths.records[0].get("root")).toBe(paths.records[1].get("root"));
    for (const row of paths.records) expect(row.get("leaves").sort()).toEqual(["TEST3000", "TEST4000"]);
    await rebuild();
    expect(await totals()).toEqual(initialTotals);
    const before = await snapshot();
    await session!.executeWrite((transaction) => deduplicateLogicNodes(transaction));
    expect(await snapshot()).toEqual(before);
  }, 30000);

  test("deduplication does not merge conditions, constants or blocked diagnostics", async () => {
    await modules("TEST1000", "TEST2000");
    await uploadAllPrereqTrees(session!, {
      TEST1000: { and: [{ cohort: { rule: "MUST_BE_IN", years: ["S:2017"] } }, "MISSING1000"] },
      TEST2000: { and: [{ cohort: { rule: "MUST_BE_IN", years: ["S:2024/25"] } }, "MISSING2000"] },
    });
    await session!.run("CREATE (:Logic {type: 'CONSTANT', value: true}), (:Logic {type: 'CONSTANT', value: false})");
    const before = await snapshot();
    await session!.executeWrite((transaction) => deduplicateLogicNodes(transaction));
    expect(await snapshot()).toEqual(before);
  });

  test("YSC exclusion is rejected after construction without deleting referenced courses", async () => {
    await modules("TEST1000", "YSC1000");
    await attachPrereqTree("TEST1000", "YSC1000", session!);
    const before = await snapshot();
    await expect(deleteYSCModules(session!)).rejects.toThrow("before prerequisite construction");
    expect(await snapshot()).toEqual(before);
  });
});
