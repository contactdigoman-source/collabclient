import moment from 'moment';

/**
 * Timestamp Conversion Utilities
 * Handles conversion between API datetime strings, SQLite ticks, and UI display
 */

/**
 * Convert API timestamp (datetime string or ticks) to UTC ticks for SQLite storage
 * @param value - API timestamp as string (ISO datetime) or number (ticks)
 * @returns UTC ticks (milliseconds since epoch)
 */
export function apiTimestampToTicks(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return Date.now(); // Fallback to current time
  }
  
  if (typeof value === 'string') {
    // Parse as UTC datetime string and convert to ticks
    return moment.utc(value).valueOf();
  }
  
  // Already ticks, assume UTC
  return value;
}

/**
 * Convert UTC ticks to API datetime string (ISO format)
 * @param ticks - UTC ticks (milliseconds since epoch)
 * @returns ISO datetime string (e.g., "2026-01-15T09:00:00Z")
 */
export function ticksToApiDatetime(ticks: number): string {
  return moment.utc(ticks).toISOString();
}

/**
 * Format UTC ticks for UI display (converts to local timezone)
 * @param ticks - UTC ticks (milliseconds since epoch)
 * @param format - Moment format string (default: 'hh:mm A')
 * @returns Formatted time string in local timezone
 */
export function formatTimestampForDisplay(ticks: number, format: string = 'hh:mm A'): string {
  // moment(ticks) automatically converts UTC ticks to local timezone
  return moment(ticks).format(format);
}

/**
 * Format UTC ticks for date display (converts to local timezone)
 * @param ticks - UTC ticks (milliseconds since epoch)
 * @param format - Moment format string (default: 'DD MMM, YY')
 * @returns Formatted date string in local timezone
 */
export function formatDateForDisplay(ticks: number, format: string = 'DD MMM, YY'): string {
  return moment(ticks).format(format);
}

/**
 * Get date string (YYYY-MM-DD) from UTC ticks for date comparisons
 * Uses UTC for internal logic
 * @param ticks - UTC ticks (milliseconds since epoch)
 * @returns Date string in YYYY-MM-DD format (UTC)
 */
export function getDateStringFromTicks(ticks: number): string {
  return moment.utc(ticks).format('YYYY-MM-DD');
}

/**
 * Check if timestamp is today (using UTC for comparison)
 * @param ticks - UTC ticks (milliseconds since epoch)
 * @returns true if timestamp is today (UTC)
 */
export function isTodayUTC(ticks: number): boolean {
  const today = moment.utc().startOf('day');
  const timestampDate = moment.utc(ticks).startOf('day');
  return timestampDate.isSame(today, 'day');
}

