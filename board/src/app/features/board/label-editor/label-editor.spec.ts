import type { Timestamp } from 'firebase/firestore';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LabelEditor } from './label-editor';
import { labelColors } from '../../../core/config/default-labels';
import type { Label } from '../../../shared/types/board';

function fakeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'l1',
    name: 'Urgent',
    color: labelColors[0],
    order: 'a0',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

async function openWith(label: Label | null, saveHandler = vi.fn().mockResolvedValue(undefined)) {
  const view = await render(LabelEditor, { inputs: { saveHandler } });
  view.fixture.componentInstance.open(label);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, saveHandler };
}

describe('LabelEditor', () => {
  it('opens in create mode with an empty name field', async () => {
    await openWith(null);

    expect(await screen.findByRole('heading', { name: /create label/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('opens in edit mode prefilled from the label', async () => {
    await openWith(fakeLabel({ name: 'Bug', emoji: '🐛' }));

    expect(await screen.findByRole('heading', { name: /edit label/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Bug');
    expect(screen.getByLabelText(/emoji/i)).toHaveValue('🐛');
  });

  it('saves a trimmed name with no emoji when created', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(null);

    await user.type(await screen.findByLabelText('Name'), '  Bug  ');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(saveHandler).toHaveBeenCalledWith({ name: 'Bug', color: labelColors[0], emoji: undefined }),
    );
  });

  it('blocks saving when the name is empty', async () => {
    const { saveHandler } = await openWith(null);

    expect(await screen.findByRole('button', { name: /^create$/i })).toBeDisabled();
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('shows a validation error and blocks saving when the emoji exceeds 4 characters', async () => {
    const { saveHandler, fixture } = await openWith(fakeLabel());

    // The native `maxlength` attribute (auto-applied from the maxLength() validator) blocks
    // keystrokes past 4 chars, so a real paste/IME-composed overflow is simulated by setting
    // the value directly rather than via userEvent.type.
    const emoji = await screen.findByLabelText(/emoji/i);
    fireEvent.input(emoji, { target: { value: 'toolong' } });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(screen.getByText(/emoji must be 4 characters or fewer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('saves the picked color when a swatch is clicked', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(null);

    await user.type(await screen.findByLabelText('Name'), 'Bug');
    await user.click(screen.getByRole('radio', { name: labelColors[3] }));
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(saveHandler).toHaveBeenCalledWith({ name: 'Bug', color: labelColors[3], emoji: undefined }),
    );
  });
});
