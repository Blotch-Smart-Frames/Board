import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LabelService } from '../../../../core/services/label.service';
import { TaskMetadataSidebar } from './task-metadata-sidebar';
import type { Collaborator, Label } from '../../../../shared/types/board';

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'l1',
    name: 'Urgent',
    color: '#EF4444',
    order: 'a0',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return { id: 'u1', email: 'u1@example.com', name: 'Alice', isOwner: false, ...overrides };
}

// LabelPicker/LabelEditor/LabelManagement all pull in LabelService via inject().
const providers = [{ provide: LabelService, useValue: {} }];

describe('TaskMetadataSidebar', () => {
  it('renders "No labels" when nothing is selected', async () => {
    await render(TaskMetadataSidebar, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    expect(screen.getByText('No labels')).toBeInTheDocument();
  });

  it('renders chips for selected labels', async () => {
    await render(TaskMetadataSidebar, {
      providers,
      inputs: {
        boardId: 'board-1',
        labels: [fakeLabel({ id: 'l1', name: 'Urgent' }), fakeLabel({ id: 'l2', name: 'Backend' })],
        selectedLabelIds: ['l1'],
      },
    });

    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.queryByText('Backend')).not.toBeInTheDocument();
  });

  it('opens the label picker when the Labels heading is clicked and emits changes', async () => {
    const user = userEvent.setup();
    const onLabelsChange = vi.fn();
    await render(TaskMetadataSidebar, {
      providers,
      inputs: {
        boardId: 'board-1',
        labels: [fakeLabel({ id: 'l1', name: 'Urgent' })],
      },
      on: { selectedLabelIdsChange: onLabelsChange },
    });

    await user.click(screen.getByRole('button', { name: 'Labels' }));
    await user.click(screen.getByRole('checkbox', { name: 'Toggle label Urgent' }));

    expect(onLabelsChange).toHaveBeenCalledWith(['l1']);
  });

  it('renders "No assignees" when the task has none', async () => {
    await render(TaskMetadataSidebar, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    expect(screen.getByText('No assignees')).toBeInTheDocument();
  });

  it('opens the assignee picker when the Assignees heading is clicked and emits changes', async () => {
    const user = userEvent.setup();
    const onAssigneesChange = vi.fn();
    await render(TaskMetadataSidebar, {
      providers,
      inputs: {
        boardId: 'board-1',
        collaborators: [fakeCollaborator({ id: 'u1', name: 'Alice' })],
      },
      on: { assignedUserIdsChange: onAssigneesChange },
    });

    await user.click(screen.getByRole('button', { name: 'Assignees' }));
    await user.click(screen.getByRole('checkbox', { name: 'Assign Alice' }));

    expect(onAssigneesChange).toHaveBeenCalledWith(['u1']);
  });

  it('shows "Unknown" when no creator is provided', async () => {
    await render(TaskMetadataSidebar, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('emits handBack when the Hand back button is clicked', async () => {
    const user = userEvent.setup();
    const onHandBack = vi.fn();
    await render(TaskMetadataSidebar, {
      providers,
      inputs: {
        boardId: 'board-1',
        creator: fakeCollaborator({ id: 'u1', name: 'Alice' }),
      },
      on: { handBack: onHandBack },
    });

    await user.click(screen.getByRole('button', { name: /hand back/i }));

    expect(onHandBack).toHaveBeenCalledTimes(1);
  });

  it('emits colorClear when Clear is clicked and hides Clear when there is no color', async () => {
    const user = userEvent.setup();
    const onColorClear = vi.fn();
    const { rerender } = await render(TaskMetadataSidebar, {
      providers,
      inputs: { boardId: 'board-1', color: '#FF0000' },
      on: { colorClear: onColorClear },
    });

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onColorClear).toHaveBeenCalledTimes(1);

    await rerender({ inputs: { boardId: 'board-1', color: null } });
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });
});
