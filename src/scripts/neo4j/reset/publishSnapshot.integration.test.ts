import neo4j, { type Driver, type Session } from "neo4j-driver";
import { publishSnapshot } from "./publishSnapshot";
import { prepareCatalogue } from "./preflight";
import { loadLocalSnapshot } from "./catalogueSnapshot";
import { mapGraph } from "../../../utils/graph/mapGraph";
import { resolvePrerequisiteConditions } from "../../../utils/graph/resolvePrerequisiteConditions";
import { normaliseNodes } from "../../../utils/graph/normaliseNodes";
import { runScheduler } from "../../../utils/graph/algo/schedule";

const integration = process.env.RUN_NEO4J_RESET_INTEGRATION === "1" ? describe : describe.skip;

integration("atomic publication on an explicitly dedicated disposable Neo4j database", () => {
  let driver: Driver | undefined;
  let session: Session | undefined;
  let database: string;
  let ownsFixture = false;
  const full = [
    { moduleCode: "CS1000", title: "Intro" },
    { moduleCode: "CS2000", title: "Advanced" },
    { moduleCode: "YSC1000", title: "Excluded" },
  ];
  const snapshot = prepareCatalogue(full, full.map((mod) => ({ code: mod.moduleCode, title: mod.title })), {
    CS1000: null,
    CS2000: { and: ["CS1000", "YSC1000", { cohort: { rule: "IF_IN", years: ["S:2024/25"] }, then: "OLD1000" }] },
    YSC1000: null,
  });

  beforeAll(async () => {
    const uri = process.env.NEO4J_RESET_TEST_URI;
    const username = process.env.NEO4J_RESET_TEST_USERNAME;
    const password = process.env.NEO4J_RESET_TEST_PASSWORD;
    database = process.env.NEO4J_RESET_TEST_DATABASE ?? "";
    if (!uri || !username || !password || !/^uniplans-reset-test[-a-z0-9]*$/.test(database)) {
      throw new Error("Explicit NEO4J_RESET_TEST_URI, USERNAME, PASSWORD, and DATABASE (uniplans-reset-test*) are required; no application credentials or default database are used");
    }
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    session = driver.session({ database });
    const existing = await session.run("MATCH (n) RETURN count(n) AS count");
    if (Number(existing.records[0].get("count")) !== 0) throw new Error("Integration fixture refuses a nonempty database");
    ownsFixture = true;
    await session.run("CREATE (:ImportMetadata {name: 'prerequisites', status: 'uninitialized'}), (:ResetTestUnrelated {value: 'keep'})");
  });

  afterAll(async () => {
    try {
      if (ownsFixture && session) await session.run("MATCH (n) DETACH DELETE n");
    } finally {
      await session?.close();
      await driver?.close();
    }
  });

  test("publishes, preserves unrelated data, is idempotent, and rolls back a failing replacement", async () => {
    await publishSnapshot(session!, snapshot);
    await publishSnapshot(session!, snapshot);
    const metadata = await session!.run("MATCH (m:ImportMetadata {name: 'prerequisites'}) RETURN properties(m) AS properties");
    expect(metadata.records).toHaveLength(1);
    expect(metadata.records[0].get("properties")).toMatchObject({ status: "ready", fingerprint: snapshot.fingerprint });
    const readGraph = () => session!.run("MATCH (m:Module) RETURN m.moduleCode AS code ORDER BY code");
    expect((await readGraph()).records.map((record) => record.get("code"))).toEqual(["CS1000", "CS2000"]);
    await expect(publishSnapshot(session!, snapshot, {
      deduplicateLogicNodes: async () => { throw new Error("injected dedup failure"); },
    })).rejects.toThrow("injected dedup failure");
    expect((await readGraph()).records.map((record) => record.get("code"))).toEqual(["CS1000", "CS2000"]);
    const unrelated = await session!.run("MATCH (n:ResetTestUnrelated) RETURN n.value AS value");
    expect(unrelated.records[0].get("value")).toBe("keep");
    const blocked = await session!.run("MATCH (l:Logic {type: 'BLOCKED'}) RETURN l.originalToken AS token ORDER BY token");
    expect(blocked.records.map((record) => record.get("token"))).toEqual(["OLD1000", "YSC1000"]);
  }, 120000);

  test("concurrent publications serialize on metadata and do not leave mixed catalogues", async () => {
    const otherFull = [{ moduleCode: "MA1000", title: "Other catalogue" }];
    const other = prepareCatalogue(otherFull, [{ code: "MA1000", title: "Other catalogue" }], { MA1000: null });
    const second = driver!.session({ database });
    try {
      await Promise.all([publishSnapshot(session!, snapshot), publishSnapshot(second, other)]);
      const metadata = await session!.run("MATCH (m:ImportMetadata {name: 'prerequisites'}) RETURN m.fingerprint AS fingerprint");
      expect(metadata.records).toHaveLength(1);
      const modules = await session!.run("MATCH (m:Module) RETURN m.moduleCode AS code ORDER BY code");
      const fingerprint = metadata.records[0].get("fingerprint");
      expect([snapshot.fingerprint, other.fingerprint]).toContain(fingerprint);
      expect(modules.records.map((record) => record.get("code"))).toEqual(fingerprint === other.fingerprint ? ["MA1000"] : ["CS1000", "CS2000"]);
    } finally {
      await second.close();
    }
  }, 120000);

  const fullSize = process.env.RUN_NEO4J_RESET_FULL_CATALOGUE === "1" ? test : test.skip;
  fullSize("the complete local catalogue fits one transaction without batch commits", async () => {
    const catalogue = await loadLocalSnapshot();
    await publishSnapshot(session!, catalogue);
    const metadata = await session!.run("MATCH (m:ImportMetadata {name: 'prerequisites'}) RETURN m.fingerprint AS fingerprint");
    expect(metadata.records[0].get("fingerprint")).toBe(catalogue.fingerprint);
    for (const targets of [["MA4254"], ["MA4254", "DBA3701"]]) {
      const data = await session!.run(
        `UNWIND $codes AS code
         MATCH (m:Module {moduleCode: code})
         CALL apoc.path.subgraphAll(m, {
           relationshipFilter: 'HAS_PREREQ>|REQUIRES>|OPTION>', labelFilter: 'Module|Logic'
         }) YIELD nodes, relationships
         RETURN apoc.coll.toSet(apoc.coll.flatten(collect(nodes))) AS nodes,
                apoc.coll.toSet(apoc.coll.flatten(collect(relationships))) AS relationships`,
        { codes: targets },
      );
      const graph = mapGraph({ nodes: data.records[0].get("nodes"), relationships: data.records[0].get("relationships") });
      const resolved = resolvePrerequisiteConditions(graph, { cohortYear: 2024, programmeType: "Undergraduate Degree" }, targets);
      const result = runScheduler(normaliseNodes(resolved), targets, [], false, 20);
      expect(result.validation.errors).toEqual([]);
      expect(result.isValid).toBe(true);
      const semesters = result.timetable.semesters;
      expect(semesters.flatMap((semester) => semester.moduleCodes)).toEqual(expect.arrayContaining(targets));
      const dbaSemester = semesters.find((semester) => semester.moduleCodes.includes("DBA3701"));
      if (dbaSemester) {
        expect(semesters.some((semester) => semester.id < dbaSemester.id && semester.moduleCodes.some((code) => code === "DAO2702" || code === "DAO2702X"))).toBe(true);
      }
    }
  }, 600000);
});
