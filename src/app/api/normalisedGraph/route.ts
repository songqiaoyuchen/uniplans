// app/api/rawGraph/route.ts
// API route handler for graph fetching

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMergedTree } from "@/db/getMergedTree";
import { ErrorResponse } from "@/types/errorTypes";
import { normaliseNodes } from "@/utils/graph/normaliseNodes";
import { NormalisedGraph } from "@/types/graphTypes";
import { checkGraph } from "@/utils/graph/checkGraph";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<NormalisedGraph | ErrorResponse>> {
  const { searchParams } = request.nextUrl;
  const moduleCode = searchParams.get("moduleCode");
  const moduleCodesParam = searchParams.get("moduleCodes");

  let codes: string[] = [];
  if (moduleCodesParam) {
    codes = moduleCodesParam
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c);
  } else if (moduleCode) {
    codes = [moduleCode.trim().toUpperCase()];
  }

  try {
    const graph = await getMergedTree(codes);
    const normalised = normaliseNodes(graph);
    if (!checkGraph(normalised, codes)) {
      console.log("invalid graph")
    }
    return NextResponse.json(normalised);
  } catch (err) {
    console.error("exportGraph error:", err);
    return NextResponse.json(
      { error: "Failed to build merged graph" },
      { status: 500 },
    );
  }
}
