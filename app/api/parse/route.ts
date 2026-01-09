import { NextRequest, NextResponse } from 'next/server';
import { ScheduleEditor } from '@/lib/nl-parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, yamlContent } = body;

    if (!command || !yamlContent) {
      return NextResponse.json(
        { error: 'Command and YAML content are required' },
        { status: 400 }
      );
    }

    const editor = new ScheduleEditor(yamlContent);
    const parsed = editor.parseCommand(command);
    const diffs = editor.generateDiff(parsed);

    return NextResponse.json({
      parsed,
      diffs,
      confidence: parsed.confidence
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse command' },
      { status: 500 }
    );
  }
}
