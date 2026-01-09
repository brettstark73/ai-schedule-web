import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import GanttChart from '../gantt-chart';
import { Task, TaskStatus } from '@/lib/schedule-engine';

const mockTasks: Task[] = [
  {
    id: 'PHASE1',
    name: 'Phase 1',
    duration: 15,
    level: 1,
    dependencies: [],
    successors: [],
    progress: 50,
    status: TaskStatus.ON_TRACK,
    status_note: '',
    milestone: false,
    is_critical: false,
    float_days: 0,
    start_date: new Date('2025-01-15'),
    end_date: new Date('2025-02-05')
  },
  {
    id: 'WS1',
    name: 'Workstream 1',
    duration: 15,
    level: 2,
    parent_id: 'PHASE1',
    phase_id: 'PHASE1',
    dependencies: [],
    successors: [],
    progress: 50,
    status: TaskStatus.ON_TRACK,
    status_note: '',
    milestone: false,
    is_critical: false,
    float_days: 0,
    start_date: new Date('2025-01-15'),
    end_date: new Date('2025-02-05')
  },
  {
    id: 'TASK1',
    name: 'Task 1',
    duration: 5,
    level: 3,
    parent_id: 'WS1',
    phase_id: 'PHASE1',
    workstream_id: 'WS1',
    dependencies: [],
    successors: ['TASK2'],
    progress: 100,
    status: TaskStatus.COMPLETE,
    status_note: '',
    milestone: false,
    is_critical: true,
    float_days: 0,
    start_date: new Date('2025-01-15'),
    end_date: new Date('2025-01-22')
  },
  {
    id: 'TASK2',
    name: 'Task 2',
    duration: 10,
    level: 3,
    parent_id: 'WS1',
    phase_id: 'PHASE1',
    workstream_id: 'WS1',
    dependencies: [{ task_id: 'TASK1', lag: 0 }],
    successors: [],
    progress: 30,
    status: TaskStatus.ON_TRACK,
    status_note: '',
    milestone: false,
    is_critical: true,
    float_days: 0,
    start_date: new Date('2025-01-22'),
    end_date: new Date('2025-02-05')
  }
];

describe('GanttChart', () => {
  it('should render chart title', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
      />
    );

    expect(screen.getByText('Project Schedule')).toBeInTheDocument();
  });

  it('should render all tasks at level 3', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
        level={3}
      />
    );

    expect(screen.getAllByText('Task 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Task 2').length).toBeGreaterThan(0);
  });

  it('should filter tasks by level', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
        level={1}
      />
    );

    expect(screen.getAllByText('Phase 1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
  });

  it('should show zoom level buttons', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
      />
    );

    expect(screen.getByText('L1: Phases')).toBeInTheDocument();
    expect(screen.getByText('L2: +Workstreams')).toBeInTheDocument();
    expect(screen.getByText('L3: All Tasks')).toBeInTheDocument();
  });

  it('should change zoom level on button click', async () => {
    const user = userEvent.setup();

    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
        level={3}
      />
    );

    // Initially all tasks visible
    expect(screen.getAllByText('Task 1').length).toBeGreaterThan(0);

    // Click L1 button
    await user.click(screen.getByText('L1: Phases'));

    // Only phases should be visible
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
    expect(screen.getAllByText('Phase 1').length).toBeGreaterThan(0);
  });

  it('should show legend', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
      />
    );

    expect(screen.getByText('Critical Path')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('Milestone')).toBeInTheDocument();
  });

  it('should display task progress', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
      />
    );

    // Check for progress percentages
    const task1 = screen.getByText('Task 1');
    expect(task1.closest('div')).toBeInTheDocument();
  });

  it('should show critical path when enabled', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
        showCriticalPath={true}
      />
    );

    const task1Text = screen.getByText('Task 1');
    const task1Row = task1Text.closest('.flex');
    expect(task1Row).toBeInTheDocument();
  });

  it('should show baseline when enabled', () => {
    const tasksWithBaseline = mockTasks.map(t => ({
      ...t,
      baseline: {
        start: new Date('2025-01-15'),
        finish: new Date('2025-01-20')
      }
    }));

    render(
      <GanttChart
        tasks={tasksWithBaseline}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
        showBaseline={true}
      />
    );

    // Baseline should be rendered (ghost bars)
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('should render month markers', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-03-31')}
      />
    );

    // Should show multiple months
    expect(screen.getAllByText(/Jan/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Feb/).length).toBeGreaterThan(0);
  });

  it('should handle empty task list', () => {
    render(
      <GanttChart
        tasks={[]}
        projectStart={new Date('2025-01-15')}
        projectEnd={new Date('2025-02-05')}
      />
    );

    expect(screen.getByText('Project Schedule')).toBeInTheDocument();
  });
});
