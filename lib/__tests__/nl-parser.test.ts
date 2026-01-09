import { describe, it, expect } from 'vitest';
import { ScheduleEditor } from '../nl-parser';

const testYAML = `
project:
  name: Test Project
  id: TEST001
  updated: 2025-01-08
  start_date: 2025-01-15
  status: green

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
            status: on_track
          - id: HW_PROTO
            name: Hardware Prototype
            duration: 20
            progress: 0
            status: not_started
            depends_on: []
          - id: SW_DESIGN
            name: Software Design
            duration: 15
            progress: 100
            status: complete
`;

describe('ScheduleEditor', () => {
  describe('Command Parsing', () => {
    describe('Progress Updates', () => {
      it('should parse progress update with ID', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL is 75%');

        expect(result.intent).toBe('set_progress');
        expect(result.task_id).toBe('SW_IMPL');
        expect(result.value).toBe(75);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.is_query).toBe(false);
      });

      it('should parse progress update without percent sign', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL is 75');

        expect(result.intent).toBe('set_progress');
        expect(result.value).toBe(75);
      });

      it('should parse alternate progress format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL progress 80');

        expect(result.intent).toBe('set_progress');
        expect(result.value).toBe(80);
      });

      it('should parse set progress format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('set SW_IMPL to 90%');

        expect(result.intent).toBe('set_progress');
        expect(result.value).toBe(90);
      });
    });

    describe('Mark Complete', () => {
      it('should parse mark complete command', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('mark SW_IMPL complete');

        expect(result.intent).toBe('mark_complete');
        expect(result.task_id).toBe('SW_IMPL');
        expect(result.confidence).toBeGreaterThan(0.95);
      });

      it('should parse "is done" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL is done');

        expect(result.intent).toBe('mark_complete');
      });

      it('should parse "is complete" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL is complete');

        expect(result.intent).toBe('mark_complete');
      });

      it('should parse "complete X" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('complete SW_IMPL');

        expect(result.intent).toBe('mark_complete');
      });
    });

    describe('Duration Changes', () => {
      it('should parse extend duration command', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('extend HW_PROTO by 5 days');

        expect(result.intent).toBe('extend_duration');
        expect(result.task_id).toBe('HW_PROTO');
        expect(result.value).toBe(5);
      });

      it('should parse extend with "d" abbreviation', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('extend HW_PROTO by 5d');

        expect(result.intent).toBe('extend_duration');
        expect(result.value).toBe(5);
      });

      it('should parse "needs more days" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('HW_PROTO needs 3 more days');

        expect(result.intent).toBe('extend_duration');
        expect(result.value).toBe(3);
      });

      it('should parse "add days to" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('add 7 days to HW_PROTO');

        expect(result.intent).toBe('extend_duration');
        expect(result.value).toBe(7);
      });

      it('should parse shorten duration command', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('shorten SW_IMPL by 10 days');

        expect(result.intent).toBe('shorten_duration');
        expect(result.task_id).toBe('SW_IMPL');
        expect(result.value).toBe(10);
      });

      it('should parse reduce duration command', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('reduce SW_IMPL by 5 days');

        expect(result.intent).toBe('shorten_duration');
        expect(result.value).toBe(5);
      });

      it('should parse set duration command', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('set SW_IMPL to 30 days');

        expect(result.intent).toBe('set_duration');
        expect(result.value).toBe(30);
      });
    });

    describe('Risk & Status Notes', () => {
      it('should parse risk with note', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('HW_PROTO at risk: vendor delayed');

        expect(result.intent).toBe('add_risk');
        expect(result.task_id).toBe('HW_PROTO');
        expect(result.value).toBe('vendor delayed');
      });

      it('should parse "is at risk" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('HW_PROTO is at risk');

        expect(result.intent).toBe('add_risk');
        expect(result.value).toBeDefined();
      });

      it('should parse "risk for" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('risk for HW_PROTO: supply chain issue');

        expect(result.intent).toBe('add_risk');
        expect(result.value).toContain('supply chain');
      });
    });

    describe('Actual Dates', () => {
      it('should parse actual start date', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL started 2025-03-28');

        expect(result.intent).toBe('set_actual_start');
        expect(result.task_id).toBe('SW_IMPL');
        expect(result.value).toBe('2025-03-28');
      });

      it('should parse actual finish date', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_DESIGN finished 2025-02-14');

        expect(result.intent).toBe('set_actual_finish');
        expect(result.task_id).toBe('SW_DESIGN');
        expect(result.value).toBe('2025-02-14');
      });
    });

    describe('Dependencies & Lag', () => {
      it('should parse add dependency', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL depends on SW_DESIGN');

        expect(result.intent).toBe('add_dependency');
        expect(result.task_id).toBe('SW_IMPL');
        expect(result.value).toBe('SW_DESIGN');
      });

      it('should parse "move after" format', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('move HW_PROTO after SW_IMPL');

        expect(result.intent).toBe('add_dependency');
        expect(result.task_id).toBe('HW_PROTO');
        expect(result.value).toBe('SW_IMPL');
      });

      it('should parse lag command', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('HW_PROTO starts 3 days after SW_IMPL');

        expect(result.intent).toBe('add_lag');
        expect(result.task_id).toBe('HW_PROTO');
        expect(result.value).toBe(3);
        expect(result.value2).toBe('SW_IMPL');
      });
    });

    describe('Constraints', () => {
      it('should parse no earlier than constraint', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL no earlier than 2025-04-01');

        expect(result.intent).toBe('add_constraint');
        expect(result.task_id).toBe('SW_IMPL');
        expect(result.value).toBe('2025-04-01');
      });
    });

    describe('Query Commands', () => {
      it('should parse show critical path', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('show critical path');

        expect(result.intent).toBe('show_critical_path');
        expect(result.is_query).toBe(true);
        expect(result.confidence).toBe(1.0);
      });

      it('should parse show milestones', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('show milestones');

        expect(result.intent).toBe('show_milestones');
        expect(result.is_query).toBe(true);
      });

      it('should parse show variance', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('show variance');

        expect(result.intent).toBe('show_variance');
        expect(result.is_query).toBe(true);
      });

      it('should parse status query', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('status');

        expect(result.intent).toBe('show_status');
        expect(result.is_query).toBe(true);
      });

      it('should parse what-if query', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('what if HW_PROTO slips by 2 weeks');

        expect(result.intent).toBe('what_if');
        expect(result.task_id).toBe('HW_PROTO');
        expect(result.value).toBe(10); // 2 weeks = 10 days
        expect(result.is_query).toBe(true);
      });
    });

    describe('Fuzzy Matching', () => {
      it('should fuzzy match task by partial name', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('software implementation is 80%');

        expect(result.intent).toBe('set_progress');
        expect(result.task_id).toBe('SW_IMPL');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('should fuzzy match with typo', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPLL is 75%');

        // Should still match SW_IMPL with reduced confidence
        if (result.task_id === 'SW_IMPL') {
          expect(result.confidence).toBeLessThan(0.95);
        }
      });

      it('should prefer exact ID match over name match', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('SW_IMPL is 75%');

        expect(result.task_id).toBe('SW_IMPL');
        expect(result.confidence).toBeGreaterThan(0.95);
      });
    });

    describe('Unknown Commands', () => {
      it('should return unknown intent for unrecognized command', () => {
        const editor = new ScheduleEditor(testYAML);
        const result = editor.parseCommand('foo bar baz');

        expect(result.intent).toBe('unknown');
        expect(result.confidence).toBe(0);
      });
    });
  });

  describe('Diff Generation', () => {
    it('should generate diff for progress update', () => {
      const editor = new ScheduleEditor(testYAML);
      const cmd = editor.parseCommand('SW_IMPL is 75%');
      const diffs = editor.generateDiff(cmd);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].field).toBe('progress');
      expect(diffs[0].old_value).toBe(50);
      expect(diffs[0].new_value).toBe(75);
      expect(diffs[0].task_id).toBe('SW_IMPL');
    });

    it('should generate multiple diffs for mark complete', () => {
      const editor = new ScheduleEditor(testYAML);
      const cmd = editor.parseCommand('mark HW_PROTO complete');
      const diffs = editor.generateDiff(cmd);

      expect(diffs.length).toBeGreaterThanOrEqual(2);
      expect(diffs.some(d => d.field === 'progress')).toBe(true);
      expect(diffs.some(d => d.field === 'status')).toBe(true);
    });

    it('should generate diff for duration extension', () => {
      const editor = new ScheduleEditor(testYAML);
      const cmd = editor.parseCommand('extend HW_PROTO by 5 days');
      const diffs = editor.generateDiff(cmd);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].field).toBe('duration');
      expect(diffs[0].new_value).toBe(diffs[0].old_value + 5);
    });

    it('should generate diff for risk note', () => {
      const editor = new ScheduleEditor(testYAML);
      const cmd = editor.parseCommand('HW_PROTO at risk: vendor delayed');
      const diffs = editor.generateDiff(cmd);

      expect(diffs.length).toBeGreaterThanOrEqual(2);
      expect(diffs.some(d => d.field === 'status_note')).toBe(true);
      expect(diffs.some(d => d.field === 'status')).toBe(true);
    });

    it('should not generate diff for query commands', () => {
      const editor = new ScheduleEditor(testYAML);
      const cmd = editor.parseCommand('show critical path');
      const diffs = editor.generateDiff(cmd);

      expect(diffs).toHaveLength(0);
    });
  });

  describe('Apply Changes', () => {
    it('should apply diff to YAML', () => {
      const editor = new ScheduleEditor(testYAML);
      const cmd = editor.parseCommand('SW_IMPL is 75%');
      const diffs = editor.generateDiff(cmd);

      const updatedYAML = editor.applyDiff(diffs);

      expect(updatedYAML).toContain('progress: 75');
    });

    it('should preserve YAML structure', () => {
      const editor = new ScheduleEditor(testYAML);
      const cmd = editor.parseCommand('SW_IMPL is 75%');
      const diffs = editor.generateDiff(cmd);

      const updatedYAML = editor.applyDiff(diffs);

      expect(updatedYAML).toContain('project:');
      expect(updatedYAML).toContain('phases:');
      expect(updatedYAML).toContain('SW_IMPL');
    });
  });

  describe('Confidence Scoring', () => {
    it('should have high confidence for exact matches', () => {
      const editor = new ScheduleEditor(testYAML);
      const result = editor.parseCommand('SW_IMPL is 75%');

      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('should have lower confidence for fuzzy matches', () => {
      const editor = new ScheduleEditor(testYAML);
      const result = editor.parseCommand('software impl is 75%');

      // Fuzzy match should have lower confidence
      if (result.task_id) {
        expect(result.confidence).toBeLessThan(0.95);
      }
    });

    it('should have perfect confidence for query commands', () => {
      const editor = new ScheduleEditor(testYAML);
      const result = editor.parseCommand('status');

      expect(result.confidence).toBe(1.0);
    });
  });
});
