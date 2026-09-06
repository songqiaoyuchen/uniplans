import type { Neo4jModuleData } from "../../../types/neo4jTypes";
import type { MiniModuleData } from "../../../types/plannerTypes";
import { parsePrerequisite } from "../../../utils/prerequisites/parsePrerequisite";
import {
  computeCatalogueFingerprint,
  CURRENT_PREREQUISITE_SCHEMA_VERSION,
} from "../../../utils/prerequisites/catalogueFingerprint";

export type UnavailableReference = { moduleCode: string; token: string; path: string };

export type CatalogueSnapshot = {
  formatVersion: 1;
  schemaVersion: number;
  fingerprint: string;
  full: Neo4jModuleData[];
  mini: MiniModuleData[];
  prereq: Record<string, unknown>;
  diagnostics: UnavailableReference[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function catalogueCodes(data: unknown, field: string, name: string): Set<string> {
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${name} must be a nonempty array`);
  const codes = new Set<string>();
  for (const entry of data) {
    if (!isRecord(entry) || typeof entry[field] !== "string" || !/^[A-Z][A-Z0-9]*$/.test(entry[field])) {
      throw new Error(`${name} contains an invalid ${field}`);
    }
    if (codes.has(entry[field])) throw new Error(`${name} contains duplicate code ${entry[field]}`);
    codes.add(entry[field]);
    if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
      throw new Error(`${name} ${entry[field]} has no title`);
    }
  }
  return codes;
}

export function availableCatalogueCodes(snapshot: Pick<CatalogueSnapshot, "full">): Set<string> {
  return new Set(snapshot.full.map((mod) => mod.moduleCode).filter((code) => !code.startsWith("YSC")));
}

function unavailableReferences(
  tree: unknown,
  moduleCode: string,
  available: ReadonlySet<string>,
  path: string,
  diagnostics: UnavailableReference[],
): void {
  if (typeof tree === "string") {
    const token = tree.split(":")[0].toUpperCase();
    const found = token.endsWith("%")
      ? [...available].some((code) => code.startsWith(token.slice(0, -1)))
      : available.has(token);
    if (!found) diagnostics.push({ moduleCode, token: tree, path });
    return;
  }
  if (!isRecord(tree)) return;
  for (const kind of ["and", "or"]) {
    if (Array.isArray(tree[kind])) {
      tree[kind].forEach((child, index) => unavailableReferences(child, moduleCode, available, `${path}.${kind}[${index}]`, diagnostics));
    }
  }
  if (Array.isArray(tree.nOf) && Array.isArray(tree.nOf[1])) {
    tree.nOf[1].forEach((child, index) => unavailableReferences(child, moduleCode, available, `${path}.nOf[1][${index}]`, diagnostics));
  }
  if ("then" in tree) unavailableReferences(tree.then, moduleCode, available, `${path}.then`, diagnostics);
}

export function prepareCatalogue(fullInput: unknown, miniInput: unknown, prereqInput: unknown): CatalogueSnapshot {
  const fullCodes = catalogueCodes(fullInput, "moduleCode", "Full catalogue");
  const miniCodes = catalogueCodes(miniInput, "code", "Mini catalogue");
  if (fullCodes.size !== miniCodes.size || [...fullCodes].some((code) => !miniCodes.has(code))) {
    throw new Error("Full and mini catalogue membership differs");
  }
  if (!isRecord(prereqInput)) throw new Error("Prerequisite catalogue must be an object");
  const full = fullInput as Neo4jModuleData[];
  const mini = miniInput as MiniModuleData[];
  const titles = new Map(mini.map((mod) => [mod.code, mod.title]));
  for (const mod of full) {
    if (titles.get(mod.moduleCode) !== mod.title) throw new Error(`Catalogue title mismatch for ${mod.moduleCode}`);
    if (!Object.prototype.hasOwnProperty.call(prereqInput, mod.moduleCode)) {
      throw new Error(`Missing prerequisite entry for ${mod.moduleCode}`);
    }
    try {
      parsePrerequisite(prereqInput[mod.moduleCode]);
    } catch (error) {
      throw new Error(`Invalid prerequisite for ${mod.moduleCode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const code of Object.keys(prereqInput)) {
    if (!fullCodes.has(code)) throw new Error(`Prerequisite entry ${code} is outside the catalogue`);
  }
  const available = availableCatalogueCodes({ full });
  if (available.size === 0) throw new Error("Catalogue contains no modules after exclusions");
  const diagnostics: UnavailableReference[] = [];
  for (const [code, tree] of Object.entries(prereqInput)) {
    if (available.has(code)) unavailableReferences(tree, code, available, "$", diagnostics);
  }
  return {
    formatVersion: 1,
    schemaVersion: CURRENT_PREREQUISITE_SCHEMA_VERSION,
    fingerprint: computeCatalogueFingerprint(full, mini, prereqInput),
    full,
    mini,
    prereq: prereqInput,
    diagnostics,
  };
}

export function validateSnapshot(input: unknown): CatalogueSnapshot {
  if (!isRecord(input) || input.formatVersion !== 1 || input.schemaVersion !== CURRENT_PREREQUISITE_SCHEMA_VERSION) {
    throw new Error("Unsupported catalogue snapshot format or prerequisite schema version");
  }
  const snapshot = prepareCatalogue(input.full, input.mini, input.prereq);
  if (snapshot.fingerprint !== input.fingerprint) throw new Error("Catalogue snapshot fingerprint mismatch");
  return snapshot;
}
