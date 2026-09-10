import { visibleChannels } from './visible-channels.js';
import {measureLayoutStage} from './layout-profile.js';

const EPS = 1e-7;
const same = (a, b) => Math.abs(a.x-b.x) < EPS && Math.abs(a.y-b.y) < EPS;
const distance = (a, b) => Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
const direction = (a, b) => Math.abs(a.x-b.x) > EPS ? (b.x > a.x ? 1 : -1) : (b.y > a.y ? 2 : -2);

export function isSimpleOrthogonalPath(points) {
  for (let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];
    if (Math.abs(a.x-b.x)>EPS && Math.abs(a.y-b.y)>EPS) return false;
    if (i>1 && direction(points[i-2],a)===-direction(a,b)) return false;
    for (let j=1;j<i-1;j++) {
      const c=points[j-1],d=points[j];
      const vertical=Math.abs(a.x-b.x)<EPS,otherVertical=Math.abs(c.x-d.x)<EPS;
      if (vertical===otherVertical) {
        const fixed=vertical?'x':'y',along=vertical?'y':'x';
        if (Math.abs(a[fixed]-c[fixed])<EPS && Math.min(Math.max(a[along],b[along]),Math.max(c[along],d[along]))>=
          Math.max(Math.min(a[along],b[along]),Math.min(c[along],d[along]))-EPS) return false;
      } else {
        const [v1,v2,h1,h2]=vertical?[a,b,c,d]:[c,d,a,b];
        if (v1.x>=Math.min(h1.x,h2.x)-EPS && v1.x<=Math.max(h1.x,h2.x)+EPS &&
          h1.y>=Math.min(v1.y,v2.y)-EPS && h1.y<=Math.max(v1.y,v2.y)+EPS) return false;
      }
    }
  }
  return true;
}

// Stable heap, without the legacy router's lossy queue-overflow truncation.
class SearchQueue {
  constructor() { this.heap = []; this.serial = 0; }
  less(a, b) { return a.priority < b.priority || (a.priority === b.priority && a.serial < b.serial); }
  push(value) {
    const item = { ...value, serial: this.serial++ };
    let i = this.heap.length;
    this.heap.push(item);
    while (i) {
      const parent = (i-1) >> 1;
      if (!this.less(item, this.heap[parent])) break;
      this.heap[i] = this.heap[parent]; i = parent;
    }
    this.heap[i] = item;
  }
  pop() {
    if (!this.heap.length) return null;
    const result = this.heap[0], last = this.heap.pop();
    if (this.heap.length) {
      let i = 0;
      while (2*i+1 < this.heap.length) {
        let child = 2*i+1;
        if (child+1 < this.heap.length && this.less(this.heap[child+1],this.heap[child])) child++;
        if (!this.less(this.heap[child],last)) break;
        this.heap[i] = this.heap[child]; i = child;
      }
      this.heap[i] = last;
    }
    return result;
  }
}

// This only removes redundant points on an already chosen path, not detours or
// obstacles. All geometry remains within the cells visited by the search.
export function compactPath(points) {
  const result = [];
  for (const point of points) {
    if (result.length && same(point,result.at(-1))) continue;
    while (result.length >= 2 && direction(result.at(-2),result.at(-1)) === direction(result.at(-1),point)) result.pop();
    result.push({ x: point.x, y: point.y });
  }
  return result;
}

