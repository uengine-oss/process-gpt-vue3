const isType = (element, type) => (element?.businessObject?.$type || element?.type) === type;

function participantOf(element) {
  for (let parent = element.parent; parent; parent = parent.parent) {
    if (isType(parent, 'bpmn:SubProcess')) return null;
    if (isType(parent, 'bpmn:Participant')) return parent;
  }
  return null;
}

// Capture once per layout operation, before subprocess sizing or any model moves.
export function capturePhaseGrid(elements, horizontal) {
  const along = horizontal ? 'x' : 'y';
  const span = horizontal ? 'width' : 'height';
  const across = horizontal ? 'y' : 'x';
  const breadth = horizontal ? 'height' : 'width';
  const participants = elements.filter(e => isType(e, 'bpmn:Participant'));
  const used = new Set();
  const grids = [];
  for (const container of elements.filter(e => isType(e, 'phase:PhaseContainer'))) {
    const phases = elements.filter(e => isType(e, 'phase:Phase') && e.parent === container)
      .sort((a, b) => a[along] - b[along]);
    if (!phases.length) continue;
    const matches = participants.filter(p => !used.has(p.id) && p.parent === container.parent)
      .map(participant => ({ participant,
        distance: Math.abs(participant[across] - container[across] - container[breadth]),
        overlap: Math.min(participant[along] + participant[span], container[along] + container[span])
          - Math.max(participant[along], container[along]) }))
      .filter(m => m.overlap > 0 && m.distance <= 90)
      .sort((a, b) => a.distance - b.distance || b.overlap - a.overlap);
    const participant = matches[0]?.participant;
    if (!participant) continue;
    used.add(participant.id);
    const membership = new Map();
    const nodes = elements.filter(e => !e.labelTarget && !e.waypoints &&
      /^bpmn:(?:.*Task|.*Event|.*Gateway|SubProcess|CallActivity)$/.test(e.type) &&
      e.type !== 'bpmn:BoundaryEvent' && participantOf(e) === participant);
    for (const node of nodes) {
      const explicit = phases.findIndex(phase => (phase.businessObject?.flowNodeRef || [])
        .some(ref => (typeof ref === 'string' ? ref : ref.id) === node.id));
      const center = node[along] + node[span] / 2;
      const containing = phases.findIndex(phase => center >= phase[along] && center < phase[along] + phase[span]);
      const nearest = phases.map((phase, index) => ({ index,
        distance: Math.max(phase[along] - center, center - phase[along] - phase[span], 0) }))
        .sort((a, b) => a.distance - b.distance)[0].index;
      membership.set(node.id, explicit >= 0 ? explicit : containing >= 0 ? containing : nearest);
    }
    const lanes = elements.filter(e => isType(e, 'bpmn:Lane') && e.parent === participant)
      .sort((a, b) => a[across] - b[across]);
    grids.push({ participant, container, phases, membership, rows: lanes.length ? lanes : [participant] });
  }
  return grids;
}

// Coordinate assignment only: model elements are not touched until the caller applies the plan.
export function assignPhaseGrid(graph, grids, horizontal, options = {}) {
  const along = horizontal ? 'x' : 'y';
  const across = horizontal ? 'y' : 'x';
  const span = horizontal ? 'width' : 'height';
  const breadth = horizontal ? 'height' : 'width';
  const padding = Math.max(32, options.lanePadding || 0);
  const gap = Math.max(32, options.minimumLayerDistance || 50);
  const rowGap = Math.max(24, options.nodeDistance || 0);
  const lengths = new Map();
  const constrained = new Set();
  for (const grid of grids) {
    const rowIds = new Set(grid.rows.map(row => row.id));
    const members = graph.nodes.filter(node => grid.membership.has(node.__realSubProcessId || node.id));
    if (!members.length) continue;
    const groups = grid.rows.map(row => graph.getGroup(row.id)).filter(Boolean);
    const originAcross = Math.min(...groups.map(g => g.minX));
    const originAlong = Math.min(...groups.map(g => g.minY));
    if (!Number.isFinite(originAcross) || !Number.isFinite(originAlong)) continue;
    const cellNodes = new Map();
    const phaseRanks = grid.phases.map(() => new Map());
    for (const node of members) {
      const phase = grid.membership.get(node.__realSubProcessId || node.id);
      const row = rowIds.has(node.group) ? node.group : grid.rows[0].id;
      const rank = node.layer ?? 0;
      const key = `${row}:${phase}:${rank}`;
      if (!cellNodes.has(key)) cellNodes.set(key, []);
      cellNodes.get(key).push(node);
      phaseRanks[phase].set(rank, Math.max(phaseRanks[phase].get(rank) || 0, node[span]));
      constrained.add(node.__realSubProcessId || node.id);
    }
    const rankCenters = grid.phases.map(() => new Map());
    const phaseLengths = [];
    let columnStart = originAlong;
    phaseRanks.forEach((ranks, phase) => {
      const ordered = [...ranks].sort((a, b) => a[0] - b[0]);
      const header = phase === 0 ? 30 : 0;
      let cursor = columnStart + padding + header;
      ordered.forEach(([rank, size], index) => {
        rankCenters[phase].set(rank, cursor + size / 2);
        cursor += size + (index < ordered.length - 1 ? gap : 0);
      });
      const length = Math.max(140, cursor - columnStart + padding + (phase === grid.phases.length - 1 ? 30 : 0));
      phaseLengths.push(length);
      columnStart += length;
    });
    let rowStart = originAcross;
    for (const row of grid.rows) {
      let height = 128;
      for (let phase = 0; phase < grid.phases.length; phase++) {
        for (const rank of phaseRanks[phase].keys()) {
          const nodes = cellNodes.get(`${row.id}:${phase}:${rank}`) || [];
          height = Math.max(height, nodes.reduce((sum, node) => sum + node[breadth], 0)
            + Math.max(0, nodes.length - 1) * rowGap + padding * 2);
        }
      }
      for (let phase = 0; phase < grid.phases.length; phase++) {
        for (const rank of phaseRanks[phase].keys()) {
          const nodes = (cellNodes.get(`${row.id}:${phase}:${rank}`) || [])
            .sort((a, b) => a[across] - b[across] || a.id.localeCompare(b.id));
          const content = nodes.reduce((sum, node) => sum + node[breadth], 0)
            + Math.max(0, nodes.length - 1) * rowGap;
          let cursor = rowStart + (height - content) / 2;
          for (const node of nodes) {
            node[along] = rankCenters[phase].get(rank);
            node[across] = cursor + node[breadth] / 2;
            cursor += node[breadth] + rowGap;
          }
        }
      }
      if (!graph.getGroup(row.id)) graph.createGroup(row.id, []);
      Object.assign(graph.getGroup(row.id), { minX: rowStart, maxX: rowStart + height,
        minY: originAlong, maxY: columnStart });
      rowStart += height;
    }
    lengths.set(grid.container.id, phaseLengths);
  }
  return { lengths, constrained };
}
