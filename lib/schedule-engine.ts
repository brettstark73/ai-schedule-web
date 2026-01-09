/**
 * Hierarchical Schedule Engine - TypeScript Port
 *
 * Enhanced features from SYSTEM_OVERVIEW_v2:
 * - Calendar-aware date calculations (working days, holidays)
 * - Lag support on dependencies
 * - Constraints (no_earlier_than)
 * - Actual dates tracking (actual_start, actual_finish)
 * - Baseline variance tracking
 * - Progress tracking (percent_complete)
 * - Comprehensive validation
 */

import { parse, format, addDays, differenceInDays, isWeekend } from 'date-fns';
import * as yaml from 'js-yaml';

// ============================================================================
// Enums & Constants
// ============================================================================

export enum DurationUnit {
  WORKING_DAYS = 'working_days',
  CALENDAR_DAYS = 'calendar_days'
}

export enum TaskStatus {
  NOT_STARTED = 'not_started',
  ON_TRACK = 'on_track',
  AT_RISK = 'at_risk',
  DELAYED = 'delayed',
  COMPLETE = 'complete'
}

export enum ProjectStatus {
  GREEN = 'green',
  YELLOW = 'yellow',
  RED = 'red'
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0
};

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Dependency {
  task_id: string;
  lag?: number;  // Working days
}

export interface Constraint {
  type: 'no_earlier_than';
  date: Date;
  reason?: string;
}

export interface BaselineTask {
  start: Date;
  finish: Date;
}

export interface Task {
  id: string;
  name: string;
  duration: number;
  level: number;  // 1=Phase, 2=Workstream, 3=Task
  parent_id?: string;
  dependencies: Dependency[];
  successors: string[];
  owner?: string;

  // Calculated dates
  start_date?: Date;
  end_date?: Date;
  late_start?: Date;
  late_finish?: Date;

  // Actuals
  actual_start?: Date;
  actual_finish?: Date;

  // Status
  progress: number;  // 0-100
  status: TaskStatus;
  status_note: string;
  milestone: boolean;

  // Constraint
  constraint?: Constraint;

  // Critical path
  is_critical: boolean;
  float_days: number;

  // Hierarchy
  phase_id?: string;
  workstream_id?: string;

  // Baseline
  baseline?: BaselineTask;
}

export interface YAMLSchedule {
  project: {
    name: string;
    id: string;
    updated: string;
    start_date: string;
    status: ProjectStatus;
    status_summary: string;
  };
  calendar: {
    working_days: string[];
    holidays: string[];
    duration_unit: DurationUnit;
  };
  baseline?: {
    captured_on: string;
    tasks: Record<string, { start: string; finish: string }>;
  };
  phases: Array<{
    id: string;
    name: string;
    workstreams: Array<{
      id: string;
      name: string;
      tasks: Array<any>;
    }>;
  }>;
}

// ============================================================================
// Calendar Class
// ============================================================================

export class Calendar {
  working_days: string[];
  holidays: Date[];
  duration_unit: DurationUnit;

  constructor(
    working_days: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    holidays: Date[] = [],
    duration_unit: DurationUnit = DurationUnit.WORKING_DAYS
  ) {
    this.working_days = working_days;
    this.holidays = holidays;
    this.duration_unit = duration_unit;
  }

  isWorkingDay(dt: Date): boolean {
    // Check if holiday
    if (this.holidays.some(h => h.getTime() === dt.getTime())) {
      return false;
    }

    // Check if working day
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dt.getDay()];
    return this.working_days.includes(dayName);
  }

  addWorkingDays(startDate: Date, days: number): Date {
    if (this.duration_unit === DurationUnit.CALENDAR_DAYS) {
      return addDays(startDate, days);
    }

    let current = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < days) {
      current = addDays(current, 1);
      if (this.isWorkingDay(current)) {
        daysAdded++;
      }
    }

    return current;
  }

  workingDaysBetween(startDate: Date, endDate: Date): number {
    if (this.duration_unit === DurationUnit.CALENDAR_DAYS) {
      return differenceInDays(endDate, startDate);
    }

    let count = 0;
    let current = new Date(startDate);
    while (current < endDate) {
      if (this.isWorkingDay(current)) {
        count++;
      }
      current = addDays(current, 1);
    }
    return count;
  }
}

// ============================================================================
// Validation Error
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// HierarchicalSchedule Class
// ============================================================================

