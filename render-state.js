// Only presentation positions are buffered. Simulation remains authoritative.
globalThis.CellworldRenderBuffer = class {
  constructor() {
    this.cells = [];
    this.monster = null;
    this.frames = [];
    this.revision = -1;
    this.generation = null;
    this.wasRunning = false;
    this.duration = 100;
    this.animating = false;
  }

  push(world, now) {
    if (world.revision <= this.revision) return false;
    const previous = this.frames.at(-1);
    const blend = this.generation === world.generation && this.wasRunning &&
      world.running && previous && now - previous.at < 2000;
    if (blend) {
      this.duration = Math.max(100, Math.min(500,
        this.duration * .8 + (now - previous.at) * .2));
    } else {
      this.frames = [];
      this.duration = 100;
    }
    this.cells = world.cells.map(c => ({ ...c }));
    this.monster = world.monster ? { ...world.monster } : null;
    this.frames.push({
      at: now,
      cells: new Map(world.cells.map(c => [c.id, { x: c.x, y: c.y }])),
      monster: world.monster ? { x: world.monster.x, y: world.monster.y } : null
    });
    // A hidden tab or a burst of updates cannot grow the buffer without bound.
    if (this.frames.length > 32) this.frames.shift();
    this.revision = world.revision;
    this.generation = world.generation;
    this.wasRunning = world.running;
    this.sample(now);
    return true;
  }

  sample(now) {
    const renderTime = now - this.duration * 2;
    while (this.frames.length > 2 && this.frames[1].at <= renderTime) {
      this.frames.shift();
    }
    const first = this.frames[0];
    const next = this.frames[1] || first;
    if (!first) return this.cells;
    const alpha = next.at > first.at
      ? Math.max(0, Math.min(1, (renderTime - first.at) / (next.at - first.at))) : 1;
    let changed = false;
    const blend = (entity, start, end) => {
      if (!entity || !start || !end) return;
      changed ||= start.x !== end.x || start.y !== end.y;
      entity.x = start.x + (end.x - start.x) * alpha;
      entity.y = start.y + (end.y - start.y) * alpha;
    };
    for (const cell of this.cells) {
      if (cell.alive) blend(cell, first.cells.get(cell.id), next.cells.get(cell.id));
    }
    blend(this.monster, first.monster, next.monster);
    this.animating = this.wasRunning && (this.frames.length > 2 ||
      (changed && renderTime < next.at));
    return this.cells;
  }

  get moving() { return this.animating; }
};
