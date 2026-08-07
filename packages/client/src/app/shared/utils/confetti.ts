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
