// app/api/rawGraph/route.ts
// API route handler for graph fetching

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMergedTree } from "@/db/getMergedTree";
import { GraphDataError } from "@/db/graphDataError";
import { ErrorResponse } from "@/types/errorTypes";
import { normaliseNodes } from "@/utils/graph/normaliseNodes";
import { NormalisedGraph } from "@/types/graphTypes";
import type { StudentContext } from "@/types/prerequisiteTypes";
import { checkGraph } from "@/utils/graph/checkGraph";
import { resolvePrerequisiteConditions } from "@/utils/graph/resolvePrerequisiteConditions";
import { validateStudentContext } from "@/utils/prerequisites/validateStudentContext";
import miniModuleData from "@/data/miniModuleData.json";
import { MAX_MODULES_PER_PRESERVED_SEMESTER, MAX_PRESERVED_SEMESTERS } from "@/constants/plannerLimits";

const knownCodes = new Set(miniModuleData.map(({ code }) => code));

async function buildGraph(input: unknown, context: StudentContext | null): Promise<NextResponse<NormalisedGraph | ErrorResponse>> {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MODULES_PER_PRESERVED_SEMESTER * MAX_PRESERVED_SEMESTERS || input.some((code) => typeof code !== "string" || !knownCodes.has(code.trim().toUpperCase()))) {
    return NextResponse.json({ error: "Provide a bounded list of known module codes" }, { status: 400 });
  }
  const codes = [...new Set(input.map((code: string) => code.trim().toUpperCase()))];
  try {
    const graph = await getMergedTree(codes);
    const resolved = resolvePrerequisiteConditions(graph, context, codes);
    const normalised = normaliseNodes(resolved);
    if (!checkGraph(normalised, codes)) throw new GraphDataError("Prerequisite graph failed integrity checks");
    return NextResponse.json(normalised);
  } catch (err) {
    if (err instanceof GraphDataError) return NextResponse.json({ error: err.message }, { status: 503 });
    console.error("exportGraph error:", err);
    return NextResponse.json({ error: "Failed to build merged graph" }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<NormalisedGraph | ErrorResponse>> {
  const { searchParams } = request.nextUrl;
  const codes = (searchParams.get("moduleCodes") ?? searchParams.get("moduleCode") ?? "").split(",").filter(Boolean);
  return buildGraph(codes, null);
}

export async function POST(request: NextRequest): Promise<NextResponse<NormalisedGraph | ErrorResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const context = validateStudentContext(input.studentContext);
  if (!context.success) return NextResponse.json({ error: context.error }, { status: 400 });
  return buildGraph(input.moduleCodes, context.data);
}