export class HierarchicalSchedule {
  tasks: Map<string, Task> = new Map();
  phases: string[] = [];
  workstreams: string[] = [];
  calendar: Calendar = new Calendar();

  project_name = '';
  project_id = '';
  updated = '';
  project_start = new Date();
  project_status: ProjectStatus = ProjectStatus.GREEN;
  project_status_summary = '';
  baseline_captured_on?: Date;

  constructor(yamlContent: string) {
    this.load(yamlContent);
  }

  private load(yamlContent: string): void {
    const data = yaml.load(yamlContent) as YAMLSchedule;

    // Load project metadata
    const projectData = data.project || {};
    this.project_name = projectData.name || 'Project';
    this.project_id = projectData.id || '';
    this.updated = projectData.updated || new Date().toISOString().split('T')[0];
    this.project_status = projectData.status || ProjectStatus.GREEN;
    this.project_status_summary = projectData.status_summary || '';
    this.project_start = this.parseDate(projectData.start_date || '2025-01-15');

    // Load calendar
    const calData = data.calendar || {};
    this.calendar = new Calendar(
      calData.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      (calData.holidays || []).map(d => this.parseDate(d)),
      (calData.duration_unit as DurationUnit) || DurationUnit.WORKING_DAYS
    );

    // Load baseline
    let baselineTasks: Record<string, { start: string; finish: string }> = {};
    if (data.baseline) {
      this.baseline_captured_on = this.parseDate(data.baseline.captured_on);
      baselineTasks = data.baseline.tasks || {};
    }

    // Parse hierarchy
    this.tasks.clear();
    this.phases = [];
    this.workstreams = [];

    for (const phase of data.phases || []) {
      this.phases.push(phase.id);

      // Create phase task
      const phaseTask: Task = {
        id: phase.id,
        name: phase.name,
        duration: 0,
        level: 1,
        dependencies: [],
        successors: [],
        progress: 0,
        status: TaskStatus.NOT_STARTED,
        status_note: '',
        milestone: false,
        is_critical: false,
        float_days: 0
      };
      this.tasks.set(phase.id, phaseTask);

      // Parse workstreams
      for (const ws of phase.workstreams || []) {
        this.workstreams.push(ws.id);

        const wsTask: Task = {
          id: ws.id,
          name: ws.name,
          duration: 0,
          level: 2,
          parent_id: phase.id,
          phase_id: phase.id,
          dependencies: [],
          successors: [],
          progress: 0,
          status: TaskStatus.NOT_STARTED,
          status_note: '',
          milestone: false,
          is_critical: false,
          float_days: 0
        };
        this.tasks.set(ws.id, wsTask);

        // Parse tasks
        for (const taskData of ws.tasks || []) {
          const task = this.parseTask(taskData, phase.id, ws.id, baselineTasks);
          this.tasks.set(task.id, task);
        }
      }
    }

    // Calculate schedule
    this.validate();
    this.buildSuccessors();
    this.calculateDates();
    this.rollupSummaries();
    this.calculateCriticalPath();
  }

  private parseTask(
    taskData: any,
    phaseId: string,
    wsId: string,
    baselineTasks: Record<string, { start: string; finish: string }>
  ): Task {
    const task: Task = {
      id: taskData.id,
      name: taskData.name,
      duration: taskData.duration || 0,
      level: 3,
      parent_id: wsId,
      phase_id: phaseId,
      workstream_id: wsId,
      dependencies: [],
      successors: [],
      owner: taskData.owner,
      progress: taskData.progress || 0,
      status: (taskData.status as TaskStatus) || TaskStatus.NOT_STARTED,
      status_note: taskData.status_note || '',
      milestone: taskData.milestone || false,
      is_critical: false,
      float_days: 0
    };

    // Parse dependencies with lag
    if (taskData.depends_on) {
      task.dependencies = Array.isArray(taskData.depends_on)
        ? taskData.depends_on.map((dep: any) => ({
            task_id: typeof dep === 'string' ? dep : dep.id,
            lag: typeof dep === 'object' ? dep.lag || 0 : 0
          }))
        : [];
    }

    // Parse actuals
    if (taskData.actual_start) {
      task.actual_start = this.parseDate(taskData.actual_start);
    }
    if (taskData.actual_finish) {
      task.actual_finish = this.parseDate(taskData.actual_finish);
    }

    // Parse constraint
    if (taskData.constraint) {
      task.constraint = {
        type: 'no_earlier_than',
        date: this.parseDate(taskData.constraint.date),
        reason: taskData.constraint.reason
      };
    }

    // Parse explicit start date
    if (taskData.start) {
      task.start_date = this.parseDate(taskData.start);
    }

    // Load baseline
    if (baselineTasks[task.id]) {
      task.baseline = {
        start: this.parseDate(baselineTasks[task.id].start),
        finish: this.parseDate(baselineTasks[task.id].finish)
      };
    }

    return task;
  }

