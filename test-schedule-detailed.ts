import { readFileSync } from 'fs';
import { join } from 'path';
import { HierarchicalSchedule } from './lib/schedule-engine';

const yamlPath = join(__dirname, '../schedule_v4.yaml');
const yamlContent = readFileSync(yamlPath, 'utf-8');
const schedule = new HierarchicalSchedule(yamlContent);

const tasks = Array.from(schedule.tasks.values());

console.log('=== PLANNING Phase Tasks ===');
const planningTasks = tasks.filter(t => t.phase_id === 'PLANNING');
planningTasks.forEach(t => {
  console.log(`${t.id} (L${t.level}): ${t.name}`);
  console.log(`  Start: ${t.start_date}`);
  console.log(`  End: ${t.end_date}`);
  console.log(`  Workstream: ${t.workstream_id || 'none'}`);
});

console.log('\n=== All Level 2 Tasks ===');
const level2 = tasks.filter(t => t.level === 2);
level2.forEach(t => {
  console.log(`${t.id}: ${t.name}`);
  console.log(`  Is workstream: ${schedule.workstreams.includes(t.id)}`);
  console.log(`  Start: ${t.start_date}`);
  console.log(`  End: ${t.end_date}`);
});

console.log('\n=== Phases ===');
const phases = tasks.filter(t => t.level === 1);
phases.forEach(p => {
  console.log(`${p.id}: ${p.name}`);
  console.log(`  Start: ${p.start_date}`);
  console.log(`  End: ${p.end_date}`);
});
