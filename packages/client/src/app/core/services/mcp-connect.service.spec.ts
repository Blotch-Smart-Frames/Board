import { TestBed } from '@angular/core/testing';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS } from '../firebase/firebase.config';
import { McpConnectService } from './mcp-connect.service';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

describe('McpConnectService', () => {
  let service: McpConnectService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_FUNCTIONS, useValue: { __fake: 'functions' } }],
    });
    service = TestBed.inject(McpConnectService);
  });

  it('loads a pending connect request through the getMcpConnectRequest callable', async () => {
    const info = {
      clientName: 'Claude',
      clientUri: null,
      redirectHost: 'claude.ai',
      isLoopbackRedirect: false,
      expiresAt: 1,
    };
    const call = vi.fn().mockResolvedValue({ data: info });
    vi.mocked(httpsCallable).mockReturnValue(call as never);

    await expect(service.getRequest('req-1')).resolves.toEqual(info);

    expect(httpsCallable).toHaveBeenCalledWith({ __fake: 'functions' }, 'getMcpConnectRequest');
    expect(call).toHaveBeenCalledWith({ requestId: 'req-1' });
  });

  it('records the decision through the decideMcpConnectRequest callable', async () => {
    const call = vi
      .fn()
      .mockResolvedValue({ data: { redirectUrl: 'https://claude.ai/cb?code=x' } });
    vi.mocked(httpsCallable).mockReturnValue(call as never);

    await expect(service.decide('req-1', true)).resolves.toEqual({
      redirectUrl: 'https://claude.ai/cb?code=x',
    });

    expect(httpsCallable).toHaveBeenCalledWith({ __fake: 'functions' }, 'decideMcpConnectRequest');
    expect(call).toHaveBeenCalledWith({ requestId: 'req-1', approve: true });
  });

  it('propagates callable errors', async () => {
    const call = vi.fn().mockRejectedValue(new Error('not-found'));
    vi.mocked(httpsCallable).mockReturnValue(call as never);

    await expect(service.decide('req-1', false)).rejects.toThrow(/not-found/);
  });
});
