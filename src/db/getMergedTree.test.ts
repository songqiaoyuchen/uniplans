import { int } from "neo4j-driver";
import { getNeo4jDriver } from "./neo4j";
import { getMergedTree } from "./getMergedTree";
import { getPrereqTree } from "./getPrereqTree";

jest.mock("./neo4j", () => ({ getNeo4jDriver: jest.fn() }));
jest.mock("@/utils/prerequisites/catalogueFingerprint", () => ({
  CURRENT_PREREQUISITE_SCHEMA_VERSION: 2,
  computeCatalogueFingerprint: () => "catalogue-fingerprint",
}));

const record = (values: Record<string, unknown>) => ({ get: (key: string) => values[key], has: (key: string) => Object.hasOwn(values, key) });
const metadata = (overrides: Record<string, unknown> = {}) => ({ records: [record({
  schemaVersion: int(2), fingerprint: "catalogue-fingerprint", status: "ready", publicationId: "publication-one", ...overrides,
})] });

function sessionWith(...responses: unknown[]) {
  const run = jest.fn();
  responses.forEach((response) => run.mockResolvedValueOnce(response));
  const session = { run, close: jest.fn().mockResolvedValue(undefined) };
  jest.mocked(getNeo4jDriver).mockReturnValue({ session: () => session } as unknown as ReturnType<typeof getNeo4jDriver>);
  return session;
}

describe("validated graph publication reads", () => {
  afterEach(() => jest.clearAllMocks());

  test("loads a graph only when schema, catalogue and publication remain consistent", async () => {
    const session = sessionWith(metadata(), { records: [record({ nodes: [], relationships: [] })] }, metadata());
    await expect(getMergedTree(["MA4254"])).resolves.toEqual({ nodes: {}, relationships: [] });
    expect(session.run).toHaveBeenCalledTimes(3);
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  test.each([
    { records: [] },
    metadata({ schemaVersion: 1 }),
    metadata({ status: "uninitialized" }),
    metadata({ fingerprint: "different-catalogue" }),
    metadata({ publicationId: undefined }),
  ])("refuses missing, old or mismatched graph metadata", async (response) => {
    const session = sessionWith(response);
    await expect(getMergedTree(["MA4254"])).rejects.toThrow(/graph/i);
    expect(session.run).toHaveBeenCalledTimes(1);
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  test.each(["merged", "single"])("rejects a publication change during %s graph retrieval", async (kind) => {
    const session = sessionWith(metadata(), { records: [record({ nodes: [], relationships: [] })] }, metadata({ publicationId: "publication-two" }));
    const request = kind === "merged" ? getMergedTree(["MA4254"]) : getPrereqTree("MA4254");
    await expect(request).rejects.toThrow("changed during retrieval");
    expect(session.close).toHaveBeenCalledTimes(1);
  });
});
