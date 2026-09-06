import { int, Integer, Session } from "neo4j-driver";
import modulePrereqInfo from "@/data/modulePrereqInfo.json";
import { FormattedGraph, LogicNode } from "@/types/graphTypes";
import { Prerequisite, PrereqTree } from "@/types/neo4jTypes";
import { SemesterLabel } from "@/types/plannerTypes";
import { normaliseNodes } from "@/utils/graph/normaliseNodes";
import { runScheduler } from "@/utils/graph/algo/schedule";
import { resolvePrerequisiteConditions } from "@/utils/graph/resolvePrerequisiteConditions";
import { attachPrereqTree, processParsedTree, processTree, type Neo4jExecutor } from "./attachTree";
import { resolveModuleCodes } from "./resolveModuleCodes";
import { cleanupUnreachableLogicNodes, deleteYSCModules } from "../deleteYSCModules";
import { uploadAllPrereqTrees } from "../uploadPrerequisites";
import { deduplicateLogicNodes } from "../deduplicateLogicNodes";

const prerequisites = modulePrereqInfo as unknown as Prerequisite;

function mockGraphSession(moduleCodes: string[]) {
  const graph: FormattedGraph = { nodes: {}, relationships: [] };
  for (const [index, code] of moduleCodes.entries()) {
    const id = String(index + 1);
    graph.nodes[id] = {
      id,
      code,
      title: code,
      credits: 4,
      semestersOffered: [SemesterLabel.First, SemesterLabel.Second],
      exam: null,
      preclusions: [],
    };
  }

  const records = (rows: Record<string, unknown>[]) => ({
    records: rows.map((row) => ({ get: (key: string) => row[key] })),
  });
  let nextId = moduleCodes.length + 1;
  let failure: ((query: string) => boolean) | undefined;
  const run = jest.fn(async (query: string, params: Record<string, string | number | boolean | Integer | null> = {}) => {
    if (failure?.(query)) throw new Error("Injected query failure");
    if (query.includes("AS rootCount")) {
      const owner = Object.values(graph.nodes).find((node) => "code" in node && node.code === params.moduleCode);
      return records(owner ? [{ moduleId: int(owner.id), rootCount: int(graph.relationships.filter((edge) => edge.from === owner.id).length) }] : []);
    }
    if (query.includes("AS attachedCount")) {
      return records([{ attachedCount: int(graph.relationships.length) }]);
    }
    if (query.includes("WHERE NOT EXISTS")) {
      const reachable = new Set<string>();
      const visit = (id: string) => {
        if (reachable.has(id)) return;
        reachable.add(id);
        graph.relationships.filter((edge) => edge.from === id).forEach((edge) => visit(edge.to));
      };
      Object.values(graph.nodes).filter((node) => "code" in node).forEach((node) => visit(node.id));
      for (const node of Object.values(graph.nodes)) {
        if (!("code" in node) && !reachable.has(node.id)) delete graph.nodes[node.id];
      }
      graph.relationships = graph.relationships.filter((edge) => graph.nodes[edge.from] && graph.nodes[edge.to]);
      return records([]);
    }
    if (query.includes("STARTS WITH 'YSC'")) {
      for (const node of Object.values(graph.nodes)) {
        if ("code" in node && node.code.startsWith("YSC")) delete graph.nodes[node.id];
      }
      return records([]);
    }
    if (query.includes("RETURN id(m) AS id")) {
      const matches = Object.values(graph.nodes).filter((node) =>
        "code" in node && (query.includes("STARTS WITH")
          ? node.code.startsWith(String(params.rawCode))
          : node.code === params.moduleCode),
      );
      return records(matches.map((node) => ({ id: int(node.id) })));
    }
    if (query.includes("CREATE (l:Logic")) {
      const id = String(nextId++);
      const type = params.type ?? query.match(/type: "([A-Z]+)"/)?.[1];
      graph.nodes[id] = {
        id, type,
        ...(type === "NOF" ? { n: Number(params.threshold) } : {}),
        ...(params.condition ? { condition: JSON.parse(String(params.condition)) } : {}),
        ...(type === "CONSTANT" ? { value: params.value } : {}),
        ...(type === "BLOCKED" ? { reason: params.reason, moduleCode: params.moduleCode, originalToken: params.originalToken, ownerModuleCode: params.ownerModuleCode } : {}),
      } as LogicNode;
      return records([{ logicId: int(id) }]);
    }
    if (query.includes("RETURN labels(n) AS labels")) {
      const node = graph.nodes[String(params.id)];
      return records(node ? [{ labels: ["code" in node ? "Module" : "Logic"] }] : []);
    }
    if (query.includes("MERGE")) {
      const from = params.lid?.toString() ?? Object.values(graph.nodes)
        .find((node) => "code" in node && node.code === params.moduleCode)?.id;
      const to = (params.tid ?? params.mid ?? params.cid ?? params.id)?.toString();
      if (!from || !to || !graph.nodes[from] || !graph.nodes[to]) {
        throw new Error(`Invalid relationship: ${from} -> ${to}`);
      }
      if (query.includes("previousRoots") && params.clearExisting) {
        graph.relationships = graph.relationships.filter((edge) => edge.from !== from);
      }
      if (!graph.relationships.some((edge) => edge.from === from && edge.to === to)) {
        graph.relationships.push({ id: String(graph.relationships.length), from, to });
      }
      return records(query.includes("AS rootId") ? [{ rootId: int(to) }] : []);
    }
    if (query.includes("DELETE r")) {
      const owner = Object.values(graph.nodes).find((node) => "code" in node && node.code === params.moduleCode);
      graph.relationships = graph.relationships.filter((edge) => edge.from !== owner?.id);
      return records([]);
    }
    throw new Error(`Unexpected query: ${query}`);
  });

  function moduleLeaves(id: Integer | string | null): string[] {
    if (id === null) return [];
    const node = graph.nodes[id.toString()];
    if ("code" in node) return [node.code];
    return graph.relationships
      .filter((edge) => edge.from === node.id)
      .flatMap((edge) => moduleLeaves(edge.to));
  }

  const transaction = { run } as unknown as Neo4jExecutor;
  const executeWrite = jest.fn(async (work: (executor: Neo4jExecutor) => Promise<unknown>) => {
    const before: FormattedGraph = JSON.parse(JSON.stringify(graph));
    try {
      return await work(transaction);
    } catch (error) {
      graph.nodes = before.nodes;
      graph.relationships = before.relationships;
      throw error;
    }
  });
  return {
    graph, run, transaction, executeWrite,
    session: { run, executeWrite } as unknown as Session,
    moduleLeaves,
    failOn: (predicate: (query: string) => boolean) => { failure = predicate; },
  };
}

