import { describe, it, expect } from 'vitest';
import {
  Calendar,
  DurationUnit,
  HierarchicalSchedule,
  TaskStatus,
  ProjectStatus,
  ValidationError
} from '../schedule-engine';
import { parse } from 'date-fns';

// Test YAML for various scenarios
const basicYAML = `
project:
  name: Test Project
  id: TEST001
  updated: 2025-01-08
  start_date: 2025-01-15
  status: green
  status_summary: On track

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

const complexYAML = `
project:
  name: Complex Project
  id: COMPLEX001
  updated: 2025-01-08
  start_date: 2025-01-15
  status: yellow

calendar:
  working_days: [Mon, Tue, Wed, Thu, Fri]
  holidays:
    - 2025-02-14
    - 2025-02-17
  duration_unit: working_days

baseline:
  captured_on: 2025-01-15
  tasks:
    TASK_A:
      start: 2025-01-15
      finish: 2025-01-22
    TASK_B:
      start: 2025-01-23
      finish: 2025-02-05

phases:
  - id: PHASE1
    name: Phase 1
    workstreams:
      - id: WS1
        name: Workstream 1
        tasks:
          - id: TASK_A
            name: Task A
            duration: 5
            progress: 100
            status: complete
            actual_start: 2025-01-15
            actual_finish: 2025-01-22
          - id: TASK_B
            name: Task B
            duration: 10
            depends_on:
              - id: TASK_A
                lag: 2
            progress: 60
            status: on_track
          - id: TASK_C
            name: Task C
            duration: 0
            depends_on: [TASK_B]
            constraint:
              type: no_earlier_than
              date: 2025-03-01
              reason: External dependency
            milestone: true
