import { NextRequest, NextResponse } from 'next/server';
import { getNeo4jDriver } from '@/db/neo4j';

export async function GET(request: NextRequest) {
  try {
    const driver = getNeo4jDriver();
    const session = driver.session();

    // Simple query to keep the connection alive
    const result = await session.run('MATCH (m:Module) RETURN COUNT(m) as moduleCount');
    const moduleCount = result.records[0]?.get('moduleCount').toNumber() || 0;

    await session.close();

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
