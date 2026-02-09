import { NextRequest, NextResponse } from 'next/server';
import { getMergedTree } from '@/db/getMergedTree';
import { normaliseNodes } from '@/utils/graph/normaliseNodes';
import { runScheduler } from '@/utils/graph/algo/schedule';
import { ErrorResponse } from '@/types/errorTypes';
import { TimetableData } from '@/types/graphTypes';

export async function POST(request: NextRequest): Promise<NextResponse<TimetableData | ErrorResponse>> {
  try {
    const body = await request.json();
    const { 
      required: requiredModuleCodes = [], 
      exempted: exemptedModuleCodes = [], 
      specialTerms: useSpecialTerms = false, 
      maxMcs: maxMcsPerSemester = 20,
      preservedTimetable = {} 
    } = body;

    if (requiredModuleCodes.length === 0) {
      return NextResponse.json(
        { error: 'No target modules specified' },
        { status: 400 }
      );
    }

    console.log('=== START OF REPORT ===')
    console.log('📚 Generating timetable for:', {
      required: requiredModuleCodes,
      exempted: exemptedModuleCodes,
      maxMcs: maxMcsPerSemester,
      preservedSemestersCount: Object.keys(preservedTimetable).length
    });

    // Build the dependency graph for the required modules
    const rawGraph = await getMergedTree(requiredModuleCodes);
    const normalisedGraph = normaliseNodes(rawGraph);

    // Run the scheduler
    const timetable = runScheduler(
      normalisedGraph,
      requiredModuleCodes,
      exemptedModuleCodes,
      useSpecialTerms,
      maxMcsPerSemester,
      preservedTimetable
    );

    console.log('✅ Timetable generated:', timetable);

    return NextResponse.json(timetable);
  } catch (error) {
    console.error('❌ Failed to generate timetable:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate timetable' },
      { status: 500 }
    );
  }
}
