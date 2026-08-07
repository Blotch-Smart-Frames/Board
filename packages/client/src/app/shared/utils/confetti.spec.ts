import { celebrateAt } from './confetti';

const confetti = vi.fn().mockResolvedValue(undefined);
vi.mock('@tsparticles/confetti', () => ({ confetti: (...args: unknown[]) => confetti(...args) }));

describe('celebrateAt', () => {
  it('converts the pixel drop point into a percentage-of-viewport position', async () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 500);

    await celebrateAt({ x: 250, y: 100 });

    expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ position: { x: 25, y: 20 } }));

    vi.unstubAllGlobals();
  });
});
