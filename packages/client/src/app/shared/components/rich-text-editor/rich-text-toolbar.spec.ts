import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RichTextToolbar, type RichTextCommand } from './rich-text-toolbar';

describe('RichTextToolbar', () => {
  async function setup() {
    const command = vi.fn<(cmd: RichTextCommand) => void>();
    await render(RichTextToolbar, { on: { command } });
    return { command, user: userEvent.setup() };
  }

  it('emits a bold command when the bold button is clicked', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Bold' }));

    expect(command).toHaveBeenCalledWith({ kind: 'bold' });
  });

  it('emits an italic command when the italic button is clicked', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Italic' }));

    expect(command).toHaveBeenCalledWith({ kind: 'italic' });
  });

  it.each([
    ['Heading 1', 1 as const],
    ['Heading 2', 2 as const],
    ['Heading 3', 3 as const],
  ])('emits a heading command with the correct level for %s', async (label, level) => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: label }));

    expect(command).toHaveBeenCalledWith({ kind: 'heading', level });
  });

  it('emits a bulleted list command', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Bulleted list' }));

    expect(command).toHaveBeenCalledWith({ kind: 'list', style: 'bullet' });
  });

  it('emits a numbered list command', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Numbered list' }));

    expect(command).toHaveBeenCalledWith({ kind: 'list', style: 'ordered' });
  });

  it('emits a link command', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Insert link' }));

    expect(command).toHaveBeenCalledWith({ kind: 'link' });
  });

  it('emits a code-block command', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Code block' }));

    expect(command).toHaveBeenCalledWith({ kind: 'code-block' });
  });

  it('emits a formula command', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Insert formula' }));

    expect(command).toHaveBeenCalledWith({ kind: 'formula' });
  });

  it('emits a clear-formatting command from the "Tx" button', async () => {
    const { command, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Clear formatting' }));

    expect(command).toHaveBeenCalledWith({ kind: 'clear' });
  });

  it('exposes the whole bar to assistive tech as a single toolbar', async () => {
    await render(RichTextToolbar);

    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
  });
});