`;

describe('Calendar', () => {
  describe('Working Days Calculation', () => {
    it('should identify working days correctly', () => {
      const cal = new Calendar(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      const monday = parse('2025-01-20', 'yyyy-MM-dd', new Date());
      const saturday = parse('2025-01-25', 'yyyy-MM-dd', new Date());

      expect(cal.isWorkingDay(monday)).toBe(true);
      expect(cal.isWorkingDay(saturday)).toBe(false);
    });

    it('should exclude holidays from working days', () => {
      const holiday = parse('2025-02-14', 'yyyy-MM-dd', new Date());
      const cal = new Calendar(
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        [holiday]
      );

      expect(cal.isWorkingDay(holiday)).toBe(false);
    });

    it('should add working days correctly', () => {
      const cal = new Calendar(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      const start = parse('2025-01-15', 'yyyy-MM-dd', new Date()); // Wednesday
      const result = cal.addWorkingDays(start, 5);

      // 5 working days from Wed = next Wed (skip weekend)
      expect(result.toISOString().split('T')[0]).toBe('2025-01-22');
    });

    it('should add working days skipping holidays', () => {
      const holiday = parse('2025-01-17', 'yyyy-MM-dd', new Date()); // Friday
      const cal = new Calendar(
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        [holiday]
      );
      const start = parse('2025-01-15', 'yyyy-MM-dd', new Date()); // Wednesday
      const result = cal.addWorkingDays(start, 3);

      // Wed + 3 working days (skip Fri holiday, skip weekend) = Tue
      expect(result.toISOString().split('T')[0]).toBe('2025-01-21');
    });

    it('should count working days between dates', () => {
      const cal = new Calendar(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      const start = parse('2025-01-15', 'yyyy-MM-dd', new Date()); // Wednesday
      const end = parse('2025-01-22', 'yyyy-MM-dd', new Date()); // Next Wednesday

      const count = cal.workingDaysBetween(start, end);
      expect(count).toBe(5); // Wed, Thu, Fri, Mon, Tue (skip weekend)
    });

    it('should use calendar days when configured', () => {
      const cal = new Calendar(
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        [],
        DurationUnit.CALENDAR_DAYS
      );
      const start = parse('2025-01-15', 'yyyy-MM-dd', new Date());
      const result = cal.addWorkingDays(start, 5);

      // 5 calendar days = straight addition
      expect(result.toISOString().split('T')[0]).toBe('2025-01-20');
    });
  });
});

describe('HierarchicalSchedule', () => {
  describe('Basic Loading', () => {
    it('should load project metadata', () => {
      const schedule = new HierarchicalSchedule(basicYAML);

      expect(schedule.project_name).toBe('Test Project');
      expect(schedule.project_id).toBe('TEST001');
      expect(schedule.project_status).toBe(ProjectStatus.GREEN);
    });

    it('should load calendar configuration', () => {
      const schedule = new HierarchicalSchedule(basicYAML);

      expect(schedule.calendar.working_days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      expect(schedule.calendar.duration_unit).toBe(DurationUnit.WORKING_DAYS);
    });

    it('should create hierarchical task structure', () => {
      const schedule = new HierarchicalSchedule(basicYAML);

      expect(schedule.tasks.size).toBe(4); // 1 phase + 1 workstream + 2 tasks
      expect(schedule.phases).toContain('PHASE1');
      expect(schedule.workstreams).toContain('WS1');
    });

    it('should set correct task levels', () => {
      const schedule = new HierarchicalSchedule(basicYAML);

      expect(schedule.tasks.get('PHASE1')?.level).toBe(1);
      expect(schedule.tasks.get('WS1')?.level).toBe(2);
      expect(schedule.tasks.get('TASK1')?.level).toBe(3);
    });
  });

  describe('Dependencies', () => {
    it('should parse task dependencies', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const task2 = schedule.tasks.get('TASK2');

      expect(task2?.dependencies).toHaveLength(1);
      expect(task2?.dependencies[0].task_id).toBe('TASK1');
    });

    it('should parse dependencies with lag', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskB = schedule.tasks.get('TASK_B');

      expect(taskB?.dependencies).toHaveLength(1);
      expect(taskB?.dependencies[0].task_id).toBe('TASK_A');
      expect(taskB?.dependencies[0].lag).toBe(2);
    });

    it('should build successor relationships', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const task1 = schedule.tasks.get('TASK1');

      expect(task1?.successors).toContain('TASK2');
    });
  });

  describe('Date Calculations', () => {
    it('should calculate task start dates from project start', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const task1 = schedule.tasks.get('TASK1');

      expect(task1?.start_date).toBeDefined();
      expect(task1?.start_date?.toISOString().split('T')[0]).toBe('2025-01-15');
    });

    it('should calculate task end dates from duration', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const task1 = schedule.tasks.get('TASK1');

      expect(task1?.end_date).toBeDefined();
      // 5 working days from Wed Jan 15 = Wed Jan 22
      expect(task1?.end_date?.toISOString().split('T')[0]).toBe('2025-01-22');
    });

    it('should calculate dependent task start from predecessor end', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const task1 = schedule.tasks.get('TASK1');
      const task2 = schedule.tasks.get('TASK2');

      expect(task2?.start_date?.toISOString().split('T')[0]).toBe(
        task1?.end_date?.toISOString().split('T')[0]
      );
    });

    it('should apply lag to dependency calculations', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskA = schedule.tasks.get('TASK_A');
      const taskB = schedule.tasks.get('TASK_B');

      // Task B starts 2 working days after Task A ends
      const expectedStart = schedule.calendar.addWorkingDays(taskA!.end_date!, 2);
      expect(taskB?.start_date?.toISOString().split('T')[0]).toBe(
        expectedStart.toISOString().split('T')[0]
      );
    });

    it('should respect actual dates when set', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskA = schedule.tasks.get('TASK_A');

      expect(taskA?.actual_start?.toISOString().split('T')[0]).toBe('2025-01-15');
      expect(taskA?.actual_finish?.toISOString().split('T')[0]).toBe('2025-01-22');
      expect(taskA?.end_date?.toISOString().split('T')[0]).toBe('2025-01-22');
    });

    it('should enforce constraints', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskC = schedule.tasks.get('TASK_C');

      // Task C has constraint no_earlier_than 2025-03-01
      expect(taskC?.constraint?.type).toBe('no_earlier_than');
      expect(taskC?.start_date!.toISOString().split('T')[0] >= '2025-03-01').toBe(true);
    });
  });

  describe('Progress & Status', () => {
    it('should track task progress', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskA = schedule.tasks.get('TASK_A');
      const taskB = schedule.tasks.get('TASK_B');

      expect(taskA?.progress).toBe(100);
      expect(taskB?.progress).toBe(60);
    });

    it('should track task status', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskA = schedule.tasks.get('TASK_A');
      const taskB = schedule.tasks.get('TASK_B');

      expect(taskA?.status).toBe(TaskStatus.COMPLETE);
      expect(taskB?.status).toBe(TaskStatus.ON_TRACK);
    });

    it('should identify milestones', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskC = schedule.tasks.get('TASK_C');

      expect(taskC?.milestone).toBe(true);
    });
  });

  describe('Rollup Calculations', () => {
    it('should rollup workstream dates from tasks', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const ws = schedule.tasks.get('WS1');
      const task1 = schedule.tasks.get('TASK1');
      const task2 = schedule.tasks.get('TASK2');

      expect(ws?.start_date).toEqual(task1?.start_date);
      expect(ws?.end_date).toEqual(task2?.end_date);
    });

    it('should rollup phase dates from workstreams', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const phase = schedule.tasks.get('PHASE1');
      const ws = schedule.tasks.get('WS1');

      expect(phase?.start_date).toEqual(ws?.start_date);
      expect(phase?.end_date).toEqual(ws?.end_date);
    });

    it('should rollup progress weighted by duration', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const ws = schedule.tasks.get('WS1');

      // Task A: 5 days @ 100% = 500
      // Task B: 10 days @ 60% = 600
      // Task C: 0 days (milestone) @ 0% = excluded
      // Total: 1100 / 15 days = 73.3%
      expect(ws?.progress).toBeCloseTo(73, 0);
    });

    it('should rollup worst-case status', () => {
      const yamlWithRisk = `
