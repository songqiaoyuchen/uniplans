// app/api/module/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getModuleByCode } from '@/db/getModuleByCode';
import type { ModuleData } from '@/types/plannerTypes';
import type { ErrorResponse } from '@/types/errorTypes';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse<ModuleData | ErrorResponse>> {
  const { code } = await params
  const moduleCode = code.toUpperCase()

  if (!moduleCode) {
    return NextResponse.json({ error: 'Missing module code' }, { status: 400 });
  }

  try {
    const mod = await getModuleByCode(moduleCode);
    if (!mod) {
      return NextResponse.json(
        { error: `Module with code ${moduleCode} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(mod, { status: 200 });
  } catch (err) {
    console.error('getModule error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch module' },
      { status: 500 }
    );
  }
}
