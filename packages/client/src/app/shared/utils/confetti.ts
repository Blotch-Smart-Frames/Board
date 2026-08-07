/**
 * Fires a short confetti burst from a viewport pixel coordinate (e.g. a drag
 * drop point). `@tsparticles/confetti` pulls in ~1MB of shape/plugin
 * dependencies, so it's dynamically imported here rather than at the top of
 * the module — the cost is only paid the first time a burst actually fires,
 * not on initial page load. `disableForReducedMotion` defaults to `true` in
 * the library itself, so this already respects prefers-reduced-motion.
 */
export async function celebrateAt(point: { x: number; y: number }): Promise<void> {
  const { confetti } = await import('@tsparticles/confetti');
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

/**
 * Warms the `@tsparticles/confetti` module cache without firing a burst. Call
 * this ahead of a likely celebration (e.g. when a drag that could archive a
 * task starts) so the ~1MB dynamic import is already resolved by the time
 * `celebrateAt` runs — making the first burst instant instead of stalling on
 * the fetch. The module cache dedupes the import, so a later `celebrateAt`
 * reuses this same in-flight (or settled) promise rather than fetching twice.
 */
export function preloadConfetti(): void {
  void import('@tsparticles/confetti');
}
