import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideMarkdown } from 'ngx-markdown';
import { MarkdownEditor } from './markdown-editor';

describe('MarkdownEditor', () => {
  it('shows the editable textarea seeded with the current value', async () => {
    await render(MarkdownEditor, {
      inputs: { value: '# Hello' },
      providers: [provideMarkdown()],
    });

    expect(screen.getByRole('textbox', { name: 'Markdown editor' })).toHaveValue('# Hello');
  });

  it('honors ariaLabel and placeholder inputs on the textarea', async () => {
    await render(MarkdownEditor, {
      inputs: { ariaLabel: 'Task description', placeholder: 'Type here…' },
      providers: [provideMarkdown()],
    });

    const textarea = screen.getByRole('textbox', { name: 'Task description' });
    expect(textarea).toHaveAttribute('placeholder', 'Type here…');
  });

  it('reflects user typing in the preview tab (two-way value model)', async () => {
    const user = userEvent.setup();
    await render(MarkdownEditor, {
      inputs: { value: '' },
      providers: [provideMarkdown()],
    });

    await user.type(screen.getByRole('textbox', { name: 'Markdown editor' }), 'hi');
    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    // The bound model round-trips through the preview renderer.
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('shows a placeholder in the preview tab when the value is blank', async () => {
    const user = userEvent.setup();
    await render(MarkdownEditor, { providers: [provideMarkdown()] });

    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(screen.getByText('Nothing to preview')).toBeInTheDocument();
  });

  it('renders the current value in the preview tab when non-empty', async () => {
    const user = userEvent.setup();
    await render(MarkdownEditor, {
      inputs: { value: 'hello **world**' },
      providers: [provideMarkdown()],
    });

    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(screen.getByText('world').tagName).toBe('STRONG');
  });
});
