import { createHash } from "node:crypto";

export const CURRENT_PREREQUISITE_SCHEMA_VERSION = 2;

function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("Catalogue contains a non-JSON value");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJSON(record[key])}`,
  ).join(",")}}`;
}

export function computeCatalogueFingerprint(
  full: readonly unknown[],
  mini: readonly unknown[],
  prereq: Record<string, unknown>,
): string {
  const sorted = (values: readonly unknown[], key: string) => [...values].sort((a, b) => {
    const left = String((a as Record<string, unknown>)[key]);
    const right = String((b as Record<string, unknown>)[key]);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return createHash("sha256").update(canonicalJSON({
    full: sorted(full, "moduleCode"),
    mini: sorted(mini, "code"),
    prereq,
  })).digest("hex");
}
