import { render, screen } from '@testing-library/angular';
import { PreviewBackdrop } from './preview-backdrop';

describe('PreviewBackdrop', () => {
  it('projects content into the backdrop slot', async () => {
    const view = await render(
      `<app-preview-backdrop><span>Inner text</span></app-preview-backdrop>`,
      { imports: [PreviewBackdrop] },
    );
    expect(view.container.querySelector('.preview-backdrop__content')).toContainHTML(
      '<span>Inner text</span>',
    );
  });

  it('renders a mask-image URL that embeds the label text upper-cased', async () => {
    await render(PreviewBackdrop, { inputs: { label: 'demo' } });

    const textLayer = document.querySelector('.preview-backdrop__text') as HTMLElement;
    const encoded = textLayer.style.getPropertyValue('mask-image');
    // encodeURIComponent turns the SVG upper-cased label into "DEMO".
    expect(encoded).toContain('DEMO');
    expect(encoded).toMatch(/^url\("data:image\/svg\+xml;utf8,/);
  });

  it('defaults the label to "Preview" when no label is provided', async () => {
    await render(PreviewBackdrop);

    const textLayer = document.querySelector('.preview-backdrop__text') as HTMLElement;
    expect(textLayer.style.getPropertyValue('mask-image')).toContain('PREVIEW');
  });
});
