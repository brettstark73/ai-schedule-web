/**
 * Natural Language Schedule Editor - TypeScript Port
 *
 * Features:
 * - Diff-before-apply workflow
 * - Confidence scoring
 * - Support v2 fields (lag, constraints, actuals, progress)
 * - What-if simulation
 * - Query commands
 */

import Fuse from 'fuse.js';
import * as yaml from 'js-yaml';
import { Task, YAMLSchedule } from './schedule-engine';

// ============================================================================
// Types
// ============================================================================

export interface ParsedCommand {
  intent: string;
  task_id?: string;
  task_name?: string;
  value?: any;
  value2?: any;
  confidence: number;
  matched_pattern: string;
  is_query: boolean;
}

export interface Diff {
  description: string;
  task_id: string;
  field: string;
  old_value: any;
  new_value: any;
  impact?: string;
}

interface CommandPattern {
  pattern: RegExp;
  intent: string;
  base_confidence: number;
}

// ============================================================================
// Schedule Editor Class
// ============================================================================

export class ScheduleEditor {
  private yamlContent: string;
  private data: YAMLSchedule;
  private patterns: CommandPattern[];

  constructor(yamlContent: string) {
    this.yamlContent = yamlContent;
    this.data = yaml.load(yamlContent) as YAMLSchedule;
    this.patterns = this.initPatterns();
  }

