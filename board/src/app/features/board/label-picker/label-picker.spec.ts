import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LabelPicker } from './label-picker';
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

describe('LabelPicker', () => {
  it('renders a row per provided label', async () => {
    await render(LabelPicker, {
      inputs: {
        boardId: 'board-1',
        labels: [fakeLabel({ id: 'l1', name: 'Bug' }), fakeLabel({ id: 'l2', name: 'Feature' })],
      },
      providers: [{ provide: LabelService, useValue: fakeLabelService() }],
    });

    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('emits selectedLabelIdsChange with the id added when selecting an unselected label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(LabelPicker, {
      inputs: {
        boardId: 'board-1',
        labels: [fakeLabel({ id: 'l1', name: 'Bug' })],
        selectedLabelIds: [],
      },
      on: { selectedLabelIdsChange: onChange },
      providers: [{ provide: LabelService, useValue: fakeLabelService() }],
    });

    await user.click(screen.getByRole('checkbox', { name: 'Toggle label Bug' }));

    expect(onChange).toHaveBeenCalledWith(['l1']);
  });

  it('emits selectedLabelIdsChange with the id removed when deselecting a selected label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(LabelPicker, {
      inputs: {
        boardId: 'board-1',
        labels: [fakeLabel({ id: 'l1', name: 'Bug' })],
        selectedLabelIds: ['l1'],
      },
      on: { selectedLabelIdsChange: onChange },
      providers: [{ provide: LabelService, useValue: fakeLabelService() }],
    });

    await user.click(screen.getByRole('checkbox', { name: 'Toggle label Bug' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('opens the label management dialog when Manage is clicked', async () => {
    const user = userEvent.setup();
    await render(LabelPicker, {
      inputs: { boardId: 'board-1', labels: [fakeLabel()] },
      providers: [{ provide: LabelService, useValue: fakeLabelService() }],
    });

    await user.click(screen.getByRole('button', { name: /^manage$/i }));

    expect(await screen.findByRole('heading', { name: /manage labels/i })).toBeInTheDocument();
  });

  it('opens the label-editor dialog in create mode when Create label is clicked', async () => {
    const user = userEvent.setup();
    await render(LabelPicker, {
      inputs: { boardId: 'board-1', labels: [] },
      providers: [{ provide: LabelService, useValue: fakeLabelService() }],
    });

    await user.click(screen.getByRole('button', { name: /create label/i }));

    expect(await screen.findByRole('heading', { name: /create label/i })).toBeInTheDocument();
  });

  it('shows an empty state in the manage dialog when there are no labels', async () => {
    const user = userEvent.setup();
    await render(LabelPicker, {
      inputs: { boardId: 'board-1', labels: [] },
      providers: [{ provide: LabelService, useValue: fakeLabelService() }],
    });

    await user.click(screen.getByRole('button', { name: /^manage$/i }));

    expect(await screen.findByRole('heading', { name: /manage labels/i })).toBeInTheDocument();
    expect(screen.getByText(/no labels yet/i)).toBeInTheDocument();
  });

  it('edits a label from the manage dialog and saves via updateLabel', async () => {
    const user = userEvent.setup();
    const labelService = fakeLabelService();
    const label = fakeLabel({ id: 'l1', name: 'Bug' });
    await render(LabelPicker, {
      inputs: { boardId: 'board-1', labels: [label] },
      providers: [{ provide: LabelService, useValue: labelService }],
    });

    await user.click(screen.getByRole('button', { name: /^manage$/i }));
    await user.click(await screen.findByRole('button', { name: 'Edit label' }));

    expect(await screen.findByRole('heading', { name: /edit label/i })).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toHaveValue('Bug');

    await user.clear(nameInput);
    await user.type(nameInput, 'Bugfix');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(labelService.updateLabel).toHaveBeenCalledWith(
        'board-1',
        'l1',
        expect.objectContaining({ name: 'Bugfix' }),
      ),
    );
  });

  it('deletes a label via deleteLabel when the trash icon is clicked', async () => {
    const user = userEvent.setup();
    const labelService = fakeLabelService();
    const label = fakeLabel({ id: 'l1', name: 'Bug' });
    await render(LabelPicker, {
      inputs: { boardId: 'board-1', labels: [label] },
      providers: [{ provide: LabelService, useValue: labelService }],
    });

    await user.click(screen.getByRole('button', { name: /^manage$/i }));
    await user.click(await screen.findByRole('button', { name: 'Delete label' }));

    await waitFor(() => expect(labelService.deleteLabel).toHaveBeenCalledWith('board-1', 'l1'));
  });

  it('creates a label from the manage dialog via createLabel', async () => {
    const user = userEvent.setup();
    const labelService = fakeLabelService();
    await render(LabelPicker, {
      inputs: { boardId: 'board-1', labels: [] },
      providers: [{ provide: LabelService, useValue: labelService }],
    });

    await user.click(screen.getByRole('button', { name: /^manage$/i }));
    await user.click(await screen.findByRole('button', { name: /create new label/i }));

    expect(await screen.findByRole('heading', { name: /create label/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');

    await user.type(screen.getByLabelText('Name'), 'New Label');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(labelService.createLabel).toHaveBeenCalledWith(
        'board-1',
        expect.objectContaining({ name: 'New Label' }),
      ),
    );
  });
});
