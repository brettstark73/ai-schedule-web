import { readFileSync } from 'fs';
import { join } from 'path';
import { HierarchicalSchedule } from './lib/schedule-engine';

try {
  const yamlPath = join(__dirname, '../schedule_v4.yaml');
  const yamlContent = readFileSync(yamlPath, 'utf-8');

  console.log('Loading schedule...');
  const schedule = new HierarchicalSchedule(yamlContent);

  console.log('✅ Schedule loaded successfully');
  console.log(`Total tasks: ${schedule.tasks.size}`);

  // Check critical tasks
  const tasks = Array.from(schedule.tasks.values());
  console.log(`\nTasks by level:`);
  console.log(`  Level 1 (Phases): ${tasks.filter(t => t.level === 1).length}`);
  console.log(`  Level 2 (Workstreams): ${tasks.filter(t => t.level === 2).length}`);
  console.log(`  Level 3 (Tasks): ${tasks.filter(t => t.level === 3).length}`);

  // Check if ARCH_SYS exists
  const arch = schedule.tasks.get('ARCH_SYS');
  if (arch) {
    console.log(`\n✅ ARCH_SYS found:`);
    console.log(`   Name: ${arch.name}`);
    console.log(`   Level: ${arch.level}`);
    console.log(`   Start: ${arch.start_date}`);
    console.log(`   End: ${arch.end_date}`);
    console.log(`   Start is Date? ${arch.start_date instanceof Date}`);
    console.log(`   End is Date? ${arch.end_date instanceof Date}`);
  } else {
    console.log('❌ ARCH_SYS not found!');
  }

  // Check SW_DESIGN dependencies
  const sw = schedule.tasks.get('SW_DESIGN');
  if (sw) {
    console.log(`\n✅ SW_DESIGN found:`);
    console.log(`   Dependencies: ${JSON.stringify(sw.dependencies)}`);
  }

  // Check project dates
  const { start, end, duration } = schedule.getProjectDates();
  console.log(`\n✅ Project dates:`);
  console.log(`   Start: ${start} (is Date? ${start instanceof Date})`);
  console.log(`   End: ${end} (is Date? ${end instanceof Date})`);
  console.log(`   Duration: ${duration} days`);

} catch (error) {
  console.error('❌ Error:', error);
  if (error instanceof Error) {
    console.error('Stack:', error.stack);
  }
}
