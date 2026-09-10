// Record positions relative to the owning scope so moving a whole container
// does not count as a separate edit of every child.
export function captureUnlaidRotationBaseline(elements,horizontal,rootId) {
  const lanes=new Map();
  for(const lane of elements.filter(element=>element.type==='bpmn:Lane'))
    for(const ref of lane.businessObject?.flowNodeRef||[]) {
      const id=typeof ref==='string'?ref:ref.id;
      if(!lanes.has(id)) lanes.set(id,[]);
      lanes.get(id).push(lane.id);
    }
  // Capture observed geometry only. Do not require a valid layout plan before
  // the user can edit an imported diagram or resolve its semantic issues.
  const nodes=elements.filter(element=>element.parent&&!element.labelTarget&&
    /^bpmn:(?:\w*Task|\w*Event|\w*Gateway|SubProcess|CallActivity|TextAnnotation)$/.test(element.type)&&
    Number.isFinite(element.x)&&Number.isFinite(element.y)).flatMap(element=>{
    let root=element,scopeId=null;
    const seen=new Set();
    while(root.parent) {
      if(seen.has(root)) throw new Error('Cyclic rotation baseline scope');
      seen.add(root);root=root.parent;
      if(scopeId===null&&['bpmn:Participant','bpmn:SubProcess'].includes(root.type)) scopeId=root.id;
    }
    return root.id===rootId?[{id:element.id,scopeId,laneIds:lanes.get(element.id)||[],hostId:element.host?.id}]:[];
  });
  return captureRotationBaseline(elements,{nodes},horizontal);
}

export function captureRotationBaseline(elements, input, horizontal, offsets = []) {
  const byId = new Map(elements.map(element => [element.id, element]));
  const preferred = new Map(offsets.map(offset => [offset.id, offset]));
  return [...input.nodes,...(input.artifacts || [])].filter(node => !node.hostId).map(node => {
    const element = byId.get(node.id), owner = byId.get(node.scopeId);
    const x = element.x - (owner?.x || 0), y = element.y - (owner?.y || 0);
    return { id: node.id, element, parent: element.parent,
      lanes: JSON.stringify([...node.laneIds].sort()),
      along: horizontal ? x : y, across: horizontal ? y : x,
      offset: preferred.get(node.id) || { along: 0, across: 0 }, scopeId: node.scopeId };
  });
}

export function collectRotationOffsets(elements, baseline, horizontal) {
  const byId = new Map(elements.map(element => [element.id, element]));
  const lanes = new Map();
  for (const lane of elements.filter(element => element.type === 'bpmn:Lane')) {
    for (const node of lane.businessObject?.flowNodeRef || []) {
      const id = typeof node === 'string' ? node : node.id;
      if (!lanes.has(id)) lanes.set(id, []);
      lanes.get(id).push(lane.id);
    }
  }
  return baseline.flatMap(saved => {
    const element = byId.get(saved.id), owner = byId.get(saved.scopeId);
    if (element !== saved.element || element.parent !== saved.parent) return [];
    const membership = lanes.get(element.id);
    if (membership && JSON.stringify(membership.sort()) !== saved.lanes) return [];
    const x = element.x - (owner?.x || 0), y = element.y - (owner?.y || 0);
    const along = saved.offset.along + (horizontal ? x : y) - saved.along;
    const across = saved.offset.across + (horizontal ? y : x) - saved.across;
    return Math.abs(along) + Math.abs(across) > 0.001 ? [{ id: saved.id, along, across }] : [];
  });
}
