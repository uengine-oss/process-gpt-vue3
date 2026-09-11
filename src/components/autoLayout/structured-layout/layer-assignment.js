import {measureLayoutStage} from './layout-profile.js';

const compareId = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// One containment scope at a time. Backward flows keep their semantic direction.
export function assignConstrainedLayers(...args) {
  return measureLayoutStage('hierarchy',()=>assignLayers(...args));
}
function assignLayers(input, { feedbackExchange } = {}) {
  const nodes = new Map();
  for (const node of input.nodes) {
    if (!node.id || nodes.has(node.id) ||
        (node.phaseOrder !== undefined && (!Number.isInteger(node.phaseOrder) || node.phaseOrder < 0))) {
      throw new Error(`Invalid node: ${node.id}`);
    }
    nodes.set(node.id, { ...node });
  }
  const phased = [...nodes.values()].some(node => node.phaseOrder !== undefined);
  if (phased && [...nodes.values()].some(node => node.phaseOrder === undefined)) {
    throw new Error('Every node in a phased scope needs a phase order');
  }
  const outgoing = new Map([...nodes.keys()].map(id => [id, []]));
  const edges = [...input.edges].sort((a, b) => compareId(a.id, b.id));
  const ids = new Set(), feedback = new Map();
  for (const edge of edges) {
    if (!edge.id || ids.has(edge.id) || !nodes.has(edge.source) || !nodes.has(edge.target)) {
      throw new Error(`Invalid edge: ${edge.id}`);
    }
    ids.add(edge.id);
    if (phased && nodes.get(edge.source).phaseOrder > nodes.get(edge.target).phaseOrder) {
      feedback.set(edge.id, 'phase-backward');
    } else outgoing.get(edge.source).push(edge);
  }

  // Iterative depth-first traversal avoids call-stack limits on long processes.
  const state = new Map();
  const incoming = new Map([...nodes.keys()].map(id => [id, 0]));
  for (const links of outgoing.values()) for (const edge of links) incoming.set(edge.target, incoming.get(edge.target) + 1);
  const order = [...nodes.keys()].sort((a, b) =>
    (nodes.get(a).phaseOrder ?? 0) - (nodes.get(b).phaseOrder ?? 0) ||
    Number(incoming.get(a) !== 0) - Number(incoming.get(b) !== 0) || compareId(a, b));
  for (const root of order) {
    if (state.has(root)) continue;
    state.set(root, 1);
    const stack = [{ id: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1], links = outgoing.get(frame.id);
      if (frame.next === links.length) {
        state.set(frame.id, 2);
        stack.pop();
        continue;
      }
      const edge = links[frame.next++];
      if (state.get(edge.target) === 1) feedback.set(edge.id, 'cycle');
      else if (!state.has(edge.target)) {
        state.set(edge.target, 1);
        stack.push({ id: edge.target, next: 0 });
      }
    }
  }

  if (feedbackExchange) {
    const {makeForward,makeFeedback}=feedbackExchange;
    const exchanged=edges.find(edge=>edge.id===makeFeedback);
    if(feedback.get(makeForward)!=='cycle'||feedback.has(makeFeedback)||!exchanged||
      exchanged.source===exchanged.target||nodes.get(exchanged.source).phaseOrder!==nodes.get(exchanged.target).phaseOrder)
      throw new Error('Invalid feedback exchange');
    feedback.delete(makeForward);
    feedback.set(makeFeedback,'cycle');
  }
  const degree = new Map(order.map(id => [id, 0]));
  const rank = new Map(order.map(id => [id, 0]));
  for (const edge of edges) if (!feedback.has(edge.id)) degree.set(edge.target, degree.get(edge.target) + 1);
  const ready = order.filter(id => degree.get(id) === 0);
  let visited = 0;
  for (let head = 0; head < ready.length; head++) {
    const id = ready[head];
    visited++;
    for (const edge of outgoing.get(id)) {
      if (feedback.has(edge.id)) continue;
      // Separate phases are offset after local longest paths have been computed.
      if (!phased || nodes.get(id).phaseOrder === nodes.get(edge.target).phaseOrder) {
        rank.set(edge.target, Math.max(rank.get(edge.target), rank.get(id) + 1));
      }
      degree.set(edge.target, degree.get(edge.target) - 1);
      if (degree.get(edge.target) === 0) ready.push(edge.target);
    }
  }
  if (visited !== nodes.size) throw new Error('Unresolved ranking cycle');
  const phaseRanks = [];
  if (phased) {
    const widths = new Map();
    for (const node of nodes.values()) widths.set(node.phaseOrder, Math.max(widths.get(node.phaseOrder) ?? 0, rank.get(node.id) + 1));
    let offset = 0;
    for (const phase of [...widths.keys()].sort((a, b) => a - b)) {
      phaseRanks.push({ phaseOrder: phase, start: offset, count: widths.get(phase) });
      for (const node of nodes.values()) if (node.phaseOrder === phase) rank.set(node.id, rank.get(node.id) + offset);
      offset += widths.get(phase);
    }
  }
  return {
    nodes: [...nodes.values()].sort((a, b) => compareId(a.id, b.id)).map(node => ({ ...node, rank: rank.get(node.id) })),
    edges: edges.map(edge => ({ ...edge })),
    feedback: edges.filter(edge => feedback.has(edge.id)).map(edge => ({ id: edge.id, reason: feedback.get(edge.id) })),
    phaseRanks
  };
}
