import { logger } from "firebase-functions/v2";
import {
  onSchedule,
  type ScheduledEvent,
} from "firebase-functions/v2/scheduler";

// Handler is exported separately so it can be unit-tested without invoking
// the Firebase Functions builder wrapper.
export async function runDailyCleanup(event: ScheduledEvent): Promise<void> {
  logger.info("Daily cleanup started", {
    scheduledAt: event.scheduleTime,
    jobName: event.jobName,
  });

  // TODO: implement cleanup logic (e.g. purge stale docs, expire tokens).

  logger.info("Daily cleanup finished");
}

export const dailyCleanup = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "UTC",
    region: "us-central1",
    retryCount: 3,
  },
  runDailyCleanup,
);
