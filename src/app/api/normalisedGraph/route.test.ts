import { NextRequest } from "next/server";
import { getMergedTree } from "@/db/getMergedTree";
import type { FormattedGraph } from "@/types/graphTypes";
import { GET, POST } from "./route";

jest.mock("@/db/getMergedTree", () => ({ getMergedTree: jest.fn() }));

const graph: FormattedGraph = {
  nodes: {
    AR3328: { id: "AR3328", code: "AR3328", title: "Target", credits: 4, semestersOffered: [0, 2], exam: null, preclusions: [] },
    condition: { id: "condition", type: "CONDITIONAL", condition: { kind: "cohort", rule: "IF_IN", years: ["S:2024/25"] } },
    missing: { id: "missing", type: "BLOCKED", reason: "AR2328A is unavailable" },
  },
  relationships: [{ id: "root", from: "AR3328", to: "condition" }, { id: "then", from: "condition", to: "missing" }],
};

describe("context-aware dependency explorer endpoint", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.mocked(getMergedTree).mockResolvedValue(graph);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

  test("uses POST context without putting the private profile in a query string", async () => {
    const request = new NextRequest("https://uniplans.example/api/normalisedGraph", {
      method: "POST",
      body: JSON.stringify({ moduleCodes: ["AR3328"], studentContext: { cohortYear: 2023, programmeType: "Undergraduate Degree" } }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(Object.keys(result.nodes)).toEqual(["AR3328"]);
    expect(result.edges).toEqual([]);
  });

  test("legacy GET safely shows blocked context rather than assuming eligibility", async () => {
    const response = await GET(new NextRequest("https://uniplans.example/api/normalisedGraph?moduleCode=AR3328"));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(Object.values(result.nodes)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "NOF", n: 1, blockedReason: expect.stringContaining("cohort") })]));
  });

  test("rejects malformed context and unknown codes before querying Neo4j", async () => {
    const request = new NextRequest("https://uniplans.example/api/normalisedGraph", { method: "POST", body: JSON.stringify({ moduleCodes: ["AR3328"], studentContext: { cohortYear: "invalid" } }) });
    expect((await POST(request)).status).toBe(400);
    expect((await GET(new NextRequest("https://uniplans.example/api/normalisedGraph?moduleCode=UNKNOWN"))).status).toBe(400);
    expect(getMergedTree).not.toHaveBeenCalled();
  });
});
