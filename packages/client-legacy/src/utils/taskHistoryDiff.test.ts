import { describe, it, expect } from 'vitest';
import { diffTaskChanges } from './taskHistoryDiff';
import type { Task, Label, Sprint } from '../types/board';
import type { Collaborator } from '../hooks/useCollaboratorsQuery';
import { Timestamp } from 'firebase/firestore';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  listId: 'list-1',
  title: 'Test Task',
  order: 'a0',
  calendarSyncEnabled: false,
  createdBy: 'user-1',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

const labels: Label[] = [
  {
    id: 'label-1',
    name: 'Bug',
    color: '#ff0000',
    order: 'a0',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    id: 'label-2',
    name: 'Feature',
    color: '#00ff00',
    order: 'a1',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
];

const collaborators: Collaborator[] = [
  { id: 'user-1', name: 'Alice', email: 'alice@test.com', isOwner: false },
  { id: 'user-2', name: 'Bob', email: 'bob@test.com', isOwner: false },
];

const sprints: Sprint[] = [
  {
    id: 'sprint-1',
    name: 'Sprint 1',
    startDate: Timestamp.now(),
    endDate: Timestamp.now(),
    order: 'a0',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
];

const baseContext = {
  userId: 'user-1',
  labels,
  collaborators,
  lists: [
    { id: 'list-1', title: 'To Do' },
    { id: 'list-2', title: 'Done' },
  ],
  sprints,
};

describe('diffTaskChanges', () => {
  it('returns empty array when no changes', () => {
    const task = createTask({ title: 'Hello' });
    const entries = diffTaskChanges(task, {}, baseContext);
    expect(entries).toEqual([]);
  });

  describe('label changes', () => {
    it('detects label added', () => {
      const task = createTask({ labelIds: [] });
      const entries = diffTaskChanges(
        task,
        { labelIds: ['label-1'] },
        baseContext,
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('label_added');
      expect(entries[0].metadata?.labelName).toBe('Bug');
    });

    it('detects label removed', () => {
      const task = createTask({ labelIds: ['label-1'] });
      const entries = diffTaskChanges(task, { labelIds: [] }, baseContext);
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('label_removed');
      expect(entries[0].metadata?.labelName).toBe('Bug');
    });

    it('detects multiple label changes', () => {
      const task = createTask({ labelIds: ['label-1'] });
      const entries = diffTaskChanges(
        task,
        { labelIds: ['label-2'] },
        baseContext,
      );
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.action === 'label_removed')).toBeDefined();
      expect(entries.find((e) => e.action === 'label_added')).toBeDefined();
    });
  });

  describe('assignee changes', () => {
    it('detects assignee added', () => {
      const task = createTask({ assignedTo: [] });
      const entries = diffTaskChanges(
        task,
        { assignedTo: ['user-2'] },
        baseContext,
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('assignee_added');
      expect(entries[0].metadata?.userName).toBe('Bob');
    });

    it('detects assignee removed', () => {
      const task = createTask({ assignedTo: ['user-2'] });
      const entries = diffTaskChanges(task, { assignedTo: [] }, baseContext);
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('assignee_removed');
      expect(entries[0].metadata?.userName).toBe('Bob');
    });
  });

  describe('completion status', () => {
    it('detects completed', () => {
      const task = createTask();
      const entries = diffTaskChanges(
        task,
        { completedAt: new Date() },
        baseContext,
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('completed');
    });

    it('detects reopened', () => {
      const task = createTask({ completedAt: Timestamp.now() });
      const entries = diffTaskChanges(task, { completedAt: null }, baseContext);
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('reopened');
    });
  });

  describe('field changes', () => {
    it('detects title change', () => {
      const task = createTask({ title: 'Old Title' });
      const entries = diffTaskChanges(
        task,
        { title: 'New Title' },
        baseContext,
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('field_changed');
      expect(entries[0].field).toBe('title');
      expect(entries[0].metadata?.oldValue).toBe('Old Title');
      expect(entries[0].metadata?.newValue).toBe('New Title');
    });

    it('detects color change', () => {
      const task = createTask({ color: '#ff0000' });
      const entries = diffTaskChanges(task, { color: '#00ff00' }, baseContext);
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('field_changed');
      expect(entries[0].field).toBe('color');
    });

    it('detects sprint change', () => {
      const task = createTask({ sprintId: undefined });
      const entries = diffTaskChanges(
        task,
        { sprintId: 'sprint-1' },
        baseContext,
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('field_changed');
      expect(entries[0].field).toBe('sprint');
      expect(entries[0].metadata?.newValue).toBe('Sprint 1');
    });

    it('does not log when value unchanged', () => {
      const task = createTask({ title: 'Same' });
      const entries = diffTaskChanges(task, { title: 'Same' }, baseContext);
      expect(entries).toHaveLength(0);
    });
  });

  it('handles multiple changes at once', () => {
    const task = createTask({ title: 'Old', labelIds: [], assignedTo: [] });
    const entries = diffTaskChanges(
      task,
      {
        title: 'New',
        labelIds: ['label-1'],
        assignedTo: ['user-2'],
      },
      baseContext,
    );
    expect(entries.length).toBe(3);
  });
});
