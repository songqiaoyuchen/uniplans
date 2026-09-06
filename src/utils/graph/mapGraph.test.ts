import { int } from "neo4j-driver";
import type { Neo4jGraph } from "@/types/neo4jTypes";
import { mapGraph } from "./mapGraph";

const node = (id: string, label: string, properties: Record<string, unknown>) => ({
  elementId: id, identity: int(0), labels: [label], properties,
});

function mapNodes(...nodes: ReturnType<typeof node>[]) {
  return mapGraph({ nodes, relationships: [] } as unknown as Neo4jGraph).nodes;
}

describe("Neo4j prerequisite mapping", () => {
  test("keeps module identities aligned with relationship element IDs", () => {
    expect(mapNodes(node("4:db:0", "Module", { moduleCode: "MA4254" }))["4:db:0"].id).toBe("4:db:0");
  });

  test("preserves condition, consequent, constant and blocked metadata", () => {
    const condition = { kind: "cohort", rule: "IF_IN", years: ["S:2024/25"] };
    const mapped = mapNodes(
      node("condition", "Logic", { type: "CONDITIONAL", condition: JSON.stringify(condition) }),
      node("blocked", "Logic", { type: "BLOCKED", reason: "BN2403 unavailable", moduleCode: "BN2403" }),
      node("constant", "Logic", { type: "CONSTANT", value: true }),
    );
    expect(mapped.condition).toEqual({ id: "condition", type: "CONDITIONAL", condition });
    expect(mapped.blocked).toMatchObject({ type: "BLOCKED", reason: "BN2403 unavailable" });
    expect(mapped.constant).toMatchObject({ type: "CONSTANT", value: true });
  });

  test("converts Neo4j integer thresholds without changing them", () => {
    expect(mapNodes(node("nof", "Logic", { type: "NOF", threshold: int(3) })).nof).toEqual({ id: "nof", type: "NOF", n: 3 });
  });

  test.each([
    { type: "NOF" },
    { type: "NOF", threshold: 0 },
    { type: "CONDITIONAL", condition: "{}" },
    { type: "BLOCKED" },
    { type: "CONSTANT", value: "true" },
    { type: "UNKNOWN" },
  ])("rejects malformed logic instead of dropping it: %j", (properties) => {
    expect(() => mapNodes(node("invalid", "Logic", properties))).toThrow();
  });
});
