import type { FormattedGraph } from "@/types/graphTypes";
import { normaliseNodes } from "./normaliseNodes";

function graphWithGate(gate: FormattedGraph["nodes"][string]): FormattedGraph {
  return {
    nodes: {
      target: { id: "target", code: "TARGET", title: "Target", credits: 4, semestersOffered: [0, 2], exam: null, preclusions: [] },
      gate,
    },
    relationships: [{ id: "edge", from: "target", to: "gate" }],
  };
}

describe("prerequisite graph normalization", () => {
  test("rejects an accidental empty AND instead of creating a satisfied threshold", () => {
    expect(() => normaliseNodes(graphWithGate({ id: "gate", type: "AND" }))).toThrow("Empty AND");
  });

  test("keeps an explicitly blocked prerequisite unsatisfied", () => {
    const normalized = normaliseNodes(graphWithGate({ id: "gate", type: "BLOCKED", reason: "BN2403 is unavailable" }));
    expect(normalized.nodes.gate).toEqual({ id: "gate", type: "NOF", n: 1, blockedReason: "BN2403 is unavailable" });
    expect(normalized.edges).toHaveLength(1);
  });

  test("rejects unresolved conditions before the scheduler can see them", () => {
    const graph = graphWithGate({ id: "gate", type: "CONDITION", condition: { kind: "cohort", rule: "MUST_BE_IN", years: ["S:2024/25"] } });
    expect(() => normaliseNodes(graph)).toThrow("Unresolved prerequisite");
  });

  test("rejects dangling relationships", () => {
    const graph = graphWithGate({ id: "gate", type: "NOF", n: 1 });
    graph.relationships.push({ id: "missing", from: "gate", to: "absent" });
    expect(() => normaliseNodes(graph)).toThrow("Missing graph node");
  });

  test("does not clamp an impossible N-of threshold", () => {
    const normalized = normaliseNodes(graphWithGate({ id: "gate", type: "NOF", n: 2 }));
    expect(normalized.nodes.gate).toMatchObject({ n: 2 });
  });
});
