import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CatalogueSnapshot, prepareCatalogue, validateSnapshot } from "./preflight";

export async function loadLocalSnapshot(dataDirectory = path.join(process.cwd(), "src", "data")): Promise<CatalogueSnapshot> {
  const names = ["moduleData.json", "miniModuleData.json", "modulePrereqInfo.json"];
  const files = names.map((name) => path.join(dataDirectory, name));
  const before = await Promise.all(files.map((file) => fs.stat(file, { bigint: true })));
  const contents = await Promise.all(files.map((file) => fs.readFile(file, "utf8")));
  const after = await Promise.all(files.map((file) => fs.stat(file, { bigint: true })));
  if (before.some((stat, index) => stat.ino !== after[index].ino || stat.size !== after[index].size || stat.mtimeNs !== after[index].mtimeNs || stat.ctimeNs !== after[index].ctimeNs)) {
    throw new Error("Local catalogue changed while being read; use an immutable prepared snapshot");
  }
  return prepareCatalogue(...contents.map((content) => JSON.parse(content)) as [unknown, unknown, unknown]);
}

export async function loadPreparedSnapshot(filePath: string): Promise<CatalogueSnapshot> {
  return validateSnapshot(JSON.parse(await fs.readFile(filePath, "utf8")));
}

export async function savePreparedSnapshot(snapshot: CatalogueSnapshot, filePath: string): Promise<void> {
  const validated = validateSnapshot(snapshot);
  const destination = path.resolve(filePath);
  const parent = await fs.realpath(path.dirname(destination));
  const active = await fs.realpath(path.join(process.cwd(), "src", "data"));
  const relative = path.relative(active, parent);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("Prepared snapshots must be staged outside active src/data");
  }
  const target = path.join(parent, path.basename(destination));
  const temporary = `${target}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(validated));
    await handle.sync();
    await handle.close();
    await fs.link(temporary, target);
  } finally {
    await handle.close();
    await fs.unlink(temporary);
  }
}
