import { NextRequest, NextResponse } from 'next/server';
import { HierarchicalSchedule } from '@/lib/schedule-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yamlContent, level = 3 } = body;

    if (!yamlContent) {
      return NextResponse.json(
        { error: 'YAML content is required' },
        { status: 400 }
      );
    }

    const schedule = new HierarchicalSchedule(yamlContent);
    const json = schedule.toJSON(level);

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate schedule' },
      { status: 500 }
    );
  }
}
