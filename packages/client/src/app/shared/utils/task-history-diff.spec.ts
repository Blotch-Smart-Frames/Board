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
    archive: false,
    archivedAt: null,
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
      {
        action: 'label_added',
        userId: 'u1',
        metadata: { labelName: 'Urgent', labelColor: '#EF4444' },
      },
    ]);
  });

  it('produces a label_removed entry when a label is removed', () => {
    const label = fakeLabel({ id: 'l1', name: 'Urgent', color: '#EF4444' });
    const oldTask = fakeTask({ labelIds: ['l1'] });
    const context = fakeContext({ labels: [label] });

    const entries = diffTaskChanges(oldTask, { labelIds: [] }, context);

    expect(entries).toEqual([
      {
        action: 'label_removed',
        userId: 'u1',
        metadata: { labelName: 'Urgent', labelColor: '#EF4444' },
      },
    ]);
  });

  it('produces an assignee_added entry when an assignee is added', () => {
    const collaborator = fakeCollaborator({ id: 'u2', name: 'Jane Doe' });
    const oldTask = fakeTask({ assignedTo: [] });
    const context = fakeContext({ collaborators: [collaborator] });

    const entries = diffTaskChanges(oldTask, { assignedTo: ['u2'] }, context);

    expect(entries).toEqual([
      { action: 'assignee_added', userId: 'u1', metadata: { userName: 'Jane Doe' } },
    ]);
  });

  it('produces an assignee_removed entry when an assignee is removed', () => {
    const collaborator = fakeCollaborator({ id: 'u2', name: 'Jane Doe' });
    const oldTask = fakeTask({ assignedTo: ['u2'] });
    const context = fakeContext({ collaborators: [collaborator] });

    const entries = diffTaskChanges(oldTask, { assignedTo: [] }, context);

    expect(entries).toEqual([
      { action: 'assignee_removed', userId: 'u1', metadata: { userName: 'Jane Doe' } },
    ]);
  });

  it('produces an attachment_added entry when an attachment is added', () => {
    const attachment = fakeAttachment({ id: 'att1', fileName: 'report.pdf' });
    const oldTask = fakeTask({ attachments: [] });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { attachments: [attachment] }, context);

    expect(entries).toEqual([
      { action: 'attachment_added', userId: 'u1', metadata: { fileName: 'report.pdf' } },
    ]);
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

  it('falls back to the label id when the label is not in the workspace lookup', () => {
    const oldTask = fakeTask({ labelIds: ['unknown-1'] });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { labelIds: ['unknown-2'] }, context);

    expect(entries).toEqual([
      {
        action: 'label_added',
        userId: 'u1',
        metadata: { labelName: 'unknown-2', labelColor: undefined },
      },
      {
        action: 'label_removed',
        userId: 'u1',
        metadata: { labelName: 'unknown-1', labelColor: undefined },
      },
    ]);
  });

  it('falls back to the user id when the collaborator is not in the workspace lookup', () => {
    const oldTask = fakeTask({ assignedTo: ['ghost-1'] });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { assignedTo: ['ghost-2'] }, context);

    expect(entries).toEqual([
      { action: 'assignee_added', userId: 'u1', metadata: { userName: 'ghost-2' } },
      { action: 'assignee_removed', userId: 'u1', metadata: { userName: 'ghost-1' } },
    ]);
  });

  it('produces a field_changed entry when startDate changes and formats both dates', () => {
    const oldDate = new Date(2026, 0, 1);
    const newDate = new Date(2026, 1, 15);
    const oldTask = fakeTask({ startDate: ts(oldDate) });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { startDate: newDate }, context);

    expect(entries).toEqual([
      {
        action: 'field_changed',
        field: 'startDate',
        userId: 'u1',
        metadata: {
          oldValue: oldDate.toLocaleDateString(),
          newValue: newDate.toLocaleDateString(),
        },
      },
    ]);
  });

  it('produces a field_changed entry when dueDate changes from unset to a Date', () => {
    const newDate = new Date(2026, 5, 10);
    const oldTask = fakeTask();
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { dueDate: newDate }, context);

    expect(entries).toEqual([
      {
        action: 'field_changed',
        field: 'dueDate',
        userId: 'u1',
        metadata: { oldValue: '', newValue: newDate.toLocaleDateString() },
      },
    ]);
  });

  it('produces no entry when a startDate is re-written to the same instant', () => {
    const date = new Date(2026, 0, 1);
    const oldTask = fakeTask({ startDate: ts(date) });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { startDate: new Date(date.getTime()) }, context);

    expect(entries).toEqual([]);
  });

  it('produces a field_changed entry when clearing a startDate', () => {
    const oldTask = fakeTask({ startDate: ts(new Date(2026, 0, 1)) });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { startDate: null }, context);

    expect(entries).toEqual([
      {
        action: 'field_changed',
        field: 'startDate',
        userId: 'u1',
        metadata: {
          oldValue: new Date(2026, 0, 1).toLocaleDateString(),
          newValue: '',
        },
      },
    ]);
  });

  it('produces a field_changed entry when clearing a dueDate', () => {
    const oldTask = fakeTask({ dueDate: ts(new Date(2026, 0, 1)) });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { dueDate: null }, context);

    expect(entries).toEqual([
      {
        action: 'field_changed',
        field: 'dueDate',
        userId: 'u1',
        metadata: {
          oldValue: new Date(2026, 0, 1).toLocaleDateString(),
          newValue: '',
        },
      },
    ]);
  });

  it('produces a field_changed entry when the description changes', () => {
    const oldTask = fakeTask({ description: 'old' });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { description: 'new' }, context);

    expect(entries).toEqual([
      {
        action: 'field_changed',
        field: 'description',
        userId: 'u1',
        metadata: { oldValue: 'old', newValue: 'new' },
      },
    ]);
  });

  it('produces a field_changed entry when the color changes', () => {
    const oldTask = fakeTask({ color: '#111111' });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { color: '#222222' }, context);

    expect(entries).toEqual([
      {
        action: 'field_changed',
        field: 'color',
        userId: 'u1',
        metadata: { oldValue: '#111111', newValue: '#222222' },
      },
    ]);
  });

  it('treats a null labelIds update the same as an empty array (defensive fallback)', () => {
    const oldTask = fakeTask({ labelIds: ['l1'] });
    const context = fakeContext({ labels: [fakeLabel({ id: 'l1', name: 'Urgent' })] });

    const entries = diffTaskChanges(oldTask, { labelIds: null as unknown as string[] }, context);

    expect(entries).toEqual([
      {
        action: 'label_removed',
        userId: 'u1',
        metadata: { labelName: 'Urgent', labelColor: '#EF4444' },
      },
    ]);
  });

  it('treats a null assignedTo update the same as an empty array (defensive fallback)', () => {
    const oldTask = fakeTask({ assignedTo: ['u2'] });
    const context = fakeContext({ collaborators: [fakeCollaborator({ id: 'u2', name: 'Jane' })] });

    const entries = diffTaskChanges(oldTask, { assignedTo: null as unknown as string[] }, context);

    expect(entries).toEqual([
      { action: 'assignee_removed', userId: 'u1', metadata: { userName: 'Jane' } },
    ]);
  });

  it('treats a null attachments update the same as an empty array (defensive fallback)', () => {
    const oldTask = fakeTask({ attachments: [fakeAttachment({ id: 'a1', fileName: 'x.pdf' })] });
    const context = fakeContext();

    const entries = diffTaskChanges(
      oldTask,
      { attachments: null as unknown as Attachment[] },
      context,
    );

    expect(entries).toEqual([
      { action: 'attachment_removed', userId: 'u1', metadata: { fileName: 'x.pdf' } },
    ]);
  });
  it('treats an oldTask with no labelIds field as an empty selection', async () => {
    const oldTask = { ...fakeTask(), labelIds: undefined };
    const label = fakeLabel({ id: 'l1', name: 'Urgent' });
    const context = fakeContext({ labels: [label] });

    const entries = diffTaskChanges(oldTask, { labelIds: ['l1'] }, context);

    expect(entries).toEqual([
      {
        action: 'label_added',
        userId: 'u1',
        metadata: { labelName: 'Urgent', labelColor: '#EF4444' },
      },
    ]);
  });

  it('treats an oldTask with no assignedTo field as an empty assignment', async () => {
    const oldTask = { ...fakeTask(), assignedTo: undefined };
    const context = fakeContext({
      collaborators: [fakeCollaborator({ id: 'u2', name: 'Bob' })],
    });

    const entries = diffTaskChanges(oldTask, { assignedTo: ['u2'] }, context);

    expect(entries).toEqual([
      { action: 'assignee_added', userId: 'u1', metadata: { userName: 'Bob' } },
    ]);
  });

  it('treats an oldTask with no attachments field as an empty attachment list', async () => {
    const oldTask = { ...fakeTask(), attachments: undefined };
    const newAttachment = fakeAttachment({ id: 'a1', fileName: 'new.pdf' });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { attachments: [newAttachment] }, context);

    expect(entries).toEqual([
      { action: 'attachment_added', userId: 'u1', metadata: { fileName: 'new.pdf' } },
    ]);
  });

  it('produces no add/remove entries when the same attachment list is set twice', async () => {
    const attachment = fakeAttachment({ id: 'a1' });
    const oldTask = fakeTask({ attachments: [attachment] });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { attachments: [attachment] }, context);

    expect(entries).toEqual([]);
  });

  it('formats a startDate change where the incoming value is a non-Date primitive', async () => {
    const oldTask = fakeTask({ startDate: ts(new Date(2026, 0, 1)) });
    const context = fakeContext();

    // Non-Date value exercises the String(val ?? '') fallback path.
    const entries = diffTaskChanges(oldTask, { startDate: 'invalid' as unknown as Date }, context);

    expect(entries[0]).toMatchObject({
      action: 'field_changed',
      field: 'startDate',
      metadata: { newValue: 'invalid' },
    });
  });

  it('produces no entry when a color update sets the same value', async () => {
    const oldTask = fakeTask({ color: '#123456' });
    const context = fakeContext();

    const entries = diffTaskChanges(oldTask, { color: '#123456' }, context);

    expect(entries).toEqual([]);
  });
});
