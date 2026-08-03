import { Component, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMenu, lucideShare2, lucideLogOut, lucideColumns3, lucideGanttChartSquare } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { AuthStore } from '../../core/auth/auth.store';
import { UserAvatar } from '../../shared/components/user-avatar/user-avatar';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

export type ViewMode = 'kanban' | 'timeline';

@Component({
  selector: 'app-app-bar',
  imports: [NgIcon, HlmButton, HlmDropdownMenuImports, HlmToggleGroupImports, UserAvatar, ThemeToggle],
  providers: [provideIcons({ lucideMenu, lucideShare2, lucideLogOut, lucideColumns3, lucideGanttChartSquare })],
  template: `
    <header class="bg-background flex items-center gap-2 border-b px-2 py-2 shadow-sm sm:px-4">
      @if (showMenuButton()) {
        <button hlmBtn variant="ghost" size="icon" aria-label="menu" (click)="menuClick.emit()">
          <ng-icon name="lucideMenu" />
        </button>
      }

      <h1 class="text-primary grow truncate font-semibold">{{ title() }}</h1>

      @if (viewMode()) {
        <div hlmToggleGroup type="single" [value]="viewMode()" (valueChange)="viewModeChangeHandler($event)">
          <button hlmToggleGroupItem value="kanban" aria-label="Kanban view">
            <ng-icon name="lucideColumns3" />
            <span class="hidden sm:inline">Kanban</span>
          </button>
          <button hlmToggleGroupItem value="timeline" aria-label="Timeline view">
            <ng-icon name="lucideGanttChartSquare" />
            <span class="hidden sm:inline">Timeline</span>
          </button>
        </div>
      }

      @if (showShare()) {
        <button hlmBtn variant="ghost" size="icon" aria-label="Share" (click)="share.emit()">
          <ng-icon name="lucideShare2" />
        </button>
      }

      <app-theme-toggle />

      @if (authStore.user(); as user) {
        <button
          hlmBtn
          variant="ghost"
          size="icon"
          class="rounded-full"
          [hlmDropdownMenuTrigger]="userMenu"
          aria-label="Account menu"
        >
          <app-user-avatar [name]="user.displayName || user.email || 'User'" [photoURL]="user.photoURL" size="small" [showTooltip]="false" />
        </button>

        <ng-template #userMenu>
          <hlm-dropdown-menu>
            <div class="px-2 py-1.5">
              <p class="text-sm font-medium">{{ user.displayName || 'User' }}</p>
              <p class="text-muted-foreground text-xs">{{ user.email }}</p>
            </div>
            <hlm-dropdown-menu-separator />
            <button hlmDropdownMenuItem (click)="signOut()">
              <ng-icon name="lucideLogOut" class="mr-2" />
              Sign out
            </button>
          </hlm-dropdown-menu>
        </ng-template>
      }
    </header>
  `,
})
export class AppBar {
  protected readonly authStore = inject(AuthStore);

  readonly title = input('Board by Blotch');
  readonly showMenuButton = input(false);
  readonly showShare = input(false);
  readonly viewMode = input<ViewMode>();

  readonly menuClick = output<void>();
  readonly share = output<void>();
  readonly viewModeChange = output<ViewMode>();

  protected readonly isLoggingOut = signal(false);

  protected viewModeChangeHandler(mode: unknown): void {
    if (mode === 'kanban' || mode === 'timeline') {
      this.viewModeChange.emit(mode);
    }
  }

  protected async signOut(): Promise<void> {
    this.isLoggingOut.set(true);
    try {
      await this.authStore.logout();
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
