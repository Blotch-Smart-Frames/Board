import { Component, computed, input } from '@angular/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { getContrastColor } from '../../utils/color-utils';
import type { Label } from '../../types/board';

@Component({
  selector: 'app-label-chip',
  imports: [HlmBadge],
  template: `
    <span hlmBadge [style.background-color]="label().color" [style.color]="textColor()">
      @if (label().emoji) {
        <span aria-hidden="true">{{ label().emoji }}</span>
      }
      <span>{{ label().name }}</span>
    </span>
  `,
})
export class LabelChip {
  readonly label = input.required<Label>();
  protected readonly textColor = computed(() => getContrastColor(this.label().color));
}
