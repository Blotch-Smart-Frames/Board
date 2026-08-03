import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendarDays,
  lucideKanban,
  lucideLayoutDashboard,
  lucideLogOut,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmNavigationMenuImports } from '@spartan-ng/helm/navigation-menu';
import { AuthStore } from '../../core/auth/auth.store';
import { UserAvatar } from '../../shared/components/user-avatar/user-avatar';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

@Component({
  selector: 'app-main-nav',
  imports: [
    HlmButton,
    HlmDropdownMenuImports,
    HlmNavigationMenuImports,
    NgIcon,
    RouterLink,
    RouterLinkActive,
    ThemeToggle,
    UserAvatar,
  ],
  providers: [
    provideIcons({ lucideCalendarDays, lucideKanban, lucideLayoutDashboard, lucideLogOut }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-background flex items-center gap-4 border-b px-4 py-2">
      <nav hlmNavigationMenu>
        <ul hlmNavigationMenuList>
          <li hlmNavigationMenuItem>
            <a
              hlmNavigationMenuLink
              routerLink="/"
              routerLinkActive="bg-accent text-accent-foreground"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              <ng-icon name="lucideLayoutDashboard" />
              Dashboard
            </a>
          </li>
          <li hlmNavigationMenuItem>
            <a
              hlmNavigationMenuLink
              routerLink="/agenda"
              routerLinkActive="bg-accent text-accent-foreground"
            >
              <ng-icon name="lucideCalendarDays" />
              Agenda
            </a>
          </li>
          <li hlmNavigationMenuItem>
            <a
              hlmNavigationMenuLink
              routerLink="/board"
              routerLinkActive="bg-accent text-accent-foreground"
            >
              <ng-icon name="lucideKanban" />
              Board
            </a>
          </li>
        </ul>
      </nav>

      <div class="ml-auto flex items-center gap-2">
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
            <app-user-avatar
              [name]="user.displayName || user.email || 'User'"
              [photoURL]="user.photoURL"
              size="small"
              [showTooltip]="false"
            />
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
      </div>
    </div>
  `,
})
export class MainNav {
  protected readonly authStore = inject(AuthStore);

  protected readonly isLoggingOut = signal(false);

  protected async signOut(): Promise<void> {
    this.isLoggingOut.set(true);
    try {
      await this.authStore.logout();
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
