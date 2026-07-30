import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideVideo, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { formatFileSize, isImageFile } from '../../../../shared/utils/file-utils';
import type { Attachment } from '../../../../shared/types/board';

@Component({
  selector: 'app-attachment-preview',
  imports: [NgIcon, HlmButton],
  providers: [provideIcons({ lucideVideo, lucideTrash2 })],
  template: `
    <div class="flex items-center gap-2 rounded-md border p-2">
      <div class="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded">
        @if (isImage()) {
          <img [src]="attachment().downloadUrl" [alt]="attachment().fileName" class="size-full object-cover" />
        } @else {
          <ng-icon name="lucideVideo" class="text-muted-foreground" />
        }
      </div>
      <div class="min-w-0 flex-1">
        <a
          class="text-primary block truncate text-sm underline"
          [href]="attachment().downloadUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ attachment().fileName }}
        </a>
        <p class="text-muted-foreground text-xs">{{ size() }}</p>
      </div>
      <button hlmBtn variant="ghost" size="icon-sm" aria-label="Delete attachment" (click)="deleted.emit(attachment().id)">
        <ng-icon name="lucideTrash2" />
      </button>
    </div>
  `,
})
export class AttachmentPreview {
  readonly attachment = input.required<Attachment>();
  readonly deleted = output<string>();

  protected readonly isImage = computed(() => isImageFile(this.attachment().fileType));
  protected readonly size = computed(() => formatFileSize(this.attachment().fileSize));
}
