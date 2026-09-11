import {measureLayoutStage} from './layout-profile.js';

const EPS = 1e-7;
const freeze = object => Object.freeze(object);

// Vertical decomposition: create only free intervals in each obstacle-boundary
// slab. Neighbours share a nonzero vertical portal; no Cartesian x/y grid.
export function partitionFreeSpace(...args) {
  return measureLayoutStage('space',()=>partitionSpace(...args));
}
function partitionSpace(bounds, obstacles, { version = 0 } = {}) {
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) throw new Error('Invalid routing bounds');
  const right = bounds.x + bounds.width, bottom = bounds.y + bounds.height;
  const rectangles = obstacles.map(rect => {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width < 0 || rect.height < 0) throw new Error(`Invalid obstacle: ${rect.id}`);
    return { id: rect.id, left: Math.max(bounds.x, rect.x), right: Math.min(right, rect.x + rect.width),
      top: Math.max(bounds.y, rect.y), bottom: Math.min(bottom, rect.y + rect.height) };
  }).filter(rect => rect.right - rect.left > EPS && rect.bottom - rect.top > EPS);
  const xs = [...new Set([bounds.x, right, ...rectangles.flatMap(rect => [rect.left, rect.right])])].sort((a, b) => a - b);
  const slabs = [], cells = [];
  for (let i = 1; i < xs.length; i++) {
    const left = xs[i-1], end = xs[i];
    if (end - left <= EPS) continue;
    const occupied = rectangles.filter(rect => rect.left < end && rect.right > left)
      .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
    const intervals = [];
    let cursor = bounds.y;
    for (const rect of occupied) {
      if (rect.top - cursor > EPS) intervals.push([cursor, rect.top]);
      cursor = Math.max(cursor, rect.bottom);
    }
    if (bottom - cursor > EPS) intervals.push([cursor, bottom]);
    const slab = { left, right: end, cells: [] };
    for (const [top, endY] of intervals) {
      const cell = { id: cells.length, left, right: end, top, bottom: endY, portals: [] };
      cells.push(cell); slab.cells.push(cell.id);
    }
    if (slabs.length) {
      const previous = slabs[slabs.length - 1];
      let a = 0, b = 0;
      while (a < previous.cells.length && b < slab.cells.length) {
        const first = cells[previous.cells[a]], second = cells[slab.cells[b]];
        const low = Math.max(first.top, second.top), high = Math.min(first.bottom, second.bottom);
        if (high - low > EPS) {
          first.portals.push(freeze({ to: second.id, x: left, low, high }));
          second.portals.push(freeze({ to: first.id, x: left, low, high }));
        }
        if (first.bottom <= second.bottom) a++;
        else b++;
      }
    }
    slabs.push(slab);
  }
  for (const cell of cells) { freeze(cell.portals); freeze(cell); }
  for (const slab of slabs) { freeze(slab.cells); freeze(slab); }
  const locate = point => {
    let low = 0, high = slabs.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (slabs[middle].right < point.x - EPS) low = middle + 1;
      else high = middle;
    }
    const ids = [];
    for (let i = low; i < slabs.length && slabs[i].left <= point.x + EPS; i++) {
      for (const id of slabs[i].cells) if (cells[id].top <= point.y + EPS && cells[id].bottom >= point.y - EPS) ids.push(id);
    }
    return ids;
  };
  return freeze({ version, bounds: freeze({ ...bounds }), cells: freeze(cells), slabs: freeze(slabs), locate });
}
