'use client';

import { useState, useEffect } from 'react';
import { HierarchicalSchedule } from '@/lib/schedule-engine';
import GanttChart from '@/components/gantt-chart';
import Link from 'next/link';

export default function HomePage() {
  const [schedule, setSchedule] = useState<HierarchicalSchedule | null>(null);
  const [yamlFile, setYamlFile] = useState<string>('schedule_v4.yaml');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [yamlFile]);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch YAML file from public directory or API
      const response = await fetch(`/api/schedule?file=${yamlFile}`);
      if (!response.ok) {
        throw new Error('Failed to load schedule');
      }

      const yamlContent = await response.text();
      const sched = new HierarchicalSchedule(yamlContent);
      setSchedule(sched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Schedule</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadSchedule}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!schedule) {
    return null;
  }

  const { start, end, duration } = schedule.getProjectDates();
  const tasks = Array.from(schedule.tasks.values());

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {schedule.project_name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {schedule.project_id && `${schedule.project_id} • `}
                Updated: {schedule.updated}
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/edit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Edit Schedule
              </Link>
              <button
                onClick={() => {
                  const json = schedule.toJSON(3);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${schedule.project_id || 'schedule'}.json`;
                  a.click();
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Status Summary */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Status</div>
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                  schedule.project_status === 'green'
                    ? 'bg-green-100 text-green-800'
                    : schedule.project_status === 'yellow'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {schedule.project_status.toUpperCase()}
              </span>
            </div>
            {schedule.project_status_summary && (
              <div className="mt-2 text-xs text-gray-600">
                {schedule.project_status_summary}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Duration</div>
            <div className="mt-2 text-2xl font-bold">{duration} days</div>
            <div className="text-xs text-gray-500">
              {start.toLocaleDateString()} - {end.toLocaleDateString()}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Critical Path</div>
            <div className="mt-2 text-2xl font-bold">
              {tasks.filter(t => t.is_critical && t.level === 3).length}
            </div>
            <div className="text-xs text-gray-500">Critical tasks</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Progress</div>
            <div className="mt-2">
              {(() => {
                const l3Tasks = tasks.filter(t => t.level === 3);
                const totalDuration = l3Tasks.reduce((sum, t) => sum + t.duration, 0);
                const weightedProgress =
                  totalDuration > 0
                    ? Math.round(
                        l3Tasks.reduce((sum, t) => sum + t.progress * t.duration, 0) /
                          totalDuration
                      )
                    : 0;
                return (
                  <div>
                    <div className="text-2xl font-bold">{weightedProgress}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${weightedProgress}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Gantt Chart */}
        <GanttChart
          tasks={tasks}
          projectStart={start}
          projectEnd={end}
          level={3}
          showBaseline={schedule.baseline_captured_on !== undefined}
          showCriticalPath={true}
        />

        {/* At-Risk Tasks */}
        {(() => {
          const atRiskTasks = tasks.filter(
            t => t.level === 3 && (t.status === 'at_risk' || t.status === 'delayed')
          );
          if (atRiskTasks.length === 0) return null;

          return (
            <div className="mt-8 bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">⚠️ At-Risk Items</h2>
                <div className="space-y-3">
                  {atRiskTasks.map(task => (
                    <div key={task.id} className="border-l-4 border-yellow-500 pl-4 py-2">
                      <div className="font-semibold">
                        {task.name} <span className="text-gray-500 text-sm">[{task.id}]</span>
                      </div>
                      {task.status_note && (
                        <div className="text-sm text-gray-600 mt-1">{task.status_note}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Milestones */}
        {(() => {
          const milestones = tasks.filter(t => t.milestone && t.level === 3);
          if (milestones.length === 0) return null;

          return (
            <div className="mt-8 bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">💎 Milestones</h2>
                <div className="space-y-2">
                  {milestones.map(task => (
                    <div key={task.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <span className="font-semibold">{task.name}</span>
                        <span className="text-gray-500 text-sm ml-2">[{task.id}]</span>
                      </div>
                      <div className="text-gray-600">
                        {task.end_date?.toLocaleDateString()}
                        {task.progress === 100 && (
                          <span className="ml-2 text-green-600">✅</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
