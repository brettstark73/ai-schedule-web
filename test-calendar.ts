import { Calendar, DurationUnit } from './lib/schedule-engine';
import { parse } from 'date-fns';

const calendar = new Calendar(
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  [],
  DurationUnit.WORKING_DAYS
);

const startDate = parse('2025-03-26', 'yyyy-MM-dd', new Date());

console.log('Start:', startDate);
console.log('Is working day?', calendar.isWorkingDay(startDate));

const endDate = calendar.addWorkingDays(startDate, 45);
console.log('After adding 45 working days:', endDate);
console.log('Expected: early June 2025');
console.log('Actual: ', endDate.toLocaleDateString());

// Test a single day
const tomorrow = calendar.addWorkingDays(startDate, 1);
console.log('\nTomorrow:', tomorrow.toLocaleDateString());

// Test 5 days (should be next week)
const nextWeek = calendar.addWorkingDays(startDate, 5);
console.log('Next week (5 days):', nextWeek.toLocaleDateString());
