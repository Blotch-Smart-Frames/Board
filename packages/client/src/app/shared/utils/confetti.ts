import { confetti } from '@tsparticles/confetti';

/**
 * Fires a short confetti burst from a viewport pixel coordinate (e.g. a drag
 * drop point). `@tsparticles/confetti` (~1MB) is imported statically so it's
 * already loaded with the board by the time a burst fires — the first
 * celebration is instant rather than stalling on a one-off dynamic import.
 * `disableForReducedMotion` defaults to `true` in the library itself, so this
 * already respects prefers-reduced-motion.
 */
export async function celebrateAt(point: { x: number; y: number }): Promise<void> {
  await confetti({
    position: {
      x: (point.x / window.innerWidth) * 100,
      y: (point.y / window.innerHeight) * 100,
    },
    count: 60,
    spread: 70,
    scalar: 0.9,
    ticks: 150,
  });
}
