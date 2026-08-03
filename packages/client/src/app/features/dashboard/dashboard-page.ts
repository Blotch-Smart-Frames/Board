import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto flex h-full max-w-6xl flex-col gap-4 p-6">
      <h1 class="text-2xl font-semibold">Dashboard</h1>
      <p class="text-muted-foreground">Welcome back — pick a board or check your agenda.</p>
    </section>
  `,
})
export class DashboardPage {}
