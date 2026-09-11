import { captureSubprocessLaneSpans } from './subprocess-lane-spans.js';

const typeOf = element => element.businessObject?.$type || element.type;
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// Capture once before the first move; callers retain this semantic ordering for
// repeat layout/rotation instead of reading order back from generated geometry.
export function captureScopeConstraints(elements, { horizontal = true, phaseGrids = [] } = {}) {
  const across = horizontal ? 'y' : 'x';
  const containers = elements.filter(e => !e.labelTarget);
  const order = (a, b) => (a[across] ?? 0) - (b[across] ?? 0) || compareId(a, b);
  const scopeOf = element => {
    const seen = new Set();
    for (let p = element.parent; p; p = p.parent) {
      if (seen.has(p)) throw new Error(`Cyclic scope: ${element.id}`);
      seen.add(p);
      if (['bpmn:Participant', 'bpmn:SubProcess'].includes(typeOf(p))) return p.id;
    }
    return null;
  };
  const participants = containers.filter(e => typeOf(e) === 'bpmn:Participant').sort(order);
  const lanes = containers.filter(e => typeOf(e) === 'bpmn:Lane');
  const scopes = new Map();
  for (const lane of lanes) {
    // Only leaf lanes are cells; parent lane bounds are unions of their children.
    if (lanes.some(child => child.parent === lane)) continue;
    const scopeId = scopeOf(lane);
    if (!scopes.has(scopeId)) scopes.set(scopeId, []);
    scopes.get(scopeId).push(lane);
  }
  const rows = [...scopes].map(([scopeId, rows]) => ({ scopeId, rowIds: rows.sort(order).map(row => row.id) }));
  return {
    participantIds: participants.map(p => p.id),
    rows,
    subprocessSpans: captureSubprocessLaneSpans(containers, rows, horizontal),
    phaseGrids: phaseGrids.map(grid => ({ participantId: grid.participantId, containerId: grid.containerId,
      phaseIds: [...grid.phaseIds], membership: grid.membership.map(pair => [...pair]) }))
  };
}
