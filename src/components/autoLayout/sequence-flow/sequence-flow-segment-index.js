const AXES = [['x', 'y'], ['y', 'x']];
const TOLERANCE = 0.5;

// Buckets narrow candidates only; the exact legacy overlap predicates remain below.
export class SequenceFlowSegmentIndex {
  constructor(flows) {
    this.buckets = [new Map(), new Map()];
    this.entries = new Map();
    for (const flow of flows) this.update(flow);
  }

  update(flow) {
    for (const entry of this.entries.get(flow) || []) {
      const buckets = this.buckets[entry.axis];
      const bucket = buckets.get(entry.key);
      bucket.delete(entry);
      if (!bucket.size) buckets.delete(entry.key);
    }
    const entries = [];
    this.entries.set(flow, entries);
    const points = flow.waypoints;
    if (!Array.isArray(points)) return;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      for (let axis = 0; axis < AXES.length; axis++) {
        const [fixed, along] = AXES[axis];
        if (Math.abs(a[fixed] - b[fixed]) > TOLERANCE) continue;
        const coordinate = a[fixed];
        const key = Math.floor(coordinate);
        const entry = { flow, axis, key, coordinate,
          min: Math.min(a[along], b[along]), max: Math.max(a[along], b[along]) };
        const buckets = this.buckets[axis];
        if (!buckets.has(key)) buckets.set(key, new Set());
        buckets.get(key).add(entry);
        entries.push(entry);
      }
    }
  }

  intersects(flow, points) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      for (let axis = 0; axis < AXES.length; axis++) {
        const [fixed, along] = AXES[axis];
        if (Math.abs(a[fixed] - b[fixed]) > TOLERANCE) continue;
        const coordinate = a[fixed];
        const min = Math.min(a[along], b[along]);
        const max = Math.max(a[along], b[along]);
        const lastKey = Math.floor(coordinate + TOLERANCE);
        for (let key = Math.floor(coordinate - TOLERANCE); key <= lastKey; key++) {
          const bucket = this.buckets[axis].get(key);
          if (!bucket) continue;
          for (const entry of bucket) {
            if (entry.flow === flow || Math.abs(coordinate - entry.coordinate) > TOLERANCE) continue;
            if (Math.min(max, entry.max) - Math.max(min, entry.min) > 1) return true;
          }
        }
      }
    }
    return false;
  }
}
