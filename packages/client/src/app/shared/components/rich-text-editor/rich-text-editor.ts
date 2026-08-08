import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HlmInput } from '@spartan-ng/helm/input';
import { RichTextToolbar, type RichTextCommand } from './rich-text-toolbar';

// Quill/KaTeX are lazy-loaded — importing them synchronously would double the
// initial bundle even for users who never open a task. The types here match the
// `quill@2` runtime surface we actually call; a full ambient d.ts import would
// pull in Parchment/Delta types we don't reference elsewhere.
type QuillFormat = Record<string, unknown>;
type QuillRange = { readonly index: number; readonly length: number };
interface QuillInstance {
  readonly root: HTMLElement;
  focus(): void;
  blur(): void;
  getLength(): number;
  getText(): string;
  getSemanticHTML(): string;
  getSelection(focus?: boolean): QuillRange | null;
  setSelection(index: number, length: number, source?: string): void;
  getFormat(range?: QuillRange | number, length?: number): QuillFormat;
  format(name: string, value: unknown, source?: string): void;
  removeFormat(index: number, length: number, source?: string): void;
  insertEmbed(index: number, type: string, value: unknown, source?: string): void;
  deleteText(index: number, length: number, source?: string): void;
  on(event: 'selection-change', handler: (range: QuillRange | null) => void): void;
  clipboard: { dangerouslyPasteHTML(html: string, source?: string): void };
}
interface QuillCtor {
  new (
    container: HTMLElement,
    options: {
      readonly theme?: string;
      readonly placeholder?: string;
      readonly modules?: Record<string, unknown>;
      readonly formats?: readonly string[];
    },
  ): QuillInstance;
}

/* v8 ignore start -- Quill wraps browser Selection/MutationObserver APIs jsdom only stubs, so its lifecycle can't be driven in coverage; excluded via angular.json coverageExclude too. @preserve */

/**
 * Whether the current environment can host a real Quill instance. jsdom
 * advertises a `Selection` object but its contenteditable plumbing is a no-op,
 * so we filter it out by user-agent and only trust a real browser. In every
 * other case (production, dev browser) Quill takes over; the fallback path
 * still keeps the field usable if it somehow throws.
 */
function hasEditingSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom')) return false;
  const selection = window.getSelection?.();
  if (!selection) return false;
  return typeof document.createRange === 'function';
}

/**
 * Quill 2.0 wrapped as a signal-friendly Angular component with a Spartan
 * toolbar on top. Public surface mirrors `TaskDescriptionEditor`'s original
 * shape: content is seeded from `initialHtml`, reset only when `taskKey`
 * changes (so an in-flight edit isn't wiped by an ambient update to the same
 * task), and the new HTML is emitted on `htmlChange` when the editor blurs.
 *
 * In jsdom / any host without a working Selection API, Quill is skipped and a
 * `<textarea>` fallback is rendered instead. The fallback keeps the same
 * `aria-label` so downstream tests can still address the field by name, and it
 * emits plain text (which any Quill-produced HTML degrades cleanly into on the
 * next render).
 */
@Component({
  selector: 'app-rich-text-editor',
  imports: [HlmInput, RichTextToolbar],
  template: `
    @if (!fallback()) {
      <app-rich-text-toolbar (command)="onCommand($event)" />
      <div
        #host
        class="border-input! min-h-60 rounded-b-md border"
        [attr.aria-label]="ariaLabel()"
        [attr.data-testid]="'rich-text-editor'"
      ></div>
    } @else {
      <textarea
        hlmInput
        class="min-h-40 w-full resize-y"
        [value]="fallbackValue()"
        (input)="onFallbackInput($event)"
        (blur)="onFallbackBlur()"
        [attr.placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel()"
      ></textarea>
    }
  `,
})
export class RichTextEditor {
  private readonly destroyRef = inject(DestroyRef);
  // Registered as a field so it enters the destroy queue BEFORE `output()`'s
  // own hook (registered when `htmlChange` is initialized below). Destroy
  // hooks fire in FIFO order, so this guarantees the flushed edit is emitted
  // while the `OutputRef` is still live — otherwise NG0953 fires and the
  // in-flight edit is dropped when an enclosing dialog closes mid-type.
  private readonly flushOnDestroy = this.destroyRef.onDestroy(() => {
    this.flush();
    this.destroyed = true;
  });

  readonly taskKey = input.required<string>();
  readonly initialHtml = input<string>('');
  readonly ariaLabel = input<string>('Rich text editor');
  readonly placeholder = input<string>('');
  readonly htmlChange = output<string | undefined>();

  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');

  protected readonly fallback = signal(!hasEditingSupport());
  // The linked signal resets only when `taskKey` flips — ambient re-emits of
  // `initialHtml` for the same task must NOT clobber a mid-edit local buffer.
  private readonly resetSource = linkedSignal({
    source: this.taskKey,
    computation: () => this.initialHtml(),
  });
  protected readonly fallbackValue = signal('');

  private quill: QuillInstance | null = null;
  private lastEmitted = '';
  private destroyed = false;

