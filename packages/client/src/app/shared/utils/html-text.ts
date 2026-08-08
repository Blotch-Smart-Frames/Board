/**
 * Strip HTML tags from a Quill-produced description so it can be shown in
 * plain-text contexts (task card preview, calendar sync). Also decodes the
 * handful of entities Quill emits (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`,
 * `&#39;`) and collapses runs of whitespace so multiline block markup renders
 * as a single readable line.
 *
 * DOM-free by design so it can run under jsdom during tests and in any future
 * SSR/worker context without hitting `document`. The regex approach is safe for
 * text-only extraction — we never inject the result back as HTML.
 */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return '';
  const withoutTags = value.replace(/<[^>]*>/g, ' ');
  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  return decoded.replace(/\s+/g, ' ').trim();
}
