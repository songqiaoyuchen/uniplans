import { runInNewContext } from "node:vm";
import { isPlainRecord } from "./isPlainRecord";
import { validateStudentContext } from "./validateStudentContext";
import { parsePrerequisite } from "./parsePrerequisite";

describe("JSON records across request execution contexts", () => {
  test("accepts plain JSON objects from another realm", () => {
    const context = runInNewContext('JSON.parse(\'{"cohortYear":2024,"programmeType":"Undergraduate Degree"}\')');
    expect(isPlainRecord(context)).toBe(true);
    expect(validateStudentContext(context)).toEqual({ success: true, data: { cohortYear: 2024, programmeType: "Undergraduate Degree" } });
  });

  test("parses prerequisite trees supplied by another realm", () => {
    const tree = runInNewContext('JSON.parse(\'{"or":["CS1010:D","CS1101S:D"]}\')');
    expect(parsePrerequisite(tree)).toMatchObject({ type: "OR", children: [{ type: "module", moduleCode: "CS1010" }, { type: "module", moduleCode: "CS1101S" }] });
  });

  test("still rejects class instances and objects with arbitrary prototypes", () => {
    class Context { cohortYear = 2024; }
    expect(isPlainRecord(new Context())).toBe(false);
    expect(isPlainRecord(Object.create({ cohortYear: 2024 }))).toBe(false);
    expect(isPlainRecord(runInNewContext('new (class Context { cohortYear = 2024; })()'))).toBe(false);
  });
});
