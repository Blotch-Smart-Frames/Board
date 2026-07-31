import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LabelManagement } from './label-management';
import { LabelService } from '../../../core/services/label.service';
import type { Label } from '../../../shared/types/board';

function ts(): Timestamp {
  return { toDate: () => new Date() } as Timestamp;
}

function fakeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'label-1',
    name: 'Bug',
    color: '#EF4444',
    order: 'a0',
    createdAt: ts(),
    updatedAt: ts(),
    ...overrides,
  };
}

function fakeLabelService() {
  return {
    createLabel: vi.fn().mockResolvedValue(fakeLabel()),
    updateLabel: vi.fn().mockResolvedValue(undefined),
    deleteLabel: vi.fn().mockResolvedValue(undefined),
  };
}

async function openWith(labels: Label[]) {
  const labelService = fakeLabelService();
  const view = await render(LabelManagement, {
    inputs: { boardId: 'board-1', labels },
    providers: [{ provide: LabelService, useValue: labelService }],
  });
  view.fixture.componentInstance.open();
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, labelService };
}

describe('LabelManagement', () => {
  it('shows the Manage Labels heading and a row per provided label', async () => {
    await openWith([
      fakeLabel({ id: 'l1', name: 'Bug', order: 'a0' }),
      fakeLabel({ id: 'l2', name: 'Feature', order: 'a1' }),
    ]);

    expect(await screen.findByRole('heading', { name: /manage labels/i })).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('shows an empty state when there are no labels', async () => {
    await openWith([]);

    expect(await screen.findByRole('heading', { name: /manage labels/i })).toBeInTheDocument();
    expect(screen.getByText(/no labels yet/i)).toBeInTheDocument();
  });

  it('edits a label: opens it prefilled and saves the change via updateLabel', async () => {
    const user = userEvent.setup();
    const label = fakeLabel({ id: 'l1', name: 'Bug' });
    const { labelService } = await openWith([label]);

    await user.click(await screen.findByRole('button', { name: 'Edit label' }));

    expect(await screen.findByRole('heading', { name: /edit label/i })).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toHaveValue('Bug');

    await user.clear(nameInput);
    await user.type(nameInput, 'Bugfix');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(labelService.updateLabel).toHaveBeenCalledWith('board-1', 'l1', expect.objectContaining({ name: 'Bugfix' })),
    );
  });

  it('deletes a label via deleteLabel', async () => {
    const user = userEvent.setup();
    const label = fakeLabel({ id: 'l1', name: 'Bug' });
    const { labelService } = await openWith([label]);

    await user.click(await screen.findByRole('button', { name: 'Delete label' }));

    await waitFor(() => expect(labelService.deleteLabel).toHaveBeenCalledWith('board-1', 'l1'));
  });

  it('creates a label: opens the editor empty and saves via createLabel', async () => {
    const user = userEvent.setup();
    const { labelService } = await openWith([]);

    await user.click(await screen.findByRole('button', { name: /create new label/i }));

    expect(await screen.findByRole('heading', { name: /create label/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');

    await user.type(screen.getByLabelText('Name'), 'New Label');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(labelService.createLabel).toHaveBeenCalledWith('board-1', expect.objectContaining({ name: 'New Label' })),
    );
  });
});
