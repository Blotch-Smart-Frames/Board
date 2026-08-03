import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EmojiGrid } from './emoji-grid';

describe('EmojiGrid', () => {
  it('renders a search field and the category headings', async () => {
    await render(EmojiGrid);

    expect(screen.getByPlaceholderText('Search emojis')).toBeInTheDocument();
    expect(screen.getByText('Smileys')).toBeInTheDocument();
    expect(screen.getByText('Objects')).toBeInTheDocument();
  });

  it('exposes each emoji as a listbox option keyed by its name', async () => {
    await render(EmojiGrid);

    expect(screen.getByRole('option', { name: /^bug$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /grinning/i })).toBeInTheDocument();
  });

  it('emits select with the emoji char when an option is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    await render(EmojiGrid, { on: { select: onSelect } });

    await user.click(screen.getByRole('option', { name: /^bug$/i }));

    expect(onSelect).toHaveBeenCalledWith('🐛');
  });

  it('marks the current value as aria-selected', async () => {
    await render(EmojiGrid, { inputs: { value: '🐛' } });

    expect(screen.getByRole('option', { name: /^bug$/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /grinning/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('filters options by name substring', async () => {
    const user = userEvent.setup();
    await render(EmojiGrid);

    await user.type(screen.getByPlaceholderText('Search emojis'), 'bug');

    expect(screen.getByRole('option', { name: /^bug$/i })).toBeInTheDocument();
    // A ladybug's name contains "bug" so it should also match.
    expect(screen.getByRole('option', { name: /ladybug/i })).toBeInTheDocument();
    // Something whose name and keywords don't touch "bug" should disappear.
    expect(screen.queryByRole('option', { name: /grinning/i })).not.toBeInTheDocument();
  });

  it('filters options by keyword substring', async () => {
    const user = userEvent.setup();
    await render(EmojiGrid);

    await user.type(screen.getByPlaceholderText('Search emojis'), 'defect');

    // "bug" has the keyword "defect"; grinning does not.
    expect(screen.getByRole('option', { name: /^bug$/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /grinning/i })).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup();
    await render(EmojiGrid);

    await user.type(screen.getByPlaceholderText('Search emojis'), 'zzz-nonexistent-query');

    expect(screen.getByText(/no emojis found/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('hides an entire category heading when its section has no matches', async () => {
    const user = userEvent.setup();
    await render(EmojiGrid);

    await user.type(screen.getByPlaceholderText('Search emojis'), 'bug');

    // "bug" lives in the Nature category — Smileys should be filtered out entirely.
    expect(screen.getByText('Nature')).toBeInTheDocument();
    expect(screen.queryByText('Smileys')).not.toBeInTheDocument();
  });

  it('emits escape when Escape is pressed in the search field', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    await render(EmojiGrid, { on: { escape: onEscape } });

    await user.click(screen.getByPlaceholderText('Search emojis'));
    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalled();
  });
});
