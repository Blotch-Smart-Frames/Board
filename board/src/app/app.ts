import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { AuthStore } from './core/auth/auth.store';
import { ThemeService } from './core/theme/theme.service';
import { SignInPage } from './layout/sign-in-page/sign-in-page';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmSpinner, SignInPage],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly authStore = inject(AuthStore);
  // Injected so its constructor (which wires the dark-mode class effect) runs at bootstrap.
  private readonly themeService = inject(ThemeService);
}
