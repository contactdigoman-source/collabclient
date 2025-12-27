import moment from 'moment';
import momentTz from 'moment-timezone'; // Import for timezone support (optional, for future use)
import { logger } from '../services/logger';

/**
 * Get current UTC timestamp
 * @returns timestamp in milliseconds (UTC epoch)
 */
export function getCurrentUTCTimestamp(): number {
  return moment.utc().valueOf();
}

/**
 * Get current UTC date in format (YYYY-MM-DD)
 * @returns Date string in YYYY-MM-DD format in UTC
 */
export function getCurrentUTCDate(): string {
  return moment.utc().format('YYYY-MM-DD');
}

/**
 * Convert UTC timestamp to local time for display
 * @param utcTimestamp - Timestamp in milliseconds (UTC)
 * @returns moment object in local timezone (for display)
 */
export function utcToLocalTime(utcTimestamp: number | string): moment.Moment {
  const ts = typeof utcTimestamp === 'string' ? parseInt(utcTimestamp, 10) : utcTimestamp;
  // Interpret timestamp as UTC, then convert to local
  return moment.utc(ts).local();
}

/**
 * Format UTC timestamp for display in local time
 * @param utcTimestamp - Timestamp in milliseconds (UTC)
 * @param format - Moment format string (default: 'YYYY-MM-DD HH:mm:ss')
 * @returns Formatted string in local timezone
 */
export function formatUTCForDisplay(
  utcTimestamp: number | string,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string {
  return utcToLocalTime(utcTimestamp).format(format);
}

/**
 * Create UTC timestamp from date and time string in a specific timezone
 * Shift times from API are in UTC format, so timezone parameter is optional
 * @param date - Date in YYYY-MM-DD format
 * @param time - Time in HH:mm format (in UTC by default)
 * @param timezone - Optional timezone string (e.g., 'Asia/Kolkata'), defaults to UTC
 * @returns timestamp in milliseconds (UTC epoch)
 */
export function createTimestampFromDateTime(
  date: string,
  time: string,
  timezone?: string
): number | null {
  try {
    let dateTime: moment.Moment;
    
    if (timezone) {
      // Create moment in specified timezone, then convert to UTC
      dateTime = momentTz.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', timezone);
    } else {
      // Default to UTC
      dateTime = moment.utc(`${date} ${time}`, 'YYYY-MM-DD HH:mm');
    }
    
    if (!dateTime.isValid()) {
      logger.warn('Invalid date/time format for timestamp', undefined, { date, time, timezone });
      return null;
    }

    return dateTime.valueOf(); // Returns UTC milliseconds
  } catch (error) {
    logger.error('Error creating timestamp from date/time', error);
    return null;
  }
}

/**
 * Get date from UTC timestamp
 * @param utcTimestamp - Timestamp in milliseconds (UTC)
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateFromUTCTimestamp(utcTimestamp: number | string): string {
  const ts = typeof utcTimestamp === 'string' ? parseInt(utcTimestamp, 10) : utcTimestamp;
  return moment.utc(ts).format('YYYY-MM-DD');
}

