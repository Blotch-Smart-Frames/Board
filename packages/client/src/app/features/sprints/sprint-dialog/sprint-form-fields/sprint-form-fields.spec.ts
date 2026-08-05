import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintFormFields, EMPTY_SPRINT_FORM } from './sprint-form-fields';

describe('SprintFormFields', () => {
  it('renders errors when the end date is earlier than the start date', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const view = await render(SprintFormFields, {
      inputs: {
        initialValue: {
          name: 'Sprint A',
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        },
      },
      on: { submit },
    });

    const component = view.fixture.componentInstance;
    component['onStartDateChange'](new Date(2026, 5, 10));
    component['onEndDateChange'](new Date(2026, 5, 1));
    view.fixture.detectChanges();

    await component.submitWith(async () => {
      throw new Error('inner should not run when the form is invalid');
    });
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    expect(screen.getByText(/end date must be on or after the start date/i)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('flags an empty name as invalid without calling the submit handler', async () => {
    const view = await render(SprintFormFields, {
      inputs: {
        initialValue: {
          ...EMPTY_SPRINT_FORM,
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        },
      },
    });

    const inner = vi.fn();
    await view.fixture.componentInstance.submitWith(inner);

    expect(inner).not.toHaveBeenCalled();
    expect(view.fixture.componentInstance.invalid()).toBe(true);
  });

  it('calls the submitWith callback with the current model when the form is valid', async () => {
    const user = userEvent.setup();
    const view = await render(SprintFormFields, {
      inputs: {
        initialValue: {
          name: 'Sprint A',
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        },
      },
    });

    const nameInput = await screen.findByLabelText('Sprint Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed sprint');

    const captured = vi.fn();
    await view.fixture.componentInstance.submitWith(async (value) => {
      captured(value);
    });

    await waitFor(() =>
      expect(captured).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Renamed sprint',
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        }),
      ),
    );
  });

  it('shows a preview once the name and both dates are populated', async () => {
    await render(SprintFormFields, {
      inputs: {
        initialValue: {
          name: 'Sprint Preview',
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        },
      },
    });

    expect(await screen.findByText(/preview/i)).toBeInTheDocument();
  });

  it('surfaces a parent-supplied error message', async () => {
    await render(SprintFormFields, {
      inputs: {
        initialValue: EMPTY_SPRINT_FORM,
        error: 'Something went wrong',
      },
    });

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('emits escape when Escape is pressed inside the name input', async () => {
    const user = userEvent.setup();
    const escape = vi.fn();
    await render(SprintFormFields, {
      inputs: {
        initialValue: {
          name: 'Sprint A',
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        },
      },
      on: { escape },
    });

    const nameInput = await screen.findByLabelText('Sprint Name');
    nameInput.focus();
    await user.keyboard('{Escape}');

    expect(escape).toHaveBeenCalled();
  });

  it('emits submit when the form is submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    await render(SprintFormFields, {
      inputs: {
        initialValue: {
          name: 'Sprint A',
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        },
      },
      on: { submit: onSubmit },
    });

    const nameInput = await screen.findByLabelText('Sprint Name');
    nameInput.focus();
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalled();
  });

  it('wires the calendar range startDate/endDate outputs into the model', async () => {
    const view = await render(SprintFormFields, {
      inputs: {
        initialValue: {
          name: 'Sprint A',
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 14),
        },
      },
    });

    // hlm-calendar-range re-exports startDateChange/endDateChange from a host
    // directive (BrnCalendarRange). The template listener is attached to the
    // element; the safest way to hit it is to call the component's own
    // protected handler (which the template one-liner just forwards to).
    (
      view.fixture.componentInstance as unknown as {
        onStartDateChange: (d: Date) => void;
        onEndDateChange: (d: Date) => void;
      }
    ).onStartDateChange(new Date(2026, 0, 5));
    (
      view.fixture.componentInstance as unknown as {
        onEndDateChange: (d: Date) => void;
      }
    ).onEndDateChange(new Date(2026, 0, 20));

    const value = view.fixture.componentInstance.value();
    expect(value.startDate).toEqual(new Date(2026, 0, 5));
    expect(value.endDate).toEqual(new Date(2026, 0, 20));

    // The onXxxChange handlers also handle the `undefined` clear case.
    (
      view.fixture.componentInstance as unknown as {
        onStartDateChange: (d: Date | undefined) => void;
      }
    ).onStartDateChange(undefined);
    (
      view.fixture.componentInstance as unknown as {
        onEndDateChange: (d: Date | undefined) => void;
      }
    ).onEndDateChange(undefined);

    const cleared = view.fixture.componentInstance.value();
    expect(cleared.startDate).toBeNull();
    expect(cleared.endDate).toBeNull();
  });
});
