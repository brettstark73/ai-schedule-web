import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HomePage from '../page';
import { HierarchicalSchedule } from '@/lib/schedule-engine';

// Mock fetch
global.fetch = vi.fn();

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

// Mock GanttChart component
vi.mock('@/components/gantt-chart', () => ({
  default: () => <div data-testid="gantt-chart">Gantt Chart</div>
}));

const mockYamlContent = `
project:
  name: "Test Project"
  id: TEST-001
  updated: 2025-01-08
  start_date: 2025-01-15
  status: green
  status_summary: "On track"

calendar:
  working_days: [Mon, Tue, Wed, Thu, Fri]
  holidays: []
  duration_unit: working_days

phases:
  - id: PHASE1
    name: "Phase 1"
    tasks:
      - id: TASK1
        name: "Task 1"
        duration: 10
        progress: 50
        status: on_track
        status_note: ""
        milestone: false
`;

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));

    render(<HomePage />);

    expect(screen.getByText('Loading schedule...')).toBeInTheDocument();
  });

  it('should load and display schedule successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
  });

  it('should display error when fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found'
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Schedule')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load schedule')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should display error when parsing fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => 'invalid: yaml: content: ['
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Schedule')).toBeInTheDocument();
    });
  });

  it('should show project status summary', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('GREEN')).toBeInTheDocument();
      expect(screen.getByText('On track')).toBeInTheDocument();
    });
  });

  it('should show duration and dates', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText(/days/)).toBeInTheDocument();
    });
  });

  it('should show critical path information', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Critical Path')).toBeInTheDocument();
      expect(screen.getByText('Critical tasks')).toBeInTheDocument();
    });
  });

  it('should show progress information', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });
  });

  it('should have Edit Schedule link', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      const editLink = screen.getByText('Edit Schedule');
      expect(editLink).toBeInTheDocument();
      expect(editLink.closest('a')).toHaveAttribute('href', '/edit');
    });
  });

  it('should have Export JSON button', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });
  });

  it('should display at-risk items section when tasks are at risk', async () => {
    const yamlWithRisks = `
project:
  name: "Test Project"
  id: TEST-001
  updated: 2025-01-08
  start_date: 2025-01-15
  status: yellow

calendar:
  working_days: [Mon, Tue, Wed, Thu, Fri]
  holidays: []
  duration_unit: working_days

phases:
  - id: PHASE1
    name: "Phase 1"
    tasks:
      - id: TASK1
        name: "Delayed Task"
        duration: 10
        progress: 30
        status: delayed
        status_note: "Vendor delay"
      - id: TASK2
        name: "At Risk Task"
        duration: 5
        progress: 20
        status: at_risk
        status_note: "Resource constraint"
`;

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => yamlWithRisks
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('⚠️ At-Risk Items')).toBeInTheDocument();
      expect(screen.getByText('Delayed Task')).toBeInTheDocument();
      expect(screen.getByText('Vendor delay')).toBeInTheDocument();
      expect(screen.getByText('At Risk Task')).toBeInTheDocument();
      expect(screen.getByText('Resource constraint')).toBeInTheDocument();
    });
  });

  it('should display milestones section when milestones exist', async () => {
    const yamlWithMilestones = `
project:
  name: "Test Project"
  id: TEST-001
  updated: 2025-01-08
  start_date: 2025-01-15
  status: green

calendar:
  working_days: [Mon, Tue, Wed, Thu, Fri]
  holidays: []
  duration_unit: working_days

phases:
  - id: PHASE1
    name: "Phase 1"
    tasks:
      - id: TASK1
        name: "Regular Task"
        duration: 10
        progress: 50
      - id: MILESTONE1
        name: "Project Kickoff"
        duration: 0
        milestone: true
        progress: 100
      - id: MILESTONE2
        name: "Design Complete"
        duration: 0
        milestone: true
        progress: 0
`;

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => yamlWithMilestones
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('💎 Milestones')).toBeInTheDocument();
      expect(screen.getByText('Project Kickoff')).toBeInTheDocument();
      expect(screen.getByText('Design Complete')).toBeInTheDocument();
      // Check for completed milestone checkmark
      expect(screen.getByText('✅')).toBeInTheDocument();
    });
  });

  it('should not display at-risk section when no tasks are at risk', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    expect(screen.queryByText('⚠️ At-Risk Items')).not.toBeInTheDocument();
  });

  it('should not display milestones section when no milestones exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockYamlContent
    } as Response);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    expect(screen.queryByText('💎 Milestones')).not.toBeInTheDocument();
  });
});
