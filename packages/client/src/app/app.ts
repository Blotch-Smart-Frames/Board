import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import { toast } from '@spartan-ng/brain/sonner';
import { AuthStore } from './core/auth/auth.store';
import { ThemeService } from './core/theme/theme.service';
import { VersionCheckService } from './core/version/version-check.service';
import { SignInPage } from './layout/sign-in-page/sign-in-page';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmSpinner, HlmToaster, SignInPage],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly authStore = inject(AuthStore);
  // Injected so its constructor (which wires the dark-mode class effect) runs at bootstrap.
  private readonly themeService = inject(ThemeService);
  private readonly versionCheck = inject(VersionCheckService);
  private notifiedNewVersion = false;

  constructor() {
    // Fire a persistent update toast once a new deployment is detected. The
    // guard avoids re-showing it on every poll interval — sonner would happily
    // re-render otherwise.
    effect(() => {
      if (this.versionCheck.hasNewVersion() && !this.notifiedNewVersion) {
        this.notifiedNewVersion = true;
        toast('New version available', {
          description: 'Reload the page to update.',
          duration: Infinity,
          action: { label: 'Reload', onClick: () => window.location.reload() },
        });
      }
    });
  }
}
