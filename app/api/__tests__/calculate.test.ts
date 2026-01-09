import { describe, it, expect } from 'vitest';
import { POST } from '../calculate/route';
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
          - id: TASK1
            name: Task 1
            duration: 5
          - id: TASK2
            name: Task 2
            duration: 10
            depends_on: [TASK1]
`;

describe('Calculate API', () => {
  it('should calculate schedule successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({
        yamlContent: testYAML
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toBeDefined();
  });

  it('should respect level parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({
        yamlContent: testYAML,
        level: 1
      })
    });

    const response = await POST(request);
    const text = await response.text();
    const parsed = JSON.parse(text);

    // Level 1 should only include phases
    expect(parsed.tasks.every((t: any) => t.level === 1)).toBe(true);
  });

  it('should validate required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('required');
  });

  it('should handle invalid YAML', async () => {
    const request = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({
        yamlContent: 'invalid: [[[}'
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
