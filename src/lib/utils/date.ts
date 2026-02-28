/**
 * Check if a date falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Count the number of weekdays (Mon-Fri) between two dates, exclusive of both endpoints.
 * E.g., Friday to Monday = 0 (only Sat+Sun in between, which are not weekdays).
 * E.g., Monday to Wednesday = 1 (Tuesday is in between).
 */
export function countWeekdaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1);

  while (current < end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Get today's date as a YYYY-MM-DD string in local timezone.
 */
export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Parse a YYYY-MM-DD string into a Date object (at midnight local time).
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format seconds into MM:SS string.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
