const typeOf = element => element.businessObject?.$type || element.type;
const flowNode = type => /^bpmn:(?:\w*Task|\w*Event|\w*Gateway|SubProcess|CallActivity)$/.test(type);
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// Geometry is deliberately excluded except dimensions. Membership resolution is
// an explicit input: the layout must not infer new ownership from its own output.
export function captureLayoutInput(elements, { phaseMembership = new Map(), rootId } = {}) {
  const inScope = element => {
    const seen = new Set();
    let root = element;
    while (root.parent) {
      if (seen.has(root)) throw new Error(`Cyclic containment: ${element.id}`);
      seen.add(root); root = root.parent;
    }
    return rootId ? root.id === rootId : typeOf(root) !== 'bpmn:SubProcess';
  };
  elements = elements.filter(inScope);
  const shapes = elements.filter(e => !e.labelTarget);
  const byId = new Map();
  for (const element of shapes) {
    if (!element.id || byId.has(element.id)) throw new Error(`Duplicate/missing element ID: ${element.id}`);
    byId.set(element.id, element);
  }
  const lanes = new Map();
  for (const lane of shapes.filter(e => typeOf(e) === 'bpmn:Lane')) {
    for (const ref of lane.businessObject?.flowNodeRef || []) {
      const id = typeof ref === 'string' ? ref : ref.id;
      if (!lanes.has(id)) lanes.set(id, new Set());
      lanes.get(id).add(lane.id);
    }
  }
  const ancestors = element => {
    const result = [], seen = new Set([element]);
    for (let parent = element.parent; parent; parent = parent.parent) {
      if (seen.has(parent)) throw new Error(`Cyclic containment: ${element.id}`);
      seen.add(parent); result.push(parent);
    }
    return result;
  };
  const dimensions = element => {
    if (![element.width, element.height].every(n => Number.isFinite(n) && n > 0)) throw new Error(`Invalid dimensions: ${element.id}`);
    return { width: element.width, height: element.height };
  };
  const nodes = shapes.filter(e => e.parent && flowNode(typeOf(e))).map(element => {
    const parents = ancestors(element);
    const participant = parents.find(p => typeOf(p) === 'bpmn:Participant');
    const scope = parents.find(p => ['bpmn:SubProcess', 'bpmn:Participant'].includes(typeOf(p)));
    const owner = [element, element.host, ...parents].filter(Boolean).find(e => lanes.has(e.id));
    const memberships = owner ? [...lanes.get(owner.id)].sort() : parents.filter(p => typeOf(p) === 'bpmn:Lane').map(p => p.id);
    const laneIds = memberships.filter(id => !memberships.some(other => other !== id &&
      byId.has(other) && ancestors(byId.get(other)).some(parent => parent.id === id)));
    if (laneIds.length > 1 && typeOf(element) !== 'bpmn:SubProcess') throw new Error(`Ambiguous lane membership: ${element.id}`);
    const phaseId = phaseMembership.get(element.id) ?? null;
    if (phaseId !== null && typeOf(byId.get(phaseId) || {}) !== 'phase:Phase') throw new Error(`Unknown phase: ${element.id}`);
    if (typeOf(element) === 'bpmn:BoundaryEvent' && !byId.has(element.host?.id)) throw new Error(`Missing boundary host: ${element.id}`);
    return { id: element.id, name: element.businessObject?.name || '', type: typeOf(element),
      ...dimensions(element), participantId: participant?.id || null, scopeId: scope?.id || null,
      laneIds, phaseId, hostId: element.host?.id || null,
      ...(typeOf(element) === 'bpmn:SubProcess' ? { expanded: element.di?.isExpanded ??
        shapes.some(child => child.parent === element && flowNode(typeOf(child))) } : {}) };
  }).sort(compareId);
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = shapes.filter(e => ['bpmn:SequenceFlow', 'bpmn:MessageFlow', 'bpmn:Association'].includes(typeOf(e))).map(edge => {
    const source = edge.source?.id, target = edge.target?.id;
    if (!byId.has(source) || !byId.has(target)) throw new Error(`Missing edge endpoint: ${edge.id}`);
    if (typeOf(edge) === 'bpmn:SequenceFlow' && (!nodeIds.has(source) || !nodeIds.has(target))) throw new Error(`Invalid sequence endpoints: ${edge.id}`);
    return { id: edge.id, type: typeOf(edge), name: edge.businessObject?.name || '', source, target };
  }).sort(compareId);
  const containers = shapes.filter(e => ['bpmn:Participant', 'bpmn:Lane', 'bpmn:SubProcess', 'phase:Phase', 'phase:PhaseContainer'].includes(typeOf(e)))
    .map(e => ({ id: e.id, type: typeOf(e), parentId: e.parent?.id || null, name: e.businessObject?.name || '' })).sort(compareId);
  const labels = elements.filter(e => e.labelTarget && e.businessObject?.name?.trim()).map(e => ({ id: e.id, targetId: e.labelTarget.id,
    text: e.businessObject?.name || '', ...dimensions(e) })).sort(compareId);
  const artifacts = shapes.filter(e => typeOf(e) === 'bpmn:TextAnnotation').flatMap(element => {
    const parents = ancestors(element);
    const scopeId = parents.find(p => ['bpmn:SubProcess', 'bpmn:Participant'].includes(typeOf(p)))?.id || null;
    const rootArtifact = typeOf(element.parent || {}) === 'bpmn:Collaboration';
    const association = edges.find(edge => edge.type === 'bpmn:Association' &&
      [edge.source, edge.target].includes(element.id) && nodes.some(node =>
        node.id === (edge.source === element.id ? edge.target : edge.source) && (rootArtifact || node.scopeId === scopeId)));
    if (!association) return [];
    const anchor = nodes.find(node => node.id === (association.source === element.id ? association.target : association.source));
    return [{ id: element.id, type: typeOf(element), text: element.businessObject?.text || '',
      ...dimensions(element), scopeId: anchor.scopeId, participantId: anchor.participantId, anchorId: anchor.id,
      laneIds: [...anchor.laneIds], phaseId: anchor.phaseId }];
  }).sort(compareId);
  const recognized = new Set([...nodes, ...edges, ...containers, ...artifacts].map(element => element.id));
  const unsupported = shapes.filter(element => !recognized.has(element.id) &&
    !['bpmn:Process', 'bpmn:Collaboration'].includes(typeOf(element)))
    .map(element => ({ id: element.id, type: typeOf(element) })).sort(compareId);
  return { nodes, edges, containers, labels, ...(artifacts.length ? { artifacts } : {}),
    ...(unsupported.length ? { unsupported } : {}) };
}
