import {measureLayoutStage} from './layout-profile.js';

const compareId = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Count weighted inversions per layer. Equal sources/targets are not crossings.
export function countLayerCrossings(layers, edges) {
  const positions = new Map();
  layers.forEach((layer, rank) => layer.forEach((id, order) => positions.set(id, { rank, order })));
  let total = 0;
  for (let rank = 0; rank < layers.length - 1; rank++) {
    const segments = edges.filter(e => positions.get(e.source)?.rank === rank && positions.get(e.target)?.rank === rank + 1)
      .map(e => ({ source: positions.get(e.source).order, target: positions.get(e.target).order, weight: e.weight ?? 1 }))
      .sort((a, b) => a.source - b.source || a.target - b.target);
    const tree = new Float64Array(layers[rank + 1].length + 1);
    let inserted = 0;
    const prefix = index => {
      let sum = 0;
      for (let i = index + 1; i > 0; i -= i & -i) sum += tree[i];
      return sum;
    };
    for (let start = 0; start < segments.length;) {
      let end = start;
      while (end < segments.length && segments[end].source === segments[start].source) end++;
      for (let i = start; i < end; i++) total += segments[i].weight * (inserted - prefix(segments[i].target));
      for (let i = start; i < end; i++) {
        const edge = segments[i];
        inserted += edge.weight;
        for (let j = edge.target + 1; j < tree.length; j += j & -j) tree[j] += edge.weight;
      }
      start = end;
    }
  }
  return total;
}

