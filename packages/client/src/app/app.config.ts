import {
  ApplicationConfig,
  SecurityContext,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideMarkdown, MARKED_OPTIONS, SANITIZE } from 'ngx-markdown';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideMarkdown({
      markedOptions: { provide: MARKED_OPTIONS, useValue: { gfm: true, breaks: true } },
      // Sanitize rendered markdown HTML (task descriptions/comments are user content).
      sanitize: { provide: SANITIZE, useValue: SecurityContext.HTML },
    }),
  ],
};
