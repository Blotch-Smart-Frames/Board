import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EmojiPicker } from './emoji-picker';

// jsdom lacks these; the popover overlay touches them during positioning.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

describe('EmojiPicker', () => {
  it('shows the placeholder trigger when no value is set', async () => {
    await render(EmojiPicker);

    expect(screen.getByRole('button', { name: /pick an emoji/i })).toBeInTheDocument();
  });

  it('shows the current emoji on the trigger when a value is set', async () => {
    await render(EmojiPicker, { inputs: { value: '🐛' } });

    const trigger = screen.getByRole('button', { name: /change emoji/i });
    expect(trigger).toHaveTextContent('🐛');
  });

  it('opens the popover and lists emojis grouped by category', async () => {
    const user = userEvent.setup();
    await render(EmojiPicker);

    await user.click(screen.getByRole('button', { name: /pick an emoji/i }));

    expect(await screen.findByPlaceholderText('Search emojis')).toBeInTheDocument();
    expect(await screen.findByText('Smileys')).toBeInTheDocument();
    expect(screen.getByText('Objects')).toBeInTheDocument();
  });

  it('filters emojis by name and keywords when searching', async () => {
    const user = userEvent.setup();
    await render(EmojiPicker);

    await user.click(screen.getByRole('button', { name: /pick an emoji/i }));
    const search = await screen.findByPlaceholderText('Search emojis');
    await user.type(search, 'bug');

    expect(await screen.findByRole('option', { name: /^bug$/i })).toBeInTheDocument();
    // Something without "bug" in its keywords should be gone.
    expect(screen.queryByRole('option', { name: /pizza/i })).not.toBeInTheDocument();
  });

  it('shows an empty state when the search matches nothing', async () => {
    const user = userEvent.setup();
    await render(EmojiPicker);

    await user.click(screen.getByRole('button', { name: /pick an emoji/i }));
    const search = await screen.findByPlaceholderText('Search emojis');
    await user.type(search, 'zzzzzzz-not-a-real-emoji');

    expect(await screen.findByText(/no emojis found/i)).toBeInTheDocument();
  });

  it('emits the chosen emoji when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(EmojiPicker, { on: { valueChange: onChange } });

    await user.click(screen.getByRole('button', { name: /pick an emoji/i }));
    await user.click(await screen.findByRole('option', { name: /^bug$/i }));

    expect(onChange).toHaveBeenCalledWith('🐛');
  });

  it('marks the selected emoji option as aria-selected', async () => {
    const user = userEvent.setup();
    await render(EmojiPicker, { inputs: { value: '🐛' } });

    await user.click(screen.getByRole('button', { name: /change emoji/i }));

    const bug = await screen.findByRole('option', { name: /^bug$/i });
    expect(bug).toHaveAttribute('aria-selected', 'true');
  });

  it('emits an empty string when Remove emoji is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(EmojiPicker, {
      inputs: { value: '🐛' },
      on: { valueChange: onChange },
    });

    await user.click(screen.getByRole('button', { name: /change emoji/i }));
    await user.click(await screen.findByRole('button', { name: /remove emoji/i }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('closes the popover when the emoji grid emits escape', async () => {
    const user = userEvent.setup();
    await render(EmojiPicker);

    await user.click(screen.getByRole('button', { name: /pick an emoji/i }));
    const search = await screen.findByPlaceholderText('Search emojis');

    // The EmojiGrid emits escape when Escape is pressed on the search input.
    await user.type(search, '{Escape}');

    // The popover closes: the search field is no longer in the DOM.
    expect(screen.queryByPlaceholderText('Search emojis')).not.toBeInTheDocument();
  });
});
