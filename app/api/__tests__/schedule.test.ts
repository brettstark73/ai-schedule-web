import { describe, it, expect, vi } from 'vitest';
import { GET, POST } from '../schedule/route';
import { NextRequest } from 'next/server';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn()
  },
  readFile: vi.fn()
}));

describe('Schedule API', () => {
  describe('GET /api/schedule', () => {
    it('should return YAML content', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue('project:\n  name: Test\n');

      const request = new NextRequest('http://localhost:3000/api/schedule');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('project:');
    });

    it('should handle file parameter', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue('project:\n  name: Custom\n');

      const request = new NextRequest('http://localhost:3000/api/schedule?file=custom.yaml');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle file not found error', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      const request = new NextRequest('http://localhost:3000/api/schedule');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBeDefined();
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
  });
});
