import {assignLayoutCoordinates} from './coordinate-assignment.js';
const compareId=(a,b)=>a<b?-1:a>b?1:0;

// A cheap ordering proxy, not a valid BPMN route or an acceptance criterion.
export function measureOrderingSketch(input,placement) {
  const nodes=new Map([...input.nodes,...input.containers,...(input.artifacts||[])].map(n=>[n.id,n]));
  const boxes=new Map(placement.boxes.map(b=>[b.id,b]));
  const center=id=>{const b=boxes.get(id);return {x:b.x+b.width/2,y:b.y+b.height/2};};
  const edges=[...input.edges].sort((a,b)=>compareId(a.id,b.id)).map(e=>({...e,a:center(e.source),b:center(e.target),scopeId:nodes.get(e.source).scopeId}));
  const side=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
  const opposite=(x,y)=>(x>1e-7&&y< -1e-7)||(x< -1e-7&&y>1e-7);
  let crossings=0,length=0;
  for(let i=0;i<edges.length;i++) {
    const a=edges[i];length+=Math.abs(a.a.x-a.b.x)+Math.abs(a.a.y-a.b.y);
    for(let j=0;j<i;j++) {
      const b=edges[j];
      if(a.type==='bpmn:SequenceFlow'&&b.type==='bpmn:SequenceFlow'&&a.scopeId!==b.scopeId) continue;
      if(opposite(side(a.a,a.b,b.a),side(a.a,a.b,b.b))&&opposite(side(b.a,b.b,a.a),side(b.a,b.b,a.b))) crossings++;
    }
  }
  return {crossings,length};
}
const improves=(a,b)=>a.crossings<b.crossings||(a.crossings===b.crossings&&a.length<b.length-1e-7);

export function selectOrderingCandidate(input,constraints,placement,{maxOrderingCandidates=32,deadline=Infinity,...options}={}) {
  if(!Number.isInteger(maxOrderingCandidates)||maxOrderingCandidates<0) throw new Error('Invalid ordering candidate limit');
  input={...input,...Object.fromEntries(['nodes','edges','labels','containers'].map(key=>[key,[...input[key]].sort((a,b)=>compareId(a.id,b.id))]))};
  const before=measureOrderingSketch(input,placement);
  let best=before,candidate=null,considered=0;
  const scopes=[...placement.scopes].sort((a,b)=>compareId(JSON.stringify(a.scopeId),JSON.stringify(b.scopeId)));
  for(const scope of scopes) {
    const nodes=new Map(scope.ranking.nodes.map(n=>[n.id,n]));
    for(const [rank,layer] of scope.ordering.layers.entries()) for(let i=1;i<layer.length;i++) {
      if(nodes.get(layer[i-1]).cell!==nodes.get(layer[i]).cell) continue;
      if(performance.now()>=deadline) return {status:'limited',considered,before};
      if(considered===maxOrderingCandidates) return {status:'selected',considered,before,candidate};
      const reordered=[...layer];[reordered[i-1],reordered[i]]=[reordered[i],reordered[i-1]];
      const positions=new Map(reordered.map((id,j)=>[id,j]));
      const fixed=[...(scope.ranking.precedence||[]),...(options.orderingPrecedence||[])
        .filter(rule=>rule.scopeId===scope.scopeId).map(rule=>[rule.before,rule.after])];
      if(fixed.some(([a,b])=>positions.has(a)&&positions.has(b)&&positions.get(a)>=positions.get(b))) continue;
      const orderingPrecedence=reordered.slice(1).map((after,j)=>({scopeId:scope.scopeId,before:reordered[j],after,
        ...(options.compactRanks?{rankStage:'compacted'}:{})}));
      const proposed=assignLayoutCoordinates(input,constraints,{...options,horizontal:placement.horizontal,
        orderingPrecedence:[...(options.orderingPrecedence||[]),...orderingPrecedence]});
      const score=measureOrderingSketch(input,proposed);considered++;
      if(improves(score,best)) {
        best=score;candidate={scopeId:scope.scopeId,rank,swap:[layer[i-1],layer[i]],orderingPrecedence,score,placement:proposed};
      }
    }
  }
  if(performance.now()>=deadline) return {status:'limited',considered,before};
  return {status:'selected',considered,before,candidate};
}
