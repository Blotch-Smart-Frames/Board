import { render } from '@testing-library/angular';
import { BoardBackground } from './board-background';

describe('BoardBackground', () => {
  it('renders projected children inside the content wrapper', async () => {
    const view = await render(
      `<app-board-background><span data-testid="child">Hi</span></app-board-background>`,
      { imports: [BoardBackground] },
    );
    expect(view.getByTestId('child')).toBeInTheDocument();
  });

  it('leaves the background bare when no imageUrl is provided', async () => {
    const view = await render(BoardBackground);
    const root = view.container.querySelector('.bg-cover');
    expect(root).toBeNull();
    // The overlay tint is only rendered when an image is set.
    expect(view.container.querySelector('.bg-black\\/30')).toBeNull();
  });

  it('applies the imageUrl as a CSS url() and renders the overlay tint', async () => {
    const view = await render(BoardBackground, {
      inputs: { imageUrl: 'https://example.com/board.jpg' },
    });

    const root = view.container.querySelector('.bg-cover') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.backgroundImage).toBe('url("https://example.com/board.jpg")');
    expect(view.container.querySelector('.bg-black\\/30')).not.toBeNull();
  });
});