  private initPatterns(): CommandPattern[] {
    return [
      // Mark complete (high priority)
      {
        pattern: /mark\s+(\w+)\s+(?:as\s+)?complete/i,
        intent: 'mark_complete',
        base_confidence: 0.98
      },
      {
        pattern: /(\w+)\s+is\s+(?:done|complete|finished)/i,
        intent: 'mark_complete',
        base_confidence: 0.95
      },
      {
        pattern: /complete\s+(\w+)/i,
        intent: 'mark_complete',
        base_confidence: 0.95
      },

      // Duration changes (before progress to avoid conflicts)
      {
        pattern: /extend\s+(\w+)\s+by\s+(\d+)\s*(?:days?|d)/i,
        intent: 'extend_duration',
        base_confidence: 0.98
      },
      {
        pattern: /(\w+)\s+needs\s+(\d+)\s+more\s+days?/i,
        intent: 'extend_duration',
        base_confidence: 0.90
      },
      {
        pattern: /add\s+(\d+)\s+days?\s+to\s+(\w+)/i,
        intent: 'extend_duration',
        base_confidence: 0.95
      },
      {
        pattern: /shorten\s+(\w+)\s+by\s+(\d+)\s*(?:days?|d)/i,
        intent: 'shorten_duration',
        base_confidence: 0.98
      },
      {
        pattern: /reduce\s+(\w+)\s+by\s+(\d+)\s*(?:days?|d)/i,
        intent: 'shorten_duration',
        base_confidence: 0.98
      },
      {
        pattern: /set\s+(\w+)\s+(?:to\s+|duration\s+)?(\d+)\s+(?:days?|d)/i,
        intent: 'set_duration',
        base_confidence: 0.96
      },
      {
        pattern: /(\w+)\s+duration\s+(?:is\s+)?(\d+)\s*(?:days?|d)?/i,
        intent: 'set_duration',
        base_confidence: 0.95
      },

      // Progress updates (require % or "progress" keyword to avoid conflicts)
      {
        pattern: /(?:set\s+)?(\w+)\s+(?:is\s+|to\s+)?(\d+)%/i,
        intent: 'set_progress',
        base_confidence: 0.95
      },
      {
        pattern: /(\w+)\s+progress\s+(?:is\s+)?(\d+)%?/i,
        intent: 'set_progress',
        base_confidence: 0.95
      },
      {
        pattern: /set\s+(\w+)\s+to\s+(\d+)(?!\s*days?)/i,
        intent: 'set_progress',
        base_confidence: 0.85
      },
      {
        pattern: /(\w+)\s+is\s+(\d+)(?!\s*days?)/i,
        intent: 'set_progress',
        base_confidence: 0.80
      },

      // Set actual dates
      {
        pattern: /(\w+)\s+started\s+(\d{4}-\d{2}-\d{2})/i,
        intent: 'set_actual_start',
        base_confidence: 0.98
      },
      {
        pattern: /(\w+)\s+finished\s+(\d{4}-\d{2}-\d{2})/i,
        intent: 'set_actual_finish',
        base_confidence: 0.98
      },

      // Add lag
      {
        pattern: /(\w+)\s+starts\s+(\d+)\s+days?\s+after\s+(\w+)/i,
        intent: 'add_lag',
        base_confidence: 0.95
      },

      // Add dependency
      {
        pattern: /(\w+)\s+depends\s+on\s+(\w+)/i,
        intent: 'add_dependency',
        base_confidence: 0.95
      },
      {
        pattern: /move\s+(\w+)\s+after\s+(\w+)/i,
        intent: 'add_dependency',
        base_confidence: 0.95
      },

      // Add constraint
      {
        pattern: /(\w+)\s+no\s+earlier\s+than\s+(\d{4}-\d{2}-\d{2})/i,
        intent: 'add_constraint',
        base_confidence: 0.98
      },

      // Add risk/note (more specific patterns, late in list to avoid false matches)
      {
        pattern: /risk\s+for\s+(\w+)(?::\s*(.+))?/i,
        intent: 'add_risk',
        base_confidence: 0.90
      },
      {
        pattern: /(\w+)\s+(?:is\s+)?at\s+risk(?::\s*(.+))?/i,
        intent: 'add_risk',
        base_confidence: 0.90
      },
      {
        pattern: /flag\s+(\w+)(?:\s+as\s+)?at\s+risk(?::\s*(.+))?/i,
        intent: 'add_risk',
        base_confidence: 0.90
      },

      // What-if queries
      {
        pattern: /what\s+if\s+(\w+)\s+slips?\s+(?:by\s+)?(\d+)\s*(?:days?|d|weeks?)/i,
        intent: 'what_if',
        base_confidence: 1.00
      },

      // Query commands
      {
        pattern: /(?:show\s+)?(?:critical\s+path|what.*driving.*end)/i,
        intent: 'show_critical_path',
        base_confidence: 1.00
      },
      {
        pattern: /(?:show\s+)?milestones?/i,
        intent: 'show_milestones',
        base_confidence: 1.00
      },
      {
        pattern: /(?:show\s+)?variance/i,
        intent: 'show_variance',
        base_confidence: 1.00
      },
      {
        pattern: /status|summary|how\s+are\s+we/i,
        intent: 'show_status',
        base_confidence: 1.00
      }
    ];
  }

