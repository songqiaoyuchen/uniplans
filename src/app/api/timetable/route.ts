import { NextRequest, NextResponse } from 'next/server';
import { getMergedTree } from '@/db/getMergedTree';
import { normaliseNodes } from '@/utils/graph/normaliseNodes';
import { runScheduler } from '@/utils/graph/algo/schedule';
import { ErrorResponse } from '@/types/errorTypes';
import { TimetableGenerationResult } from '@/types/graphTypes';
import { validateTimetableRequest } from '@/utils/planner/validateTimetableRequest';
import { resolvePrerequisiteConditions } from '@/utils/graph/resolvePrerequisiteConditions';
import { GraphDataError } from '@/db/graphDataError';
import { checkGraph } from '@/utils/graph/checkGraph';

export async function POST(request: NextRequest): Promise<NextResponse<TimetableGenerationResult | ErrorResponse>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateTimetableRequest(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const {
    requiredModuleCodes,
    exemptedModuleCodes,
    useSpecialTerms,
    maxMcsPerSemester,
    preservedTimetable,
    studentContext,
  } = validation.data;

  try {
    console.log('=== START OF REPORT ===')
    console.log('📚 Generating timetable for:', {
      required: requiredModuleCodes,
      exempted: exemptedModuleCodes,
      maxMcs: maxMcsPerSemester,
      preservedSemestersCount: Object.keys(preservedTimetable).length
    });

    // Build the dependency graph for the required modules
    const rawGraph = await getMergedTree(requiredModuleCodes);
    const resolvedGraph = resolvePrerequisiteConditions(rawGraph, studentContext, requiredModuleCodes);
    const normalisedGraph = normaliseNodes(resolvedGraph);
    if (!checkGraph(normalisedGraph, requiredModuleCodes)) throw new GraphDataError('Prerequisite graph failed integrity checks');

    // Run the scheduler
    const result = runScheduler(
      normalisedGraph,
      requiredModuleCodes,
      exemptedModuleCodes,
      useSpecialTerms,
      maxMcsPerSemester,
      preservedTimetable
    );

    if (result.isValid) {
      console.log('Timetable generated and validated');
    } else {
      console.warn('Scheduler returned an invalid proposal', {
        validationErrors: result.validation.errors.length,
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GraphDataError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('❌ Failed to generate timetable:', error);
    return NextResponse.json(
      { error: 'Failed to generate timetable' },
      { status: 500 }
    );
  }
}
