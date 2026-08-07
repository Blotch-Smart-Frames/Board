import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCirclePlay, lucideFileVideo, lucideTrash2 } from '@ng-icons/lucide';
import { HlmAttachmentImports } from '@spartan-ng/helm/attachment';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { formatFileSize, isImageFile, isVideoFile } from '../../../../shared/utils/file-utils';
import type { Attachment } from '../../../../shared/types/board';

@Component({
  selector: 'app-attachment-preview',
  imports: [NgIcon, HlmAttachmentImports, HlmDialogImports],
  providers: [provideIcons({ lucideCirclePlay, lucideFileVideo, lucideTrash2 })],
  template: `
    <div hlmAttachment class="w-full" orientation="vertical">
      <button
        type="button"
        hlmAttachmentMedia
        [variant]="mediaVariant()"
        class="bg-background cursor-pointer"
        [attr.aria-label]="'View ' + attachment().fileName"
        (click)="dialog.open()"
      >
        @if (isImage()) {
          <img
            [src]="attachment().downloadUrl"
            [alt]="attachment().fileName"
            class="size-25 object-cover"
          />
        } @else if (isVideo()) {
          <video
            [src]="attachment().downloadUrl"
            class="aspect-square w-full object-cover"
            muted
            preload="metadata"
          ></video>
          <span class="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
            <ng-icon name="lucideCirclePlay" class="text-3xl" />
          </span>
        } @else {
          <ng-icon name="lucideFileVideo" class="text-muted-foreground" />
        }
      </button>
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

    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="w-auto! max-w-[95vw]! p-2! sm:max-w-[85vw]!">
        <hlm-dialog-header class="sr-only">
          <h3 hlmDialogTitle>{{ attachment().fileName }}</h3>
        </hlm-dialog-header>

        @if (isImage()) {
          <img
            [src]="attachment().downloadUrl"
            [alt]="attachment().fileName"
            class="mx-auto max-h-[85vh] w-auto rounded-lg object-contain"
          />
        } @else if (isVideo()) {
          <video
            [src]="attachment().downloadUrl"
            controls
            class="mx-auto max-h-[85vh] w-auto rounded-lg"
          ></video>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class AttachmentPreview {
  readonly attachment = input.required<Attachment>();
  readonly deleted = output<string>();

  protected readonly isImage = computed(() => isImageFile(this.attachment().fileType));
  protected readonly isVideo = computed(() => isVideoFile(this.attachment().fileType));
  protected readonly mediaVariant = computed<'image' | 'icon'>(() =>
    this.isImage() || this.isVideo() ? 'image' : 'icon',
  );
  protected readonly size = computed(() => formatFileSize(this.attachment().fileSize));
}
