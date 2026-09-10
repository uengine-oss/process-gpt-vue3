const typeOf=element=>element.businessObject?.$type||element.type;
const flowNode=element=>/^bpmn:(?:\w*Task|\w*Event|\w*Gateway|SubProcess|CallActivity)$/.test(typeOf(element));

// A subprocess's visual lane span is distinct from its single flowNodeRef owner.
// Capture before generated geometry changes, exactly as with Phase membership.
export function captureSubprocessLaneSpans(elements,rows,horizontal) {
  const byId=new Map(elements.map(element=>[element.id,element]));
  const axis=horizontal?'y':'x',size=horizontal?'height':'width';
  const other=horizontal?'x':'y',otherSize=horizontal?'width':'height';
  const rowGroups=new Map(rows.map(row=>[row.scopeId,row.rowIds.map(id=>byId.get(id))]));
  const overlap=(a,b,key,extent)=>Math.min(a[key]+a[extent],b[key]+b[extent])-Math.max(a[key],b[key])>1e-6;
  const result=[];
  for(const subprocess of elements.filter(element=>typeOf(element)==='bpmn:SubProcess').sort((a,b)=>a.id.localeCompare(b.id))) {
    if(subprocess.di?.isExpanded===false) continue;
    let owner=subprocess.parent;
    const seen=new Set();
    while(owner&&!rowGroups.has(owner.id)) {
      if(seen.has(owner)) throw new Error(`Cyclic lane span ownership: ${subprocess.id}`);
      seen.add(owner);owner=owner.parent;
    }
    if(!owner) continue;
    const lanes=rowGroups.get(owner.id).filter(lane=>overlap(subprocess,lane,axis,size)&&overlap(subprocess,lane,other,otherSize));
    if(lanes.length<2) continue;
    const membership=elements.filter(element=>element.parent===subprocess&&!element.labelTarget&&flowNode(element)).map(element=>{
      const declared=rowGroups.get(owner.id).filter(lane=>(lane.businessObject?.flowNodeRef||[]).some(ref=>(typeof ref==='string'?ref:ref.id)===element.id));
      const outside=declared.filter(lane=>!lanes.includes(lane));
      if(outside.length) throw new Error(`Declared lane outside captured subprocess span: ${subprocess.id}:${element.id}:${outside.map(lane=>lane.id).join(',')}`);
      const center=element[axis]+element[size]/2;
      const lane=declared.length===1?declared[0]:lanes.find(lane=>center>=lane[axis]&&center<lane[axis]+lane[size])||
        [...lanes].sort((a,b)=>Math.abs(center-a[axis]-a[size]/2)-Math.abs(center-b[axis]-b[size]/2))[0];
      return [element.id,lane.id];
    }).sort((a,b)=>a[0].localeCompare(b[0]));
    result.push({id:subprocess.id,scopeId:owner.id,rowIds:lanes.map(lane=>lane.id),membership});
  }
  return result;
}

export function layoutLaneIds(node,constraints) {
  const ownSpan=constraints.subprocessSpans?.find(span=>span.id===(node.anchorId||node.id));
  if(ownSpan) return ownSpan.rowIds;
  const explicitRows=constraints.rows?.find(row=>row.scopeId===node.scopeId)?.rowIds;
  if(explicitRows?.length) return node.laneIds;
  const parentSpan=constraints.subprocessSpans?.find(span=>span.id===node.scopeId);
  const membership=parentSpan?.membership.find(([id])=>id===(node.anchorId||node.id));
  return membership?[membership[1]]:node.laneIds;
}
