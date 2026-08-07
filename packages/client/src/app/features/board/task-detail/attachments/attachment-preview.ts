import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileVideo, lucideTrash2 } from '@ng-icons/lucide';
import { HlmAttachmentImports } from '@spartan-ng/helm/attachment';
import { formatFileSize, isImageFile } from '../../../../shared/utils/file-utils';
import type { Attachment } from '../../../../shared/types/board';

@Component({
  selector: 'app-attachment-preview',
  imports: [NgIcon, HlmAttachmentImports],
  providers: [provideIcons({ lucideFileVideo, lucideTrash2 })],
  template: `
    <div hlmAttachment class="w-full" orientation="vertical">
      <div hlmAttachmentMedia [variant]="isImage() ? 'image' : 'icon'" class="bg-background">
        @if (isImage()) {
          <img
            [src]="attachment().downloadUrl"
            [alt]="attachment().fileName"
            class="size-25 object-cover"
          />
        } @else {
          <ng-icon name="lucideFileVideo" class="text-muted-foreground" />
        }
      </div>
      <div hlmAttachmentContent>
        <span hlmAttachmentDescription class="text-muted-foreground text-xs">{{ size() }}</span>
      </div>
      <div hlmAttachmentActions>
        <button
          hlmAttachmentAction
          aria-label="Delete attachment"
          (click)="deleted.emit(attachment().id)"
        >
          <ng-icon name="lucideTrash2" />
        </button>
      </div>
    </div>
  `,
})
export class AttachmentPreview {
  readonly attachment = input.required<Attachment>();
  readonly deleted = output<string>();

  protected readonly isImage = computed(() => isImageFile(this.attachment().fileType));
  protected readonly size = computed(() => formatFileSize(this.attachment().fileSize));
}
