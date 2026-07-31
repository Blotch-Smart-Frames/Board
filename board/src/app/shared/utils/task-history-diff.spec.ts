import type { Timestamp } from 'firebase/firestore';
import { diffTaskChanges } from './task-history-diff';
import type { Task, Label, Collaborator, Attachment } from '../types/board';

type DiffContext = Parameters<typeof diffTaskChanges>[2];

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Write tests',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

function fakeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'l1',
    name: 'Urgent',
    color: '#EF4444',
    order: 'a0',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: 'u2',
    email: 'jane@example.com',
    name: 'Jane Doe',
    isOwner: false,
    ...overrides,
  };
}

function fakeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att1',
    fileName: 'report.pdf',
    fileSize: 1024,
    fileType: 'application/pdf',
    storagePath: 'boards/b1/attachments/att1',
    downloadUrl: 'https://example.com/report.pdf',
    uploadedAt: 1700000000000,
    ...overrides,
  };
}

function fakeContext(overrides: Partial<DiffContext> = {}): DiffContext {
  return {
    userId: 'u1',
    labels: [],
    collaborators: [],
    lists: [],
    sprints: [],
    ...overrides,
  };
}

describe('diffTaskChanges', () => {
  it('produces a label_added entry when a label is added', () => {
    const label = fakeLabel({ id: 'l1', name: 'Urgent', color: '#EF4444' });
    const oldTask = fakeTask({ labelIds: [] });
    const context = fakeContext({ labels: [label] });

    const entries = diffTaskChanges(oldTask, { labelIds: ['l1'] }, context);

    expect(entries).toEqual([
      { action: 'label_added', userId: 'u1', metadata: { labelName: 'Urgent', labelColor: '#EF4444' } },
    ]);
  });

  it('produces a label_removed entry when a label is removed', () => {
    const label = fakeLabel({ id: 'l1', name: 'Urgent', color: '#EF4444' });
    const oldTask = fakeTask({ labelIds: ['l1'] });
    const context = fakeContext({ labels: [label] });

    const entries = diffTaskChanges(oldTask, { labelIds: [] }, context);

    expect(entries).toEqual([
      { action: 'label_removed', userId: 'u1', metadata: { labelName: 'Urgent', labelColor: '#EF4444' } },
    ]);
  });

  it('produces an assignee_added entry when an assignee is added', () => {
    const collaborator = fakeCollaborator({ id: 'u2', name: 'Jane Doe' });
    const oldTask = fakeTask({ assignedTo: [] });
    const context = fakeContext({ collaborators: [collaborator] });

    const entries = diffTaskChanges(oldTask, { assignedTo: ['u2'] }, context);

    expect(entries).toEqual([{ action: 'assignee_added', userId: 'u1', metadata: { userName: 'Jane Doe' } }]);
  });

  it('produces an assignee_removed entry when an assignee is removed', () => {
    const collaborator = fakeCollaborator({ id: 'u2', name: 'Jane Doe' });
    const oldTask = fakeTask({ assignedTo: ['u2'] });
    const context = fakeContext({ collaborators: [collaborator] });

    const entries = diffTaskChanges(oldTask, { assignedTo: [] }, context);

    expect(entries).toEqual([{ action: 'assignee_removed', userId: 'u1', metadata: { userName: 'Jane Doe' } }]);
  });

  it('produces an attachment_added entry when an attachment is added', () => {
    const attachment = fakeAttachment({ id: 'att1', fileName: 'report.pdf' });
    const oldTask = fakeTask({ attachments: [] });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { attachments: [attachment] }, context);

    expect(entries).toEqual([{ action: 'attachment_added', userId: 'u1', metadata: { fileName: 'report.pdf' } }]);
  });

  it('produces an attachment_removed entry when an attachment is removed', () => {
    const attachment = fakeAttachment({ id: 'att1', fileName: 'report.pdf' });
    const oldTask = fakeTask({ attachments: [attachment] });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { attachments: [] }, context);

    expect(entries).toEqual([
      { action: 'attachment_removed', userId: 'u1', metadata: { fileName: 'report.pdf' } },
    ]);
  });

  it('produces both attachment_added and attachment_removed entries when one is swapped for another', () => {
    const oldAttachment = fakeAttachment({ id: 'att1', fileName: 'old.pdf' });
    const newAttachment = fakeAttachment({ id: 'att2', fileName: 'new.pdf' });
    const oldTask = fakeTask({ attachments: [oldAttachment] });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { attachments: [newAttachment] }, context);

    expect(entries).toEqual([
      { action: 'attachment_added', userId: 'u1', metadata: { fileName: 'new.pdf' } },
      { action: 'attachment_removed', userId: 'u1', metadata: { fileName: 'old.pdf' } },
    ]);
  });

  it('produces a completed entry when completedAt transitions from unset to a date', () => {
    const oldTask = fakeTask();
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { completedAt: new Date(2026, 0, 1) }, context);

    expect(entries).toEqual([{ action: 'completed', userId: 'u1' }]);
  });

  it('produces a reopened entry when completedAt transitions from set to null', () => {
    const oldTask = fakeTask({ completedAt: ts(new Date(2026, 0, 1)) });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { completedAt: null }, context);

    expect(entries).toEqual([{ action: 'reopened', userId: 'u1' }]);
  });

  it('produces a field_changed entry when the title changes', () => {
    const oldTask = fakeTask({ title: 'Old title' });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { title: 'New title' }, context);

    expect(entries).toEqual([
      {
        action: 'field_changed',
        field: 'title',
        userId: 'u1',
        metadata: { oldValue: 'Old title', newValue: 'New title' },
      },
    ]);
  });

  it('produces no entry when an update sets a field to its existing value', () => {
    const oldTask = fakeTask({ title: 'Same title' });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { title: 'Same title' }, context);

    expect(entries).toEqual([]);
  });

  it('returns an empty array when the update has no relevant keys', () => {
    const oldTask = fakeTask();
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, {}, context);

    expect(entries).toEqual([]);
  });
});
