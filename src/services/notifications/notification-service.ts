import { Platform } from 'react-native';
import { logger } from '../logger';

// Dynamically import notifee to handle cases where native module isn't linked
let notifee: any = null;
let AndroidImportance: any = null;
let TriggerType: any = null;

try {
  const notifeeModule = require('@notifee/react-native');
  notifee = notifeeModule.default || notifeeModule;
  AndroidImportance = notifeeModule.AndroidImportance;
  TriggerType = notifeeModule.TriggerType;
} catch (error) {
  // Notifee not available - will be handled gracefully
}

const BREAK_NOTIFICATION_ID = 'break-reminder';
const NOTIFICATION_INTERVAL_MINUTES = 30;

export interface BreakStatus {
  status: string;
  startTime: string | number;
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notifee) {
    logger.warn('Notifee not available. Cannot request notification permission.');
    return false;
  }
  try {
    if (Platform.OS === 'android') {
      await notifee.requestPermission();
    } else {
      const settings = await notifee.requestPermission();
      return settings.authorizationStatus >= 1; // Authorized or Provisional
    }
    return true;
  } catch (error) {
    logger.warn('Error requesting notification permission', error);
    return false;
  }
}

/**
 * Schedule recurring notifications every 30 minutes when user is on break
 */
export async function scheduleBreakReminderNotifications(
  breakStatus: string,
): Promise<void> {
  if (!notifee || !AndroidImportance || !TriggerType) {
    logger.warn('Notifee not available. Cannot schedule notifications.');
    return;
  }
  try {
    // Cancel any existing break notifications
    await cancelBreakReminderNotifications();

    // Request permission first
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      logger.debug('Notification permission not granted');
      return;
    }

    // Create a channel for Android
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'break-reminders',
        name: 'Break Reminders',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
    }

    // Get break status label
    const breakStatusLabel = getBreakStatusLabel(breakStatus);

    // Schedule first notification in 30 minutes
    const firstTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + NOTIFICATION_INTERVAL_MINUTES * 60 * 1000,
    };

    await notifee.createTriggerNotification(
      {
        id: BREAK_NOTIFICATION_ID,
        title: 'Break Reminder',
        body: `Don't forget to check in when you return from ${breakStatusLabel}`,
        android: {
          channelId: 'break-reminders',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          ongoing: false,
          autoCancel: true,
        },
        ios: {
          sound: 'default',
        },
      },
      firstTrigger,
    );

    // Schedule recurring notifications using a workaround
    // Since notifee doesn't support true recurring triggers, we'll schedule multiple notifications
    // scheduleRecurringNotifications(breakStatusLabel, 5); // Schedule 5 notifications (2.5 hours)
  } catch (error) {
    logger.error('Error scheduling break reminder notifications', error);
  }
}



/**
 * Cancel all break reminder notifications
 */
export async function cancelBreakReminderNotifications(): Promise<void> {
  if (!notifee) {
    logger.warn('Notifee not available. Cannot cancel notifications.');
    return;
  }
  try {
    // Cancel main notification
    await notifee.cancelNotification(BREAK_NOTIFICATION_ID);

    // Cancel all recurring notifications
    for (let i = 1; i <= 10; i++) {
      await notifee.cancelNotification(`${BREAK_NOTIFICATION_ID}-${i}`);
    }

    // Also cancel all notifications with the break reminder prefix
    const notifications = await notifee.getTriggerNotifications();
    notifications.forEach((notification: any) => {
      if (notification.notification.id?.startsWith(BREAK_NOTIFICATION_ID)) {
        notifee.cancelNotification(notification.notification.id);
      }
    });
  } catch (error) {
    logger.warn('Error canceling break reminder notifications', error);
  }
}

/**
 * Get human-readable label for break status
 */
function getBreakStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    LUNCH: 'Lunch',
    SHORTBREAK: 'Short Break',
    COMMUTING: 'Commuting',
    PERSONALTIMEOUT: 'Personal Timeout',
    OUTFORDINNER: 'Dinner',
    EARLY_CHECKOUT: 'Early Checkout',
  };

  return statusMap[status.toUpperCase()] || status;
}

/**
 * Check if user is currently on break
 */
export function isUserOnBreak(
  attendanceStatus?: string,
  punchDirection?: string,
): boolean {
  if (!attendanceStatus || !punchDirection) {
    return false;
  }

  const breakStatuses = [
    'LUNCH',
    'SHORTBREAK',
    'COMMUTING',
    'PERSONALTIMEOUT',
    'OUTFORDINNER',
  ];

  const isBreakStatus = breakStatuses.includes(attendanceStatus.toUpperCase());
  const isCheckedOut = punchDirection.toUpperCase() === 'OUT';

  return isBreakStatus && isCheckedOut;
}

