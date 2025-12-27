import moment from 'moment-timezone';
import { logger } from '../services/logger';

// IST timezone constant
const IST_TIMEZONE = 'Asia/Kolkata'; // IST is UTC+5:30

/**
 * Get current timestamp in IST (Indian Standard Time)
 * This returns the timestamp representing the current IST time
 * @returns timestamp in milliseconds (UTC epoch, but represents IST time)
 */
export function getCurrentISTTimestamp(): number {
  // Get current time in IST, then convert to UTC timestamp
  // This ensures the timestamp represents IST time
  const istMoment = moment.tz(IST_TIMEZONE);
  return istMoment.valueOf(); // Returns UTC milliseconds representing IST time
}

/**
 * Get current date in IST format (YYYY-MM-DD)
 * @returns Date string in YYYY-MM-DD format in IST
 */
export function getCurrentISTDate(): string {
  return moment.tz(IST_TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Convert a timestamp to IST moment object
 * @param timestamp - Timestamp in milliseconds (assumed to be in IST)
 * @returns moment object in IST timezone
 */
export function timestampToIST(timestamp: number | string): moment.Moment {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  // Treat the timestamp as representing IST time
  return moment.tz(ts, IST_TIMEZONE);
}

/**
 * Convert IST timestamp to local time for display
 * @param istTimestamp - Timestamp in milliseconds (representing IST time)
 * @returns moment object in local timezone (for display)
 */
export function istToLocalTime(istTimestamp: number | string): moment.Moment {
  const ts = typeof istTimestamp === 'string' ? parseInt(istTimestamp, 10) : istTimestamp;
  // First interpret the timestamp as IST, then convert to local
  const istMoment = moment.tz(ts, IST_TIMEZONE);
  return istMoment.local(); // Convert to local timezone
}

/**
 * Format IST timestamp for display in local time
 * @param istTimestamp - Timestamp in milliseconds (representing IST time)
 * @param format - Moment format string (default: 'YYYY-MM-DD HH:mm:ss')
 * @returns Formatted string in local timezone
 */
export function formatISTForDisplay(
  istTimestamp: number | string,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string {
  return istToLocalTime(istTimestamp).format(format);
}

/**
 * Create IST timestamp from date and time string
 * @param date - Date in YYYY-MM-DD format
 * @param time - Time in HH:mm format (interpreted as IST)
 * @returns timestamp in milliseconds (UTC epoch, but represents IST time)
 */
export function createISTTimestamp(date: string, time: string): number | null {
  try {
    const istMoment = moment.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', IST_TIMEZONE);
    
    if (!istMoment.isValid()) {
      logger.warn('Invalid date/time format for IST timestamp', undefined, { date, time });
      return null;
    }

    return istMoment.valueOf(); // Returns UTC milliseconds representing IST time
  } catch (error) {
    logger.error('Error creating IST timestamp', error);
    return null;
  }
}

