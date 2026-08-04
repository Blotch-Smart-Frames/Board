import { render, screen } from '@testing-library/angular';
import { provideMarkdown } from 'ngx-markdown';
import { MarkdownRenderer } from './markdown-renderer';

describe('MarkdownRenderer', () => {
  it('renders inline emphasis from GFM', async () => {
    await render(MarkdownRenderer, {
      inputs: { source: 'Hello *world*' },
      providers: [provideMarkdown()],
    });

    // ngx-markdown compiles asynchronously so we await the produced <em>.
    expect((await screen.findByText('world')).tagName).toBe('EM');
  });

  it('renders a list from GFM', async () => {
    await render(MarkdownRenderer, {
      inputs: { source: '- one\n- two' },
      providers: [provideMarkdown()],
    });

    expect((await screen.findByText('one')).tagName).toBe('LI');
    expect((await screen.findByText('two')).tagName).toBe('LI');
  });

  it('renders nothing meaningful for an empty source', async () => {
    const view = await render(MarkdownRenderer, {
      inputs: { source: '' },
      providers: [provideMarkdown()],
    });

    // The wrapper is still present, but has no rendered children beyond
    // ngx-markdown's own container.
    expect(view.container.textContent?.trim()).toBe('');
  });
});
