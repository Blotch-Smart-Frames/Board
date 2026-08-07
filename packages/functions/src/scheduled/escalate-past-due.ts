import { logger } from "firebase-functions/v2";
import {
  onSchedule,
  type ScheduledEvent,
} from "firebase-functions/v2/scheduler";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type {
  EscalationContact,
  EscalationLevel,
  Task,
  User,
} from "@blotch/model";
import { getDb } from "../firebase";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  sendWhatsApp,
} from "../notifications/whatsapp";

const ESCALATION_ORDER: EscalationLevel[] = [
  "none",
  "level-1",
  "level-2",
  "level-3",
];

/**
 * The next level up from the current one, or null when the ticket is already at
 * the top (`level-3`) or the value is unknown. One step per call keeps the
 * "step up each run" cadence.
 */
export function nextEscalationLevel(
  current: EscalationLevel | undefined,
): EscalationLevel | null {
  const index = ESCALATION_ORDER.indexOf(current ?? "none");
  if (index < 0 || index >= ESCALATION_ORDER.length - 1) return null;
  return ESCALATION_ORDER[index + 1] ?? null;
}

// Injectable so unit tests can pass a fake Firestore + a spy sender instead of
// standing up the Admin SDK / Twilio.
export type EscalateDeps = {
  db: Firestore;
  sendWhatsApp: (to: string, body: string) => Promise<void>;
};

function buildMessage(
  task: Task,
  level: EscalationLevel,
  boardTitle: string | undefined,
): string {
  const due = task.dueDate?.toDate();
  const dueText = due ? ` (was due ${due.toDateString()})` : "";
  const boardText = boardTitle ? ` Board: ${boardTitle}.` : "";
  return `⚠️ Ticket "${task.title}" is overdue${dueText} and has been escalated to ${level}.${boardText}`;
}

/**
 * Scan every board's tasks for past-due tickets, bump each one's escalation
 * level by one step, and WhatsApp the contacts configured for the new level on
 * each assignee's profile.
 */
export async function runEscalatePastDue(
  event: ScheduledEvent,
  deps?: Partial<EscalateDeps>,
): Promise<void> {
  const db = deps?.db ?? getDb();
  const send = deps?.sendWhatsApp ?? sendWhatsApp;

  logger.info("Escalation run started", {
    scheduledAt: event.scheduleTime,
    jobName: event.jobName,
  });

  const now = Timestamp.now();
  const snapshot = await db
    .collectionGroup("tasks")
    .where("dueDate", "<", now)
    .get();

  // Cache lookups so repeated assignees/boards aren't fetched twice in a run.
  const userCache = new Map<string, User | null>();
  const boardTitleCache = new Map<string, string | undefined>();

  let scanned = 0;
  let escalated = 0;
  let messagesSent = 0;

  for (const doc of snapshot.docs) {
    scanned++;
    const task = { id: doc.id, ...doc.data() } as Task;

    // Defensive: skip archived tickets and anything not actually past due —
    // null dueDate values can slip past the inequality filter on some SDKs.
    if (task.archive) continue;
    if (!task.dueDate || task.dueDate.toMillis() >= now.toMillis()) continue;

    const next = nextEscalationLevel(task.escalation);
    if (!next) continue; // already at the top level

    // The task's grandparent doc is its board — used for the message body.
    const boardId = doc.ref.parent.parent?.id;
    let boardTitle: string | undefined;
    if (boardId) {
      if (boardTitleCache.has(boardId)) {
        boardTitle = boardTitleCache.get(boardId);
      } else {
        const boardSnap = await db.collection("boards").doc(boardId).get();
        boardTitle = boardSnap.exists
          ? (boardSnap.data()?.["title"] as string | undefined)
          : undefined;
        boardTitleCache.set(boardId, boardTitle);
      }
    }

    // Gather this level's contacts across every assignee, de-duped by number.
    const contacts = await collectContacts(
      db,
      task.assignedTo ?? [],
      next,
      userCache,
    );

    if (contacts.length === 0) {
      logger.warn("No escalation contacts configured for level", {
        taskId: task.id,
        boardId,
        level: next,
      });
    }

    const message = buildMessage(task, next, boardTitle);
    for (const contact of contacts) {
      try {
        await send(contact.number, message);
        messagesSent++;
      } catch (error) {
        logger.error("Failed to send WhatsApp escalation", {
          taskId: task.id,
          to: contact.number,
          level: next,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Bump the level every run for a past-due ticket (step-up cadence), even
    // when no contact is configured for this level.
    await doc.ref.update({ escalation: next, updatedAt: Timestamp.now() });
    escalated++;
  }

  logger.info("Escalation run finished", { scanned, escalated, messagesSent });
}

async function collectContacts(
  db: Firestore,
  assigneeIds: string[],
  level: EscalationLevel,
  userCache: Map<string, User | null>,
): Promise<EscalationContact[]> {
  const contacts: EscalationContact[] = [];
  const seenNumbers = new Set<string>();

  for (const uid of assigneeIds) {
    let user = userCache.get(uid);
    if (user === undefined) {
      const snap = await db.collection("users").doc(uid).get();
      user = snap.exists ? ({ id: snap.id, ...snap.data() } as User) : null;
      userCache.set(uid, user);
    }
    for (const contact of user?.escalationContacts ?? []) {
      if (contact.escalation === level && !seenNumbers.has(contact.number)) {
        seenNumbers.add(contact.number);
        contacts.push(contact);
      }
    }
  }

  return contacts;
}

export const escalatePastDue = onSchedule(
  {
    // Step-up cadence: each daily run advances an overdue ticket one level.
    schedule: "every day 09:00",
    timeZone: "UTC",
    region: "us-central1",
    retryCount: 3,
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM],
  },
  runEscalatePastDue,
);
