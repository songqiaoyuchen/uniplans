import type { Session } from "neo4j-driver";
import { publishSnapshot, acquirePublicationLock, type PublicationSteps } from "./publishSnapshot";
import { prepareCatalogue } from "./preflight";
import { uploadModules } from "./uploadModules";
import { deleteGraph } from "./deleteGraph";
import type { Neo4jExecutor } from "./buildTree/attachTree";

const full = [{ moduleCode: "CS1000", title: "Intro" }, { moduleCode: "YSC1000", title: "Excluded" }];
const snapshot = prepareCatalogue(full, full.map((mod) => ({ code: mod.moduleCode, title: mod.title })), { CS1000: "OLD1000", YSC1000: null });
const result = (values: Record<string, unknown>) => ({ records: [{ get: (key: string) => values[key] }] });

function fixture(failure?: string) {
  const database = { codes: ["OLD1000"], fingerprint: "old-fingerprint", unrelated: "preserved" };
  const pending = { ...database, codes: [...database.codes] };
  const order: string[] = [];
  const run = jest.fn(async (query: string, parameters: Record<string, unknown> = {}) => {
    if (query.includes("_prerequisitePublicationLock")) return result({ anchorId: "metadata-anchor" });
    if (query.includes("RETURN count(metadata)") && !query.includes("MERGE")) return result({ metadataCount: 1 });
    if (query.includes("DETACH DELETE n")) {
      order.push("delete");
      pending.codes = [];
      return result({});
    }
    if (query.includes("UNWIND $rows")) {
      order.push("upload");
      if (failure === "write") throw new Error("write failure");
      const rows = parameters.rows as { moduleCode: string }[];
      pending.codes.push(...rows.map((row) => row.moduleCode));
      return result({ uploadedCount: rows.length });
    }
    if (query.includes("MERGE (metadata")) {
      order.push("metadata");
      if (failure === "metadata") throw new Error("metadata failure");
      pending.fingerprint = String(parameters.fingerprint);
      return result({ metadataCount: 1 });
    }
    throw new Error(`Unexpected query ${query}`);
  });
  const transaction = {
    run,
    commit: jest.fn(async () => {
      order.push("commit");
      if (failure === "commit") throw new Error("commit failure");
      Object.assign(database, pending);
    }),
    rollback: jest.fn(async () => { order.push("rollback"); }),
  };
  const session = { beginTransaction: jest.fn(() => transaction as unknown as ReturnType<Session["beginTransaction"]>) };
  const stage = (name: string) => jest.fn(async (executor: Neo4jExecutor) => {
    expect(executor).toBe(transaction);
    order.push(name);
    if (failure === name) throw new Error(`${name} failure`);
  });
  const overrides: Partial<PublicationSteps> = {
    deleteYSCModules: jest.fn(async (executor) => {
      expect(executor).toBe(transaction);
      order.push("exclude");
      pending.codes = pending.codes.filter((code) => !code.startsWith("YSC"));
    }),
    uploadAllPrereqTrees: jest.fn(async (executor, prereq, available) => {
      await stage("prerequisites")(executor);
      expect(prereq).toEqual(snapshot.prereq);
      expect(available).toEqual(new Set(["CS1000"]));
      expect(pending.codes).toEqual(["CS1000"]);
    }),
    deduplicateLogicNodes: stage("dedup"),
    cleanupUnreachableLogicNodes: stage("cleanup"),
    assertGraphInvariants: stage("invariants"),
  };
  return { database, transaction, session, overrides, order };
}

test.each(["write", "prerequisites", "dedup", "cleanup", "invariants", "metadata", "commit"])("%s failure rolls back the whole import and retains the previous graph", async (failure) => {
  const { database, transaction, session, overrides } = fixture(failure);
  await expect(publishSnapshot(session as Pick<Session, "beginTransaction">, snapshot, overrides)).rejects.toThrow(`${failure} failure`);
  expect(database).toEqual({ codes: ["OLD1000"], fingerprint: "old-fingerprint", unrelated: "preserved" });
  expect(session.beginTransaction).toHaveBeenCalledTimes(1);
  expect(transaction.rollback).toHaveBeenCalledTimes(1);
  expect(transaction.commit).toHaveBeenCalledTimes(failure === "commit" ? 1 : 0);
});

test("publishes metadata last and uses one transaction for every write", async () => {
  const { database, transaction, session, overrides, order } = fixture();
  await publishSnapshot(session, snapshot, overrides);
  expect(order).toEqual(["delete", "upload", "exclude", "prerequisites", "dedup", "cleanup", "invariants", "metadata", "commit"]);
  expect(database).toEqual({ codes: ["CS1000"], fingerprint: snapshot.fingerprint, unrelated: "preserved" });
  expect(transaction.rollback).not.toHaveBeenCalled();
  expect(session.beginTransaction).toHaveBeenCalledTimes(1);
  expect(transaction.run).toHaveBeenLastCalledWith(expect.stringContaining("metadata.status = 'ready'"), {
    name: "prerequisites", schemaVersion: 2, fingerprint: snapshot.fingerprint, moduleCount: 1,
    publicationId: expect.any(String),
  });
});

test("same-fingerprint reimports receive distinct publication IDs for reader fencing", async () => {
  const { transaction, session, overrides } = fixture();
  await publishSnapshot(session, snapshot, overrides);
  await publishSnapshot(session, snapshot, overrides);
  const writes = transaction.run.mock.calls.filter(([query]) => query.includes("MERGE (metadata"));
  expect(writes[0][1]?.publicationId).not.toBe(writes[1][1]?.publicationId);
});

test("invalid/tampered snapshots fail before opening a transaction", async () => {
  const { session } = fixture();
  await expect(publishSnapshot(session, { ...snapshot, prereq: {} })).rejects.toThrow("Missing prerequisite");
  expect(session.beginTransaction).not.toHaveBeenCalled();
});

test("empty databases and ambiguous metadata cannot publish without a safe lock", async () => {
  const missing = { run: jest.fn().mockResolvedValue({ records: [] }) };
  await expect(acquirePublicationLock(missing as unknown as Neo4jExecutor)).rejects.toThrow("lock anchor");
  const duplicate = { run: jest.fn().mockResolvedValueOnce(result({ anchorId: "anchor" })).mockResolvedValueOnce(result({ metadataCount: 2 })) };
  await expect(acquirePublicationLock(duplicate as unknown as Neo4jExecutor)).rejects.toThrow("ambiguous import metadata");
});

test("upload batches remain on the supplied executor and failures propagate", async () => {
  const run = jest.fn(async (_query, params: { rows: unknown[] }) => result({ uploadedCount: params.rows.length }));
  const executor = { run } as unknown as Neo4jExecutor;
  await uploadModules(executor, Array.from({ length: 501 }, (_, index) => ({ moduleCode: `CS${index}`, title: "Module" })));
  expect(run.mock.calls.map((call) => call[1].rows.length)).toEqual([250, 250, 1]);
  run.mockRejectedValueOnce(new Error("batch failed"));
  await expect(uploadModules(executor, full)).rejects.toThrow("batch failed");
});

test("deleteGraph targets only application nodes, leaves metadata lock intact, and propagates errors", async () => {
  const run = jest.fn().mockRejectedValue(new Error("delete failed"));
  await expect(deleteGraph({ run } as unknown as Neo4jExecutor)).rejects.toThrow("delete failed");
  expect(run).toHaveBeenCalledWith("MATCH (n) WHERE n:Module OR n:Logic DETACH DELETE n");
});
