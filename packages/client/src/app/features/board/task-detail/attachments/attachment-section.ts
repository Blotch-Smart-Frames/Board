import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePaperclip } from '@ng-icons/lucide';
import { HlmAttachmentImports } from '@spartan-ng/helm/attachment';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { StorageService } from '../../../../core/services/storage.service';
import { ALLOWED_ATTACHMENT_TYPES } from '../../../../shared/utils/file-utils';
import { AttachmentPreview } from './attachment-preview';
import type { Attachment } from '../../../../shared/types/board';

type UploadInProgress = { id: string; fileName: string; progress: number };

@Component({
  selector: 'app-attachment-section',
  imports: [
    NgIcon,
    HlmButton,
    HlmSpinner,
    HlmAlert,
    HlmAlertDescription,
    HlmAttachmentImports,
    AttachmentPreview,
  ],
  providers: [provideIcons({ lucidePaperclip })],
  template: `
    <div>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-muted-foreground text-sm font-medium">Attachments</h3>
        <button
          hlmBtn
          variant="ghost"
          size="sm"
          [disabled]="uploads().length > 0"
          (click)="fileInput.click()"
        >
          <ng-icon name="lucidePaperclip" class="mr-2" />
          Add attachment
        </button>
        <input
          #fileInput
          type="file"
          class="hidden"
          multiple
          [accept]="acceptTypes"
          (change)="onFilesSelected($event)"
        />
      </div>

      @if (error()) {
        <div hlmAlert variant="destructive" class="mb-2">
          <p hlmAlertDescription>{{ error() }}</p>
        </div>
      }

      @if (hasContent()) {
        <div hlmAttachmentGroup class="flex-row flex-nowrap overflow-x-auto">
          @for (attachment of attachments(); track attachment.id) {
            <app-attachment-preview
              [attachment]="attachment"
              (deleted)="removeAttachment($event)"
            />
          }
          @for (upload of uploads(); track upload.id) {
            <div hlmAttachment state="uploading" class="flex flex-col min-w-29.5 items-center">
              <div class="flex-1 self-stretch flex items-center justify-center">
                <div hlmAttachmentMedia>
                  <hlm-spinner />
                </div>
              </div>
              <div hlmAttachmentContent class="min-h-0 flex flex-col justify-end">
                <span hlmAttachmentTitle>{{ upload.fileName }}</span>
                <span hlmAttachmentDescription>Uploading · {{ upload.progress }}%</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AttachmentSection {
  private readonly storageService = inject(StorageService);

  readonly boardId = input.required<string>();
  readonly taskId = input.required<string>();
  readonly attachments = input<Attachment[]>([]);
  readonly attachmentsChange = output<Attachment[]>();

  protected readonly acceptTypes = ALLOWED_ATTACHMENT_TYPES.join(',');
  protected readonly uploads = signal<UploadInProgress[]>([]);
  protected readonly error = signal<string | null>(null);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly hasContent = computed(
    () => this.attachments().length > 0 || this.uploads().length > 0,
  );

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    /* v8 ignore next -- input.files is always non-null when the change event fires @preserve */
    const files = Array.from(input.files ?? []);
    input.value = ''; // allow re-selecting the same file
    this.error.set(null);

    for (const file of files) {
      const uploadId = crypto.randomUUID();
      this.uploads.update((list) => [...list, { id: uploadId, fileName: file.name, progress: 0 }]);

      this.storageService
        .uploadTaskAttachment(this.boardId(), this.taskId(), file, (progress) => {
          this.uploads.update((list) =>
            list.map((u) => (u.id === uploadId ? { ...u, progress } : u)),
          );
        })
        .then((attachment) => {
          this.uploads.update((list) => list.filter((u) => u.id !== uploadId));
          this.attachmentsChange.emit([...this.attachments(), attachment]);
        })
        .catch((err: Error) => {
          this.uploads.update((list) => list.filter((u) => u.id !== uploadId));
          this.error.set(err.message);
        });
    }
  }

  protected removeAttachment(attachmentId: string): void {
    const attachment = this.attachments().find((a) => a.id === attachmentId);
    if (!attachment) return;
    /* v8 ignore next -- storage delete is fire-and-forget; the UI updates regardless of remote result @preserve */
    this.storageService.deleteTaskAttachment(attachment.storagePath).catch(() => {});
    this.attachmentsChange.emit(this.attachments().filter((a) => a.id !== attachmentId));
  }
}