project:
  name: Test
  id: TEST
  updated: 2025-01-08
  start_date: 2025-01-15
  status: yellow

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
          - id: T1
            name: Task 1
            duration: 5
            status: complete
          - id: T2
            name: Task 2
            duration: 5
            status: at_risk
      `;

      const schedule = new HierarchicalSchedule(yamlWithRisk);
      const ws = schedule.tasks.get('WS1');

      // Worst case = at_risk
      expect(ws?.status).toBe(TaskStatus.AT_RISK);
    });
  });

  describe('Critical Path', () => {
    it('should calculate task float', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const task1 = schedule.tasks.get('TASK1');

      expect(task1?.float_days).toBeDefined();
    });

    it('should identify critical path tasks (zero float)', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const criticalTasks = Array.from(schedule.tasks.values()).filter(
        t => t.is_critical && t.level === 3
      );

      expect(criticalTasks.length).toBeGreaterThan(0);
    });

    it('should mark tasks on longest path as critical', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const task2 = schedule.tasks.get('TASK2');

      // TASK2 is on the longest path (depends on TASK1)
      expect(task2?.is_critical).toBe(true);
    });
  });

  describe('Baseline Variance', () => {
    it('should load baseline data', () => {
      const schedule = new HierarchicalSchedule(complexYAML);

      expect(schedule.baseline_captured_on).toBeDefined();
    });

    it('should attach baseline to tasks', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskA = schedule.tasks.get('TASK_A');

      expect(taskA?.baseline).toBeDefined();
      expect(taskA?.baseline?.start.toISOString().split('T')[0]).toBe('2025-01-15');
      expect(taskA?.baseline?.finish.toISOString().split('T')[0]).toBe('2025-01-22');
    });

    it('should calculate variance from baseline', () => {
      const schedule = new HierarchicalSchedule(complexYAML);
      const taskA = schedule.tasks.get('TASK_A');

      const variance = schedule.getVariance(taskA!);
      expect(variance).toBe(0); // Actual = baseline
    });
  });

  describe('Validation', () => {
    it('should detect circular dependencies', () => {
      const circularYAML = `
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
            depends_on: [TASK2]
          - id: TASK2
            name: Task 2
            duration: 5
            depends_on: [TASK1]
      `;

      expect(() => new HierarchicalSchedule(circularYAML)).toThrow(ValidationError);
    });

    it('should detect invalid dependency references', () => {
      const invalidDepYAML = `
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
            depends_on: [NONEXISTENT]
      `;

      expect(() => new HierarchicalSchedule(invalidDepYAML)).toThrow(ValidationError);
    });

    it('should validate milestone duration is zero', () => {
      const invalidMilestoneYAML = `
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
            milestone: true
      `;

      expect(() => new HierarchicalSchedule(invalidMilestoneYAML)).toThrow(ValidationError);
    });

    it('should validate progress is 0-100', () => {
      const invalidProgressYAML = `
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
            progress: 150
      `;

      expect(() => new HierarchicalSchedule(invalidProgressYAML)).toThrow(ValidationError);
    });
  });

  describe('Export', () => {
    it('should export to JSON', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const json = schedule.toJSON(3);

      expect(json).toBeTruthy();
      const data = JSON.parse(json);
      expect(data.project.name).toBe('Test Project');
      expect(data.tasks).toBeInstanceOf(Array);
    });

    it('should filter by level when exporting', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const jsonL1 = JSON.parse(schedule.toJSON(1));
      const jsonL2 = JSON.parse(schedule.toJSON(2));
      const jsonL3 = JSON.parse(schedule.toJSON(3));

      expect(jsonL1.tasks.length).toBe(1); // Only phases
      expect(jsonL2.tasks.length).toBe(2); // Phases + workstreams
      expect(jsonL3.tasks.length).toBe(4); // All
    });

    it('should get project dates', () => {
      const schedule = new HierarchicalSchedule(basicYAML);
      const { start, end, duration } = schedule.getProjectDates();

      expect(start).toBeDefined();
      expect(end).toBeDefined();
      expect(duration).toBeGreaterThan(0);
    });
  });
});
