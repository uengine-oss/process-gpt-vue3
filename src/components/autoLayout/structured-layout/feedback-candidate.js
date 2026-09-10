import {assignConstrainedLayers} from './layer-assignment.js';

const compare=(a,b)=>a<b?-1:a>b?1:0;
const metrics=ranking=>{
  const rank=new Map(ranking.nodes.map(n=>[n.id,n.rank]));
  const feedback=new Set(ranking.feedback.map(e=>e.id));
  let columns=0,totalSpan=0,feedbackSpan=0,maxSpan=0;
  for(const n of ranking.nodes) columns=Math.max(columns,n.rank+1);
  for(const e of ranking.edges) {
    const span=Math.abs(rank.get(e.source)-rank.get(e.target));
    totalSpan+=span;maxSpan=Math.max(maxSpan,span);
    if(feedback.has(e.id)) feedbackSpan+=span;
  }
  return {columns,totalSpan,feedbackSpan,maxSpan};
};

// All-entry dominators identify prerequisites without guessing a business path.
function prerequisites(ranking,tick) {
  const incoming=new Map(ranking.nodes.map(n=>[n.id,[]])),outgoing=new Map(ranking.nodes.map(n=>[n.id,[]]));
  for(const e of ranking.edges) {tick();incoming.get(e.target).push(e.source);outgoing.get(e.source).push(e.target);}
  const entries=new Set(ranking.nodes.filter(n=>n.type==='bpmn:StartEvent'||!incoming.get(n.id).length).map(n=>n.id));
  const reached=new Set(entries),queue=[...entries];
  for(let i=0;i<queue.length;i++) for(const id of outgoing.get(queue[i])) {
    tick();if(!reached.has(id)) {reached.add(id);queue.push(id);}
  }
  if(reached.size!==ranking.nodes.length) return null;
  const dom=new Map();
  for(const id of reached) {
    tick(entries.has(id)?1:reached.size);
    dom.set(id,entries.has(id)?new Set([id]):new Set(reached));
  }
  let changed=true;
  while(changed) {
    changed=false;
    for(const id of reached) if(!entries.has(id)) {
      const parents=incoming.get(id),next=new Set();
      for(const predecessor of dom.get(parents[0])) {
        let present=true;
        for(const parent of parents) {tick();if(!dom.get(parent).has(predecessor)) {present=false;break;}}
        if(present) next.add(predecessor);
      }
      next.add(id);
      if(next.size!==dom.get(id).size) {dom.set(id,next);changed=true;}
    }
  }
  return dom;
}

export function selectFeedbackCandidate(placement,{deadline=Infinity,maxCandidates=256,maxWork=100000}={}) {
  if(!Number.isInteger(maxCandidates)||maxCandidates<0||!Number.isInteger(maxWork)||maxWork<0)
    throw new Error('Invalid feedback candidate budget');
  const stopped={},candidates=[];let considered=0,work=0,reason;
  const tick=(count=1)=>{
    if(performance.now()>=deadline) {reason='deadline';throw stopped;}
    work+=count;
    if(work>maxWork) {reason='work-budget';throw stopped;}
  };
  try {
    for(const scope of [...placement.scopes].sort((a,b)=>compare(a.scopeId??'',b.scopeId??''))) {
      tick();
      if(!scope.ranking.feedback.some(e=>e.reason==='cycle')) continue;
      tick(scope.ranking.nodes.length+scope.ranking.edges.length);
      const original=assignConstrainedLayers(scope.ranking),before=metrics(original);
      const dom=prerequisites(original,tick);
      if(!dom) continue;
      const ranks=new Map(original.nodes.map(n=>[n.id,n.rank]));
      const required=[];
      for(const [id,ancestors] of dom) for(const ancestor of ancestors) {
        tick();if(ancestor!==id&&ranks.get(ancestor)<ranks.get(id)) required.push([ancestor,id]);
      }
      const nodes=new Map(original.nodes.map(n=>[n.id,n]));
      const feedback=new Set(original.feedback.map(e=>e.id));
      for(const removed of original.feedback.filter(e=>e.reason==='cycle')) for(const added of original.edges) {
        tick();
        if(feedback.has(added.id)||added.source===added.target||nodes.get(added.source).phaseOrder!==nodes.get(added.target).phaseOrder) continue;
        if(considered>=maxCandidates) {reason='candidate-budget';throw stopped;}
        considered++;
        tick(3*(original.nodes.length+original.edges.length));
        const exchange={scopeId:scope.scopeId,makeForward:removed.id,makeFeedback:added.id};
        let proposed;
        try {proposed=assignConstrainedLayers(original,{feedbackExchange:exchange});}
        catch(error) {if(error.message==='Unresolved ranking cycle') continue;throw error;}
        const after=metrics(proposed),keys=Object.keys(before);
        if(!keys.every(k=>after[k]<=before[k])||!keys.some(k=>after[k]<before[k])) continue;
        const nextRanks=new Map(proposed.nodes.map(n=>[n.id,n.rank]));
        let preserves=true;
        for(const [a,b] of required) {tick();if(nextRanks.get(a)>=nextRanks.get(b)) {preserves=false;break;}}
        if(preserves) candidates.push({exchange,before,after});
      }
    }
  } catch(error) {
    if(error!==stopped) throw error;
    return {status:'limited',reason,considered,work};
  }
  candidates.sort((a,b)=>(b.before.columns-b.after.columns)-(a.before.columns-a.after.columns)||
    (b.before.totalSpan-b.after.totalSpan)-(a.before.totalSpan-a.after.totalSpan)||
    compare(a.exchange.scopeId??'',b.exchange.scopeId??'')||compare(a.exchange.makeForward,b.exchange.makeForward)||
    compare(a.exchange.makeFeedback,b.exchange.makeFeedback));
  return {status:'selected',considered,work,candidate:candidates[0]};
}
