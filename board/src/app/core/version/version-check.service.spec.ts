import { TestBed } from '@angular/core/testing';
import { VersionCheckService } from './version-check.service';
import { BUILD_HASH } from './build-hash';

async function settleFetch() {
  // toSignal(from(fetch())) needs several microtask turns before the resolved
  // value propagates through the RxJS pipeline and into the signal.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
  TestBed.flushEffects();
}

describe('VersionCheckService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hasNewVersion is false when the remote hash matches the build hash', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ buildHash: BUILD_HASH }),
    });

    const service = TestBed.inject(VersionCheckService);
    await settleFetch();

    expect(service.hasNewVersion()).toBe(false);
  });

  it('hasNewVersion becomes true once a different remote hash is fetched', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ buildHash: 'not-the-build-hash' }),
    });

    const service = TestBed.inject(VersionCheckService);
    await settleFetch();

    expect(service.hasNewVersion()).toBe(true);
  });

  it('stays false when the fetch fails outright', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    const service = TestBed.inject(VersionCheckService);
    await settleFetch();

    expect(service.hasNewVersion()).toBe(false);
  });
});
