import { stripHtml } from './html-text';

describe('stripHtml', () => {
  it('returns an empty string for nullish input', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('')).toBe('');
  });

  it('leaves plain text untouched', () => {
    expect(stripHtml('hello world')).toBe('hello world');
  });

  it('drops inline and block tags', () => {
    expect(stripHtml('<p>Fix the <strong>flaky</strong> tests</p>')).toBe('Fix the flaky tests');
  });

  it('joins paragraphs and headings into a single line', () => {
    expect(stripHtml('<h1>Title</h1><p>Body copy</p>')).toBe('Title Body copy');
  });

  it('decodes the common HTML entities Quill emits', () => {
    expect(stripHtml('Tom&nbsp;&amp;&nbsp;Jerry &lt;3 &quot;fun&quot; &#39;quotes&#39;')).toBe(
      `Tom & Jerry <3 "fun" 'quotes'`,
    );
  });

  it('trims leading/trailing whitespace from block markup', () => {
    expect(stripHtml('  <p>  padded  </p>  ')).toBe('padded');
  });
});
