import { Service, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS } from '../firebase/firebase.config';
import type {
  DecideMcpConnectRequestInput,
  DecideMcpConnectRequestResult,
  GetMcpConnectRequestInput,
  McpConnectRequestInfo,
} from '../../shared/types/board';

/**
 * Talks to the OAuth consent callables behind the MCP server. When an AI app
 * (ChatGPT, Claude, …) starts connecting, the server parks a pending request
 * and sends the browser to `/connect?request=<id>`; these calls read that
 * request and record the signed-in user's decision.
 */
@Service()
export class McpConnectService {
  private readonly functions = inject(FIREBASE_FUNCTIONS);

  async getRequest(requestId: string): Promise<McpConnectRequestInfo> {
    const call = httpsCallable<GetMcpConnectRequestInput, McpConnectRequestInfo>(
      this.functions,
      'getMcpConnectRequest',
    );
    const result = await call({ requestId });
    return result.data;
  }

  /**
   * Approves or denies the request. Either way the server hands back the URL
   * to send the browser to: the app's redirect URI carrying a code or an error.
   */
  async decide(requestId: string, approve: boolean): Promise<DecideMcpConnectRequestResult> {
    const call = httpsCallable<DecideMcpConnectRequestInput, DecideMcpConnectRequestResult>(
      this.functions,
      'decideMcpConnectRequest',
    );
    const result = await call({ requestId, approve });
    return result.data;
  }
}
