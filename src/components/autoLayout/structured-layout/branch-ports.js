const EPS=1e-7;

// Allocate unobstructed straight gateway continuations before individual paths
// reserve ports. Claims depend on final geometry, not edge visitation order.
export function planBranchPorts(input,placement,obstaclesForScope) {
  const boxes=new Map(placement.boxes.map(box=>[box.id,box]));
  const nodes=new Map(input.nodes.map(node=>[node.id,node]));
  const feedback=new Set((placement.scopes||[]).flatMap(scope=>scope.ranking.feedback.map(edge=>edge.id)));
  const along=placement.horizontal?'x':'y',across=placement.horizontal?'y':'x';
  const length=placement.horizontal?'width':'height',breadth=placement.horizontal?'height':'width';
  const side=placement.horizontal?1:2,claims=new Map();
  const outputs=new Map();
  for(const edge of input.edges) if(edge.type==='bpmn:SequenceFlow'&&!feedback.has(edge.id))
    outputs.set(edge.source,(outputs.get(edge.source)||0)+1);
  for(const edge of [...input.edges].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
    if(edge.type!=='bpmn:SequenceFlow'||feedback.has(edge.id)) continue;
    const source=nodes.get(edge.source),target=nodes.get(edge.target);
    if(!source||!target||source.scopeId!==target.scopeId) continue;
    if(!/Gateway/.test(source.type)||(outputs.get(source.id)||0)<2) continue;
    const a=boxes.get(source.id),b=boxes.get(target.id);
    const cross=a[across]+a[breadth]/2;
    if(Math.abs(cross-b[across]-b[breadth]/2)>EPS) continue;
    const start=a[along]+a[length],end=b[along];
    if(end<=start+EPS) continue;
    if(obstaclesForScope(source.scopeId).some(o=>o.id!==source.id&&o.id!==target.id&&
      cross>o[across]+EPS&&cross<o[across]+o[breadth]-EPS&&
      start<o[along]+o[length]-EPS&&end>o[along]+EPS)) continue;
    const key=`${source.id}:${side}`,distance=end-start,previous=claims.get(key);
    if(!previous||distance<previous.distance-EPS) claims.set(key,{edgeId:edge.id,distance});
  }
  return claims;
}