  parseCommand(command: string): ParsedCommand {
    const cleaned = command.trim().toLowerCase();

    let bestMatch: ParsedCommand | null = null;
    let bestConfidence = 0.0;

    for (const { pattern, intent, base_confidence } of this.patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let confidence = base_confidence;
        let task_id: string | undefined;
        let task_name: string | undefined;

        // Extract task ID - usually first group, but handle special cases
        let taskIdGroupIndex = 1;

        // Special case: "add N days to TASK" - task is in group 2
        if (intent === 'extend_duration' && pattern.toString().includes('add') && pattern.toString().includes('to')) {
          taskIdGroupIndex = 2;
        }

        if (match[taskIdGroupIndex]) {
          const taskIdCandidate = match[taskIdGroupIndex].toUpperCase();

          // Check exact match in tasks
          if (this.findTaskInYAML(taskIdCandidate)) {
            task_id = taskIdCandidate;
            confidence = Math.min(1.0, confidence + 0.05);
          } else {
            // Fuzzy match
            const fuzzyResult = this.fuzzyFindTask(taskIdCandidate);
            if (fuzzyResult) {
              task_id = fuzzyResult.id;
              task_name = fuzzyResult.name;
              confidence = Math.min(1.0, confidence * fuzzyResult.score);
            }
          }
        }

        const cmd: ParsedCommand = {
          intent,
          task_id,
          task_name,
          confidence,
          matched_pattern: pattern.toString(),
          is_query: intent.startsWith('show_') || intent === 'what_if'
        };

        // Extract values based on intent
        if (intent === 'set_progress') {
          cmd.value = parseInt(match[2]);
        } else if (intent === 'extend_duration' || intent === 'shorten_duration' || intent === 'set_duration') {
          cmd.value = parseInt(match[2] || match[1]);
          if (intent === 'extend_duration' && pattern.toString().includes('add')) {
            cmd.value = parseInt(match[1]);
          }
        } else if (intent === 'add_risk') {
          cmd.value = match[2] || 'At risk';
        } else if (intent === 'set_actual_start' || intent === 'set_actual_finish') {
          cmd.value = match[2];
        } else if (intent === 'add_lag') {
          cmd.task_id = match[1].toUpperCase();
          cmd.value = parseInt(match[2]);
          cmd.value2 = match[3].toUpperCase(); // predecessor
        } else if (intent === 'add_dependency') {
          cmd.value = match[2].toUpperCase(); // predecessor
        } else if (intent === 'add_constraint') {
          cmd.value = match[2]; // date
        } else if (intent === 'what_if') {
          const val = match[2];
          if (command.includes('week')) {
            cmd.value = parseInt(val) * 5;
          } else {
            cmd.value = parseInt(val);
          }
        }

        if (confidence > bestConfidence) {
          bestMatch = cmd;
          bestConfidence = confidence;
        }
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    return {
      intent: 'unknown',
      confidence: 0.0,
      matched_pattern: '',
      is_query: false
    };
  }

  private findTaskInYAML(taskId: string): boolean {
    // Search through phases, workstreams, and tasks
    for (const phase of this.data.phases || []) {
      if (phase.id === taskId) return true;
      for (const ws of phase.workstreams || []) {
        if (ws.id === taskId) return true;
        for (const task of ws.tasks || []) {
          if (task.id === taskId) return true;
        }
      }
    }
    return false;
  }

  private fuzzyFindTask(query: string): { id: string; name: string; score: number } | null {
    const tasks: Array<{ id: string; name: string }> = [];

    // Collect all tasks
    for (const phase of this.data.phases || []) {
      tasks.push({ id: phase.id, name: phase.name });
      for (const ws of phase.workstreams || []) {
        tasks.push({ id: ws.id, name: ws.name });
        for (const task of ws.tasks || []) {
          tasks.push({ id: task.id, name: task.name });
        }
      }
    }

    // Use Fuse.js for fuzzy matching
    const fuse = new Fuse(tasks, {
      keys: ['id', 'name'],
      threshold: 0.3,
      includeScore: true
    });

    const results = fuse.search(query);

    if (results.length > 0 && results[0].score !== undefined) {
      const match = results[0];
      // Convert Fuse score (lower is better) to 0-1 confidence (higher is better)
      const confidence = 1 - (match.score || 0);
      if (confidence >= 0.7) {
        return {
          id: match.item.id,
          name: match.item.name,
          score: confidence
        };
      }
    }

    return null;
  }

  generateDiff(command: ParsedCommand): Diff[] {
    const diffs: Diff[] = [];

    if (command.is_query) {
      return diffs; // Queries don't modify
    }

    if (!command.task_id) {
      return diffs;
    }

    const task = this.findTaskDataInYAML(command.task_id);
    if (!task) {
      return diffs;
    }

    // Generate diff based on intent
    switch (command.intent) {
      case 'set_progress':
        diffs.push({
          description: `Set progress to ${command.value}%`,
          task_id: command.task_id,
          field: 'progress',
          old_value: task.progress || 0,
          new_value: command.value
        });
        break;

      case 'mark_complete':
        diffs.push({
          description: 'Mark as complete',
          task_id: command.task_id,
          field: 'progress',
          old_value: task.progress || 0,
          new_value: 100
        });
        diffs.push({
          description: 'Set status to complete',
          task_id: command.task_id,
          field: 'status',
          old_value: task.status || 'not_started',
          new_value: 'complete'
        });
        break;

      case 'extend_duration':
        diffs.push({
          description: `Extend duration by ${command.value} days`,
          task_id: command.task_id,
          field: 'duration',
          old_value: task.duration || 0,
          new_value: (task.duration || 0) + command.value
        });
        break;

      case 'shorten_duration':
        diffs.push({
          description: `Shorten duration by ${command.value} days`,
          task_id: command.task_id,
          field: 'duration',
          old_value: task.duration || 0,
          new_value: Math.max(0, (task.duration || 0) - command.value)
        });
        break;

      case 'set_duration':
        diffs.push({
          description: `Set duration to ${command.value} days`,
          task_id: command.task_id,
          field: 'duration',
          old_value: task.duration || 0,
          new_value: command.value
        });
        break;

      case 'add_risk':
        diffs.push({
          description: `Add risk note: ${command.value}`,
          task_id: command.task_id,
          field: 'status_note',
          old_value: task.status_note || '',
          new_value: command.value
        });
        diffs.push({
          description: 'Set status to at_risk',
          task_id: command.task_id,
          field: 'status',
          old_value: task.status || 'not_started',
          new_value: 'at_risk'
        });
        break;

      case 'set_actual_start':
        diffs.push({
          description: `Set actual start to ${command.value}`,
          task_id: command.task_id,
          field: 'actual_start',
          old_value: task.actual_start || null,
          new_value: command.value
        });
        break;

      case 'set_actual_finish':
        diffs.push({
          description: `Set actual finish to ${command.value}`,
          task_id: command.task_id,
          field: 'actual_finish',
          old_value: task.actual_finish || null,
          new_value: command.value
        });
        break;

      case 'add_lag':
        diffs.push({
          description: `Add ${command.value} day lag after ${command.value2}`,
          task_id: command.task_id,
          field: 'depends_on',
          old_value: task.depends_on || [],
          new_value: [
            ...(task.depends_on || []),
            { id: command.value2, lag: command.value }
          ]
        });
        break;

      case 'add_dependency':
        diffs.push({
          description: `Add dependency on ${command.value}`,
          task_id: command.task_id,
          field: 'depends_on',
          old_value: task.depends_on || [],
          new_value: [...(task.depends_on || []), command.value]
        });
        break;

      case 'add_constraint':
        diffs.push({
          description: `Add constraint: no earlier than ${command.value}`,
          task_id: command.task_id,
          field: 'constraint',
          old_value: task.constraint || null,
          new_value: {
            type: 'no_earlier_than',
            date: command.value
          }
        });
        break;
    }

    return diffs;
  }

  private findTaskDataInYAML(taskId: string): any {
    for (const phase of this.data.phases || []) {
      if (phase.id === taskId) return phase;
      for (const ws of phase.workstreams || []) {
        if (ws.id === taskId) return ws;
        for (const task of ws.tasks || []) {
          if (task.id === taskId) return task;
        }
      }
    }
    return null;
  }

  applyDiff(diffs: Diff[]): string {
    // Apply all diffs to the data
    for (const diff of diffs) {
      const task = this.findTaskDataInYAML(diff.task_id);
      if (task) {
        task[diff.field] = diff.new_value;
      }
    }

    // Return updated YAML
    return yaml.dump(this.data, {
      noRefs: true,
      lineWidth: -1
    });
  }

  getYAML(): string {
    return yaml.dump(this.data, {
      noRefs: true,
      lineWidth: -1
    });
  }
}
