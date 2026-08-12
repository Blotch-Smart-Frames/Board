import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskDescriptionEditor } from './task-description-editor';

describe('TaskDescriptionEditor', () => {
  it('seeds the textarea from initialDescription', async () => {
    await render(TaskDescriptionEditor, {
      inputs: { taskKey: 't1', initialDescription: 'existing notes' },
    });

    expect(screen.getByLabelText('Description')).toHaveValue('existing notes');
  });

  it('emits the edited description on blur when it changed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(TaskDescriptionEditor, {
      inputs: { taskKey: 't1', initialDescription: 'old' },
      on: { descriptionChange: onChange },
    });

    const textarea = screen.getByLabelText('Description');
    await user.clear(textarea);
    await user.type(textarea, 'new');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith('new');
  });

  it('emits undefined for an empty description so the field clears', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(TaskDescriptionEditor, {
      inputs: { taskKey: 't1', initialDescription: 'old' },
      on: { descriptionChange: onChange },
    });

    const textarea = screen.getByLabelText('Description');
    await user.clear(textarea);
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('trims trailing whitespace before emitting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(TaskDescriptionEditor, {
      inputs: { taskKey: 't1', initialDescription: '' },
      on: { descriptionChange: onChange },
    });

    const textarea = screen.getByLabelText('Description');
    await user.type(textarea, '  trimmed  ');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith('trimmed');
  });

  it('does not emit when the value is unchanged on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(TaskDescriptionEditor, {
      inputs: { taskKey: 't1', initialDescription: 'same' },
      on: { descriptionChange: onChange },
    });

    await user.click(screen.getByLabelText('Description'));
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not emit when only surrounding whitespace differs from the original', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(TaskDescriptionEditor, {
      inputs: { taskKey: 't1', initialDescription: 'same' },
      on: { descriptionChange: onChange },
    });

    const textarea = screen.getByLabelText('Description');
    await user.click(textarea);
    await user.type(textarea, '   ');
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('resets the model when taskKey changes so an unrelated task open does not carry stale edits', async () => {
    const user = userEvent.setup();
    const view = await render(TaskDescriptionEditor, {
      inputs: { taskKey: 't1', initialDescription: 'first' },
    });

    const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'in-progress edit');

    view.fixture.componentRef.setInput('taskKey', 't2');
    view.fixture.componentRef.setInput('initialDescription', 'second');
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    expect(screen.getByLabelText('Description')).toHaveValue('second');
  });

  // Regression: editing the description then clicking a Close/X button used to
  // silently drop the edit. The save must land synchronously on blur (the
  // `focusout` that a Close click's mousedown triggers) so it propagates
  // through the nested output hop while the surrounding tree is still alive —
  // i.e. WITHOUT relying on emitting during teardown.
  it('emits the in-flight edit when focus leaves for a Close button (mimics a dialog close)', async () => {
    @Component({
      imports: [TaskDescriptionEditor],
      template: `
        <app-task-description-editor
          taskKey="t1"
          initialDescription="old"
          (descriptionChange)="onChange($event)"
        />
        <button type="button">Close</button>
      `,
    })
    class HostCmp {
      readonly received = signal<(string | undefined)[]>([]);
      onChange(value: string | undefined): void {
        this.received.update((prev) => [...prev, value]);
      }
    }

    const user = userEvent.setup();
    const view = await render(HostCmp);

    await user.type(screen.getByLabelText('Description'), ' more');
    // Focus leaves the editor for the Close button before any teardown.
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(view.fixture.componentInstance.received()).toContain('old more');
  });
});
