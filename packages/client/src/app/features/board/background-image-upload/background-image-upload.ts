import { Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { deleteField } from 'firebase/firestore';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideWallpaper, lucideUpload, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { BoardService } from '../../../core/services/board.service';
import { StorageService } from '../../../core/services/storage.service';

const ACCEPT_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * Floating "wallpaper" FAB that lets the board owner upload/replace/remove the
 * board background image. Mounted once at the workspace level so it overlays
 * both the Kanban and Timeline views (matches source's placement inside
 * BoardBackground).
 */
@Component({
  selector: 'app-background-image-upload',
  imports: [NgIcon, HlmButton, HlmSpinner, HlmDropdownMenuImports],
  providers: [provideIcons({ lucideWallpaper, lucideUpload, lucideTrash2 })],
  template: `
    <input
      #fileInput
      type="file"
      class="hidden"
      [accept]="acceptTypes"
      (change)="onFileSelected($event)"
    />

    <button
      hlmBtn
      size="icon"
      class="fixed right-6 bottom-6 z-40 rounded-full shadow-lg"
      aria-label="Board background options"
      [disabled]="isLoading()"
      [hlmDropdownMenuTrigger]="menu"
    >
      @if (isLoading()) {
        <hlm-spinner class="size-5" />
      } @else {
        <ng-icon name="lucideWallpaper" />
      }
    </button>

    <ng-template #menu>
      <hlm-dropdown-menu class="min-w-52">
        <button hlmDropdownMenuItem class="whitespace-nowrap" (click)="triggerFilePicker()">
          <ng-icon name="lucideUpload" class="mr-2" />
          Upload new image
        </button>
        @if (hasBackground()) {
          <button
            hlmDropdownMenuItem
            variant="destructive"
            class="whitespace-nowrap"
            (click)="removeBackground()"
          >
            <ng-icon name="lucideTrash2" class="mr-2" />
            Remove background
          </button>
        }
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class BackgroundImageUpload {
  private readonly boardService = inject(BoardService);
  private readonly storageService = inject(StorageService);

  readonly boardId = input.required<string>();
  readonly hasBackground = input(false);

  protected readonly acceptTypes = ACCEPT_TYPES;
  protected readonly isLoading = signal(false);

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected triggerFilePicker(): void {
    this.fileInput().nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so selecting the same file again still fires 'change'.
    input.value = '';
    if (!file) return;

    this.isLoading.set(true);
    try {
      const url = await this.storageService.uploadBoardBackground(this.boardId(), file);
      await this.boardService.updateBoard(this.boardId(), { backgroundImageUrl: url });
    } catch (err) {
      console.error('Failed to upload background:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async removeBackground(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.storageService.deleteBoardBackground(this.boardId());
      await this.boardService.updateBoard(this.boardId(), { backgroundImageUrl: deleteField() });
    } catch (err) {
      console.error('Failed to remove background:', err);
    } finally {
      this.isLoading.set(false);
    }
  }
}
