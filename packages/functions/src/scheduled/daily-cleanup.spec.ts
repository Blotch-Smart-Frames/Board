import { describe, expect, it, vi } from "vitest";
import type { ScheduledEvent } from "firebase-functions/v2/scheduler";

vi.mock("firebase-functions/v2", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (
    _opts: unknown,
    handler: (event: ScheduledEvent) => Promise<void>,
  ) => handler,
}));

import { logger } from "firebase-functions/v2";
import { dailyCleanup, runDailyCleanup } from "./daily-cleanup";

function makeEvent(): ScheduledEvent {
  return {
    scheduleTime: "2026-08-04T03:00:00Z",
    jobName: "dailyCleanup",
  } as ScheduledEvent;
}

describe("runDailyCleanup", () => {
  it("logs start and finish without throwing", async () => {
    await expect(runDailyCleanup(makeEvent())).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      "Daily cleanup started",
      expect.objectContaining({ jobName: "dailyCleanup" }),
    );
    expect(logger.info).toHaveBeenCalledWith("Daily cleanup finished");
  });
});

describe("dailyCleanup export", () => {
  it("is defined and callable", async () => {
    expect(dailyCleanup).toBeDefined();
    // With onSchedule mocked to return the handler, we can invoke it directly.
    await expect(
      (dailyCleanup as unknown as (e: ScheduledEvent) => Promise<void>)(
        makeEvent(),
      ),
    ).resolves.toBeUndefined();
  });
});
