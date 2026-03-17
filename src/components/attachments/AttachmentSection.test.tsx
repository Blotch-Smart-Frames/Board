import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentSection } from './AttachmentSection';
import type { Attachment } from '../../types/board';

vi.mock('../../services/storageService', () => ({
  uploadTaskAttachment: vi.fn(),
  deleteTaskAttachment: vi.fn().mockResolvedValue(undefined),
}));

const mockAttachment: Attachment = {
  id: 'att-1',
  fileName: 'photo.jpg',
  fileSize: 1024 * 500,
  fileType: 'image/jpeg',
  storagePath: 'boards/b1/tasks/t1/attachments/att-1.jpg',
  downloadUrl: 'https://example.com/photo.jpg',
  uploadedAt: Date.now(),
};

describe('AttachmentSection', () => {
  const defaultProps = {
    boardId: 'board-1',
    taskId: 'task-1',
    attachments: [] as Attachment[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the attachments heading and upload button', () => {
    render(<AttachmentSection {...defaultProps} />);
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add attachment/i }),
    ).toBeInTheDocument();
  });

  it('renders existing attachments', () => {
    render(
      <AttachmentSection {...defaultProps} attachments={[mockAttachment]} />,
    );
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('500.0 KB')).toBeInTheDocument();
  });

  it('calls onChange without deleted attachment when delete is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AttachmentSection
        {...defaultProps}
        attachments={[mockAttachment]}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /delete attachment/i }),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows error when upload fails', async () => {
    const { uploadTaskAttachment } =
      await import('../../services/storageService');
    (uploadTaskAttachment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('File size exceeds 25 MB limit.'),
    );

    const user = userEvent.setup();
    render(<AttachmentSection {...defaultProps} />);

    const file = new File(['content'], 'big.jpg', { type: 'image/jpeg' });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    expect(
      await screen.findByText('File size exceeds 25 MB limit.'),
    ).toBeInTheDocument();
  });
});
