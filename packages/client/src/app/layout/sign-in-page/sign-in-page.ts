import { Component } from '@angular/core';
import { HlmCard } from '@spartan-ng/helm/card';
import { GoogleAuthButton } from '../google-auth-button/google-auth-button';

@Component({
  selector: 'app-sign-in-page',
  imports: [HlmCard, GoogleAuthButton],
  template: `
    <div class="flex h-screen items-center justify-center gap-4 p-6">
      <div hlmCard class="mx-4 flex w-full max-w-md flex-col gap-4 p-8 text-center">
        <h1 class="mb-2 text-2xl font-bold">
          Board <sub class="text-muted-foreground text-xs font-normal">by Blotch</sub>
        </h1>
        <p class="text-muted-foreground">
          Organize your tasks with a beautiful, collaborative board.
        </p>

        <div class="flex flex-col items-center gap-4">
          <app-google-auth-button />

          <p class="text-muted-foreground mt-4 block text-xs">
            By signing in, you agree to our
            <a href="/terms.html" target="_blank" rel="noopener" class="underline"
              >Terms of Service</a
            >
            and
            <a href="/privacy.html" target="_blank" rel="noopener" class="underline"
              >Privacy Policy</a
            >.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class SignInPage {}
