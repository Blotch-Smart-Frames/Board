import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundImageUpload } from './BackgroundImageUpload';

const mockUploadBoardBackground = vi.fn();
const mockDeleteBoardBackground = vi.fn();
const mockUpdateBoard = vi.fn();

vi.mock('../../services/storageService', () => ({
  uploadBoardBackground: (...args: unknown[]) =>
    mockUploadBoardBackground(...args),
  deleteBoardBackground: (...args: unknown[]) =>
    mockDeleteBoardBackground(...args),
}));

vi.mock('../../services/boardService', () => ({
  updateBoard: (...args: unknown[]) => mockUpdateBoard(...args),
}));

vi.mock('firebase/firestore', () => ({
  deleteField: vi.fn(() => '__deleteField__'),
}));

describe('BackgroundImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the FAB button', () => {
    render(<BackgroundImageUpload boardId="board-1" hasBackground={false} />);

    expect(
      screen.getByRole('button', { name: 'Board background options' }),
    ).toBeInTheDocument();
  });

  it('opens dialog when FAB clicked', async () => {
    const user = userEvent.setup();
    render(<BackgroundImageUpload boardId="board-1" hasBackground={false} />);

    await user.click(
      screen.getByRole('button', { name: 'Board background options' }),
    );

    expect(screen.getByText('Board background')).toBeInTheDocument();
    expect(screen.getByText('Upload new image')).toBeInTheDocument();
  });

  it('shows remove option when hasBackground is true', async () => {
    const user = userEvent.setup();
    render(<BackgroundImageUpload boardId="board-1" hasBackground={true} />);

    await user.click(
      screen.getByRole('button', { name: 'Board background options' }),
    );

    expect(screen.getByText('Remove background')).toBeInTheDocument();
  });

  it('does not show remove option when hasBackground is false', async () => {
    const user = userEvent.setup();
    render(<BackgroundImageUpload boardId="board-1" hasBackground={false} />);

    await user.click(
      screen.getByRole('button', { name: 'Board background options' }),
    );

    expect(screen.queryByText('Remove background')).not.toBeInTheDocument();
  });

  it('removes background when remove clicked', async () => {
    const user = userEvent.setup();
    mockDeleteBoardBackground.mockResolvedValue(undefined);
    mockUpdateBoard.mockResolvedValue(undefined);

    render(<BackgroundImageUpload boardId="board-1" hasBackground={true} />);

    await user.click(
      screen.getByRole('button', { name: 'Board background options' }),
    );
    await user.click(screen.getByText('Remove background'));

    expect(mockDeleteBoardBackground).toHaveBeenCalledWith('board-1');
    expect(mockUpdateBoard).toHaveBeenCalled();
  });
});
