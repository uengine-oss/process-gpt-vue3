const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;

// Constraints are x[target] >= x[source] + distance on a DAG. Earlier
// preferences have priority. A preference is clamped only when an already
// anchored coordinate or a hard constraint makes the requested value impossible.
export function solvePreferredCoordinates(ids,constraints,preferences=[]) {
  const outgoing=new Map(),incoming=new Map(),degree=new Map();
  for(const id of ids) {
    if(outgoing.has(id)) throw new Error(`Duplicate coordinate: ${id}`);
    outgoing.set(id,[]);incoming.set(id,[]);degree.set(id,0);
  }
  for(const [source,target,distance] of constraints) {
    if(!outgoing.has(source)||!outgoing.has(target)||!Number.isFinite(distance)||distance<0)
      throw new Error('Invalid coordinate constraint');
    outgoing.get(source).push({target,distance});
    incoming.get(target).push({source,distance});
    degree.set(target,degree.get(target)+1);
  }
  const order=ids.filter(id=>degree.get(id)===0).sort(compare);
  for(let i=0;i<order.length;i++) for(const edge of outgoing.get(order[i])) {
    degree.set(edge.target,degree.get(edge.target)-1);
    if(degree.get(edge.target)===0) order.push(edge.target);
  }
  if(order.length!==ids.length) throw new Error('Cyclic coordinate constraints');
  const anchors=new Map(),adjusted=[];
  const limits=()=>{
    const lower=new Map(ids.map(id=>[id,anchors.get(id)??0]));
    const upper=new Map(ids.map(id=>[id,anchors.get(id)??Infinity]));
    for(const id of order) for(const edge of outgoing.get(id))
      lower.set(edge.target,Math.max(lower.get(edge.target),lower.get(id)+edge.distance));
    for(let i=order.length-1;i>=0;i--) for(const edge of incoming.get(order[i]))
      upper.set(edge.source,Math.min(upper.get(edge.source),upper.get(order[i])-edge.distance));
    return {lower,upper};
  };
  const preferred=new Set();
  for(const {id,value} of preferences) {
    if(!outgoing.has(id)||!Number.isFinite(value)||preferred.has(id)) throw new Error(`Invalid preference: ${id}`);
    preferred.add(id);
    const {lower,upper}=limits();
    const position=Math.max(lower.get(id),Math.min(value,upper.get(id)));
    anchors.set(id,position);
    if(position!==value) adjusted.push({id,requested:value,actual:position});
  }
  return {positions:limits().lower,adjusted};
}
