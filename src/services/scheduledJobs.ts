import { eloDecayService } from './eloDecayService';
import { notificationService } from './notificationService';
import { streakService } from './streakService';

export class ScheduledJobs {
  private intervals: NodeJS.Timeout[] = [];

  start() {
    console.log('[ScheduledJobs] Starting scheduled tasks...');

    // ELO decay check - every hour
    this.intervals.push(setInterval(async () => {
      try {
        const result = await eloDecayService.runDecay();
        console.log(`[ScheduledJobs] ELO decay check complete — decayed: ${result.decayed}, warned: ${result.warned}`);
      } catch (err) {
        console.error('[ScheduledJobs] ELO decay error:', err);
      }
    }, 60 * 60 * 1000));

    // Streak warnings - every hour
    this.intervals.push(setInterval(async () => {
      try {
        const sent = await notificationService.sendStreakWarnings();
        if (sent > 0) console.log(`[ScheduledJobs] Sent ${sent} streak warnings`);
      } catch (err) {
        console.error('[ScheduledJobs] Streak warning error:', err);
      }
    }, 60 * 60 * 1000));

    // Weekly freeze grants - every 24 hours, check if Sunday
    this.intervals.push(setInterval(async () => {
      try {
        if (new Date().getUTCDay() === 0) { // Sunday
          await streakService.grantWeeklyFreezes();
          console.log('[ScheduledJobs] Weekly freezes granted');
        }
      } catch (err) {
        console.error('[ScheduledJobs] Weekly freeze error:', err);
      }
    }, 24 * 60 * 60 * 1000));

    // Run decay immediately on startup
    eloDecayService.runDecay().catch(err =>
      console.error('[ScheduledJobs] Initial decay check error:', err)
    );

    console.log('[ScheduledJobs] Scheduled tasks active');
  }

  stop() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    console.log('[ScheduledJobs] Scheduled tasks stopped');
  }
}

export const scheduledJobs = new ScheduledJobs();
