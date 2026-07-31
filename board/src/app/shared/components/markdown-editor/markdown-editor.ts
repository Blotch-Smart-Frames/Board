import { Component, input, model, signal } from '@angular/core';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmInput } from '@spartan-ng/helm/input';
import { MarkdownRenderer } from '../markdown-renderer/markdown-renderer';

/**
 * Lightweight markdown composer: a plain textarea with an Edit/Preview tab
 * switch backed by the read-only MarkdownRenderer. Replaces the source app's
 * `@uiw/react-md-editor` (a heavier WYSIWYG) — GFM is still fully hand-typeable.
 */
@Component({
  selector: 'app-markdown-editor',
  imports: [HlmTabsImports, HlmInput, MarkdownRenderer],
  template: `
    <hlm-tabs [tab]="activeTab()" (tabActivated)="activeTab.set($any($event))">
      <hlm-tabs-list class="w-fit">
        <button hlmTabsTrigger="edit">Write</button>
        <button hlmTabsTrigger="preview">Preview</button>
      </hlm-tabs-list>

      <div hlmTabsContent="edit" class="mt-2">
        <textarea
          hlmInput
          class="w-full resize-y"
          [style.min-height.px]="minHeight()"
          [value]="value()"
          (input)="value.set($any($event.target).value)"
          [attr.placeholder]="placeholder()"
          [attr.aria-label]="ariaLabel()"
        ></textarea>
      </div>

      <div hlmTabsContent="preview" class="mt-2">
        <div class="rounded-md border p-3" [style.min-height.px]="minHeight()">
          @if (value().trim()) {
            <app-markdown-renderer [source]="value()" />
          } @else {
            <p class="text-muted-foreground text-sm">Nothing to preview</p>
          }
        </div>
      </div>
    </hlm-tabs>
  `,
})
export class MarkdownEditor {
  readonly value = model('');
  readonly placeholder = input('');
  readonly ariaLabel = input('Markdown editor');
  readonly minHeight = input(120);

  protected readonly activeTab = signal<'edit' | 'preview'>('edit');
}
