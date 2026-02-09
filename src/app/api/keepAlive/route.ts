import { NextResponse } from 'next/server';
import { getNeo4jDriver } from '@/db/neo4j';
import { supabaseServer } from '@/services/supabase';

async function keepNeo4jAlive() {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    // Simple query to keep Neo4j connection alive
    const result = await session.run('MATCH (m:Module) RETURN COUNT(m) as moduleCount');
    return result.records[0]?.get('moduleCount').toNumber() || 0;
  } finally {
    await session.close();
  }
}

async function keepSupabaseAlive() {
  // Simple query to keep Supabase connection alive
  const { error } = await supabaseServer
    .from('timetable_snapshots')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }
}

export async function GET() {
  try {
    const [moduleCount] = await Promise.all([
      keepNeo4jAlive(),
      keepSupabaseAlive(),
    ]);

    return NextResponse.json({
      status: 'ok',
      moduleCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ KeepAlive query failed:', error);
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}
