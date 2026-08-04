import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskTitleEditor } from './task-title-editor';

// hlmDialogTitle inside the component's template injects BrnDialogRef so it can
// stamp an id for aria-labelledby. When the editor is rendered outside an
// hlm-dialog (which is how we test it in isolation), we have to hand-provide a
// stub or the directive throws NG0201.
const dialogRefStub = { dialogId: 'test-dialog' } as unknown as BrnDialogRef;
const providers = [{ provide: BrnDialogRef, useValue: dialogRefStub }];

describe('TaskTitleEditor', () => {
  it('renders the title as a heading by default', async () => {
    await render(TaskTitleEditor, { providers, inputs: { title: 'Do the thing' } });

    expect(screen.getByRole('heading', { name: 'Do the thing' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('switches to an input when the heading is clicked', async () => {
    const user = userEvent.setup();
    await render(TaskTitleEditor, { providers, inputs: { title: 'Do the thing' } });

    await user.click(screen.getByRole('heading', { name: 'Do the thing' }));

    expect(screen.getByLabelText('Title')).toHaveValue('Do the thing');
  });

  it('emits titleChange with the trimmed value on blur when it changed', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    await render(TaskTitleEditor, {
      providers,
      inputs: { title: 'Old title' },
      on: { titleChange: onTitleChange },
    });

    await user.click(screen.getByRole('heading', { name: 'Old title' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.type(input, '  New title  ');
    await user.tab();

    await waitFor(() => expect(onTitleChange).toHaveBeenCalledWith('New title'));
  });

  it('does not emit and reverts the heading when the value is emptied on blur', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    await render(TaskTitleEditor, {
      providers,
      inputs: { title: 'Old title' },
      on: { titleChange: onTitleChange },
    });

    await user.click(screen.getByRole('heading', { name: 'Old title' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.tab();

    expect(onTitleChange).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Old title' })).toBeInTheDocument();
  });

  it('does not emit when Escape reverts the edit', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    await render(TaskTitleEditor, {
      providers,
      inputs: { title: 'Old title' },
      on: { titleChange: onTitleChange },
    });

    await user.click(screen.getByRole('heading', { name: 'Old title' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.type(input, 'Something else');
    await user.keyboard('{Escape}');

    expect(onTitleChange).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Old title' })).toBeInTheDocument();
  });

  it('does not emit when the value is unchanged', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    await render(TaskTitleEditor, {
      providers,
      inputs: { title: 'Same' },
      on: { titleChange: onTitleChange },
    });

    await user.click(screen.getByRole('heading', { name: 'Same' }));
    await user.tab();

    expect(onTitleChange).not.toHaveBeenCalled();
  });

  it('blurs the input when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    await render(TaskTitleEditor, {
      providers,
      inputs: { title: 'Old' },
      on: { titleChange: onTitleChange },
    });

    await user.click(screen.getByRole('heading', { name: 'Old' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.type(input, 'Newer{Enter}');

    // Enter -> blur -> commit; the parent owns the title() input so we can only
    // observe the emitted value here, not the re-rendered heading.
    await waitFor(() => expect(onTitleChange).toHaveBeenCalledWith('Newer'));
  });
});
