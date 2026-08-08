import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RichTextEditor } from './rich-text-editor';

// jsdom's Selection/Range plumbing can't back a contenteditable in a way Quill
// tolerates, so this component runs its <textarea> fallback here. The Quill
// path itself is exercised in the browser at runtime and excluded from
// coverage (see angular.json `coverageExclude`).
describe('RichTextEditor (jsdom fallback)', () => {
  it('renders a labeled textarea seeded with the initial value', async () => {
    await render(RichTextEditor, {
      inputs: { taskKey: 't1', initialHtml: 'hello', ariaLabel: 'Description' },
    });

    expect(screen.getByLabelText('Description')).toHaveValue('hello');
  });

  it('honors the placeholder input on the textarea', async () => {
    await render(RichTextEditor, {
      inputs: {
        taskKey: 't1',
        ariaLabel: 'Description',
        placeholder: 'Add a description…',
      },
    });

    expect(screen.getByLabelText('Description')).toHaveAttribute(
      'placeholder',
      'Add a description…',
    );
  });

  it('emits the trimmed text on blur when the value changed', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    await render(RichTextEditor, {
      inputs: { taskKey: 't1', initialHtml: 'old', ariaLabel: 'Description' },
      on: { htmlChange: change },
    });

    const textarea = screen.getByLabelText('Description');
    await user.clear(textarea);
    await user.type(textarea, '  new  ');
    await user.tab();

    expect(change).toHaveBeenCalledWith('new');
  });

  it('emits undefined when the field is cleared', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    await render(RichTextEditor, {
      inputs: { taskKey: 't1', initialHtml: 'old', ariaLabel: 'Description' },
      on: { htmlChange: change },
    });

    const textarea = screen.getByLabelText('Description');
    await user.clear(textarea);
    await user.tab();

    expect(change).toHaveBeenCalledWith(undefined);
  });

  it('does not emit when the value is unchanged on blur', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    await render(RichTextEditor, {
      inputs: { taskKey: 't1', initialHtml: 'same', ariaLabel: 'Description' },
      on: { htmlChange: change },
    });

    await user.click(screen.getByLabelText('Description'));
    await user.tab();

    expect(change).not.toHaveBeenCalled();
  });

  it('resets the buffer when taskKey changes so an unrelated task open does not carry stale edits', async () => {
    const user = userEvent.setup();
    const view = await render(RichTextEditor, {
      inputs: { taskKey: 't1', initialHtml: 'first', ariaLabel: 'Description' },
    });

    const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'in-progress edit');

    view.fixture.componentRef.setInput('taskKey', 't2');
    view.fixture.componentRef.setInput('initialHtml', 'second');
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    expect(screen.getByLabelText('Description')).toHaveValue('second');
  });

  // Escape / backdrop-click on the enclosing dialog tears the subtree down
  // before the textarea has a chance to blur; without this flush the in-flight
  // edit was silently dropped and never reached Firestore.
  it('flushes an unsaved edit on destroy so a modal close does not lose it', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const view = await render(RichTextEditor, {
      inputs: { taskKey: 't1', initialHtml: 'old', ariaLabel: 'Description' },
      on: { htmlChange: change },
    });

    await user.type(screen.getByLabelText('Description'), ' more');
    view.fixture.destroy();

    expect(change).toHaveBeenCalledWith('old more');
  });

  it('does not emit again on destroy when the last blur already saved the edit', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const view = await render(RichTextEditor, {
      inputs: { taskKey: 't1', initialHtml: 'old', ariaLabel: 'Description' },
      on: { htmlChange: change },
    });

    const textarea = screen.getByLabelText('Description');
    await user.clear(textarea);
    await user.type(textarea, 'new');
    await user.tab();
    view.fixture.destroy();

    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith('new');
  });
});
