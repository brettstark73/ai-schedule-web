import { describe, it, expect } from 'vitest';
import { POST } from '../parse/route';
import { NextRequest } from 'next/server';

const testYAML = `
project:
  name: Test
  id: TEST
  updated: 2025-01-08
  start_date: 2025-01-15

calendar:
  working_days: [Mon, Tue, Wed, Thu, Fri]
  holidays: []
  duration_unit: working_days

phases:
  - id: PHASE1
    name: Phase 1
    workstreams:
      - id: WS1
        name: Workstream 1
        tasks:
          - id: SW_IMPL
            name: Software Implementation
            duration: 45
            progress: 50
`;

describe('Parse API', () => {
  it('should parse NL command successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/parse', {
      method: 'POST',
      body: JSON.stringify({
        command: 'SW_IMPL is 75%',
        yamlContent: testYAML
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.parsed.intent).toBe('set_progress');
    expect(json.parsed.task_id).toBe('SW_IMPL');
    expect(json.diffs).toBeDefined();
  });

  it('should return confidence score', async () => {
    const request = new NextRequest('http://localhost:3000/api/parse', {
      method: 'POST',
      body: JSON.stringify({
        command: 'SW_IMPL is 75%',
        yamlContent: testYAML
      })
    });

    const response = await POST(request);
    const json = await response.json();

    expect(json.confidence).toBeGreaterThan(0.9);
  });

  it('should validate required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/parse', {
      method: 'POST',
      body: JSON.stringify({ command: 'test' })
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('required');
  });

  it('should handle parsing errors', async () => {
    const request = new NextRequest('http://localhost:3000/api/parse', {
      method: 'POST',
      body: JSON.stringify({
        command: 'test',
        yamlContent: 'invalid yaml: [[[}'
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