  private parseDate(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (typeof d === 'string') {
      return parse(d, 'yyyy-MM-dd', new Date());
    }
    return new Date(d);
  }

  // ============================================================================
  // Validation
  // ============================================================================

  validate(): void {
    // Check for missing task IDs
    for (const task of this.tasks.values()) {
      if (!task.id) {
        throw new ValidationError(`Task missing ID: ${task.name}`);
      }
    }

    // Check for duplicate task IDs
    const ids = new Set<string>();
    for (const task of this.tasks.values()) {
      if (ids.has(task.id)) {
        throw new ValidationError(`Duplicate task ID: ${task.id}`);
      }
      ids.add(task.id);
    }

    // Check dependencies exist
    for (const task of this.tasks.values()) {
      for (const dep of task.dependencies) {
        if (!this.tasks.has(dep.task_id)) {
          throw new ValidationError(
            `Task ${task.id} depends on non-existent task: ${dep.task_id}`
          );
        }
      }
    }

    // Check for circular dependencies
    this.checkCircularDependencies();

    // Validate milestones have zero duration
    for (const task of this.tasks.values()) {
      if (task.milestone && task.duration !== 0) {
        throw new ValidationError(`Milestone ${task.id} must have duration=0`);
      }
    }

    // Validate progress is 0-100
    for (const task of this.tasks.values()) {
      if (task.progress < 0 || task.progress > 100) {
        throw new ValidationError(`Task ${task.id} progress must be 0-100, got ${task.progress}`);
      }
    }
  }

  private checkCircularDependencies(): void {
    const visit = (taskId: string, visited: Set<string>, stack: string[]): void => {
      if (stack.includes(taskId)) {
        throw new ValidationError(
          `Circular dependency detected: ${stack.join(' → ')} → ${taskId}`
        );
      }

      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = this.tasks.get(taskId);
      if (!task) return;

      stack.push(taskId);
      for (const dep of task.dependencies) {
        visit(dep.task_id, visited, stack);
      }
      stack.pop();
    };

    const visited = new Set<string>();
    for (const taskId of this.tasks.keys()) {
      visit(taskId, visited, []);
    }
  }

  // ============================================================================
  // Build Successors
  // ============================================================================

  private buildSuccessors(): void {
    // Clear existing successors
    for (const task of this.tasks.values()) {
      task.successors = [];
    }

    // Build successor relationships
    for (const task of this.tasks.values()) {
      for (const dep of task.dependencies) {
        const predTask = this.tasks.get(dep.task_id);
        if (predTask) {
          predTask.successors.push(task.id);
        }
      }
    }
  }

  // ============================================================================
  // Calculate Dates (Forward & Backward Pass)
  // ============================================================================

