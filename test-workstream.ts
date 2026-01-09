import { readFileSync } from 'fs';
import { join } from 'path';
import { HierarchicalSchedule } from './lib/schedule-engine';

const yamlPath = join(__dirname, '../schedule_v4.yaml');
const yamlContent = readFileSync(yamlPath, 'utf-8');
const schedule = new HierarchicalSchedule(yamlContent);

const tasks = Array.from(schedule.tasks.values());

console.log('=== SOFTWARE Workstream Tasks ===');
const swTasks = tasks.filter(t => t.workstream_id === 'SOFTWARE' && t.level === 3);
swTasks.forEach(t => {
  console.log(`${t.id}: ${t.name}`);
  console.log(`  Duration: ${t.duration} days`);
  console.log(`  Start: ${t.start_date}`);
  console.log(`  End: ${t.end_date}`);
  console.log(`  Dependencies: ${JSON.stringify(t.dependencies)}`);
});

const ws = schedule.tasks.get('SOFTWARE');
console.log(`\nSOFTWARE workstream rollup:`);
console.log(`  Start: ${ws?.start_date}`);
console.log(`  End: ${ws?.end_date}`);
console.log(`  Duration: ${ws?.duration}`);

// Check calendar
console.log(`\nCalendar settings:`);
console.log(`  Duration unit: ${schedule.calendar.duration_unit}`);
console.log(`  Working days: ${schedule.calendar.working_days}`);
console.log(`  Holidays: ${schedule.calendar.holidays.length}`);
