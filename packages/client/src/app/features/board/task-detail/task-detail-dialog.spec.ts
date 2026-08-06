import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { provideRouter, Router } from '@angular/router';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideMarkdown } from 'ngx-markdown';
import { TaskDetailDialog } from './task-detail-dialog';
import { BoardStore } from '../data/board.store';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { StorageService } from '../../../core/services/storage.service';
import { SprintService } from '../../../core/services/sprint.service';
import { UserBoardsStore } from '../../boards/data/user-boards.store';
import type { Board, Collaborator, Label, List, Sprint, Task } from '../../../shared/types/board';

// CommentsSection/HistorySection subscribe via collectionSignal, which calls the
// real onSnapshot unless the SDK is mocked. Stub it so it never fires — both
// sections already render an empty state ("No comments yet" / gated behind the
// History tab) in that case.
vi.mock('firebase/firestore', () => {
  // SprintDialog's previewSprint uses Timestamp.now()/fromDate() when rendering.
  class MockTimestamp {
    constructor(private readonly date: Date) {}
    static now(): MockTimestamp {
      return new MockTimestamp(new Date());
    }
    static fromDate(date: Date): MockTimestamp {
      return new MockTimestamp(date);
    }
    toDate(): Date {
      return this.date;
    }
    toMillis(): number {
      return this.date.getTime();
    }
  }
  return {
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({
      type: 'collection',
      path: segments.join('/'),
    })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      type: 'doc',
      path: segments.join('/'),
    })),
    query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({
      type: 'query',
      ref,
      constraints,
    })),
    orderBy: vi.fn((field: string) => ({ orderBy: field })),
    onSnapshot: vi.fn(() => vi.fn()),
    Timestamp: MockTimestamp,
  };
});

// jsdom doesn't implement these; the select's active-descendant key manager and
// the popover overlay's size tracking both touch them as soon as an option list opens.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Existing task',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

function fakeList(id: string, title: string, order: string): List {
  return { id, title, order, createdAt: ts(new Date(2026, 0, 1)) };
}

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return { id: 'u9', email: 'u9@example.com', name: 'Bob', isOwner: false, ...overrides };
}

function fakeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    startDate: ts(new Date(2026, 0, 1)),
    endDate: ts(new Date(2026, 0, 14)),
    order: 'a0',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

type SetupOpts = {
  labels?: Label[];
  collaborators?: Collaborator[];
  lists?: List[];
  sprints?: Sprint[];
  board?: Board | null;
};

function setup(task: Task, opts: SetupOpts = {}) {
  const store = {
    boardId: signal('board-1'),
    tasks: signal<Task[]>([task]),
    labels: signal<Label[]>(opts.labels ?? []),
    collaborators: signal<Collaborator[]>(opts.collaborators ?? []),
    sprints: signal<Sprint[]>(opts.sprints ?? []),
    board: signal<Board | null>(opts.board ?? null),
    listsWithTasks: signal(
      (opts.lists ?? [fakeList('list-1', 'To Do', 'a0')]).map((l) => ({ ...l, tasks: [] })),
    ),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTaskToList: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
  };
  const sprintService = {
    calculateNextSprintDates: vi.fn().mockResolvedValue({
      startDate: new Date(2026, 1, 1),
      endDate: new Date(2026, 1, 14),
      suggestedName: 'Sprint 2',
    }),
    createSprint: vi.fn().mockResolvedValue({}),
    updateSprint: vi.fn().mockResolvedValue(undefined),
    deleteSprint: vi.fn().mockResolvedValue(undefined),
    updateSprintConfig: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    sprintService,
    providers: [
      provideRouter([]),
      { provide: BoardStore, useValue: store },
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: AuthStore, useValue: { user: signal({ uid: 'u1' }) } },
      { provide: BoardService, useValue: {} },
      { provide: StorageService, useValue: {} },
      { provide: SprintService, useValue: sprintService },
      { provide: UserBoardsStore, useValue: { boards: signal([]) } },
      provideMarkdown(),
    ],
  };
}

async function openWith(task: Task, opts: SetupOpts = {}) {
  const { store, sprintService, providers } = setup(task, opts);
  const view = await render(TaskDetailDialog, { providers });
  view.fixture.componentInstance.open(task);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, store, sprintService };
}

