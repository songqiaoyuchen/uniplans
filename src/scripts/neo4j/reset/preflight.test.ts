import { prepareCatalogue, validateSnapshot } from "./preflight";
import { computeCatalogueFingerprint, CURRENT_PREREQUISITE_SCHEMA_VERSION } from "../../../utils/prerequisites/catalogueFingerprint";
import { loadLocalSnapshot } from "./catalogueSnapshot";

const full = [{ moduleCode: "CS1000", title: "Intro" }, { moduleCode: "CS2000", title: "Advanced" }];
const mini = full.map((mod) => ({ code: mod.moduleCode, title: mod.title }));
const prereq = { CS1000: null, CS2000: { and: ["CS1000", "OLD1000"] } };

test("validates complete snapshots and reports, rather than drops, unavailable references", () => {
  const snapshot = prepareCatalogue(full, mini, prereq);
  expect(snapshot.schemaVersion).toBe(CURRENT_PREREQUISITE_SCHEMA_VERSION);
  expect(snapshot.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(snapshot.prereq.CS2000).toEqual(prereq.CS2000);
  expect(snapshot.diagnostics).toEqual([{ moduleCode: "CS2000", token: "OLD1000", path: "$.and[1]" }]);
  expect(validateSnapshot(snapshot)).toEqual(snapshot);
});

test.each([
  [[], [], {}, "nonempty"],
  [[...full, full[0]], mini, prereq, "duplicate"],
  [full, [mini[0], mini[0]], prereq, "duplicate"],
  [full, mini.slice(1), prereq, "membership"],
  [full, mini, { CS1000: null }, "Missing prerequisite entry for CS2000"],
  [full, mini, { ...prereq, EXTRA1000: null }, "outside"],
  [full, mini, { ...prereq, CS2000: undefined }, "Invalid prerequisite for CS2000"],
  [full, mini, { ...prereq, CS2000: { mystery: "CS1000" } }, "Invalid prerequisite for CS2000"],
  [full, mini, { ...prereq, CS2000: { and: [] } }, "nonempty"],
  [full, [{ ...mini[0], title: "Wrong" }, mini[1]], prereq, "title mismatch"],
])("rejects malformed or incomplete snapshot %#", (modules, list, trees, message) => {
  expect(() => prepareCatalogue(modules, list, trees)).toThrow(String(message));
});

test("exclusions and missing wildcards are reported inside conditionals without making them fatal", () => {
  const modules = [...full, { moduleCode: "YSC1000", title: "Excluded" }];
  const snapshot = prepareCatalogue(modules, modules.map((mod) => ({ code: mod.moduleCode, title: mod.title })), {
    CS1000: null,
    CS2000: { cohort: { rule: "IF_IN", years: ["S:2024/25"] }, then: { nOf: [2, ["YSC1000", "CS1%", "OLD%"]] } },
    YSC1000: null,
  });
  expect(snapshot.diagnostics.map((entry) => entry.token)).toEqual(["YSC1000", "OLD%"]);
});

test("fingerprints ignore object/catalogue order, but detect data and prerequisite changes", () => {
  const fingerprint = computeCatalogueFingerprint(full, mini, prereq);
  expect(computeCatalogueFingerprint([...full].reverse(), [...mini].reverse(), { CS2000: prereq.CS2000, CS1000: null })).toBe(fingerprint);
  expect(computeCatalogueFingerprint(full.map((mod) => ({ title: mod.title, moduleCode: mod.moduleCode })), mini, prereq)).toBe(fingerprint);
  expect(computeCatalogueFingerprint(full, mini, { ...prereq, CS2000: null })).not.toBe(fingerprint);
  expect(computeCatalogueFingerprint([{ ...full[0], description: "Updated" }, full[1]], mini, prereq)).not.toBe(fingerprint);
  expect(() => validateSnapshot({ ...prepareCatalogue(full, mini, prereq), fingerprint: "stale" })).toThrow("fingerprint mismatch");
  expect(() => validateSnapshot({ ...prepareCatalogue(full, mini, prereq), schemaVersion: 1 })).toThrow("schema version");
});

test("the full checked-in catalogue passes read-only preflight", async () => {
  const snapshot = await loadLocalSnapshot();
  expect(snapshot.full.length).toBeGreaterThan(6000);
  expect(Object.keys(snapshot.prereq)).toHaveLength(snapshot.full.length);
  expect(snapshot.diagnostics.some((entry) => entry.moduleCode === "BN4406" && entry.token === "BN2403:D")).toBe(true);
});
