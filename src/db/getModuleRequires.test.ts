import { getModuleRequires } from "./getModuleRequires";
import { getModuleByCode } from "./getModuleByCode";

describe("module prerequisite metadata for browser validation", () => {
  test.each([
    ["AR3328", "cohort", "AR2328A"],
    ["ADS5201", "programType", "ADS5101"],
  ])("preserves %s conditional requirements in context-independent module responses", async (code, kind, prerequisite) => {
    const moduleInfo = await getModuleByCode(code);
    expect(moduleInfo?.prerequisiteSchemaVersion).toBe(2);
    expect(moduleInfo?.requires).toMatchObject({ type: "conditional", condition: { kind }, then: { type: "module", moduleCode: prerequisite } });
  });

  test("marks a missing direct prerequisite explicitly unavailable", async () => {
    await expect(getModuleRequires("BN4406")).resolves.toMatchObject({ type: "blocked", moduleCode: "BN2403", reason: expect.stringContaining("unavailable") });
  });

  test("distinguishes explicitly absent prerequisites from missing source data", async () => {
    await expect(getModuleRequires("AR2328A")).resolves.toBeNull();
    await expect(getModuleRequires("NOT_A_MODULE")).rejects.toThrow("Missing prerequisite data");
  });
});