describe('TaskDetailDialog', () => {
  it('shows the task title and description', async () => {
    await openWith(fakeTask({ description: 'Some notes', dueDate: ts(new Date(2026, 5, 1)) }));

    expect(await screen.findByRole('heading', { name: 'Existing task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Some notes');
  });

  it('shows resolved labels for the task', async () => {
    const label: Label = {
      id: 'l1',
      name: 'Urgent',
      color: '#EF4444',
      order: 'a0',
      createdAt: ts(new Date()),
      updatedAt: ts(new Date()),
    };
    await openWith(fakeTask({ labelIds: ['l1'] }), { labels: [label] });

    expect(await screen.findByText('Urgent')).toBeInTheDocument();
  });

  it('shows "No assignees" and expands into a picker that updates assignments', async () => {
    const user = userEvent.setup();
    const collaborator = fakeCollaborator();
    const { store } = await openWith(fakeTask(), { collaborators: [collaborator] });

    expect(screen.getByText('No assignees')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit assignees' }));
    await user.click(screen.getByRole('checkbox', { name: 'Assign Bob' }));

    expect(store.updateTask).toHaveBeenCalledWith('t1', { assignedTo: ['u9'] });
  });

  it('moves the task to a different list through the List select', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask({ listId: 'list-1' }), {
      lists: [fakeList('list-1', 'To Do', 'a0'), fakeList('list-2', 'Doing', 'a1')],
    });

    await user.click(screen.getByRole('combobox', { name: 'List' }));
    await user.click(await screen.findByRole('option', { name: 'Doing' }));

    expect(store.moveTaskToList).toHaveBeenCalledWith('t1', 'list-2');
  });

  it('saves an edited title after clicking it and blurring', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    await user.click(await screen.findByRole('heading', { name: 'Existing task' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.type(input, 'Updated title');
    await user.tab();

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { title: 'Updated title' }),
    );
  });

  it('does not save an empty title and reverts it on blur', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    await user.click(await screen.findByRole('heading', { name: 'Existing task' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.tab();

    expect(store.updateTask).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Existing task' })).toBeInTheDocument();
  });

  it('saves an edited description on blur', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    const description = screen.getByLabelText('Description');
    await user.type(description, 'New notes');
    await user.tab();

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { description: 'New notes' }),
    );
  });

  it('sets the task start and due dates when a sprint is clicked on the Sprint tab', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask(), {
      sprints: [fakeSprint({ name: 'Sprint A' })],
    });

    await user.click(screen.getByRole('tab', { name: 'Sprint' }));

    // Click the sprint entry in the sprint-management list; that sets the task's
    // start & due dates from the sprint's range.
    await user.click(await screen.findByRole('button', { name: /sprint a/i }));

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ startDate: expect.any(Date), dueDate: expect.any(Date) }),
      ),
    );
  });

  it('deletes the task and closes the dialog when Delete is clicked', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    await user.click(await screen.findByRole('button', { name: /delete/i }));

    expect(store.deleteTask).toHaveBeenCalledWith('t1');
  });

  it('shows a synthetic "created this task" row on the History tab', async () => {
    const user = userEvent.setup();
    const creator = fakeCollaborator({ id: 'u1', name: 'Alice' });
    await openWith(fakeTask({ createdBy: 'u1', createdAt: ts(new Date(2026, 0, 1)) }), {
      collaborators: [creator],
    });

    await user.click(screen.getByRole('tab', { name: 'History' }));

    expect(await screen.findByText(/alice created this task/i)).toBeInTheDocument();
  });

  describe('calendar sync toggle', () => {
    // The sync toggle lives on the Sprint tab alongside the due date controls.
    // hlm-tabs sets `hidden` on inactive tabpanels, which excludes them from the
    // accessibility tree — role queries can't see the switch until we activate
    // the tab. `getByText` still finds the hint because it walks the DOM
    // directly, which is why the hint test doesn't need to switch tabs.
    it('is disabled when there is no due date', async () => {
      const user = userEvent.setup();
      await openWith(fakeTask({ dueDate: undefined }));

      await user.click(screen.getByRole('tab', { name: 'Sprint' }));

      const toggle = await screen.findByRole('switch', { name: /sync with google calendar/i });
      expect(toggle).toHaveAttribute('data-disabled', 'true');
    });

    it('shows a hint when the due date is empty', async () => {
      await openWith(fakeTask({ dueDate: undefined }));

      expect(screen.getByText(/set a due date to enable calendar sync/i)).toBeInTheDocument();
    });

    it('saves calendarSyncEnabled: true when toggled on with a due date set', async () => {
      const user = userEvent.setup();
      const { store } = await openWith(fakeTask({ dueDate: ts(new Date(2026, 5, 1)) }));

      await user.click(screen.getByRole('tab', { name: 'Sprint' }));

      await user.click(await screen.findByRole('switch', { name: /sync with google calendar/i }));

      await waitFor(() =>
        expect(store.updateTask).toHaveBeenCalledWith('t1', { calendarSyncEnabled: true }),
      );
    });
  });

  describe('inlined sprint management', () => {
    function fakeBoard(overrides: Partial<Board> = {}): Board {
      return {
        id: 'board-1',
        title: 'My board',
        ownerId: 'u1',
        collaborators: [],
        createdAt: ts(new Date()),
        updatedAt: ts(new Date()),
        ...overrides,
      };
    }

    async function openSprintTab(opts: SetupOpts = {}) {
      const user = userEvent.setup();
      const result = await openWith(fakeTask(), opts);
      await user.click(screen.getByRole('tab', { name: 'Sprint' }));
      return { user, ...result };
    }

    it('disables Save until the duration changes, then persists it', async () => {
      const { user, sprintService } = await openSprintTab({
        board: fakeBoard({ sprintConfig: { durationDays: 14 } }),
      });

      // The duration input + its Save button live inside the create-sprint
      // dialog, which is opened by the "Create Sprint" button on the tab.
      await user.click(screen.getByRole('button', { name: /create sprint/i }));

      const saveButton = await screen.findByRole('button', { name: /^save$/i });
      expect(saveButton).toBeDisabled();

      const input = screen.getByLabelText('Default sprint duration');
      await user.clear(input);
      await user.type(input, '21');
      await user.click(saveButton);

      await waitFor(() =>
        expect(sprintService.updateSprintConfig).toHaveBeenCalledWith('board-1', {
          durationDays: 21,
        }),
      );
    });

    it('shows an empty state when there are no sprints', async () => {
      await openSprintTab();

      expect(await screen.findByText('No sprints created yet')).toBeInTheDocument();
    });

    it('edits a sprint through the nested dialog', async () => {
      const sprint = fakeSprint({ name: 'Sprint A' });
      const { user, sprintService } = await openSprintTab({ sprints: [sprint] });

      await user.click(screen.getByRole('button', { name: 'Edit sprint' }));
      const editDialog = await screen.findByRole('dialog', { name: /edit sprint/i });
      const name = within(editDialog).getByLabelText('Sprint Name');
      await user.clear(name);
      await user.type(name, 'Sprint A renamed');
      await user.click(within(editDialog).getByRole('button', { name: /^save$/i }));

      await waitFor(() =>
        expect(sprintService.updateSprint).toHaveBeenCalledWith(
          'board-1',
          's1',
          expect.objectContaining({ name: 'Sprint A renamed' }),
        ),
      );
    });

    it('surfaces an error when the delete operation fails', async () => {
      const sprint = fakeSprint();
      const { user, sprintService } = await openSprintTab({ sprints: [sprint] });
      sprintService.deleteSprint.mockRejectedValueOnce(new Error('Network error'));

      await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

      expect(await screen.findByText(/network error/i)).toBeInTheDocument();
      expect(sprintService.deleteSprint).toHaveBeenCalledWith('board-1', 's1');
    });

    it('deletes a sprint when no tasks are assigned', async () => {
      const sprint = fakeSprint();
      const { user, sprintService } = await openSprintTab({ sprints: [sprint] });

      await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

      await waitFor(() => expect(sprintService.deleteSprint).toHaveBeenCalledWith('board-1', 's1'));
    });
  });

  describe('advanced tab', () => {
    it('exposes an Advanced tab with the migrate form', async () => {
      const user = userEvent.setup();
      await openWith(fakeTask());

      await user.click(screen.getByRole('tab', { name: 'Advanced' }));

      expect(
        await screen.findByRole('heading', { name: /move to another board/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /move task/i })).toBeDisabled();
    });

    it('shows a success view when the migrate form emits migrated, without closing the dialog', async () => {
      const user = userEvent.setup();
      const { fixture } = await openWith(fakeTask());

      await user.click(screen.getByRole('tab', { name: 'Advanced' }));

      const migrate = fixture.debugElement.query((el) => el.name === 'app-task-migrate-form');
      (
        migrate.componentInstance as {
          migrated: { emit: (v: { boardId: string; boardTitle: string }) => void };
        }
      ).migrated.emit({ boardId: 'board-2', boardTitle: 'Other Board' });

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /task moved/i })).toBeInTheDocument(),
      );
      expect(screen.getByRole('button', { name: /go to other board/i })).toBeInTheDocument();
      // Original task heading is gone because the success branch replaces it.
      expect(screen.queryByRole('heading', { name: 'Existing task' })).not.toBeInTheDocument();
    });

    it('navigates to the target board and closes when Go to X is clicked', async () => {
      const user = userEvent.setup();
      const { fixture } = await openWith(fakeTask());
      const navigate = vi
        .spyOn(fixture.debugElement.injector.get(Router), 'navigate')
        .mockResolvedValue(true);

      await user.click(screen.getByRole('tab', { name: 'Advanced' }));

      const migrate = fixture.debugElement.query((el) => el.name === 'app-task-migrate-form');
      (
        migrate.componentInstance as {
          migrated: { emit: (v: { boardId: string; boardTitle: string }) => void };
        }
      ).migrated.emit({ boardId: 'board-2', boardTitle: 'Other Board' });

      const goTo = await screen.findByRole('button', { name: /go to other board/i });
      await user.click(goTo);

      await waitFor(() => expect(navigate).toHaveBeenCalledWith(['/board', 'board-2']));
      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: /task moved/i })).not.toBeInTheDocument(),
      );
    });

    it('closes when the success view Close button is clicked', async () => {
      const user = userEvent.setup();
      const { fixture } = await openWith(fakeTask());

      await user.click(screen.getByRole('tab', { name: 'Advanced' }));

      const migrate = fixture.debugElement.query((el) => el.name === 'app-task-migrate-form');
      (
        migrate.componentInstance as {
          migrated: { emit: (v: { boardId: string; boardTitle: string }) => void };
        }
      ).migrated.emit({ boardId: 'board-2', boardTitle: 'Other Board' });

      const closeButtons = await screen.findAllByRole('button', { name: /^close$/i });
      await user.click(closeButtons[closeButtons.length - 1]);

      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: /task moved/i })).not.toBeInTheDocument(),
      );
    });
  });

  it('closes the dialog when the footer Close button is clicked', async () => {
    const user = userEvent.setup();
    await openWith(fakeTask());

    // The dialog also renders an icon-only "Close" button in the header, so
    // find the footer's outline-variant Close (the last matching entry).
    const closeButtons = await screen.findAllByRole('button', { name: /^close$/i });
    await user.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Existing task' })).not.toBeInTheDocument(),
    );
  });

  it('logs but does not throw when deleting fails', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = await openWith(fakeTask());
    store.deleteTask.mockRejectedValueOnce(new Error('offline'));

    await user.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Task delete failed:', expect.any(Error)),
    );
    consoleError.mockRestore();
  });

  it('renders nothing but the shell when no task is currently open', async () => {
    // The dialog is rendered but open() is never called — task() stays undefined.
    const task = fakeTask();
    const { store, providers } = setup(task);
    // Make store.tasks empty so task() is undefined even after open.
    store.tasks.set([]);
    const view = await render(TaskDetailDialog, { providers });
    view.fixture.componentInstance.open(task);
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    // The `@if (task(); as task)` gate hides the destructive "Delete" button
    // (label "Delete") — the icon-only close button in the dialog corner is
    // named "Close" and still renders.
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it('is a no-op when the title change handler runs without a matching task', async () => {
    const task = fakeTask();
    const { store, providers } = setup(task);
    store.tasks.set([]);
    const view = await render(TaskDetailDialog, { providers });

    view.fixture.componentInstance['onTitleChange']('should not be saved');

    expect(store.updateTask).not.toHaveBeenCalled();
  });

  it('is a no-op when the delete flow runs without a matching task', async () => {
    const task = fakeTask();
    const { store, providers } = setup(task);
    store.tasks.set([]);
    const view = await render(TaskDetailDialog, { providers });

    await view.fixture.componentInstance['deleteTask']();

    expect(store.deleteTask).not.toHaveBeenCalled();
  });
});
