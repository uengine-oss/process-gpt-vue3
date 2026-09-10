// Compact a feasible ranking without changing phase widths or forward order.
// Two deterministic sweeps bound work; neutral moves retain the original rank.
export function compactLayerRanks(ranking, {fixedIds=[]}={}) {
  const fixed=new Set(fixedIds);
  const nodes=ranking.nodes.map(node=>({...node}));
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const feedback=new Set(ranking.feedback.map(edge=>edge.id));
  const adjacent=new Map(nodes.map(node=>[node.id,[]]));
  for(const edge of ranking.edges) {
    if(edge.source===edge.target) continue;
    adjacent.get(edge.source).push({other:edge.target,forward:!feedback.has(edge.id),out:true});
    adjacent.get(edge.target).push({other:edge.source,forward:!feedback.has(edge.id),out:false});
  }
  const last=Math.max(0,...nodes.map(node=>node.rank));
  const ordered=[...nodes].sort((a,b)=>a.rank-b.rank||(a.id<b.id?-1:a.id>b.id?1:0));
  for(const sweep of [[...ordered].reverse(),ordered]) for(const node of sweep) {
    if(fixed.has(node.id)) continue;
    const links=adjacent.get(node.id);
    if(!links.length) continue;
    const phase=ranking.phaseRanks.find(phase=>phase.phaseOrder===node.phaseOrder);
    let low=phase?.start??0,high=phase?phase.start+phase.count-1:last;
    for(const link of links) if(link.forward) {
      const rank=byId.get(link.other).rank;
      if(link.out) high=Math.min(high,rank-1);
      else low=Math.max(low,rank+1);
    }
    if(low>high) throw new Error(`Invalid rank bounds: ${node.id}`);
    const neighbors=links.map(link=>byId.get(link.other).rank).sort((a,b)=>a-b);
    const candidate=Math.max(low,Math.min(high,neighbors[Math.floor(neighbors.length/2)]));
    const cost=rank=>neighbors.reduce((sum,value)=>sum+Math.abs(rank-value),0);
    if(cost(candidate)<cost(node.rank)) node.rank=candidate;
  }
  return {...ranking,nodes};
}
