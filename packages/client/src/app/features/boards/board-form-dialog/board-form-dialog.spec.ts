import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BoardFormDialog } from './board-form-dialog';

async function open(initialTitle = '') {
  const saveHandler = vi.fn().mockResolvedValue(undefined);
  const view = await render(BoardFormDialog, {
    inputs: { heading: 'Create new board', submitLabel: 'Create', saveHandler },
  });
  view.fixture.componentInstance.open(initialTitle);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, saveHandler };
}

describe('BoardFormDialog', () => {
  it('opens with the heading and a prefilled title', async () => {
    await open('Existing name');

    expect(await screen.findByRole('heading', { name: /create new board/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/board title/i)).toHaveValue('Existing name');
  });

  it('saves the trimmed title and closes on success', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await open();

    const input = await screen.findByLabelText(/board title/i);
    await user.type(input, '  New Board  ');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(saveHandler).toHaveBeenCalledWith('New Board');
    await waitFor(() => expect(screen.queryByRole('heading', { name: /create new board/i })).not.toBeInTheDocument());
  });

  it('does not call the save handler when the title is empty', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await open();

    await screen.findByLabelText(/board title/i);
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows an error when saving fails', async () => {
    const user = userEvent.setup();
    const saveHandler = vi.fn().mockRejectedValue(new Error('offline'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = await render(BoardFormDialog, {
      inputs: { heading: 'Create new board', submitLabel: 'Create', saveHandler },
    });
    view.fixture.componentInstance.open();
    view.fixture.detectChanges();

    const input = await screen.findByLabelText(/board title/i);
    await user.type(input, 'New Board');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create new board/i })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