export function searchFreeSpace(...args) {
  return measureLayoutStage('search',()=>searchSpace(...args));
}
function searchSpace(space, { sources, targets, bendCost = 24, maxStates = 50000,
  deadline = Infinity, segmentCost = () => 0, turnAllowed = () => true, heuristic = true, evaluatePath, guides = {}, visibilityChannels = false, channelQuality }) {
  if (!Number.isFinite(bendCost) || bendCost < 0 || !Number.isInteger(maxStates) || maxStates <= 0) throw new Error('Invalid search limits');
  const guideX=[...new Set(guides.x||[])].sort((a,b)=>a-b),guideY=[...new Set(guides.y||[])].sort((a,b)=>a-b);
  if(![...guideX,...guideY].every(Number.isFinite)) throw new Error('Invalid channel guide');
  const validPort = port => port.id && Number.isFinite(port.point?.x) && Number.isFinite(port.point?.y) &&
    [undefined,0,1,-1,2,-2].includes(port.direction) && Number.isFinite(port.cost ?? 0) && (port.cost ?? 0) >= 0;
  if (![...sources,...targets].every(validPort)) throw new Error('Invalid routing port');
  const goalByCell = new Map();
  for (const target of targets) for (const cell of space.locate(target.point)) {
    if (!goalByCell.has(cell)) goalByCell.set(cell,[]);
    goalByCell.get(cell).push(target);
  }
  const estimate = point => heuristic ? Math.min(...targets.map(target => distance(point,target.point) + (target.cost || 0))) : 0;
  const queue = new SearchQueue(), best = new Map();
  const enqueue = state => {
    let xs=best.get(state.cell),ys=xs?.get(state.point.x),directions=ys?.get(state.point.y);
    const slot=state.direction+2;
    let entry=directions?.[slot];
    if (state.cost >= (entry?.cost ?? Infinity)) return;
    if(!xs) best.set(state.cell,xs=new Map());
    if(!ys) xs.set(state.point.x,ys=new Map());
    if(!directions) ys.set(state.point.y,directions=[]);
    if(!entry) directions[slot]=entry={cost:state.cost};
    else entry.cost=state.cost;
    // Queued states keep the entry so stale checks need no coordinate lookup.
    queue.push({ ...state, bestEntry:entry, priority: state.cost + estimate(state.point) });
  };
  for (const source of sources) for (const cell of space.locate(source.point)) enqueue({
    cell, point: source.point, direction: source.direction || 0, cost: source.cost || 0,
    sourceId: source.id, parent: null, points: [source.point]
  });
  if (!queue.heap.length || !goalByCell.size) return { status: 'unreachable', reason: 'blocked-ports', expanded: 0, version: space.version };
  const step = (state, points, finalDirection = 0) => {
    let cost = state.cost, lastDirection = state.direction, previous = state.point;
    for (const point of points) {
      if (same(previous,point)) continue;
      if (Math.abs(previous.x-point.x)>EPS && Math.abs(previous.y-point.y)>EPS) throw new Error('Nonorthogonal search step');
      const nextDirection = direction(previous,point);
      if (lastDirection === -nextDirection) return null;
      if (lastDirection && lastDirection !== nextDirection && !turnAllowed(previous,lastDirection,nextDirection)) return null;
      const extra = segmentCost(previous,point);
      if (extra === Infinity) return null;
      if (!Number.isFinite(extra) || extra < 0) throw new Error('Invalid segment cost');
      cost += distance(previous,point) + extra + (lastDirection && lastDirection !== nextDirection ? bendCost : 0);
      lastDirection = nextDirection; previous = point;
    }
    if (finalDirection && lastDirection === -finalDirection) return null;
    if (finalDirection && lastDirection && lastDirection !== finalDirection && !turnAllowed(previous,lastDirection,finalDirection)) return null;
    if (finalDirection && lastDirection && lastDirection !== finalDirection) cost += bendCost;
    return { cost, direction: lastDirection };
  };
  const localPaths = (from,to,cell) => {
    if (same(from,to)) return [[]];
    const paths = Math.abs(from.x-to.x)<EPS || Math.abs(from.y-to.y)<EPS ? [[to]] :
      [[{x:to.x,y:from.y},to],[{x:from.x,y:to.y},to]];
    // Same-side portals can require a turn inside a free cell. Carrying entry
    // direction makes these meaningful transitions, not a waypoint repair pass.
    for (const x of new Set([cell.left,(cell.left+cell.right)/2,cell.right,...guideX.filter(x=>x>cell.left&&x<cell.right)])) paths.push([{x,y:from.y},{x,y:to.y},to]);
    for (const y of new Set([cell.top,(cell.top+cell.bottom)/2,cell.bottom,...guideY.filter(y=>y>cell.top&&y<cell.bottom)])) paths.push([{x:from.x,y},{x:to.x,y},to]);
    return paths;
  };
  let expanded = 0, winner = null;
  const pathTo = (state, points) => {
    const chunks = [points];
    for (let current = state; current; current = current.parent) chunks.push(current.points);
    return compactPath(chunks.reverse().flat());
  };
  let channelWinner = null;
  if (visibilityChannels) {
    let winner = null;
    for (const source of sources) for (const target of targets) {
    if (performance.now() >= deadline) return {status:'limited',reason:'deadline',expanded,version:space.version};
    const state = { point:source.point,direction:source.direction||0,cost:source.cost||0,
      sourceId:source.id,parent:null,points:[source.point] };
    const lowerBound = state.cost + distance(source.point,target.point) + (target.cost || 0);
    if (winner && lowerBound >= winner.cost) continue;
    for (const points of visibleChannels(space, source.point, target.point, deadline)) {
      if (winner && lowerBound >= winner.cost) break;
      const moved = step(state, points, target.direction || 0);
      if (!moved) continue;
      const cost = moved.cost + (target.cost || 0);
      if (winner && cost >= winner.cost) continue;
      const completePath = pathTo(state, points);
      if (!isSimpleOrthogonalPath(completePath)) continue;
      const evaluation = evaluatePath?.(completePath, source.id, target.id);
      if (evaluatePath && !evaluation) continue;
      winner = {cost,state,points,targetId:target.id,evaluation};
    }
    }
    channelWinner = winner;
  }
  while (queue.heap.length) {
    if (expanded >= maxStates || performance.now() >= deadline) return {status:'limited',reason:expanded>=maxStates?'state-budget':'deadline',expanded,version:space.version};
    const state = queue.pop();
    if (state.cost !== state.bestEntry.cost) continue;
    if (winner && state.priority >= winner.cost) break;
    expanded++;
    for (const target of goalByCell.get(state.cell) || []) for (const points of localPaths(state.point,target.point,space.cells[state.cell])) {
      const moved = step(state,points,target.direction || 0);
      if (!moved) continue;
      const cost = moved.cost + (target.cost || 0);
      if (!winner || cost < winner.cost) {
        const completePath = pathTo(state,points);
        if (!isSimpleOrthogonalPath(completePath)) continue;
        const evaluation = evaluatePath?.(completePath,state.sourceId,target.id);
        if (evaluatePath && !evaluation) continue;
        winner = {cost,state,points,targetId:target.id,evaluation};
      }
    }
    for (const portal of space.cells[state.cell].portals) {
      const clamp = y => Math.max(portal.low,Math.min(portal.high,y));
      const levels = [...new Set([clamp(state.point.y),...targets.map(target=>clamp(target.point.y)),portal.low,portal.high,
        ...guideY.filter(y=>y>portal.low&&y<portal.high)])];
      for (const y of levels) {
        const point = {x:portal.x,y};
        for (const points of localPaths(state.point,point,space.cells[state.cell])) {
          const moved = step(state,points);
          if (moved) enqueue({ ...moved,cell:portal.to,point,sourceId:state.sourceId,parent:state,points });
        }
      }
    }
  }
  // Keep the sparse reference search intact: a cheaper weighted path must not
  // buy extra crossings or bends. No rendered path is repaired or moved here.
  if (channelWinner && (!winner || channelWinner.cost < winner.cost)) {
    const quality = candidate => channelQuality(pathTo(candidate.state,candidate.points),candidate.state.sourceId,candidate.targetId);
    const before = winner && channelQuality ? quality(winner) : null;
    const after = before ? quality(channelWinner) : null;
    if (!before || after.every((value,i) => value <= before[i]+EPS)) winner = channelWinner;
  }
  if (!winner) return {status:'unreachable',reason:'disconnected-space',expanded,version:space.version};
  return {status:'routed',points:pathTo(winner.state,winner.points),sourceId:winner.state.sourceId,
    targetId:winner.targetId,cost:winner.cost,expanded,version:space.version,
    ...(evaluatePath ? {evaluation:winner.evaluation} : {})};
}
