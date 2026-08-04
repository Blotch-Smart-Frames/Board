import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BoardService } from '../../../core/services/board.service';
import { StorageService } from '../../../core/services/storage.service';
import { BackgroundImageUpload } from './background-image-upload';

vi.mock('firebase/firestore', () => ({
  deleteField: vi.fn(() => ({ __deleteField: true })),
}));

type Fakes = {
  uploadBoardBackground?: ReturnType<typeof vi.fn>;
  deleteBoardBackground?: ReturnType<typeof vi.fn>;
  updateBoard?: ReturnType<typeof vi.fn>;
};

function setup(overrides: Fakes = {}) {
  const uploadBoardBackground =
    overrides.uploadBoardBackground ?? vi.fn().mockResolvedValue('https://example.com/bg.png');
  const deleteBoardBackground =
    overrides.deleteBoardBackground ?? vi.fn().mockResolvedValue(undefined);
  const updateBoard = overrides.updateBoard ?? vi.fn().mockResolvedValue(undefined);

  return {
    uploadBoardBackground,
    deleteBoardBackground,
    updateBoard,
    providers: [
      { provide: StorageService, useValue: { uploadBoardBackground, deleteBoardBackground } },
      { provide: BoardService, useValue: { updateBoard } },
    ],
  };
}

describe('BackgroundImageUpload', () => {
  it('renders the wallpaper FAB with the expected accessible name', async () => {
    const { providers } = setup();

    await render(BackgroundImageUpload, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    expect(screen.getByRole('button', { name: /board background options/i })).toBeInTheDocument();
  });

  it('shows the upload option, and hides Remove when there is no background', async () => {
    const user = userEvent.setup();
    const { providers } = setup();

    await render(BackgroundImageUpload, {
      providers,
      inputs: { boardId: 'board-1', hasBackground: false },
    });

    await user.click(screen.getByRole('button', { name: /board background options/i }));

    expect(await screen.findByRole('menuitem', { name: /upload new image/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /remove background/i })).not.toBeInTheDocument();
  });

  it('offers Remove background only when hasBackground is true', async () => {
    const user = userEvent.setup();
    const { providers } = setup();

    await render(BackgroundImageUpload, {
      providers,
      inputs: { boardId: 'board-1', hasBackground: true },
    });

    await user.click(screen.getByRole('button', { name: /board background options/i }));

    expect(await screen.findByRole('menuitem', { name: /remove background/i })).toBeInTheDocument();
  });

  it('uploads a selected file and persists the returned URL to the board', async () => {
    const user = userEvent.setup();
    const { providers, uploadBoardBackground, updateBoard } = setup({
      uploadBoardBackground: vi.fn().mockResolvedValue('https://cdn.example.com/bg-1.png'),
    });

    const view = await render(BackgroundImageUpload, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    const fileInput = view.container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['bytes'], 'wallpaper.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await waitFor(() => expect(uploadBoardBackground).toHaveBeenCalledWith('board-1', file));
    await waitFor(() =>
      expect(updateBoard).toHaveBeenCalledWith('board-1', {
        backgroundImageUrl: 'https://cdn.example.com/bg-1.png',
      }),
    );
  });

  it('removes the background by deleting storage and clearing the field via deleteField()', async () => {
    const user = userEvent.setup();
    const { providers, deleteBoardBackground, updateBoard } = setup();

    await render(BackgroundImageUpload, {
      providers,
      inputs: { boardId: 'board-1', hasBackground: true },
    });

    await user.click(screen.getByRole('button', { name: /board background options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /remove background/i }));

    await waitFor(() => expect(deleteBoardBackground).toHaveBeenCalledWith('board-1'));
    await waitFor(() =>
      expect(updateBoard).toHaveBeenCalledWith('board-1', {
        backgroundImageUrl: { __deleteField: true },
      }),
    );
  });

  it('logs and recovers when the upload rejects (does not leave the FAB stuck in loading)', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { providers } = setup({
      uploadBoardBackground: vi.fn().mockRejectedValue(new Error('too big')),
    });

    const view = await render(BackgroundImageUpload, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    const fileInput = view.container.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(fileInput, new File(['bytes'], 'x.png', { type: 'image/png' }));

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /board background options/i })).not.toBeDisabled(),
    );

    consoleError.mockRestore();
  });
});
