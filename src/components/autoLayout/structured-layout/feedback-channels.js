// Closed rank intervals reserve endpoint turns as well as the return segment.
// Disjoint intervals may reuse capacity; this is not a prescribed final path.
export function allocateFeedbackChannels(edges, rankById) {
  const intervals=edges.map(edge=>{
    const source=rankById.get(edge.source),target=rankById.get(edge.target);
    if(!Number.isFinite(source)||!Number.isFinite(target)) throw new Error(`Missing feedback rank: ${edge.id}`);
    return {id:edge.id,start:Math.min(source,target),end:Math.max(source,target)};
  }).sort((a,b)=>a.start-b.start||a.end-b.end||(a.id<b.id?-1:a.id>b.id?1:0));
  const ends=[],assignments=[];
  for(const interval of intervals) {
    let channel=ends.findIndex(end=>end<interval.start);
    if(channel<0) channel=ends.length;
    ends[channel]=interval.end;
    assignments.push({...interval,channel});
  }
  return {count:ends.length,assignments};
}
