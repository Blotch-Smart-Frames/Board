import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { labelColors } from '../../../core/config/default-labels';
import { getContrastColor } from '../../utils/color-utils';

@Component({
  selector: 'app-color-picker',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck })],
  template: `
    <div
      class="grid w-fit grid-cols-[repeat(8,1.75rem)] gap-1"
      role="radiogroup"
      aria-label="Card color"
    >
      @for (color of colors; track color) {
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md transition-transform hover:scale-110"
          [style.background-color]="color"
          [style.color]="contrast(color)"
          [class.ring-2]="color === value()"
          [class.ring-foreground]="color === value()"
          role="radio"
          [attr.aria-checked]="color === value()"
          [attr.aria-label]="color"
          (click)="valueChange.emit(color)"
        >
          @if (color === value()) {
            <ng-icon name="lucideCheck" class="text-sm" />
          }
        </button>
      }
    </div>
  `,
})
export class ColorPicker {
  readonly value = input<string>('');
  readonly valueChange = output<string>();

  protected readonly colors = labelColors;
  protected contrast(color: string): string {
    return getContrastColor(color);
  }
}
