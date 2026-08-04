import { Component, computed, input } from '@angular/core';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmTooltip } from '@spartan-ng/helm/tooltip';
import { getInitials, stringToColor } from '../../utils/user-display';

@Component({
  selector: 'app-user-avatar',
  imports: [HlmAvatarImports, HlmTooltip],
  template: `
    <hlm-avatar [size]="hlmSize()" [hlmTooltip]="name()" [tooltipDisabled]="!showTooltip()">
      @if (photoURL()) {
        <img hlmAvatarImage [src]="photoURL()" [alt]="name()" />
      }
      <span hlmAvatarFallback [style.background-color]="color()" style="color: white">
        {{ initials() }}
      </span>
    </hlm-avatar>
  `,
})
export class UserAvatar {
  readonly name = input.required<string>();
  readonly photoURL = input<string | null | undefined>(null);
  readonly size = input<'small' | 'medium' | 'large'>('medium');
  readonly showTooltip = input(true);

  protected readonly hlmSize = computed(() => {
    const map = { small: 'sm', medium: 'default', large: 'lg' } as const;
    return map[this.size()];
  });
  protected readonly initials = computed(() => getInitials(this.name()));
  protected readonly color = computed(() => stringToColor(this.name()));
}
