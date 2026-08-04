import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMenu, lucideShare2, lucideColumns3, lucideGanttChartSquare } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';

export type ViewMode = 'kanban' | 'timeline';

@Component({
  selector: 'app-app-bar',
  imports: [NgIcon, HlmButton, HlmToggleGroupImports],
  providers: [provideIcons({ lucideMenu, lucideShare2, lucideColumns3, lucideGanttChartSquare })],
  template: `
    <header class="bg-background flex items-center gap-2 border-b px-2 py-2 shadow-sm sm:px-4">
      @if (showMenuButton()) {
        <button hlmBtn variant="ghost" size="icon" aria-label="menu" (click)="menuClick.emit()">
          <ng-icon name="lucideMenu" />
        </button>
      }

      <h1 class="text-primary grow truncate font-semibold">{{ title() }}</h1>

      @if (viewMode()) {
        <div
          hlmToggleGroup
          type="single"
          [value]="viewMode()"
          (valueChange)="viewModeChangeHandler($event)"
        >
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
    </header>
  `,
})
export class AppBar {
  readonly title = input('Board by Blotch');
  readonly showMenuButton = input(false);
  readonly showShare = input(false);
  readonly viewMode = input<ViewMode>();

  readonly menuClick = output<void>();
  readonly share = output<void>();
  readonly viewModeChange = output<ViewMode>();

  protected viewModeChangeHandler(mode: unknown): void {
    if (mode === 'kanban' || mode === 'timeline') {
      this.viewModeChange.emit(mode);
    }
  }
}
