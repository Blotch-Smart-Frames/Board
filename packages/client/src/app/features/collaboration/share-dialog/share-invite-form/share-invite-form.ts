import { Component, input, output, signal } from '@angular/core';
import { form, submit, required, email as emailValidator, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUserPlus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';

/**
 * Invite-by-email row. Owns its own signal-form + inviting state. Parent
 * supplies an async `inviteHandler` that either resolves with a success
 * message (which triggers a field reset + emits `success`) or throws
 * (which emits `error`). Feedback is surfaced upward so the parent dialog
 * can drive its transient banner without leaf components owning banner
 * timing.
 */
@Component({
  selector: 'app-share-invite-form',
  imports: [HlmButton, HlmFieldImports, HlmInput, HlmSpinner, NgIcon, FormField],
  providers: [provideIcons({ lucideUserPlus })],
  template: `
    <!-- /* v8 ignore start -- form submit listener wraps onSubmit which is covered directly @preserve */ -->
    <form (submit)="$event.preventDefault(); onSubmit()">
      <!-- /* v8 ignore stop -- @preserve */ -->
      <div hlmField>
        <div class="flex gap-2">
          <input
            hlmInput
            class="flex-1"
            placeholder="Enter email address"
            aria-label="Invite by email"
            type="email"
            [formField]="inviteForm.email"
            (keydown.escape)="escape.emit()"
          />
          <button
            hlmBtn
            type="button"
            [disabled]="inviteForm().invalid() || inviting() || !model().email.trim()"
            (click)="onSubmit()"
          >
            @if (inviting()) {
              <hlm-spinner class="size-4" />
            } @else {
              <ng-icon name="lucideUserPlus" class="mr-2" />
              Invite
            }
          </button>
        </div>
        @for (err of inviteForm.email().errors(); track err.kind) {
          <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
        }
      </div>
    </form>
  `,
})
export class ShareInviteForm {
  readonly inviteHandler = input.required<(email: string) => Promise<string>>();
  readonly success = output<string>();
  readonly error = output<string>();
  readonly escape = output<void>();

  protected readonly model = signal({ email: '' });
  protected readonly inviteForm = form(this.model, (path) => {
    required(path.email, { message: 'Enter an email' });
    emailValidator(path.email, { message: 'Enter a valid email' });
  });
  protected readonly inviting = signal(false);

  protected async onSubmit(): Promise<void> {
    await submit(this.inviteForm, async () => {
      const email = this.model().email.trim();
      this.inviting.set(true);
      try {
        const successMessage = await this.inviteHandler()(email);
        this.success.emit(successMessage);
        this.model.set({ email: '' });
      } catch (err) {
        this.error.emit(err instanceof Error ? err.message : 'Failed to send invitation');
      } finally {
        this.inviting.set(false);
      }
    });
  }
}
