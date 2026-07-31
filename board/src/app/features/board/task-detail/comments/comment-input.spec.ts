import { provideMarkdown } from 'ngx-markdown';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CommentInput } from './comment-input';

describe('CommentInput', () => {
  it('disables the Post button when the textarea is empty', async () => {
    await render(CommentInput, {
      inputs: { postHandler: vi.fn().mockResolvedValue(undefined) },
      providers: [provideMarkdown()],
    });

    expect(screen.getByRole('button', { name: /^post$/i })).toBeDisabled();
  });

  it('posts the trimmed text and clears the textarea', async () => {
    const user = userEvent.setup();
    const postHandler = vi.fn().mockResolvedValue(undefined);
    await render(CommentInput, { inputs: { postHandler }, providers: [provideMarkdown()] });

    const textarea = screen.getByLabelText('Add a comment');
    await user.type(textarea, '  Hello world  ');
    expect(screen.getByRole('button', { name: /^post$/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^post$/i }));

    await waitFor(() => expect(textarea).toHaveValue(''));
    expect(postHandler).toHaveBeenCalledWith('Hello world');
  });
});
