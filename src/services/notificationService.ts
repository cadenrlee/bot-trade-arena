import prisma from '../lib/prisma';

/**
 * Notification Service
 *
 * Rule: Max 2 notifications per day. Protect the notification channel.
 * Types: STREAK_WARNING, MATCH_RESULT, TOURNAMENT, RANK_UP, FRIEND_ACTIVITY, DECAY_WARNING, NEW_SEASON, ACHIEVEMENT
 */

const MAX_NOTIFICATIONS_PER_DAY = 2;

export class NotificationService {
  /**
   * Send a notification (respects daily limit)
   */
  async send(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any,
  ): Promise<boolean> {
    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countToday = await prisma.notification.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    // Achievement notifications bypass the limit
    if (countToday >= MAX_NOTIFICATIONS_PER_DAY && type !== 'ACHIEVEMENT') {
      return false;
    }

    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    });

    return true;
  }

  /**
   * Get unread notifications for a user
   */
  async getUnread(userId: string) {
    return prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Get all recent notifications
   */
  async getRecent(userId: string, page = 1, limit = 20) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Mark notification as read
   */
  async markRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return result.count > 0;
  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  /**
   * Send streak warning 2 hours before midnight
   */
  async sendStreakWarnings(): Promise<number> {
    const streaks = await prisma.userStreak.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastActivityAt: { lt: new Date(Date.now() - 20 * 3600000) }, // No activity in last 20 hours
      },
    });

    let sent = 0;
    for (const streak of streaks) {
      const success = await this.send(
        streak.userId,
        'STREAK_WARNING',
        `Your ${streak.currentStreak}-day streak is on the line!`,
        'Quick match before midnight to keep your streak alive.',
        { currentStreak: streak.currentStreak },
      );
      if (success) sent++;
    }

    return sent;
  }
}

export const notificationService = new NotificationService();
