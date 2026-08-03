import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AttachmentUploadButton } from './AttachmentUploadButton';

describe('AttachmentUploadButton', () => {
  it('renders the add attachment button', () => {
    render(<AttachmentUploadButton onFilesSelected={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /add attachment/i }),
    ).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<AttachmentUploadButton onFilesSelected={vi.fn()} disabled />);
    expect(
      screen.getByRole('button', { name: /add attachment/i }),
    ).toBeDisabled();
  });

  it('calls onFilesSelected when files are chosen', async () => {
    const user = userEvent.setup();
    const onFilesSelected = vi.fn();
    render(<AttachmentUploadButton onFilesSelected={onFilesSelected} />);

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('accepts only allowed file types', () => {
    render(<AttachmentUploadButton onFilesSelected={vi.fn()} />);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input.accept).toContain('image/jpeg');
    expect(input.accept).toContain('video/mp4');
  });

  it('allows multiple file selection', () => {
    render(<AttachmentUploadButton onFilesSelected={vi.fn()} />);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });
});
