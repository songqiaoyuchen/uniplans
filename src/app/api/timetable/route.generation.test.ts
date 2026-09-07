import { NextRequest } from "next/server";
import { getMergedTree } from "@/db/getMergedTree";
import { GraphDataError } from "@/db/graphDataError";
import { getModuleByCode } from "@/db/getModuleByCode";
import type { FormattedGraph } from "@/types/graphTypes";
import { POST } from "./route";

jest.mock("@/db/getMergedTree", () => ({ getMergedTree: jest.fn() }));

function prerequisiteGraph(): FormattedGraph {
  return {
    nodes: {
      AR3328: { id: "AR3328", code: "AR3328", title: "Target", credits: 4, semestersOffered: [0, 2], exam: null, preclusions: [] },
      AR2328A: { id: "AR2328A", code: "AR2328A", title: "Prerequisite", credits: 4, semestersOffered: [0, 2], exam: null, preclusions: [] },
      condition: { id: "condition", type: "CONDITIONAL", condition: { kind: "cohort", rule: "IF_IN", years: ["S:2024/25"] } },
    },
    relationships: [
      { id: "root", from: "AR3328", to: "condition" },
      { id: "then", from: "condition", to: "AR2328A" },
    ],
  };
}

function request(body: unknown) {
  return new NextRequest("https://uniplans.example/api/timetable", { method: "POST", body: JSON.stringify(body) });
}

describe("timetable generation with context and blocked requirements", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.mocked(getMergedTree).mockResolvedValue(prerequisiteGraph());
  });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

  test.each([[2024, ["AR2328A", "AR3328"]], [2023, ["AR3328"]]])("evaluates cohort %i before scheduling", async (cohortYear, expected) => {
    const response = await POST(request({ required: ["AR3328"], studentContext: { cohortYear, programmeType: "Undergraduate Degree" } }));
    const result = await response.json();
    expect(result).not.toHaveProperty("error");
    expect(response.status).toBe(200);
    expect(result.isValid).toBe(true);
    expect(result.timetable.semesters.flatMap((semester: { moduleCodes: string[] }) => semester.moduleCodes)).toEqual(expected);
  });

  test("missing context returns an invalid proposal with actionable diagnostics", async () => {
    const result = await (await POST(request({ required: ["AR3328"] }))).json();
    expect(result.isValid).toBe(false);
    expect(result.timetable.semesters).toEqual([]);
    expect(result.validation.errors.join(" ")).toContain("cohort");
  });

  test("unavailable direct requirements do not produce a valid timetable", async () => {
    const graph = prerequisiteGraph();
    graph.nodes.condition = { id: "condition", type: "BLOCKED", reason: "AR2328A is unavailable" };
    graph.relationships = graph.relationships.slice(0, 1);
    jest.mocked(getMergedTree).mockResolvedValue(graph);
    const result = await (await POST(request({ required: ["AR3328"] }))).json();
    expect(result.isValid).toBe(false);
    expect(result.validation.errors).toContain("AR3328: AR2328A is unavailable");
  });

  test("bad context is rejected before any graph request", async () => {
    const response = await POST(request({ required: ["AR3328"], studentContext: { cohortYear: "2024" } }));
    expect(response.status).toBe(400);
    expect(getMergedTree).not.toHaveBeenCalled();
  });

  test("keeps both MA4254 and DBA3701 targets when a conflicting mathematics route is available earlier", async () => {
    const codes = ["MA4254", "MA3252", "DBA3701", "DAO2702", "RE1702", "MA2001"];
    const graph: FormattedGraph = { nodes: { choice: { id: "choice", type: "OR" } }, relationships: [] };
    for (const code of codes) {
      const course = await getModuleByCode(code);
      expect(course).not.toBeNull();
      graph.nodes[code] = { ...course!, id: code };
    }
    graph.relationships = [
      ["MA4254", "choice"], ["choice", "MA3252"], ["choice", "DBA3701"],
      ["MA3252", "MA2001"], ["DBA3701", "DAO2702"], ["DAO2702", "RE1702"],
    ].map(([from, to], index) => ({ id: String(index), from, to }));
    jest.mocked(getMergedTree).mockResolvedValue(graph);
    const response = await POST(request({
      required: ["MA4254", "DBA3701"], exempted: ["MA2001"],
      studentContext: { cohortYear: 2024, programmeType: "Undergraduate Degree" },
    }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.validation.errors).toEqual([]);
    expect(result.isValid).toBe(true);
    const scheduled = result.timetable.semesters.flatMap((semester: { moduleCodes: string[] }) => semester.moduleCodes);
    expect(scheduled).toEqual(expect.arrayContaining(["DAO2702", "DBA3701", "MA4254"]));
    expect(scheduled).not.toContain("MA3252");
  });

  test("stale graph data is reported as temporarily unavailable", async () => {
    jest.mocked(getMergedTree).mockRejectedValue(new GraphDataError("Validated rebuild required"));
    const response = await POST(request({ required: ["AR3328"] }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Validated rebuild required" });
  });
});
