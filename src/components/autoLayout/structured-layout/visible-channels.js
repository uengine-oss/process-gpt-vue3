const EPS = 1e-7;
const visibility = new WeakMap();

function indexFor(space) {
  let index = visibility.get(space);
  if (!index) visibility.set(space, index = {
    x:new Map(),y:new Map(),
    xs:[...new Set(space.cells.flatMap(cell=>[cell.left,cell.right]))].sort((a,b)=>a-b),
    ys:[...new Set(space.cells.flatMap(cell=>[cell.top,cell.bottom]))].sort((a,b)=>a-b)
  });
  return index;
}

function levelsWithEndpoints(levels, first, second) {
  const result = levels.slice();
  for (const value of [first,second]) {
    let low=0,high=result.length;
    while(low<high) {
      const middle=(low+high)>>1;
      if(result[middle]<value) low=middle+1;
      else high=middle;
    }
    if(result[low]!==value) result.splice(low,0,value);
  }
  return result;
}

function intervalsAt(space, vertical, coordinate) {
  const index = indexFor(space);
  const cache = vertical ? index.x : index.y;
  if (cache.has(coordinate)) return cache.get(coordinate);
  const intervals = space.cells.filter(cell => vertical ?
    coordinate >= cell.left - EPS && coordinate <= cell.right + EPS :
    coordinate >= cell.top - EPS && coordinate <= cell.bottom + EPS)
    .map(cell => vertical ? [cell.top,cell.bottom] : [cell.left,cell.right])
    .sort((a,b) => a[0]-b[0]);
  const merged = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]+EPS) last[1] = Math.max(last[1],interval[1]);
    else merged.push(interval);
  }
  cache.set(coordinate,merged);
  return merged;
}

// A complete segment must be covered by free cells, not just have free ends.
export function segmentInFreeSpace(space, a, b) {
  const vertical = Math.abs(a.x - b.x) < EPS;
  if (!vertical && Math.abs(a.y - b.y) >= EPS) return false;
  const start = vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
  const end = vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
  const intervals = intervalsAt(space, vertical, vertical ? a.x : a.y);
  let cursor = start;
  for (const [low, high] of intervals) {
    if (high < cursor - EPS) continue;
    if (low > cursor + EPS) return false;
    cursor = Math.max(cursor, high);
    if (cursor >= end - EPS) return true;
  }
  return false;
}

// Whole-channel visibility adds useful routes without multiplying every portal
// state by every obstacle coordinate. The search still scores every segment.
export function* visibleChannels(space, from, to, deadline = Infinity) {
  const index = indexFor(space);
  const xs = levelsWithEndpoints(index.xs,from.x,to.x);
  const ys = levelsWithEndpoints(index.ys,from.y,to.y);
  for (const axis of ['x', 'y']) for (const level of axis === 'x' ? xs : ys) {
    if (performance.now() >= deadline) return;
    const points = axis === 'x' ? [{ x: level, y: from.y }, { x: level, y: to.y }, to] :
      [{ x: from.x, y: level }, { x: to.x, y: level }, to];
    if (points.every((point, i) => segmentInFreeSpace(space, i ? points[i - 1] : from, point))) yield points;
  }
}
