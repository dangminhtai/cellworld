// Presentation only: blend between received positions, never simulate or extrapolate.
// Kept as a classic script so the buildless GitHub Pages frontend also works.
globalThis.CellworldRenderBuffer = class {
  constructor() {
    this.cells = [];
    this.from = new Map();
    this.revision = -1;
    this.generation = null;
    this.receivedAt = 0;
    this.duration = 500;
    this.animating = false;
    this.wasRunning = false;
    this.wasRecovering = false;
  }

  push(world, now, recoveryMs = 0) {
    if (world.revision < this.revision) return false;
    // A reconnect/duplicate publication must not restart a completed blend.
    if (world.revision === this.revision) return false;
    const visible = this.sample(now);
    const blend = this.generation === world.generation && this.wasRunning &&
      world.running && !this.wasRecovering && recoveryMs < 100;
    if (blend) {
      const gap = now - this.receivedAt;
      // Follow the observed publication cadence, with a bound after outages.
      if (gap > 0) this.duration = Math.max(100, Math.min(1000, this.duration * .8 + gap * .2));
    }
    this.from = new Map(visible.map(c => [c.id, { x: c.x, y: c.y }]));
    this.cells = world.cells.map(c => ({ ...c, targetX: c.x, targetY: c.y }));
    this.revision = world.revision;
    this.generation = world.generation;
    this.wasRunning = world.running;
    this.wasRecovering = recoveryMs >= 100;
    this.receivedAt = now;
    this.animating = blend && this.cells.some(c => {
      const start = this.from.get(c.id);
      return c.alive && start && (start.x !== c.x || start.y !== c.y);
    });
    if (!blend) this.from.clear();
    this.sample(now);
    return true;
  }

  sample(now) {
    const alpha = this.animating ? Math.max(0, Math.min(1, (now - this.receivedAt) / this.duration)) : 1;
    for (const c of this.cells) {
      const start = this.from.get(c.id);
      // Death/counters/food remain those of the newest authoritative snapshot.
      c.x = start && c.alive ? start.x + (c.targetX - start.x) * alpha : c.targetX;
      c.y = start && c.alive ? start.y + (c.targetY - start.y) * alpha : c.targetY;
    }
    if (alpha === 1) this.animating = false;
    return this.cells;
  }

  get moving() { return this.animating; }
};
