import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../schedule/route';

describe('Schedule API', () => {
  describe('GET /api/schedule', () => {
    it('should return YAML content from default file', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/yaml');
      const text = await response.text();
      expect(text).toContain('project:');
      expect(text).toContain('name:');
    });

    it('should handle file parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule?file=schedule_v4.yaml');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Widget Product Development');
    });

    it('should handle file not found error', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule?file=nonexistent.yaml');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Failed to load schedule file');
    });

    it('should sanitize file path to prevent directory traversal', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule?file=../../../etc/passwd');
      const response = await GET(request);

      // Should fail to find the file outside public directory
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/schedule', () => {
    it('should accept YAML content', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule', {
        method: 'POST',
        body: JSON.stringify({ yamlContent: 'project:\n  name: Test\n' })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('required');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Failed to save schedule');
    });

    it('should handle empty yamlContent', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule', {
        method: 'POST',
        body: JSON.stringify({ yamlContent: '' })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('required');
    });
  });
});
