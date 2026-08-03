import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders plain text', () => {
    render(<MarkdownRenderer>{'Hello world'}</MarkdownRenderer>);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders bold text', () => {
    const { container } = render(
      <MarkdownRenderer>{'**bold**'}</MarkdownRenderer>,
    );
    const strong = container.querySelector('strong');
    expect(strong).toHaveTextContent('bold');
  });

  it('renders italic text', () => {
    const { container } = render(
      <MarkdownRenderer>{'*italic*'}</MarkdownRenderer>,
    );
    const em = container.querySelector('em');
    expect(em).toHaveTextContent('italic');
  });

  it('renders inline code', () => {
    const { container } = render(
      <MarkdownRenderer>{'`code`'}</MarkdownRenderer>,
    );
    const code = container.querySelector('code');
    expect(code).toHaveTextContent('code');
  });

  it('handles empty string without crashing', () => {
    const { container } = render(<MarkdownRenderer>{''}</MarkdownRenderer>);
    expect(container).toBeInTheDocument();
  });
});