  private calculateDates(): void {
    const visited = new Set<string>();

    const calcTask = (taskId: string): void => {
      if (visited.has(taskId)) return;

      const task = this.tasks.get(taskId);
      if (!task) return;

      // Skip summary tasks (levels 1 & 2) - calculated in rollup
      if (task.level < 3) {
        visited.add(taskId);
        return;
      }

      // If actual_finish is set, use it (task is complete)
      if (task.actual_finish) {
        task.end_date = task.actual_finish;
        task.start_date = task.actual_start || this.addDuration(task.actual_finish, -task.duration);
        visited.add(taskId);
        return;
      }

      // Calculate predecessors first
      for (const dep of task.dependencies) {
        calcTask(dep.task_id);
      }

      // Calculate early start
      let earlyStart = this.project_start;

      // If has actual_start, use it
      if (task.actual_start) {
        earlyStart = task.actual_start;
      }
      // If has explicit start and no dependencies, use it
      else if (task.start_date && task.dependencies.length === 0) {
        earlyStart = task.start_date;
      }
      // Otherwise calculate from predecessors
      else if (task.dependencies.length > 0) {
        let maxPredFinish = new Date(0);
        for (const dep of task.dependencies) {
          const predTask = this.tasks.get(dep.task_id);
          if (predTask?.end_date) {
            let predFinish = this.calendar.addWorkingDays(predTask.end_date, dep.lag || 0);
            if (predFinish > maxPredFinish) {
              maxPredFinish = predFinish;
            }
          }
        }
        if (maxPredFinish.getTime() > 0) {
          earlyStart = maxPredFinish;
        }
      }

      // Apply constraint
      if (task.constraint?.type === 'no_earlier_than') {
        if (earlyStart < task.constraint.date) {
          earlyStart = task.constraint.date;
        }
      }

      task.start_date = earlyStart;

      // Calculate finish based on progress
      if (task.progress === 100) {
        // Complete - use actual or calculated
        task.end_date = task.actual_finish || this.addDuration(earlyStart, task.duration);
      } else if (task.progress > 0 && task.actual_start) {
        // In progress - forecast remaining work
        const elapsedDays = this.calendar.workingDaysBetween(task.actual_start, new Date());
        const remainingDays = Math.ceil((task.duration * (100 - task.progress)) / 100);
        task.end_date = this.calendar.addWorkingDays(new Date(), remainingDays);
      } else {
        // Not started - use duration
        task.end_date = this.addDuration(earlyStart, task.duration);
      }

      visited.add(taskId);
    };

    // Calculate all tasks
    for (const taskId of this.tasks.keys()) {
      calcTask(taskId);
    }
  }

  private addDuration(start: Date, days: number): Date {
    if (days === 0) return start;
    if (days < 0) {
      // Subtract working days (for backward calculation)
      return this.calendar.addWorkingDays(start, days);
    }
    return this.calendar.addWorkingDays(start, days);
  }

  // ============================================================================
  // Rollup Summaries
  // ============================================================================

  private rollupSummaries(): void {
    // Roll up workstream dates from tasks
    for (const wsId of this.workstreams) {
      const ws = this.tasks.get(wsId);
      if (!ws) continue;

      const wsTasks = Array.from(this.tasks.values()).filter(
        t => t.workstream_id === wsId && t.level === 3
      );

      if (wsTasks.length === 0) continue;

      const starts = wsTasks.map(t => t.start_date).filter(Boolean) as Date[];
      const ends = wsTasks.map(t => t.end_date).filter(Boolean) as Date[];

      if (starts.length > 0) {
        ws.start_date = new Date(Math.min(...starts.map(d => d.getTime())));
      }
      if (ends.length > 0) {
        ws.end_date = new Date(Math.max(...ends.map(d => d.getTime())));
      }
      if (ws.start_date && ws.end_date) {
        ws.duration = this.calendar.workingDaysBetween(ws.start_date, ws.end_date);
      }

      // Roll up progress (weighted by duration)
      const totalDuration = wsTasks.reduce((sum, t) => sum + t.duration, 0);
      if (totalDuration > 0) {
        ws.progress = Math.round(
          wsTasks.reduce((sum, t) => sum + t.progress * t.duration, 0) / totalDuration
        );
      }

      // Roll up status (worst case)
      const statusPriority: Record<TaskStatus, number> = {
        [TaskStatus.DELAYED]: 4,
        [TaskStatus.AT_RISK]: 3,
        [TaskStatus.ON_TRACK]: 2,
        [TaskStatus.COMPLETE]: 1,
        [TaskStatus.NOT_STARTED]: 0
      };
      ws.status = wsTasks.reduce(
        (worst: TaskStatus, t) => (statusPriority[t.status] > statusPriority[worst] ? t.status : worst),
        TaskStatus.NOT_STARTED
      );
    }

    // Roll up phase dates from workstreams
    for (const phaseId of this.phases) {
      const phase = this.tasks.get(phaseId);
      if (!phase) continue;

      const phaseWs = Array.from(this.tasks.values()).filter(
        t => t.phase_id === phaseId && t.level === 2
      );

      if (phaseWs.length === 0) continue;

      const starts = phaseWs.map(t => t.start_date).filter(Boolean) as Date[];
      const ends = phaseWs.map(t => t.end_date).filter(Boolean) as Date[];

      if (starts.length > 0) {
        phase.start_date = new Date(Math.min(...starts.map(d => d.getTime())));
      }
      if (ends.length > 0) {
        phase.end_date = new Date(Math.max(...ends.map(d => d.getTime())));
      }
      if (phase.start_date && phase.end_date) {
        phase.duration = this.calendar.workingDaysBetween(phase.start_date, phase.end_date);
      }

      // Roll up progress
      const totalDuration = phaseWs.reduce((sum, t) => sum + t.duration, 0);
      if (totalDuration > 0) {
        phase.progress = Math.round(
          phaseWs.reduce((sum, t) => sum + t.progress * t.duration, 0) / totalDuration
        );
      }

      // Roll up status
      const statusPriority: Record<TaskStatus, number> = {
        [TaskStatus.DELAYED]: 4,
        [TaskStatus.AT_RISK]: 3,
        [TaskStatus.ON_TRACK]: 2,
        [TaskStatus.COMPLETE]: 1,
        [TaskStatus.NOT_STARTED]: 0
      };
      phase.status = phaseWs.reduce(
        (worst: TaskStatus, t) => (statusPriority[t.status] > statusPriority[worst] ? t.status : worst),
        TaskStatus.NOT_STARTED
      );
    }
  }

