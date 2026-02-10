import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColorPicker } from './ColorPicker';
import { labelColors } from '../../config/defaultLabels';

describe('ColorPicker', () => {
  it('renders all label colors', () => {
    render(<ColorPicker value="" onChange={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(labelColors.length);
  });

  it('applies background color to each swatch', () => {
    render(<ColorPicker value="" onChange={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button, i) => {
      expect(button).toHaveStyle({ backgroundColor: labelColors[i] });
    });
  });

  it('shows check icon on the selected color', () => {
    const selected = labelColors[3];
    const { container } = render(
      <ColorPicker value={selected} onChange={vi.fn()} />,
    );

    const checkIcons = container.querySelectorAll('[data-testid="CheckIcon"]');
    expect(checkIcons).toHaveLength(1);
  });

  it('does not show check icon when no color is selected', () => {
    const { container } = render(<ColorPicker value="" onChange={vi.fn()} />);

    const checkIcons = container.querySelectorAll('[data-testid="CheckIcon"]');
    expect(checkIcons).toHaveLength(0);
  });

  it('calls onChange with the clicked color', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ColorPicker value="" onChange={handleChange} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[2]);

    expect(handleChange).toHaveBeenCalledOnce();
    expect(handleChange).toHaveBeenCalledWith(labelColors[2]);
  });

  it('shows tooltip with color hex on each swatch', async () => {
    const user = userEvent.setup();
    render(<ColorPicker value="" onChange={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    await user.hover(buttons[0]);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      labelColors[0],
    );
  });

  it('highlights the selected color swatch with a check icon', () => {
    const selected = labelColors[0];
    const { container } = render(
      <ColorPicker value={selected} onChange={vi.fn()} />,
    );

    // The selected swatch should show the check icon
    const checkIcons = container.querySelectorAll('[data-testid="CheckIcon"]');
    expect(checkIcons).toHaveLength(1);

    // The check icon should be inside the first button
    const buttons = screen.getAllByRole('button');
    expect(
      buttons[0].querySelector('[data-testid="CheckIcon"]'),
    ).toBeInTheDocument();
  });
});
