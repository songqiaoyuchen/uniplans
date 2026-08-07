import { NextRequest, NextResponse } from 'next/server';

import { getModuleSummaries } from '@/db/getModuleSummaries';
import type { MiniModuleData } from '@/types/plannerTypes';
import type { ErrorResponse } from '@/types/errorTypes';

const MAX_SUMMARY_CODES = 500;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<MiniModuleData[] | ErrorResponse>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isSummaryRequest(body)) {
    return NextResponse.json(
      { error: `codes must be an array of at most ${MAX_SUMMARY_CODES} module codes` },
      { status: 400 },
    );
  }

  const codes = [
    ...new Set(body.codes.map((code) => code.trim().toUpperCase()).filter(Boolean)),
  ];

  return NextResponse.json(getModuleSummaries(codes));
}

function isSummaryRequest(body: unknown): body is { codes: string[] } {
  if (!body || typeof body !== 'object' || !('codes' in body)) return false;

  const { codes } = body as { codes?: unknown };
  return (
    Array.isArray(codes) &&
    codes.length <= MAX_SUMMARY_CODES &&
    codes.every((code) => typeof code === 'string')
  );
}