  // ============================================================================
  // Critical Path (Backward Pass)
  // ============================================================================

  private calculateCriticalPath(): void {
    // Get project end date
    const allEndDates = Array.from(this.tasks.values())
      .filter(t => t.level === 3 && t.end_date)
      .map(t => t.end_date as Date);

    if (allEndDates.length === 0) return;

    const projectEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())));

    // Backward pass - calculate late dates
    const visited = new Set<string>();

    const calcLate = (taskId: string): void => {
      if (visited.has(taskId)) return;

      const task = this.tasks.get(taskId);
      if (!task || task.level < 3) {
        visited.add(taskId);
        return;
      }

      // Calculate successors first
      for (const succId of task.successors) {
        calcLate(succId);
      }

      // Calculate late finish
      let lateFinish = projectEnd;

      if (task.successors.length > 0) {
        let minSuccStart = new Date(projectEnd);
        for (const succId of task.successors) {
          const succ = this.tasks.get(succId);
          if (succ?.late_start) {
            // Find lag for this dependency
            const dep = succ.dependencies.find(d => d.task_id === taskId);
            const lag = dep?.lag || 0;
            const succStart = this.calendar.addWorkingDays(succ.late_start, -lag);
            if (succStart < minSuccStart) {
              minSuccStart = succStart;
            }
          }
        }
        if (minSuccStart.getTime() < projectEnd.getTime()) {
          lateFinish = minSuccStart;
        }
      }

      task.late_finish = lateFinish;
      task.late_start = this.addDuration(lateFinish, -task.duration);

      // Calculate float
      if (task.end_date && task.late_finish) {
        task.float_days = this.calendar.workingDaysBetween(task.end_date, task.late_finish);
        task.is_critical = task.float_days <= 0;
      }

      visited.add(taskId);
    };

    // Calculate for all tasks
    for (const taskId of this.tasks.keys()) {
      calcLate(taskId);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  getVariance(task: Task): number | null {
    if (!task.baseline || !task.end_date) return null;
    return this.calendar.workingDaysBetween(task.baseline.finish, task.end_date);
  }

  getProjectDates(): { start: Date; end: Date; duration: number } {
    const allStartDates = Array.from(this.tasks.values())
      .filter(t => t.level === 1 && t.start_date)
      .map(t => t.start_date as Date);

    const allEndDates = Array.from(this.tasks.values())
      .filter(t => t.level === 1 && t.end_date)
      .map(t => t.end_date as Date);

    const start = allStartDates.length > 0
      ? new Date(Math.min(...allStartDates.map(d => d.getTime())))
      : this.project_start;

    const end = allEndDates.length > 0
      ? new Date(Math.max(...allEndDates.map(d => d.getTime())))
      : this.project_start;

    const duration = this.calendar.workingDaysBetween(start, end);

    return { start, end, duration };
  }

  // ============================================================================
  // Export Methods
  // ============================================================================

  toJSON(level: number = 3): string {
    const tasks = Array.from(this.tasks.values())
      .filter(t => t.level <= level)
      .map(t => ({
        ...t,
        start_date: t.start_date ? format(t.start_date, 'yyyy-MM-dd') : undefined,
        end_date: t.end_date ? format(t.end_date, 'yyyy-MM-dd') : undefined,
        late_start: t.late_start ? format(t.late_start, 'yyyy-MM-dd') : undefined,
        late_finish: t.late_finish ? format(t.late_finish, 'yyyy-MM-dd') : undefined,
        actual_start: t.actual_start ? format(t.actual_start, 'yyyy-MM-dd') : undefined,
        actual_finish: t.actual_finish ? format(t.actual_finish, 'yyyy-MM-dd') : undefined,
        constraint: t.constraint ? {
          ...t.constraint,
          date: format(t.constraint.date, 'yyyy-MM-dd')
        } : undefined,
        baseline: t.baseline ? {
          start: format(t.baseline.start, 'yyyy-MM-dd'),
          finish: format(t.baseline.finish, 'yyyy-MM-dd')
        } : undefined
      }));

    const { start, end, duration } = this.getProjectDates();

    return JSON.stringify({
      project: {
        name: this.project_name,
        id: this.project_id,
        updated: this.updated,
        status: this.project_status,
        status_summary: this.project_status_summary,
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
        duration
      },
      calendar: {
        working_days: this.calendar.working_days,
        holidays: this.calendar.holidays.map(h => format(h, 'yyyy-MM-dd')),
        duration_unit: this.calendar.duration_unit
      },
      baseline_captured_on: this.baseline_captured_on
        ? format(this.baseline_captured_on, 'yyyy-MM-dd')
        : undefined,
      tasks
    }, null, 2);
  }

  printSummary(): void {
    const { start, end, duration } = this.getProjectDates();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`PROJECT: ${this.project_name} [${this.project_id}]`);
    console.log(`Status: ${this.project_status.toUpperCase()} | Updated: ${this.updated}`);
    console.log(`${'-'.repeat(80)}`);
    console.log(`Start: ${format(start, 'yyyy-MM-dd')} | End: ${format(end, 'yyyy-MM-dd')} | Duration: ${duration}d`);

    if (this.project_status_summary) {
      console.log(`\n${this.project_status_summary}`);
    }

    console.log(`\n${'='.repeat(80)}\n`);

    // Print tasks
    const phaseTasks = Array.from(this.tasks.values()).filter(t => t.level === 1);
    for (const phase of phaseTasks) {
      console.log(`\n📦 ${phase.name} [${phase.id}]`);
      console.log(`   ${format(phase.start_date!, 'yyyy-MM-dd')} → ${format(phase.end_date!, 'yyyy-MM-dd')} (${phase.duration}d)`);
      console.log(`   Progress: ${phase.progress}% | Status: ${phase.status}`);

      const wsTasks = Array.from(this.tasks.values()).filter(
        t => t.level === 2 && t.phase_id === phase.id
      );

      for (const ws of wsTasks) {
        console.log(`\n   🔹 ${ws.name} [${ws.id}]`);
        console.log(`      ${format(ws.start_date!, 'yyyy-MM-dd')} → ${format(ws.end_date!, 'yyyy-MM-dd')} (${ws.duration}d)`);
        console.log(`      Progress: ${ws.progress}% | Status: ${ws.status}`);

        const tasks = Array.from(this.tasks.values()).filter(
          t => t.level === 3 && t.workstream_id === ws.id
        );

        for (const task of tasks) {
          const critical = task.is_critical ? '🔴 CRITICAL' : '';
          const milestone = task.milestone ? '💎 MILESTONE' : '';
          const variance = task.baseline ? this.getVariance(task) : null;
          const varianceStr = variance !== null ? ` (Δ${variance > 0 ? '+' : ''}${variance}d)` : '';

          console.log(
            `      • ${task.name} [${task.id}] ${critical} ${milestone}`.trim()
          );
          console.log(
            `        ${format(task.start_date!, 'yyyy-MM-dd')} → ${format(task.end_date!, 'yyyy-MM-dd')} (${task.duration}d)${varianceStr}`
          );
          console.log(
            `        Progress: ${task.progress}% | Float: ${task.float_days}d | Status: ${task.status}`
          );

          if (task.status_note) {
            console.log(`        Note: ${task.status_note}`);
          }
        }
      }
    }

    console.log(`\n${'='.repeat(80)}\n`);
  }
}
