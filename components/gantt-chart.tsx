'use client';

import { useState, useMemo } from 'react';
import { format, differenceInDays, addDays } from 'date-fns';
import { Task } from '@/lib/schedule-engine';

interface GanttChartProps {
  tasks: Task[];
  projectStart: Date;
  projectEnd: Date;
  level?: 1 | 2 | 3;  // Zoom level: 1=Phases only, 2=+Workstreams, 3=+Tasks
  showBaseline?: boolean;
  showCriticalPath?: boolean;
  today?: Date;
}

export default function GanttChart({
  tasks,
  projectStart,
  projectEnd,
  level = 3,
  showBaseline = true,
  showCriticalPath = true,
  today = new Date()
}: GanttChartProps) {
  const [selectedLevel, setSelectedLevel] = useState(level);

  // Filter tasks by level
  const visibleTasks = useMemo(() => {
    return tasks
      .filter(t => t.level <= selectedLevel)
      .sort((a, b) => {
        // Sort by phase, then workstream, then task
        if (a.phase_id !== b.phase_id) {
          return (a.phase_id || '').localeCompare(b.phase_id || '');
        }
        if (a.workstream_id !== b.workstream_id) {
          return (a.workstream_id || '').localeCompare(b.workstream_id || '');
        }
        return a.level - b.level;
      });
  }, [tasks, selectedLevel]);

  // Calculate timeline range
  const timelineStart = projectStart;
  const timelineEnd = projectEnd;
  const totalDays = differenceInDays(timelineEnd, timelineStart);

  // Calculate position for a date
  const getPosition = (date: Date): number => {
    const days = differenceInDays(date, timelineStart);
    return (days / totalDays) * 100;
  };

  // Get task bar color
  const getTaskColor = (task: Task): string => {
    if (showCriticalPath && task.is_critical) {
      return 'bg-red-500';
    }
    if (task.status === 'complete') {
      return 'bg-green-500';
    }
    if (task.status === 'at_risk') {
      return 'bg-yellow-500';
    }
    if (task.status === 'delayed') {
      return 'bg-red-500';
    }
    return 'bg-blue-500';
  };

  // Get level icon
  const getLevelIcon = (level: number): string => {
    if (level === 1) return '📦';
    if (level === 2) return '🔹';
    return '•';
  };

  // Get status icon
  const getStatusIcon = (task: Task): string => {
    if (task.milestone) return '💎';
    if (task.status === 'complete') return '✅';
    if (task.status === 'at_risk') return '⚠️';
    if (task.status === 'delayed') return '🔴';
    return '';
  };

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: Array<{ date: Date; position: number; label: string }> = [];
    let current = new Date(timelineStart);
    current.setDate(1); // First of month

    while (current <= timelineEnd) {
      if (current >= timelineStart) {
        markers.push({
          date: current,
          position: getPosition(current),
          label: format(current, 'MMM yyyy')
        });
      }
      current = addDays(current, 32);
      current.setDate(1);
    }

    return markers;
  }, [timelineStart, timelineEnd]);

  const todayPosition = getPosition(today);

  return (
    <div className="w-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Project Schedule</h2>
            <p className="text-sm text-gray-600">
              {format(projectStart, 'MMM d, yyyy')} - {format(projectEnd, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedLevel(1)}
              className={`px-3 py-1 rounded ${
                selectedLevel === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              L1: Phases
            </button>
            <button
              onClick={() => setSelectedLevel(2)}
              className={`px-3 py-1 rounded ${
                selectedLevel === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              L2: +Workstreams
            </button>
            <button
              onClick={() => setSelectedLevel(3)}
              className={`px-3 py-1 rounded ${
                selectedLevel === 3 ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              L3: All Tasks
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-2 text-sm text-gray-600">
          {showCriticalPath && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-500 rounded" />
              <span>Critical Path</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>Complete</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span>On Track</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-500 rounded" />
            <span>At Risk</span>
          </div>
          <div className="flex items-center gap-1">
            <span>💎</span>
            <span>Milestone</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Timeline header */}
        <div className="sticky top-0 z-10 bg-gray-50 border-b">
          <div className="flex">
            <div className="w-80 p-2 font-semibold border-r">Task</div>
            <div className="flex-1 relative h-16">
              {monthMarkers.map((marker, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-gray-300"
                  style={{ left: `${marker.position}%` }}
                >
                  <div className="px-2 py-1 text-xs text-gray-600">
                    {marker.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {visibleTasks.map((task) => (
            <div
              key={task.id}
              className="flex border-b hover:bg-gray-50"
              style={{
                paddingLeft: `${(task.level - 1) * 20}px`
              }}
            >
              {/* Task name */}
              <div className="w-80 p-2 border-r flex items-center gap-2">
                <span>{getLevelIcon(task.level)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {task.name} {getStatusIcon(task)}
                  </div>
                  <div className="text-xs text-gray-500 flex gap-2">
                    <span>{task.id}</span>
                    {task.progress > 0 && <span>{task.progress}%</span>}
                    {task.is_critical && <span className="text-red-600">Critical</span>}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1 relative h-12">
                {/* Grid lines */}
                {monthMarkers.map((marker, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-gray-200"
                    style={{ left: `${marker.position}%` }}
                  />
                ))}

                {/* Today marker */}
                {today >= timelineStart && today <= timelineEnd && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: `${todayPosition}%` }}
                  />
                )}

                {/* Baseline bar (ghost) */}
                {showBaseline && task.baseline && task.baseline.start && task.baseline.finish && (
                  <div
                    className="absolute h-3 bg-gray-300 opacity-40 rounded top-7"
                    style={{
                      left: `${getPosition(task.baseline.start)}%`,
                      width: `${
                        getPosition(task.baseline.finish) - getPosition(task.baseline.start)
                      }%`
                    }}
                  />
                )}

                {/* Task bar */}
                {task.start_date && task.end_date && (
                  <div
                    className={`absolute h-6 ${getTaskColor(task)} rounded top-3 group cursor-pointer`}
                    style={{
                      left: `${getPosition(task.start_date)}%`,
                      width: `${
                        getPosition(task.end_date) - getPosition(task.start_date)
                      }%`
                    }}
                  >
                    {/* Progress bar */}
                    {task.progress > 0 && task.progress < 100 && (
                      <div
                        className="h-full bg-green-600 rounded-l"
                        style={{ width: `${task.progress}%` }}
                      />
                    )}

                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full mb-2 left-0 bg-gray-800 text-white text-xs rounded p-2 whitespace-nowrap z-30">
                      <div className="font-semibold">{task.name}</div>
                      <div>
                        {task.start_date && format(task.start_date, 'MMM d')} -{' '}
                        {task.end_date && format(task.end_date, 'MMM d, yyyy')}
                      </div>
                      <div>{task.duration} days</div>
                      {task.progress > 0 && <div>{task.progress}% complete</div>}
                      {task.float_days !== undefined && (
                        <div>Float: {task.float_days} days</div>
                      )}
                      {task.status_note && <div className="mt-1">{task.status_note}</div>}
                    </div>
                  </div>
                )}

                {/* Milestone diamond */}
                {task.milestone && task.end_date && (
                  <div
                    className="absolute w-3 h-3 bg-purple-600 transform rotate-45 top-4"
                    style={{
                      left: `${getPosition(task.end_date)}%`,
                      marginLeft: '-6px'
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
