'use client';

import { useEffect, useState } from 'react';
import { HierarchicalSchedule } from '@/lib/schedule-engine';

export default function TestPage() {
  const [schedule, setSchedule] = useState<HierarchicalSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/schedule?file=schedule_v4.yaml');
        const yamlContent = await response.text();
        const sched = new HierarchicalSchedule(yamlContent);
        setSchedule(sched);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }
    load();
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!schedule) {
    return <div>Loading...</div>;
  }

  const tasks = Array.from(schedule.tasks.values());
  const { start, end, duration } = schedule.getProjectDates();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Page</h1>

      <div className="space-y-2">
        <div>Project: {schedule.project_name}</div>
        <div>Start: {start?.toLocaleDateString()}</div>
        <div>End: {end?.toLocaleDateString()}</div>
        <div>Duration: {duration} days</div>
        <div>Tasks: {tasks.length}</div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Tasks</h2>
        <div className="space-y-1">
          {tasks.filter(t => t.level === 3).slice(0, 5).map(task => (
            <div key={task.id} className="border p-2">
              <div>{task.name} [{task.id}]</div>
              <div className="text-sm text-gray-600">
                {task.start_date instanceof Date ? task.start_date.toLocaleDateString() : 'No start'} - {task.end_date instanceof Date ? task.end_date.toLocaleDateString() : 'No end'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
