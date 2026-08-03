import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CommentInput } from './CommentInput';

describe('CommentInput', () => {
  it('renders text field and post button', () => {
    render(<CommentInput onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /post/i })).toBeInTheDocument();
  });

  it('disables post button when text is empty', () => {
    render(<CommentInput onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /post/i })).toBeDisabled();
  });

  it('enables post button when text is entered', async () => {
    const user = userEvent.setup();
    render(<CommentInput onSubmit={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Add a comment...'), 'Hello');
    expect(screen.getByRole('button', { name: /post/i })).toBeEnabled();
  });

  it('calls onSubmit with trimmed text and clears field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentInput onSubmit={onSubmit} />);

    await user.type(
      screen.getByPlaceholderText('Add a comment...'),
      '  Hello world  ',
    );
    await user.click(screen.getByRole('button', { name: /post/i }));

    expect(onSubmit).toHaveBeenCalledWith('Hello world');
    expect(screen.getByPlaceholderText('Add a comment...')).toHaveValue('');
  });

  it('does not submit whitespace-only text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CommentInput onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Add a comment...'), '   ');
    expect(screen.getByRole('button', { name: /post/i })).toBeDisabled();
  });
});
