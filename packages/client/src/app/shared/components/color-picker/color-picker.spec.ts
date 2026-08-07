import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from './color-picker';
import { labelColors } from '../../../core/config/default-labels';

describe('ColorPicker', () => {
  it('renders a swatch for every palette color', async () => {
    await render(ColorPicker);

    expect(screen.getAllByRole('radio')).toHaveLength(labelColors.length);
  });

  it('marks the selected color as checked', async () => {
    await render(ColorPicker, { inputs: { value: labelColors[0] } });

    expect(screen.getByRole('radio', { name: labelColors[0] })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('emits valueChange when a swatch is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(ColorPicker, { on: { valueChange: onChange } });

    await user.click(screen.getByRole('radio', { name: labelColors[2] }));

    expect(onChange).toHaveBeenCalledWith(labelColors[2]);
  });
});
