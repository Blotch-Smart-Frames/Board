import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-preview-backdrop',
  template: `
    <div class="preview-backdrop">
      <div class="preview-backdrop__checker" aria-hidden="true"></div>
      <div
        class="preview-backdrop__text"
        aria-hidden="true"
        [style.mask-image]="textPattern()"
        [style.-webkit-mask-image]="textPattern()"
      ></div>
      <div class="preview-backdrop__content">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .preview-backdrop {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 0.5rem;
      padding: 1.25rem 1rem;
      isolation: isolate;
      background-color: rgb(0 0 0 / 0.03);
    }

    :host-context(.dark) .preview-backdrop {
      background-color: rgb(255 255 255 / 0.03);
    }

    .preview-backdrop__checker {
      position: absolute;
      inset: -50%;
      z-index: 0;
      background-image:
        linear-gradient(45deg, rgb(0 0 0 / 0.06) 25%, transparent 25%),
        linear-gradient(-45deg, rgb(0 0 0 / 0.06) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgb(0 0 0 / 0.06) 75%),
        linear-gradient(-45deg, transparent 75%, rgb(0 0 0 / 0.06) 75%);
      background-size: 16px 16px;
      background-position:
        0 0,
        0 8px,
        8px -8px,
        -8px 0;
      animation: preview-backdrop-slide 6s linear infinite;
    }

    :host-context(.dark) .preview-backdrop__checker {
      background-image:
        linear-gradient(45deg, rgb(255 255 255 / 0.06) 25%, transparent 25%),
        linear-gradient(-45deg, rgb(255 255 255 / 0.06) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgb(255 255 255 / 0.06) 75%),
        linear-gradient(-45deg, transparent 75%, rgb(255 255 255 / 0.06) 75%);
    }

    /* Force a large square so a -45deg rotation always covers non-square parents. */
    .preview-backdrop__text {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 200vmax;
      height: 200vmax;
      z-index: 1;
      background-color: rgb(0 0 0 / 0.18);
      mask-repeat: repeat;
      mask-size: 200px 56px;
      mask-position: 0 0;
      -webkit-mask-repeat: repeat;
      -webkit-mask-size: 200px 56px;
      -webkit-mask-position: 0 0;
      transform: translate(-50%, -50%) rotate(-45deg);
      user-select: none;
      pointer-events: none;
      animation: preview-backdrop-marquee 48s linear infinite;
    }

    :host-context(.dark) .preview-backdrop__text {
      background-color: rgb(255 255 255 / 0.22);
    }

    .preview-backdrop__content {
      position: relative;
      z-index: 2;
    }

    @keyframes preview-backdrop-slide {
      from {
        background-position:
          0 0,
          0 8px,
          8px -8px,
          -8px 0;
      }
      to {
        background-position:
          16px 16px,
          16px 24px,
          24px 8px,
          8px 16px;
      }
    }

    @keyframes preview-backdrop-marquee {
      from {
        mask-position: 0 0;
        -webkit-mask-position: 0 0;
      }
      to {
        mask-position: 200px 56px;
        -webkit-mask-position: 200px 56px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .preview-backdrop__checker,
      .preview-backdrop__text {
        animation: none;
      }
    }
  `,
})
export class PreviewBackdrop {
  readonly label = input<string>('Preview');

  protected readonly textPattern = computed(() => {
    const text = this.label().toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='56' viewBox='0 0 200 56'>
      <g fill='white' font-family='ui-monospace, Menlo, Monaco, Consolas, monospace' font-size='12' font-weight='700' letter-spacing='2'>
        <text x='0' y='20'>${text}</text>
        <text x='100' y='48'>${text}</text>
      </g>
    </svg>`;
    const encoded = encodeURIComponent(svg.replace(/\s+/g, ' '));
    return `url("data:image/svg+xml;utf8,${encoded}")`;
  });
}
