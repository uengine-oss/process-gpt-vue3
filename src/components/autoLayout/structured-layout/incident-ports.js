const compareId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;

export function hasCrowdedGatewayPorts(input,routing,distance) {
  const gateways=new Set(input.nodes.filter(node=>/Gateway/.test(node.type)).map(node=>node.id));
  const edges=new Map(input.edges.map(edge=>[edge.id,edge])),ends=new Map();
  for(const route of routing.routes) {
    const edge=edges.get(route.id);
    for(const [id,point] of [[edge.source,route.points[0]],[edge.target,route.points.at(-1)]]) {
      if(!gateways.has(id)) continue;
      if(!ends.has(id)) ends.set(id,[]);
      ends.get(id).push(point);
    }
  }
  for(const points of ends.values()) if(points.length>=3&&points.length<=4)
    for(let i=0;i<points.length;i++) for(let j=0;j<i;j++)
      if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<distance-1e-7) return true;
  return false;
}

// At most four incident edges: enumerate at most 4! side assignments before
// any path reserves space. The caller supplies obstacle-checked legal ports.
export function planIncidentPorts(input,placement,portsForEdge) {
  const nodes=new Map(input.nodes.map(node=>[node.id,node]));
  const boxes=new Map(placement.boxes.map(box=>[box.id,box]));
  const incident=new Map(),claims=new Map();
  for(const edge of [...input.edges].sort(compareId)) {
    for(const [id,peerId,target] of [[edge.source,edge.target,false],[edge.target,edge.source,true]]) {
      if(!incident.has(id)) incident.set(id,[]);
      incident.get(id).push({edge,peerId,target});
    }
  }
  const sides=placement.horizontal?[1,2,-1,-2]:[2,1,-2,-1];
  for(const node of [...input.nodes].sort(compareId)) {
    const entries=incident.get(node.id)||[];
    if(!/Gateway/.test(node.type)||entries.length<3||entries.length>4) continue;
    if(entries.some(({edge,peerId})=>edge.type!=='bpmn:SequenceFlow'||peerId===node.id||
      nodes.get(peerId)?.scopeId!==node.scopeId)) continue;
    const choices=entries.map(({edge,peerId,target})=>{
      const peer=nodes.get(peerId),box=boxes.get(peerId),bySide=new Map();
      for(const port of portsForEdge(node,peer,edge,target)) {
        const side=target?-port.direction:port.direction;
        const cost=port.cost+Math.abs(port.point.x-box.x-box.width/2)+Math.abs(port.point.y-box.y-box.height/2);
        if(!bySide.has(side)||cost<bySide.get(side)) bySide.set(side,cost);
      }
      return sides.filter(side=>bySide.has(side)).map(side=>({side,cost:bySide.get(side)}));
    });
    let best=null,bestCost=Infinity;
    const assign=(index,selected,cost)=>{
      if(index===entries.length) {
        if(cost<bestCost-1e-7) {bestCost=cost;best=[...selected];}
        return;
      }
      for(const choice of choices[index]) if(!selected.includes(choice.side))
        assign(index+1,[...selected,choice.side],cost+choice.cost);
    };
    assign(0,[],0);
    if(!best) continue;
    for(const side of sides) {
      const index=best.indexOf(side);
      claims.set(`${node.id}:${side}`,{edgeId:index<0?null:entries[index].edge.id});
    }
  }
  return claims;
}