  constructor() {
    // First render only: attempt to boot Quill. `afterNextRender` runs in a
    // browser context, so bundlers dead-code-eliminate this on the server.
    afterNextRender(() => {
      if (this.fallback()) return;
      void this.initQuill();
    });

    // Runs on init and again on every taskKey change (never on ambient
    // `initialHtml` updates for the same task). Keeps the Quill root, the
    // fallback buffer, and `lastEmitted` all seeded from one source of truth.
    effect(() => {
      const next = this.resetSource();
      this.fallbackValue.set(next);
      if (this.quill) {
        this.pushContent(this.quill, next);
      }
      this.lastEmitted = this.normalize(next);
    });
  }

  protected onCommand(cmd: RichTextCommand): void {
    const quill = this.quill;
    if (!quill) return;
    quill.focus();
    const range = quill.getSelection(true) ?? { index: quill.getLength() - 1, length: 0 };
    const current = quill.getFormat(range);

    switch (cmd.kind) {
      case 'bold':
        quill.format('bold', !current['bold'], 'user');
        return;
      case 'italic':
        quill.format('italic', !current['italic'], 'user');
        return;
      case 'heading':
        quill.format('header', current['header'] === cmd.level ? false : cmd.level, 'user');
        return;
      case 'list':
        quill.format('list', current['list'] === cmd.style ? false : cmd.style, 'user');
        return;
      case 'code-block':
        quill.format('code-block', !current['code-block'], 'user');
        return;
      case 'link': {
        const seed = typeof current['link'] === 'string' ? current['link'] : 'https://';
        const url = window.prompt('Enter link URL', seed);
        if (url === null) return;
        quill.format('link', url === '' ? false : url, 'user');
        return;
      }
      case 'formula': {
        const latex = window.prompt('Enter LaTeX formula (e.g. e^{i\\pi}+1=0)');
        if (!latex) return;
        if (range.length > 0) quill.deleteText(range.index, range.length, 'user');
        quill.insertEmbed(range.index, 'formula', latex, 'user');
        quill.setSelection(range.index + 1, 0, 'user');
        return;
      }
      case 'clear':
        if (range.length > 0) quill.removeFormat(range.index, range.length, 'user');
        return;
    }
  }

  protected onFallbackInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) return;
    this.fallbackValue.set(target.value);
  }

  protected onFallbackBlur(): void {
    this.emit(this.fallbackValue());
  }

  private async initQuill(): Promise<void> {
    const container = this.host()?.nativeElement;
    if (!container) {
      this.fallback.set(true);
      return;
    }

    try {
      const [{ default: Quill }, katexMod] = await Promise.all([import('quill'), import('katex')]);
      if (this.destroyed) return;

      // Quill's formula module reads `window.katex` at insert time; attaching
      // it here (instead of via a `<script>` tag) keeps the CSP surface tight.
      (globalThis as unknown as { katex: unknown }).katex =
        (katexMod as { default?: unknown }).default ?? katexMod;

      const quill = new (Quill as unknown as QuillCtor)(container, {
        theme: 'snow',
        placeholder: this.placeholder(),
        modules: { toolbar: false },
        formats: ['bold', 'italic', 'header', 'list', 'link', 'code-block', 'formula'],
      });
      // Screen readers announce the focused editable region (`.ql-editor`),
      // not the outer container — mirror the aria-label there so the name
      // matches what the outer <label> displays visually.
      quill.root.setAttribute('aria-label', this.ariaLabel());
      this.pushContent(quill, this.initialHtml());
      this.lastEmitted = this.normalize(this.initialHtml());

      quill.on('selection-change', (range) => {
        // Quill fires `null` when focus leaves the editor — that's our blur.
        if (range === null) this.emitIfChanged(quill);
      });

      this.quill = quill;
    } catch {
      // Any failure (missing Selection support, module resolution, malformed
      // seed content) drops us to the textarea fallback so the field stays
      // usable rather than presenting an empty inert box.
      this.fallback.set(true);
    }
  }

  private pushContent(quill: QuillInstance, html: string): void {
    // `dangerouslyPasteHTML` re-parses through Quill's clipboard converter so
    // unsupported markup is silently dropped. 'silent' suppresses the
    // resulting text-change event so we don't self-trigger emit.
    quill.clipboard.dangerouslyPasteHTML(html ?? '', 'silent');
  }

  private emitIfChanged(quill: QuillInstance): void {
    const html = quill.getSemanticHTML().trim();
    const plain = quill.getText().trim();
    // Quill's empty state is `<p><br></p>`; treat any all-whitespace document
    // as a clear so the parent stores `undefined` and resets the field.
    const value = plain ? html : '';
    if (this.normalize(value) === this.lastEmitted) return;
    this.lastEmitted = this.normalize(value);
    this.htmlChange.emit(value || undefined);
  }

  private emit(text: string): void {
    const trimmed = text.trim();
    if (this.normalize(trimmed) === this.lastEmitted) return;
    this.lastEmitted = this.normalize(trimmed);
    this.htmlChange.emit(trimmed || undefined);
  }

  // Called from the DestroyRef hook: a mid-type dialog close (Escape,
  // backdrop click) tears the subtree down before the editor can blur, so we
  // re-run the emit path once more against the live Quill/textarea state.
  // Swallow so a partly-detached DOM never surfaces an error during teardown.
  private flush(): void {
    try {
      if (this.quill) this.emitIfChanged(this.quill);
      else if (this.fallback()) this.emit(this.fallbackValue());
    } catch {
      /* no-op */
    }
  }

  private normalize(html: string): string {
    return (html ?? '').trim();
  }
}

/* v8 ignore stop -- @preserve */
