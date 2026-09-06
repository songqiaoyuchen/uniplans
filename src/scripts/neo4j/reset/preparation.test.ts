import axios from "axios";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fetchModuleData } from "../../scrapers/fetchModuleData";
import { fetchPrereqInfo } from "../../scrapers/fetchPrereqInfo";
import { saveModuleData } from "../../scrapers/saveModuleData";
import { saveMiniModuleData } from "../../scrapers/saveMiniModuleData";
import { savePrereqInfo } from "../../scrapers/savePrereqInfo";
import { downloadData } from "./downloadData";
import { prepareCatalogue } from "./preflight";
import { savePreparedSnapshot, loadPreparedSnapshot } from "./catalogueSnapshot";
import { parseResetOptions, resetDB } from "./resetDB";

jest.mock("axios");
jest.mock("../../../db/neo4j", () => { throw new Error("Dry-run must not import the database driver"); });

const get = axios.get as jest.Mock;
const full = [{ moduleCode: "CS1000", title: "Intro" }, { moduleCode: "CS2000", title: "Advanced" }];
const mini = full.map((mod) => ({ code: mod.moduleCode, title: mod.title }));
const snapshot = prepareCatalogue(full, mini, { CS1000: null, CS2000: "CS1000" });
let directory: string;

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "uniplans-reset-"));
  get.mockReset();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

test("module download failure is fatal rather than an empty catalogue", async () => {
  get.mockRejectedValue(new Error("network failed"));
  await expect(fetchModuleData()).rejects.toThrow("network failed");
});

test("prerequisites use the supplied catalogue and a single failure rejects the full result", async () => {
  const read = jest.spyOn(fs, "readFile");
  get.mockResolvedValueOnce({ data: { moduleCode: "CS1000" } }).mockRejectedValueOnce(new Error("network failed"));
  await expect(fetchPrereqInfo(full)).rejects.toThrow("Failed to fetch prerequisites for CS2000");
  expect(read).not.toHaveBeenCalled();
  expect(get.mock.calls.map((args) => args[0])).toEqual([
    expect.stringContaining("/CS1000.json"), expect.stringContaining("/CS2000.json"),
  ]);
});

test.each([
  { moduleCode: "OTHER1000", prereqTree: null },
  { moduleCode: "CS1000", prerequisite: "Missing structured prerequisite" },
  null,
])("rejects incomplete/mismatched prerequisite responses %#", async (data) => {
  get.mockResolvedValue({ data });
  await expect(fetchPrereqInfo(full.slice(0, 1))).rejects.toThrow("Failed to fetch prerequisites for CS1000");
});

test("preserves falsey malformed trees so preflight rejects them rather than treating them as null", async () => {
  get.mockResolvedValue({ data: { moduleCode: "CS1000", prereqTree: false } });
  const prereq = await fetchPrereqInfo(full.slice(0, 1));
  expect(prereq).toEqual({ CS1000: false });
  expect(() => prepareCatalogue(full.slice(0, 1), mini.slice(0, 1), prereq)).toThrow("Invalid prerequisite");
});

test("failed full preparation writes neither staged nor active datasets", async () => {
  const write = jest.spyOn(fs, "writeFile");
  const open = jest.spyOn(fs, "open");
  get.mockResolvedValueOnce({ data: full }).mockResolvedValueOnce({ data: full });
  get.mockResolvedValueOnce({ data: { moduleCode: "CS1000", prereqTree: null } }).mockRejectedValueOnce(new Error("fetch failed"));
  await expect(downloadData(path.join(directory, "prepared.json"))).rejects.toThrow("fetch failed");
  expect(write).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
  expect(await fs.readdir(directory)).toEqual([]);
});

test("stages one complete verified bundle, refuses overwrite, and leaves active data alone", async () => {
  const file = path.join(directory, "prepared.json");
  await savePreparedSnapshot(snapshot, file);
  expect(await loadPreparedSnapshot(file)).toEqual(snapshot);
  await expect(savePreparedSnapshot(snapshot, file)).rejects.toThrow();
  expect(await fs.readdir(directory)).toEqual(["prepared.json"]);
  await expect(savePreparedSnapshot(snapshot, path.join(process.cwd(), "src", "data", "must-not-exist.json"))).rejects.toThrow("outside active src/data");
});

test("staging write failures leave no publishable partial bundle", async () => {
  const actualOpen = fs.open;
  jest.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await actualOpen(...args);
    jest.spyOn(handle, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    return handle;
  });
  await expect(savePreparedSnapshot(snapshot, path.join(directory, "prepared.json"))).rejects.toThrow("disk full");
  expect(await fs.readdir(directory)).toEqual([]);
});

test("all legacy save helpers propagate disk failures without logging the dataset", async () => {
  const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(fs, "writeFile").mockRejectedValue(new Error("disk failed"));
  await expect(saveModuleData(full, directory)).rejects.toThrow("disk failed");
  await expect(saveMiniModuleData(mini, directory)).rejects.toThrow("disk failed");
  await expect(savePrereqInfo(snapshot.prereq, directory)).rejects.toThrow("disk failed");
  expect(log).not.toHaveBeenCalled();
});

test("the CLI defaults to dry-run and rejects ambiguous destructive options", () => {
  expect(parseResetOptions([])).toEqual({ apply: false, source: "local" });
  expect(parseResetOptions(["--snapshot", "/prepared.json"])).toEqual({ apply: false, source: "snapshot", snapshotPath: "/prepared.json" });
  expect(parseResetOptions(["--apply", "--source", "local"]).apply).toBe(true);
  for (const args of [["--apply", "--dry-run"], ["--source", "download"], ["--source", "snapshot"], ["--force"], ["--source", "local", "--snapshot", "file"]]) {
    expect(() => parseResetOptions(args)).toThrow();
  }
});

test("even --apply never opens the database if acquisition or staging fails", async () => {
  get.mockRejectedValueOnce(new Error("acquisition failed"));
  await expect(resetDB(["--apply", "--source", "download", "--stage", path.join(directory, "failed.json")])).rejects.toThrow("acquisition failed");
  get.mockReset();
  get.mockResolvedValueOnce({ data: full }).mockResolvedValueOnce({ data: full });
  get.mockResolvedValueOnce({ data: { moduleCode: "CS1000", prereqTree: null } });
  get.mockResolvedValueOnce({ data: { moduleCode: "CS2000", prereqTree: "CS1000" } });
  jest.spyOn(fs, "open").mockRejectedValueOnce(new Error("staging failed"));
  await expect(resetDB(["--apply", "--source", "download", "--stage", path.join(directory, "failed.json")])).rejects.toThrow("staging failed");
  expect(await fs.readdir(directory)).toEqual([]);
});

test("actual local CLI dry-run needs no database import, credentials, writes, or HTTP requests", async () => {
  const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  const write = jest.spyOn(fs, "writeFile");
  const open = jest.spyOn(fs, "open");
  const prepared = await resetDB(["--dry-run", "--source", "local"]);
  expect(prepared?.full.length).toBeGreaterThan(6000);
  expect(log).toHaveBeenCalledWith("Dry-run complete. No database connection or active catalogue writes were made.");
  expect(get).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
