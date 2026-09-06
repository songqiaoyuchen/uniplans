import { assertGraphInvariants } from "./assertGraphInvariants";
import { prepareCatalogue } from "./preflight";
import type { Neo4jExecutor } from "./buildTree/attachTree";

const full = [{ moduleCode: "CS1000", title: "Intro" }, { moduleCode: "CS2000", title: "Advanced" }];
const snapshot = prepareCatalogue(full, full.map((mod) => ({ code: mod.moduleCode, title: mod.title })), {
  CS1000: null, CS2000: { nOf: [5, ["CS1000", "OLD1000"]] },
});
const records = (rows: Record<string, unknown>[]) => ({ records: rows.map((row) => ({ get: (key: string) => row[key] })) });
const roots = [{ code: "CS1000", rootCount: 0 }, { code: "CS2000", rootCount: 1 }];
const logic = [
  { properties: { type: "NOF", threshold: 5 }, childCount: 2 },
  { properties: { type: "BLOCKED", reason: "Unavailable", ownerModuleCode: "CS2000", originalToken: "OLD1000" }, childCount: 0 },
];

function executor(changes: { roots?: Record<string, unknown>[]; logic?: Record<string, unknown>[]; invalidCount?: number; unreachableCount?: number; cycleCount?: number } = {}) {
  return { run: jest.fn()
    .mockResolvedValueOnce(records(changes.roots ?? roots))
    .mockResolvedValueOnce(records([{ invalidCount: changes.invalidCount ?? 0 }]))
    .mockResolvedValueOnce(records([{ unreachableCount: changes.unreachableCount ?? 0 }]))
    .mockResolvedValueOnce(records([{ cycleCount: changes.cycleCount ?? 0 }]))
    .mockResolvedValueOnce(records(changes.logic ?? logic)),
  } as unknown as Neo4jExecutor;
}

test("underpopulated NOF remains an attached blocked requirement, not an invariant error", async () => {
  await expect(assertGraphInvariants(executor(), snapshot)).resolves.toBeUndefined();
});

test.each([
  [{ roots: [roots[0]] }, "incomplete module catalogue"],
  [{ roots: [...roots, roots[0]] }, "duplicate Module"],
  [{ roots: [roots[0], { code: "CS2000", rootCount: 0 }] }, "root count"],
  [{ roots: [{ code: "CS1000", rootCount: 1 }, roots[1]] }, "root count"],
  [{ invalidCount: 1 }, "invalid prerequisite relationship"],
  [{ unreachableCount: 1 }, "unreachable logic"],
  [{ cycleCount: 1 }, "cyclic logic"],
  [{ logic: [{ properties: { type: "AND" }, childCount: 0 }] }, "empty AND"],
  [{ logic: [{ properties: { type: "NOF", threshold: 0 }, childCount: 1 }] }, "NOF threshold"],
  [{ logic: [{ properties: { type: "CONDITIONAL", condition: "{}" }, childCount: 0 }] }, "condition gate"],
  [{ logic: [{ properties: { type: "CONDITION", condition: "{}" }, childCount: 0 }] }, "condition kind"],
  [{ logic: [{ properties: { type: "UNKNOWN" }, childCount: 0 }] }, "unknown logic type"],
  [{ logic: [logic[0]] }, "missing blocked reference"],
])("rejects structural publication failure %#", async (changes, message) => {
  await expect(assertGraphInvariants(executor(changes), snapshot)).rejects.toThrow(String(message));
});
