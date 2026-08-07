import { NextRequest } from "next/server";
import { getMergedTree } from "@/db/getMergedTree";
import { MAX_TARGET_MODULES } from "@/constants/plannerLimits";
import { POST } from "./route";

jest.mock("@/db/getMergedTree", () => ({ getMergedTree: jest.fn() }));
jest.mock("@/utils/graph/normaliseNodes", () => ({ normaliseNodes: jest.fn() }));
jest.mock("@/utils/graph/algo/schedule", () => ({ runScheduler: jest.fn() }));

const mockedGetMergedTree = getMergedTree as jest.MockedFunction<typeof getMergedTree>;

describe("POST /api/timetable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 400 for invalid JSON without querying Neo4j", async () => {
    const request = new NextRequest("https://uniplans.example/api/timetable", {
      method: "POST",
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(mockedGetMergedTree).not.toHaveBeenCalled();
  });

  test("returns 400 for excessive targets without querying Neo4j", async () => {
    const request = new NextRequest("https://uniplans.example/api/timetable", {
      method: "POST",
      body: JSON.stringify({
        required: Array(MAX_TARGET_MODULES + 1).fill("ABM5001"),
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: `required cannot contain more than ${MAX_TARGET_MODULES} modules`,
    });
    expect(mockedGetMergedTree).not.toHaveBeenCalled();
  });
});