// Ranked input only. Feedback classification/layer assignment are separate stages.
export function orderConstrainedLayers(...args) {
  return measureLayoutStage('ordering',()=>orderLayers(...args));
}
function orderLayers(input, { maxSweeps = 12 } = {}) {
  if (!Number.isInteger(maxSweeps) || maxSweeps < 0) throw new Error('Invalid sweep limit');
  const nodes = new Map();
  for (const node of input.nodes) {
    if (nodes.has(node.id) || !Number.isInteger(node.rank) || node.rank < 0) throw new Error(`Invalid ranked node: ${node.id}`);
    nodes.set(node.id, { ...node, virtual: false });
  }
  const segments = [], feedback = [], edgeIds = new Set();
  let serial = 0;
  for (const edge of [...input.edges].sort((a, b) => compareId(a.id, b.id))) {
    const source = nodes.get(edge.source), target = nodes.get(edge.target);
    if (!edge.id || edgeIds.has(edge.id) || !source || !target || !Number.isFinite(edge.weight ?? 1) || (edge.weight ?? 1) < 0) throw new Error(`Invalid edge: ${edge.id}`);
    edgeIds.add(edge.id);
    if (target.rank <= source.rank) { feedback.push(edge.id); continue; }
    let previous = edge.source;
    for (let rank = source.rank + 1; rank < target.rank; rank++) {
      let id;
      do { id = `__layout_virtual_${serial++}`; } while (nodes.has(id));
      nodes.set(id, { id, rank, virtual: true, cell: '', cellOrder: Number.MAX_SAFE_INTEGER });
      segments.push({ edgeId: edge.id, source: previous, target: id, weight: edge.weight ?? 1 });
      previous = id;
    }
    segments.push({ edgeId: edge.id, source: previous, target: edge.target, weight: edge.weight ?? 1 });
  }
  const layers = Array.from({ length: Math.max(-1, ...[...nodes.values()].map(n => n.rank)) + 1 }, () => []);
  for (const node of nodes.values()) layers[node.rank].push(node.id);
  const precedence = input.precedence || [];
  const cellCompare = (a, b) => (a.cellOrder ?? 0) - (b.cellOrder ?? 0) || compareId(a.cell ?? '', b.cell ?? '');
  const cellOrders = new Map();
  for (const node of nodes.values()) if (!node.virtual) {
    if (cellOrders.has(node.cell) && cellOrders.get(node.cell) !== (node.cellOrder ?? 0)) throw new Error('Inconsistent cell order');
    cellOrders.set(node.cell, node.cellOrder ?? 0);
  }
  for (const [a, b] of precedence) {
    if (!nodes.has(a) || !nodes.has(b) || nodes.get(a).rank !== nodes.get(b).rank) throw new Error('Precedence must reference one layer');
    if (nodes.get(a).cell !== nodes.get(b).cell && cellCompare(nodes.get(a), nodes.get(b)) > 0) throw new Error('Precedence conflicts with cell order');
  }
  // Stable constrained topological ordering establishes a valid initial sequence.
  for (const layer of layers) {
    const remaining = new Set(layer), result = [];
    while (remaining.size) {
      const ready = [...remaining].filter(id => !precedence.some(([a, b]) => b === id && remaining.has(a)))
        .sort((a, b) => cellCompare(nodes.get(a), nodes.get(b)) || compareId(a, b));
      if (!ready.length) throw new Error('Cyclic ordering constraints');
      result.push(ready[0]);
      remaining.delete(ready[0]);
    }
    layer.splice(0, layer.length, ...result);
  }
  const initialLayers = layers.map(layer => [...layer]);
  const incoming = new Map(), outgoing = new Map();
  for (const edge of segments) {
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    incoming.get(edge.target).push({ id: edge.source, weight: edge.weight });
    outgoing.get(edge.source).push({ id: edge.target, weight: edge.weight });
  }
  const neighborOrder = (layer, reverse, median) => {
    const positions = new Map();
    layers.forEach(row => row.forEach((id, i) => positions.set(id, i)));
    const scores = new Map(layer.map(id => {
      const neighbors = (reverse ? outgoing : incoming).get(id) || [];
      const weighted = neighbors.filter(n => n.weight > 0).map(n => ({ value: positions.get(n.id), weight: n.weight }))
        .sort((a, b) => a.value - b.value);
      const total = weighted.reduce((sum, n) => sum + n.weight, 0);
      if (!total) return [id, positions.get(id)];
      if (!median) return [id, weighted.reduce((sum, n) => sum + n.value * n.weight, 0) / total];
      let sum = 0;
      return [id, weighted.find(n => { sum += n.weight; return sum >= total / 2; }).value];
    }));
    const remaining = new Set(layer), result = [];
    while (remaining.size) {
      const firstCell = [...remaining].map(id => nodes.get(id)).filter(n => !n.virtual).sort(cellCompare)[0];
      const ready = [...remaining].filter(id => {
        const node = nodes.get(id);
        return (node.virtual || !firstCell || cellCompare(node, firstCell) === 0) &&
          !precedence.some(([a, b]) => b === id && remaining.has(a));
      }).sort((a, b) => scores.get(a) - scores.get(b) || positions.get(a) - positions.get(b) || compareId(a, b));
      // A virtual-node precedence can temporarily block a cell. Retain the
      // valid current ordering instead of relaxing any ownership constraint.
      if (!ready.length) return [...layer];
      result.push(ready[0]); remaining.delete(ready[0]);
    }
    return result;
  };
  let cost = countLayerCrossings(layers, segments);
  const before = cost;
  let swaps = 0, sweeps = 0, reorderings = 0, stalledDirections = 0;
  for (; sweeps < maxSweeps; sweeps++) {
    let improved = false;
    const order = sweeps % 2 ? [...layers].reverse() : layers;
    for (const layer of order) for (const median of [true, false]) {
      const previous = [...layer], candidate = neighborOrder(layer, Boolean(sweeps % 2), median);
      layer.splice(0, layer.length, ...candidate);
      const candidateCost = countLayerCrossings(layers, segments);
      if (candidateCost < cost) { cost = candidateCost; reorderings++; improved = true; }
      else layer.splice(0, layer.length, ...previous);
    }
    for (const layer of order) for (let i = 0; i < layer.length - 1; i++) {
      const a = nodes.get(layer[i]), b = nodes.get(layer[i + 1]);
      if ((!a.virtual && !b.virtual && a.cell !== b.cell) || precedence.some(([x, y]) => x === a.id && y === b.id)) continue;
      [layer[i], layer[i + 1]] = [layer[i + 1], layer[i]];
      const candidate = countLayerCrossings(layers, segments);
      if (candidate < cost) { cost = candidate; swaps++; improved = true; }
      else [layer[i], layer[i + 1]] = [layer[i + 1], layer[i]];
    }
    stalledDirections = improved ? 0 : stalledDirections + 1;
    // A forward local minimum can still improve from outgoing neighbours.
    if (cost === 0 || stalledDirections === 2) { sweeps++; break; }
  }
  return {
    layers: layers.map(layer => layer.filter(id => !nodes.get(id).virtual)),
    expandedLayers: layers, segments, initialLayers, feedback,
    metrics: { before, after: cost, swaps, sweeps, reorderings }
  };
}