describe("prerequisite graph import", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ["DAO2702%:D", ["DAO2702", "DAO2702X"]],
    ["DAO2702:D", ["DAO2702"]],
    ["dao2702%:D", ["DAO2702", "DAO2702X"]],
  ])("resolves %s to concrete module codes", async (token, expected) => {
    const db = mockGraphSession(["DAO2702", "DAO2702X", "DAO2703"]);
    const ids = await resolveModuleCodes(token, db.session);
    expect(ids.flatMap((id) => db.moduleLeaves(id))).toEqual(expected);
  });

  test("attaches DBA3701's wildcard prerequisite despite its cohort condition", async () => {
    const db = mockGraphSession(["DBA3701", "DAO2702", "DAO2702X"]);
    await attachPrereqTree("DBA3701", prerequisites.DBA3701!, db.session);

    const root = db.graph.relationships.find((edge) => edge.from === "1");
    expect(root).toBeDefined();
    expect(db.moduleLeaves(root!.to)).toEqual(["DAO2702", "DAO2702X"]);
    expect(db.graph.nodes[root!.to]).toMatchObject({ type: "AND" });
    const choice = db.graph.relationships.find((edge) => edge.from === root!.to);
    expect(db.graph.nodes[choice!.to]).toMatchObject({ type: "OR" });
  });

  test.each<PrereqTree>([
    prerequisites.DAO1704X!,
    prerequisites.DAO1704!,
    { and: [prerequisites.DAO1704!] },
    { nOf: [1, [prerequisites.DAO1704!]] },
  ])("preserves cohort-only predicates inside their original operators: %j", async (tree) => {
    const db = mockGraphSession([]);
    const root = await processTree(tree, db.session);
    expect(root).not.toBeNull();
    expect(db.moduleLeaves(root)).toEqual([]);
    expect(Object.values(db.graph.nodes)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "CONDITION", condition: expect.objectContaining({ kind: "cohort", rule: "MUST_BE_IN" }) }),
    ]));
    expect(db.run.mock.calls.filter(([query]) => query.includes("condition: $condition")))
      .not.toHaveLength(0);
  });

  test("retains module requirements beside nested cohort-only logic", async () => {
    const db = mockGraphSession(["DAO2702"]);
    const root = await processTree({
      and: ["DAO2702:D", prerequisites.DAO1704!],
    }, db.session);
    expect(db.moduleLeaves(root)).toEqual(["DAO2702"]);
    expect(db.graph.relationships.filter((edge) => edge.from === root!.toString())).toHaveLength(2);
    expect(Object.values(db.graph.nodes).filter((node) => "type" in node && node.type === "CONDITION")).toHaveLength(2);
  });

  test("preserves N-of thresholds and flattened wildcard options beside cohort conditions", async () => {
    const db = mockGraphSession(["DAO2702", "DAO2702X", "DAO2703"]);
    const root = await processTree({
      nOf: [2, ["DAO2702%:D", "DAO2703:D", prerequisites.DAO1704X!]],
    }, db.session);
    expect(db.graph.nodes[root!.toString()]).toMatchObject({ type: "NOF", n: 2 });
    expect(db.moduleLeaves(root)).toEqual(["DAO2702", "DAO2702X", "DAO2703"]);
  });

  test.each<PrereqTree>([
    { or: ["MISSING1000:D"] },
    { nOf: [1, ["MISSING1000%:D"]] },
  ])("does not mistake unresolved module requirements for cohort-only logic: %j", async (tree) => {
    const db = mockGraphSession([]);
    const root = await processTree(tree, db.session);
    expect(root).not.toBeNull();
    expect(db.graph.nodes[root!.toString()]).toHaveProperty("type");
  });

  test("still rejects unknown prerequisite nodes", async () => {
    const db = mockGraphSession([]);
    await expect(processTree({ unexpected: true } as unknown as PrereqTree, db.session))
      .rejects.toThrow("supported prerequisite operator");
    expect(db.run).not.toHaveBeenCalled();
  });

  test.each([
    ["AR3328", "AR2328A", "cohort"],
    ["ADS5201", "ADS5101", "programType"],
  ])("preserves %s's conditional then subtree", async (owner, required, kind) => {
    const db = mockGraphSession([owner, required]);
    await attachPrereqTree(owner, prerequisites[owner], db.session);
    const root = db.graph.relationships.find((edge) => edge.from === "1")!.to;
    expect(db.graph.nodes[root]).toMatchObject({ type: "CONDITIONAL", condition: { kind, rule: "IF_IN" } });
    expect(db.moduleLeaves(root)).toEqual([required]);
    const metadata = db.run.mock.calls.find(([, params]) => params?.type === "CONDITIONAL")![1]!.condition;
    expect(typeof metadata).toBe("string");
    expect(JSON.parse(String(metadata))).toMatchObject({ kind, rule: "IF_IN" });
  });

  test.each([
    [2024, false],
    [2023, true],
    [null, false],
  ])("AR3328's unavailable consequent is applicable only to its cohort (cohort %s)", async (cohortYear, valid) => {
    const db = mockGraphSession(["AR3328"]);
    await attachPrereqTree("AR3328", prerequisites.AR3328, db.session);
    const resolved = resolvePrerequisiteConditions(db.graph, { cohortYear, programmeType: "Undergraduate Degree" }, ["AR3328"]);
    const result = runScheduler(normaliseNodes(resolved), ["AR3328"], [], false, 20, {});
    expect(result.isValid).toBe(valid);
  });

  test.each([
    ["CPE (Certificate)", false],
    ["Undergraduate Degree", true],
    [null, false],
  ])("ADS5201 retains programme applicability and unknown-context blocking (%s)", async (programmeType, valid) => {
    const db = mockGraphSession(["ADS5201"]);
    await attachPrereqTree("ADS5201", prerequisites.ADS5201, db.session);
    const resolved = resolvePrerequisiteConditions(db.graph, { cohortYear: 2024, programmeType }, ["ADS5201"]);
    const result = runScheduler(normaliseNodes(resolved), ["ADS5201"], [], false, 20, {});
    expect(result.isValid).toBe(valid);
  });

  test("retains nested programme and cohort then constraints", async () => {
    const db = mockGraphSession(["AR2328A"]);
    const root = await processTree({
      programType: { rule: "IF_IN", types: ["CPE (Certificate)"] },
      then: prerequisites.AR3328,
    }, db.session);
    expect(db.moduleLeaves(root)).toEqual(["AR2328A"]);
    expect(Object.values(db.graph.nodes).filter((node) => "type" in node && node.type === "CONDITIONAL")).toHaveLength(2);
  });

  test("keeps an unavailable conditional consequent blocked rather than unconditional or absent", async () => {
    const db = mockGraphSession(["AR3328"]);
    await attachPrereqTree("AR3328", prerequisites.AR3328, db.session);
    const conditional = db.graph.relationships.find((edge) => edge.from === "1")!.to;
    const consequent = db.graph.relationships.find((edge) => edge.from === conditional)!.to;
    expect(db.graph.nodes[conditional]).toMatchObject({ type: "CONDITIONAL" });
    expect(db.graph.nodes[consequent]).toMatchObject({ type: "BLOCKED", moduleCode: "AR2328A" });
  });

  test("represents BN4406's absent direct prerequisite as a diagnostic blocked gate", async () => {
    const db = mockGraphSession(["BN4406"]);
    await attachPrereqTree("BN4406", prerequisites.BN4406, db.session);
    const root = db.graph.relationships.find((edge) => edge.from === "1")!.to;
    expect(db.graph.nodes[root]).toMatchObject({
      type: "BLOCKED", moduleCode: "BN2403", originalToken: "BN2403:D", ownerModuleCode: "BN4406",
      reason: expect.stringContaining("BN2403:D"),
    });
    expect(db.moduleLeaves(root)).toEqual([]);
  });

  test.each([
    ["partial", ["DAO2702:D", "MISSING1000:D"], 1],
    ["entirely unavailable", ["MISSING1000:D", "MISSING2000:D"], 2],
  ])("retains every conjunct in an %s AND", async (_name, children, blockedCount) => {
    const db = mockGraphSession(["DAO2702"]);
    const root = await processTree({ and: children }, db.session);
    expect(db.graph.relationships.filter((edge) => edge.from === root!.toString())).toHaveLength(2);
    expect(Object.values(db.graph.nodes).filter((node) => "type" in node && node.type === "BLOCKED")).toHaveLength(Number(blockedCount));
  });

  test("retains a usable OR alternative alongside an unavailable blocked path", async () => {
    const db = mockGraphSession(["DAO2702"]);
    const root = await processTree({ or: ["MISSING1000:D", "DAO2702:D"] }, db.session);
    expect(db.moduleLeaves(root)).toEqual(["DAO2702"]);
    expect(db.graph.relationships.filter((edge) => edge.from === root!.toString())).toHaveLength(2);
    expect(Object.values(db.graph.nodes)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "BLOCKED" })]));
  });

  test("does not lower an underpopulated NOF threshold or lose unavailable options", async () => {
    const db = mockGraphSession(["DAO2702"]);
    const root = await processTree({ nOf: [3, ["DAO2702:D", "MISSING1000:D", "MISSING2000%:D"]] }, db.session);
    expect(db.graph.nodes[root!.toString()]).toMatchObject({ type: "NOF", n: 3 });
    expect(db.graph.relationships.filter((edge) => edge.from === root!.toString())).toHaveLength(3);
    expect(Object.values(db.graph.nodes).filter((node) => "type" in node && node.type === "BLOCKED")).toHaveLength(2);
  });

  test("flattens overlapping NOF wildcards into a distinct concrete course pool", async () => {
    const db = mockGraphSession(["DAO2702", "DAO2702X", "DAO2703"]);
    const root = await processTree({ nOf: [4, ["DAO270%", "DAO2702%", "DAO2702:D"]] }, db.session);
    expect(db.graph.nodes[root!.toString()]).toMatchObject({ type: "NOF", n: 4 });
    expect(db.moduleLeaves(root)).toEqual(["DAO2702", "DAO2702X", "DAO2703"]);
    expect(db.graph.relationships).toHaveLength(3);
  });

  test.each([true, false])("persists explicit constant %s without inventing an empty Boolean gate", async (value) => {
    const db = mockGraphSession([]);
    const root = await processParsedTree({ type: "constant", value }, db.transaction);
    expect(db.graph.nodes[root.toString()]).toMatchObject({ type: "CONSTANT", value });
  });

  test("persists a canonical blocked requirement's reason and module token", async () => {
    const db = mockGraphSession([]);
    const root = await processParsedTree({ type: "blocked", reason: "Unavailable source requirement", moduleCode: "BN2403" }, db.transaction);
    expect(db.graph.nodes[root.toString()]).toMatchObject({ type: "BLOCKED", reason: "Unavailable source requirement", moduleCode: "BN2403" });
  });

  test.each([undefined, { and: [] }, { or: [] }, { nOf: [1, []] }, { and: ["DAO2702", { unexpected: true }] }])(
    "validates the complete tree before writes and keeps existing requirements for %j", async (tree) => {
      const db = mockGraphSession(["DBA3701", "DAO2702"]);
      await attachPrereqTree("DBA3701", "DAO2702", db.session);
      const before = JSON.parse(JSON.stringify(db.graph));
      db.run.mockClear();
      db.executeWrite.mockClear();
      await expect(attachPrereqTree("DBA3701", tree, db.session)).rejects.toThrow("DBA3701");
      expect(db.graph).toEqual(before);
      expect(db.run).not.toHaveBeenCalled();
      expect(db.executeWrite).not.toHaveBeenCalled();
    },
  );

  test.each(["CREATE (l:Logic", "RETURN id(t) AS rootId", "WHERE NOT EXISTS"])(
    "propagates %s failure through session transaction rollback", async (failureQuery) => {
      const db = mockGraphSession(["DBA3701", "DAO2702"]);
      await attachPrereqTree("DBA3701", { or: ["DAO2702"] }, db.session);
      const before = JSON.parse(JSON.stringify(db.graph));
      db.failOn((query) => query.includes(failureQuery));
      await expect(attachPrereqTree("DBA3701", { and: ["DAO2702"] }, db.session)).rejects.toThrow("Injected query failure");
      expect(db.graph).toEqual(before);
    },
  );

  test("rejects a missing owner instead of creating unattached logic", async () => {
    const db = mockGraphSession(["DAO2702"]);
    await expect(attachPrereqTree("DBA3701", { and: ["DAO2702"] }, db.session)).rejects.toThrow("owner Module");
    expect(Object.values(db.graph.nodes)).toHaveLength(1);
  });

  test("null replacement removes a stale root and only its unreachable logic", async () => {
    const db = mockGraphSession(["DBA3701", "DAO2702"]);
    await attachPrereqTree("DBA3701", { or: ["DAO2702"] }, db.session);
    await attachPrereqTree("DBA3701", null, db.session);
    expect(db.graph.relationships).toEqual([]);
    expect(Object.values(db.graph.nodes)).toHaveLength(2);
  });

  test("repeated replacement keeps one root and a bounded set of reachable logic", async () => {
    const db = mockGraphSession(["DBA3701", "DAO2702"]);
    const tree = { and: [{ or: ["DAO2702"] }, prerequisites.DAO1704X] };
    for (let i = 0; i < 3; i++) await attachPrereqTree("DBA3701", tree, db.session);
    expect(db.graph.relationships.filter((edge) => edge.from === "1")).toHaveLength(1);
    expect(Object.values(db.graph.nodes)).toHaveLength(5);
    expect(db.graph.relationships).toHaveLength(4);
  });

  test("a run-only transaction is reused without nesting session transactions", async () => {
    const db = mockGraphSession(["DBA3701", "DAO2702"]);
    await attachPrereqTree("DBA3701", "DAO2702", db.transaction);
    expect(db.executeWrite).not.toHaveBeenCalled();
  });

  test("cleanup preserves attached CN3109 NOF and blocked leaves with no outgoing edges", async () => {
    const db = mockGraphSession(["CN3109"]);
    await attachPrereqTree("CN3109", prerequisites.CN3109, db.session);
    const before = JSON.parse(JSON.stringify(db.graph));
    await cleanupUnreachableLogicNodes(db.transaction);
    expect(db.graph).toEqual(before);
    expect(Object.values(db.graph.nodes)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "NOF", n: 2 }),
      expect.objectContaining({ type: "BLOCKED", moduleCode: "CN3121" }),
      expect.objectContaining({ type: "BLOCKED", moduleCode: "CN3132" }),
    ]));
  });

  test.each([
    ["missing direct", "MISSING1000:D", false],
    ["partial AND", { and: ["DAO2702", "MISSING1000"] }, false],
    ["unavailable AND", { and: ["MISSING1000", "MISSING2000"] }, false],
    ["underpopulated NOF", { nOf: [2, ["DAO2702", "MISSING1000%"]] }, false],
    ["available OR", { or: ["DAO2702", "MISSING1000"] }, true],
    ["unavailable OR", { or: ["MISSING1000", "MISSING2000"] }, false],
  ])("imported %s constraint has the correct scheduling outcome", async (_name, tree, valid) => {
    const db = mockGraphSession(["DBA3701", "DAO2702"]);
    await attachPrereqTree("DBA3701", tree, db.session);
    const resolved = resolvePrerequisiteConditions(db.graph, { cohortYear: 2024, programmeType: "Undergraduate Degree" }, ["DBA3701"]);
    const result = runScheduler(normaliseNodes(resolved), ["DBA3701"], [], false, 20, {});
    expect(result.isValid).toBe(valid);
    const scheduled = result.timetable.semesters.flatMap((semester) => semester.moduleCodes);
    if (valid) expect(scheduled).toContain("DBA3701");
    else expect(scheduled).not.toContain("DBA3701");
  });

  test("the MA4254 chain remains unschedulable when all foundation courses are unavailable", async () => {
    const codes = ["MA4254", "DBA3701", "DAO2702", "DAO2702X"];
    const db = mockGraphSession(codes);
    for (const code of codes) await attachPrereqTree(code, prerequisites[code], db.session);
    const resolved = resolvePrerequisiteConditions(db.graph, { cohortYear: 2024, programmeType: "Undergraduate Degree" }, ["MA4254"]);
    const result = runScheduler(normaliseNodes(resolved), ["MA4254"], [], false, 20, {});
    expect(result.isValid).toBe(false);
    expect(result.timetable.semesters.flatMap((semester) => semester.moduleCodes)).not.toContain("MA4254");
  });

  test("YSC exclusion runs before construction and references become blocked", async () => {
    const db = mockGraphSession(["CS1000", "YSC1000"]);
    await deleteYSCModules(db.session);
    await attachPrereqTree("CS1000", "YSC1000", db.session);
    expect(Object.values(db.graph.nodes)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "BLOCKED", moduleCode: "YSC1000" })]));
    await expect(deleteYSCModules(db.session)).rejects.toThrow("before prerequisite construction");
  });

  test("prepared upload explicitly clears null entries and skips excluded owners", async () => {
    const db = mockGraphSession(["DBA3701", "DAO2702"]);
    await attachPrereqTree("DBA3701", "DAO2702", db.session);
    db.executeWrite.mockClear();
    await uploadAllPrereqTrees(db.session, { DBA3701: null, DAO2702: null, YSC1000: { malformed: true } }, new Set(["DBA3701", "DAO2702"]));
    expect(db.graph.relationships).toEqual([]);
    expect(db.executeWrite).toHaveBeenCalledTimes(1);
  });

  test.each([
    [{ DBA3701: undefined }, "DBA3701"],
    [{ DAO2702: null }, "Missing prerequisite source entry for DBA3701"],
  ])("prepared upload rejects missing or failed source entries: %j", async (source, error) => {
    const db = mockGraphSession(["DBA3701"]);
    await expect(uploadAllPrereqTrees(db.session, source, new Set(["DBA3701"]))).rejects.toThrow(String(error));
    expect(db.run).not.toHaveBeenCalled();
  });

  test("an explicit invalid prepared map is not replaced by the local-file fallback", async () => {
    const db = mockGraphSession([]);
    await expect(uploadAllPrereqTrees(db.session, null as unknown as Record<string, unknown>)).rejects.toThrow("module-code map");
    expect(db.run).not.toHaveBeenCalled();
  });

  test("a prepared upload fails atomically instead of continuing after write errors", async () => {
    const db = mockGraphSession(["DBA3701", "DAO2702"]);
    const before = JSON.parse(JSON.stringify(db.graph));
    db.failOn((query) => query.includes('type: "BLOCKED"'));
    await expect(uploadAllPrereqTrees(db.session, { DBA3701: "DAO2702", DAO2702: "MISSING1000" })).rejects.toThrow("Injected query failure");
    expect(db.graph).toEqual(before);
  });

  test("deduplication errors propagate immediately", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const run = jest.fn().mockRejectedValue(new Error("dedup failed"));
    await expect(deduplicateLogicNodes({ run } as unknown as Neo4jExecutor)).rejects.toThrow("dedup failed");
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("deduplication limits merging to established AND/OR/NOF semantics", async () => {
    const run = jest.fn().mockResolvedValue({ records: [{ get: () => int(0) }] });
    await deduplicateLogicNodes({ run } as unknown as Neo4jExecutor);
    expect(run).toHaveBeenCalledTimes(3);
    expect(run.mock.calls.map(([query]) => query.match(/MATCH \(l:Logic \{type: "([A-Z]+)"\}/)?.[1])).toEqual(["OR", "AND", "NOF"]);
  });

  test.each(["DAO2702", "DAO2702X"])(
    "schedules MA4254 through %s and DBA3701 only after their prerequisites",
    async (variant) => {
      const codes = ["MA4254", "MA3252", "DBA3701", "DAO2702", "DAO2702X", "DAO1704", "DAO1704X", "RE1702"];
      const db = mockGraphSession(codes);
      for (const node of Object.values(db.graph.nodes)) {
        if ("code" in node && ["MA3252", "RE1702", variant === "DAO2702" ? "DAO2702X" : "DAO2702"].includes(node.code)) {
          node.semestersOffered = [];
        }
      }
      for (const code of codes.filter((code) => code !== "MA3252")) {
        if (prerequisites[code]) {
          await attachPrereqTree(code, prerequisites[code]!, db.session);
        }
      }

      const resolved = resolvePrerequisiteConditions(db.graph, { cohortYear: 2024, programmeType: "Undergraduate Degree" }, ["MA4254"]);
      const result = runScheduler(normaliseNodes(resolved), ["MA4254"], [], false, 20, {});
      const semesters = result.timetable.semesters;
      const semesterOf = (code: string) => semesters.find((semester) => semester.moduleCodes.includes(code))!.id;
      const scheduled = semesters.flatMap((semester) => semester.moduleCodes);

      expect(result.isValid).toBe(true);
      expect(scheduled).toEqual(expect.arrayContaining(["MA4254", "DBA3701", variant]));
      const foundation = scheduled.find((code) => code.startsWith("DAO1704"));
      expect(foundation).toBeDefined();
      expect(semesterOf(foundation!)).toBeLessThan(semesterOf(variant));
      expect(semesterOf(variant)).toBeLessThan(semesterOf("DBA3701"));
      expect(semesterOf("DBA3701")).toBeLessThan(semesterOf("MA4254"));
    },
  );
});
