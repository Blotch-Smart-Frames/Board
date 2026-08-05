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

  it('does not call postHandler when submit is triggered with only whitespace', async () => {
    const postHandler = vi.fn().mockResolvedValue(undefined);
    const view = await render(CommentInput, {
      inputs: { postHandler },
      providers: [provideMarkdown()],
    });

    // Set the internal draft to whitespace directly to trigger submit() while
    // the Post button would be disabled through the template.
    (view.fixture.componentInstance as unknown as { text: { set: (v: string) => void } }).text.set(
      '   ',
    );
    await view.fixture.componentInstance['submit']();

    expect(postHandler).not.toHaveBeenCalled();
  });

  it('preserves the draft text when postHandler rejects', async () => {
    // Rejection is caught by the finally block; wire the handler so the
    // promise settles synchronously and the try/finally has a chance to
    // finalize `submitting()` — the assertion below is on `text()` staying
    // populated.
    const postHandler = vi.fn().mockImplementation(() => Promise.reject(new Error('offline')));
    const view = await render(CommentInput, {
      inputs: { postHandler },
      providers: [provideMarkdown()],
    });

    const component = view.fixture.componentInstance as unknown as {
      text: { set: (v: string) => void; (): string };
      submit: () => Promise<void>;
    };
    component.text.set('draft that should stay');

    try {
      await component.submit();
    } catch {
      /* expected */
    }

    expect(postHandler).toHaveBeenCalledWith('draft that should stay');
    expect(component.text()).toBe('draft that should stay');
  });
});
