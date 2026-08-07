import { Component, input, signal, viewChild } from '@angular/core';
import { form, submit, required, FormField } from '@angular/forms/signals';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';

/**
 * Reusable create/rename dialog for a board title. Opened imperatively via
 * `open(initialTitle)`; owns its own submit lifecycle (validate → run the
 * injected saveHandler → close on success, stay open + show an error on
 * failure), matching the source app's TanStack-form create/rename dialogs but
 * de-duplicated into one component.
 */
@Component({
  selector: 'app-board-form-dialog',
  imports: [HlmDialogImports, HlmButton, HlmInput, HlmSpinner, FormField],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-sm">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>{{ heading() }}</h3>
        </hlm-dialog-header>

        <form class="py-2" (submit)="$event.preventDefault(); save()">
          <input
            hlmInput
            class="w-full"
            placeholder="Enter board title"
            aria-label="Board title"
            [formField]="titleForm.title"
            (keydown.escape)="close()"
          />
          @if (error()) {
            <p class="text-destructive mt-2 text-sm">{{ error() }}</p>
          }
        </form>

        <hlm-dialog-footer>
          <button hlmBtn variant="outline" type="button" [disabled]="saving()" (click)="close()">
            Cancel
          </button>
          <button
            hlmBtn
            type="button"
            [disabled]="titleForm().invalid() || saving()"
            (click)="save()"
          >
            @if (saving()) {
              <hlm-spinner class="size-4" />
            } @else {
              {{ submitLabel() }}
            }
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class BoardFormDialog {
  readonly heading = input('Board');
  readonly submitLabel = input('Save');
  readonly saveHandler = input.required<(title: string) => Promise<void>>();

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  protected readonly model = signal({ title: '' });
  protected readonly titleForm = form(this.model, (path) => {
    required(path.title, { message: 'A board title is required' });
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  open(initialTitle = ''): void {
    this.model.set({ title: initialTitle });
    this.error.set(null);
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
    this.saving.set(false);
  }

  protected async save(): Promise<void> {
    await submit(this.titleForm, async () => {
      this.error.set(null);
      this.saving.set(true);
      try {
        await this.saveHandler()(this.model().title.trim());
        this.model.set({ title: '' });
        this.dialog().close(undefined);
      } catch (err) {
        console.error('Board save failed:', err);
        this.error.set('Something went wrong. Please try again.');
      } finally {
        this.saving.set(false);
      }
    });
  }
}
