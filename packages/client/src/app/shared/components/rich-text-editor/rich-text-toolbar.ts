import { Component, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { HlmTooltip } from '@spartan-ng/helm/tooltip';

/**
 * All the commands the toolbar can raise. Kept as a discriminated union so the
 * parent `RichTextEditor` can `switch` on `kind` without runtime string checks,
 * and so new commands (tables, images, etc.) can be added without changing the
 * output surface.
 */
export type RichTextCommand =
  | { readonly kind: 'bold' }
  | { readonly kind: 'italic' }
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3 }
  | { readonly kind: 'list'; readonly style: 'ordered' | 'bullet' }
  | { readonly kind: 'link' }
  | { readonly kind: 'code-block' }
  | { readonly kind: 'formula' }
  | { readonly kind: 'clear' };

/**
 * Spartan-styled formatting bar for the rich text description editor. Pure
 * display: it just emits `RichTextCommand`s and lets the editor decide how to
 * apply them to the Quill instance. Kept as its own component so the toolbar
 * can be exercised in isolation (no Quill needed) and reused in future
 * comment/attachment rich-text surfaces.
 */
@Component({
  selector: 'app-rich-text-toolbar',
  imports: [HlmButton, HlmSeparator, HlmTooltip],
  host: {
    class: 'flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-muted/40 p-1',
    role: 'toolbar',
    'aria-label': 'Formatting',
    // Buttons default to receiving focus on mousedown, which would blur the
    // Quill editor and drop its selection. preventDefault on mousedown keeps
    // focus in the editor while still firing the click event.
    '(mousedown)': '$event.preventDefault()',
  },
  template: `
    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Bold (Ctrl+B)"
      aria-label="Bold"
      (click)="command.emit({ kind: 'bold' })"
    >
      <i class="fa-sharp fa-regular fa-bold"></i>
    </button>

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Italic (Ctrl+I)"
      aria-label="Italic"
      (click)="command.emit({ kind: 'italic' })"
    >
      <i class="fa-sharp fa-regular fa-italic"></i>
    </button>

    <hlm-separator orientation="vertical" class="mx-1 h-6" />

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Heading 1"
      aria-label="Heading 1"
      (click)="command.emit({ kind: 'heading', level: 1 })"
    >
      <i class="fa-sharp fa-regular fa-h1"></i>
    </button>

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Heading 2"
      aria-label="Heading 2"
      (click)="command.emit({ kind: 'heading', level: 2 })"
    >
      <i class="fa-sharp fa-regular fa-h2"></i>
    </button>

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Heading 3"
      aria-label="Heading 3"
      (click)="command.emit({ kind: 'heading', level: 3 })"
    >
      <i class="fa-sharp fa-regular fa-h3"></i>
    </button>

    <hlm-separator orientation="vertical" class="mx-1 h-6" />

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Bulleted list"
      aria-label="Bulleted list"
      (click)="command.emit({ kind: 'list', style: 'bullet' })"
    >
      <i class="fa-sharp fa-regular fa-list-ul"></i>
    </button>

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Numbered list"
      aria-label="Numbered list"
      (click)="command.emit({ kind: 'list', style: 'ordered' })"
    >
      <i class="fa-sharp fa-regular fa-list-ol"></i>
    </button>

    <hlm-separator orientation="vertical" class="mx-1 h-6" />

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Insert link"
      aria-label="Insert link"
      (click)="command.emit({ kind: 'link' })"
    >
      <i class="fa-sharp fa-regular fa-link"></i>
    </button>

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Code block"
      aria-label="Code block"
      (click)="command.emit({ kind: 'code-block' })"
    >
      <i class="fa-sharp fa-regular fa-code"></i>
    </button>

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Insert formula"
      aria-label="Insert formula"
      (click)="command.emit({ kind: 'formula' })"
    >
      <i class="fa-sharp fa-regular fa-function"></i>
    </button>

    <hlm-separator orientation="vertical" class="mx-1 h-6" />

    <button
      type="button"
      hlmBtn
      variant="ghost"
      size="icon-sm"
      hlmTooltip="Convert to standard text"
      aria-label="Clear formatting"
      (click)="command.emit({ kind: 'clear' })"
    >
      <i class="fa-sharp fa-regular fa-text-slash"></i>
    </button>
  `,
})
export class RichTextToolbar {
  readonly command = output<RichTextCommand>();
}
