import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSun, lucideMoon, lucideMonitor, lucideCheck } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { ThemeService, type ThemeMode } from '../../core/theme/theme.service';

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'lucideSun' },
  { value: 'dark', label: 'Dark', icon: 'lucideMoon' },
  { value: 'system', label: 'System', icon: 'lucideMonitor' },
];

@Component({
  selector: 'app-theme-toggle',
  imports: [NgIcon, HlmButton, HlmDropdownMenuImports],
  providers: [provideIcons({ lucideSun, lucideMoon, lucideMonitor, lucideCheck })],
  template: `
    <button hlmBtn variant="ghost" size="icon" [hlmDropdownMenuTrigger]="menu" aria-label="Theme">
      <ng-icon [name]="currentIcon()" />
    </button>

    <ng-template #menu>
      <hlm-dropdown-menu>
        @for (option of options; track option.value) {
          <button hlmDropdownMenuItem (click)="themeService.setMode(option.value)">
            <ng-icon [name]="option.icon" class="mr-2" />
            {{ option.label }}
            @if (themeService.mode() === option.value) {
              <ng-icon name="lucideCheck" class="ml-auto" />
            }
          </button>
        }
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class ThemeToggle {
  protected readonly themeService = inject(ThemeService);
  protected readonly options = MODE_OPTIONS;

  protected currentIcon(): string {
    return this.options.find((o) => o.value === this.themeService.mode())?.icon ?? 'lucideMonitor';
  }
}
