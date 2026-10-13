import { Component, DOCUMENT, computed, inject, input, resource, signal } from '@angular/core';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { AuthStore } from '../../core/auth/auth.store';
import { McpConnectService } from '../../core/services/mcp-connect.service';
import { UserAvatar } from '../../shared/components/user-avatar/user-avatar';
import type { McpConnectRequestInfo } from '../../shared/types/board';

const EXPIRED_MESSAGE =
  'This connection request has expired or was already used. Go back to your AI app and connect again.';
const LOAD_FAILED_MESSAGE = "We couldn't load this connection request. Please try again.";
const DECISION_FAILED_MESSAGE = 'Something went wrong. Please try again.';

/** Callable errors carry `functions/<code>`; an expired or used request reports `not-found`. */
function describeError(error: unknown, fallback: string): string {
  const code = (error as { code?: unknown }).code;
  return code === 'functions/not-found' ? EXPIRED_MESSAGE : fallback;
}

type ConnectView =
  | { kind: 'missing' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; requestId: string; info: McpConnectRequestInfo };

/**
 * OAuth consent screen for AI apps connecting through the MCP server. The
 * server's authorize endpoint sends the browser here with `?request=<id>`; the
 * user reviews who is asking and what they'll get, then approves or denies,
 * and the browser is sent on to the app's redirect URI.
 */
@Component({
  selector: 'app-connect-page',
  imports: [HlmAlertImports, HlmButton, HlmCardImports, HlmSpinner, UserAvatar],
  host: { class: 'flex h-full items-center justify-center overflow-auto p-6' },
  template: `
    <section hlmCard class="w-full max-w-md" aria-labelledby="connect-title">
      @let state = view();
      @if (state.kind === 'ready') {
        <div hlmCardHeader>
          <h1 hlmCardTitle id="connect-title" class="text-xl font-semibold">
            Connect {{ state.info.clientName }} to Board
          </h1>
          <p hlmCardDescription>
            {{ state.info.clientName }} is asking to use Board on your behalf.
          </p>
        </div>

        <div hlmCardContent class="flex flex-col gap-5">
          <div class="flex items-center gap-3">
            <app-user-avatar
              [name]="account().name"
              [photoURL]="account().photoURL"
              [showTooltip]="false"
            />
            <div class="min-w-0 text-sm">
              <p class="text-muted-foreground">Signed in as</p>
              <p class="truncate font-medium">{{ account().name }}</p>
              @if (account().email) {
                <p class="text-muted-foreground truncate">{{ account().email }}</p>
              }
            </div>
          </div>

          <div class="text-sm">
            <h2 class="mb-1 font-medium">It will be able to</h2>
            <ul class="text-muted-foreground list-disc space-y-1 ps-5">
              <li>See your boards, lists, tasks, comments and team members</li>
              <li>Create, edit, move, assign and delete tasks</li>
              <li>Add comments, lists and labels</li>
            </ul>
          </div>

          <p class="text-sm">
            After you choose, you'll be sent to
            <strong class="font-semibold break-all">{{ state.info.redirectHost }}</strong
            >.
          </p>

          @if (state.info.isLoopbackRedirect) {
            <div hlmAlert>
              <h2 hlmAlertTitle>This app runs on your computer</h2>
              <p hlmAlertDescription>
                Only continue if you started this connection yourself. Any program on this computer
                could be waiting for the response.
              </p>
            </div>
          }

          @if (decisionError(); as message) {
            <div hlmAlert variant="destructive">
              <p hlmAlertDescription>{{ message }}</p>
            </div>
          }
        </div>

        <div hlmCardFooter class="flex justify-end gap-2">
          <button
            hlmBtn
            variant="outline"
            type="button"
            [disabled]="busy()"
            (click)="decide(state.requestId, false)"
          >
            @if (pending() === 'deny') {
              <hlm-spinner class="mr-2 size-4" />
            }
            Cancel
          </button>
          <button hlmBtn type="button" [disabled]="busy()" (click)="decide(state.requestId, true)">
            @if (pending() === 'allow') {
              <hlm-spinner class="mr-2 size-4" />
            }
            Allow
          </button>
        </div>
      } @else if (state.kind === 'loading') {
        <div hlmCardContent class="flex flex-col items-center gap-3 py-8">
          <hlm-spinner />
          <h1 id="connect-title" class="text-muted-foreground text-sm">
            Loading connection request…
          </h1>
        </div>
      } @else {
        <div hlmCardHeader>
          <h1 hlmCardTitle id="connect-title" class="text-xl font-semibold">
            Can't connect this app
          </h1>
          <p hlmCardDescription>
            @if (state.kind === 'error') {
              {{ state.message }}
            } @else {
              This link is missing its connection request. Go back to your AI app and start
              connecting again.
            }
          </p>
        </div>
      }
    </section>
  `,
})
export class ConnectPage {
  private readonly mcpConnect = inject(McpConnectService);
  private readonly authStore = inject(AuthStore);
  private readonly document = inject(DOCUMENT);

  /** The pending request id, bound from the `?request=` query parameter. */
  readonly request = input<string>();

  private readonly connectRequest = resource({
    params: () => this.request() || undefined,
    loader: ({ params }) => this.mcpConnect.getRequest(params),
  });

  protected readonly view = computed<ConnectView>(() => {
    const requestId = this.request();
    if (!requestId) return { kind: 'missing' };
    const error = this.connectRequest.error();
    if (error) return { kind: 'error', message: describeError(error, LOAD_FAILED_MESSAGE) };
    const info = this.connectRequest.value();
    if (!info) return { kind: 'loading' };
    return { kind: 'ready', requestId, info };
  });

  protected readonly account = computed(() => {
    const user = this.authStore.user();
    return {
      name: user?.displayName || user?.email || 'Your account',
      email: user?.email ?? '',
      photoURL: user?.photoURL ?? null,
    };
  });

  /** Which button was pressed, while its decision is in flight (or the browser is leaving). */
  protected readonly pending = signal<'allow' | 'deny' | null>(null);
  protected readonly busy = computed(() => this.pending() !== null);
  protected readonly decisionError = signal<string | null>(null);

  protected async decide(requestId: string, approve: boolean): Promise<void> {
    this.pending.set(approve ? 'allow' : 'deny');
    this.decisionError.set(null);
    try {
      const { redirectUrl } = await this.mcpConnect.decide(requestId, approve);
      // Stay "busy" on success: the browser is navigating away to the app.
      this.document.location.assign(redirectUrl);
    } catch (error) {
      this.decisionError.set(describeError(error, DECISION_FAILED_MESSAGE));
      this.pending.set(null);
    }
  }
}
