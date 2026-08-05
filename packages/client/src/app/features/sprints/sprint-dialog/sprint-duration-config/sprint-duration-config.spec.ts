import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintDurationConfig } from './sprint-duration-config';

describe('SprintDurationConfig', () => {
  it('seeds the input from the configured value and keeps Save disabled until it changes', async () => {
    const user = userEvent.setup();
    const saveHandler = vi.fn().mockResolvedValue(undefined);

    await render(SprintDurationConfig, {
      inputs: { configuredDurationDays: 14, saveHandler },
    });

    const input = await screen.findByLabelText('Default sprint duration');
    expect(input).toHaveValue(14);

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    expect(saveButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, '21');
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);

    await waitFor(() => expect(saveHandler).toHaveBeenCalledWith(21));
  });

  it('falls back to a 14-day default when no configured duration is provided', async () => {
    await render(SprintDurationConfig, {
      inputs: { saveHandler: vi.fn().mockResolvedValue(undefined) },
    });

    expect(await screen.findByLabelText('Default sprint duration')).toHaveValue(14);
  });

  it('ignores non-positive integer input on save', async () => {
    const user = userEvent.setup();
    const saveHandler = vi.fn().mockResolvedValue(undefined);

    await render(SprintDurationConfig, {
      inputs: { configuredDurationDays: 14, saveHandler },
    });

    const input = await screen.findByLabelText('Default sprint duration');
    await user.clear(input);
    await user.type(input, '0');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('logs but does not throw when the save handler rejects', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveHandler = vi.fn().mockRejectedValue(new Error('offline'));

    await render(SprintDurationConfig, {
      inputs: { configuredDurationDays: 14, saveHandler },
    });

    const input = await screen.findByLabelText('Default sprint duration');
    await user.clear(input);
    await user.type(input, '21');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(saveHandler).toHaveBeenCalledWith(21));
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to save sprint config:', expect.any(Error)),
    );
    consoleError.mockRestore();
  });
});
