import { Component, viewChild } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LabelFormFields, EMPTY_LABEL_FORM, type LabelFormModel } from './label-form-fields';
import { labelColors } from '../../../../core/config/default-labels';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

// Wraps LabelFormFields so tests can access the exposed submitWith() API via a
// ref, matching how LabelEditor drives the form in production.
@Component({
  selector: 'test-host',
  imports: [LabelFormFields],
  template: `
    <app-label-form-fields
      #fields
      [initialValue]="initialValue"
      [error]="error"
      (submit)="onSubmit()"
      (escape)="onEscape()"
    />
  `,
})
class Host {
  initialValue: LabelFormModel = EMPTY_LABEL_FORM;
  error: string | null = null;
  readonly fields = viewChild.required<LabelFormFields>('fields');
  onSubmit = vi.fn();
  onEscape = vi.fn();
}

describe('LabelFormFields', () => {
  it('starts empty when no initial value is provided', async () => {
    await render(LabelFormFields);

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByRole('button', { name: /pick an emoji/i })).toBeInTheDocument();
  });

  it('seeds fields from initialValue', async () => {
    await render(LabelFormFields, {
      inputs: {
        initialValue: { name: 'Bug', emoji: '🐛', color: labelColors[3] },
      },
    });

    expect(screen.getByLabelText('Name')).toHaveValue('Bug');
    expect(screen.getByRole('button', { name: /change emoji/i })).toHaveTextContent('🐛');
    expect(screen.getByRole('radio', { name: labelColors[3] })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('renders the label preview reflecting the current name and color', async () => {
    await render(LabelFormFields, {
      inputs: {
        initialValue: { name: 'Ready', emoji: '', color: labelColors[2] },
      },
    });

    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('falls back to the "Label" placeholder in the preview when name is empty', async () => {
    await render(LabelFormFields);

    expect(screen.getByText('Label')).toBeInTheDocument();
  });

  it('surfaces the error input as a field error', async () => {
    await render(LabelFormFields, { inputs: { error: 'Name already exists' } });

    expect(screen.getByText('Name already exists')).toBeInTheDocument();
  });

  it('emits escape when Escape is pressed inside the name field', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    await render(LabelFormFields, { on: { escape: onEscape } });

    await user.click(screen.getByLabelText('Name'));
    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalled();
  });

  it('shows a required error and does not invoke the handler when submitted empty', async () => {
    const view = await render(Host);
    const host = view.fixture.componentInstance;
    const handler = vi.fn().mockResolvedValue(undefined);

    await host.fields().submitWith(handler);

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(handler).not.toHaveBeenCalled();
  });

  it('submitWith forwards the current model when valid', async () => {
    const user = userEvent.setup();
    const view = await render(Host);
    const host = view.fixture.componentInstance;
    const handler = vi.fn().mockResolvedValue(undefined);

    await user.type(screen.getByLabelText('Name'), 'Bug');
    await user.click(screen.getByRole('radio', { name: labelColors[3] }));

    await host.fields().submitWith(handler);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bug', color: labelColors[3] }),
    );
  });

  it('color-picker clicks feed the model so submitWith reflects the new choice', async () => {
    const user = userEvent.setup();
    const view = await render(Host);
    const host = view.fixture.componentInstance;
    const handler = vi.fn().mockResolvedValue(undefined);

    await user.type(screen.getByLabelText('Name'), 'Bug');
    await user.click(screen.getByRole('radio', { name: labelColors[5] }));

    await host.fields().submitWith(handler);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ color: labelColors[5] }));
  });

  it('emoji picks flow into the model exposed via submitWith', async () => {
    const user = userEvent.setup();
    const view = await render(Host);
    const host = view.fixture.componentInstance;
    const handler = vi.fn().mockResolvedValue(undefined);

    await user.type(screen.getByLabelText('Name'), 'Bug');
    await user.click(screen.getByRole('button', { name: /pick an emoji/i }));
    await user.click(await screen.findByRole('option', { name: /^bug$/i }));

    await host.fields().submitWith(handler);

    await waitFor(() =>
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ emoji: '🐛' })),
    );
  });

  it('resets the local model when initialValue changes so reopening picks up new defaults', async () => {
    const view = await render(LabelFormFields, {
      inputs: {
        initialValue: { name: 'First', emoji: '', color: labelColors[0] },
      },
    });

    view.fixture.componentRef.setInput('initialValue', {
      name: 'Second',
      emoji: '',
      color: labelColors[1],
    });
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    expect(screen.getByLabelText('Name')).toHaveValue('Second');
    expect(screen.getByRole('radio', { name: labelColors[1] })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
