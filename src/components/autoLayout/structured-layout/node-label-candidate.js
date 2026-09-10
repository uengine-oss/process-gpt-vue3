import {DEFAULT_LAYOUT_OPTIONS} from '../layout-options.js';
import {layoutLaneIds} from './subprocess-lane-spans.js';
import {measureLayoutStage} from './layout-profile.js';

const EPS=1e-7;
const inside=(a,b)=>b&&a.x>=b.x-EPS&&a.y>=b.y-EPS&&a.x+a.width<=b.x+b.width+EPS&&a.y+a.height<=b.y+b.height+EPS;
const overlaps=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+EPS&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+EPS;
const cuts=(a,b,box)=>Math.abs(a.x-b.x)<EPS?
  a.x>box.x+EPS&&a.x<box.x+box.width-EPS&&Math.min(a.y,b.y)<box.y+box.height-EPS&&Math.max(a.y,b.y)>box.y+EPS:
  a.y>box.y+EPS&&a.y<box.y+box.height-EPS&&Math.min(a.x,b.x)<box.x+box.width-EPS&&Math.max(a.x,b.x)>box.x+EPS;

// Rank a bounded set using newly opened straight channels. This score is only
// a proposal: the caller must reroute and validate whole-plan quality.
export function selectNodeLabelCandidate(...args) {
  return measureLayoutStage('labels.select',()=>selectLabelCandidate(...args));
}
export function selectJointNodeLabelCandidate(input,plan,constraints,options={}) {
  return measureLayoutStage('labels.select',()=>selectLabelCandidate(input,plan,constraints,{...options,joint:true}));
}
function selectLabelCandidate(input,plan,constraints,{deadline=Infinity,maxCandidates=64,joint=false,...overrides}={}) {
  if(!Number.isInteger(maxCandidates)||maxCandidates<0) throw new Error('Invalid label candidate limit');
  const options={...DEFAULT_LAYOUT_OPTIONS,...overrides};
  const boxes=new Map(plan.placement.boxes.map(b=>[b.id,b])),nodes=new Map(input.nodes.map(n=>[n.id,n]));
  const routes=new Map(plan.routing.routes.map(r=>[r.id,r]));
  const along=plan.placement.horizontal?'x':'y',across=plan.placement.horizontal?'y':'x';
  const length=plan.placement.horizontal?'width':'height',breadth=plan.placement.horizontal?'height':'width';
  const inflate=box=>({...box,x:box.x-options.nodeToEdgeDistance,y:box.y-options.nodeToEdgeDistance,
    width:box.width+2*options.nodeToEdgeDistance,height:box.height+2*options.nodeToEdgeDistance});
  const labels=input.labels.filter(l=>nodes.has(l.targetId)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const edges=[...input.edges].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  let candidate=null,considered=0;
  const candidates=[];
  const result=()=>{
    if(!joint||!candidates.length) return {status:'selected',considered,candidate};
    let placement=plan.placement;
    const preferences=[],seen=new Set();
    for(const item of candidates.sort((a,b)=>b.score-a.score)) {
      if(seen.has(item.labelId)) continue;
      const preference={labelId:item.labelId,side:item.side,gap:item.gap};
      const next=nodeLabelCandidate(input,placement,constraints,{...options,...preference});
      if(!next) continue;
      placement=next;seen.add(item.labelId);preferences.push(preference);
    }
    return {status:'selected',considered,candidate:preferences.length?
      {...candidate,placement,preferences}:null};
  };
  const gaps=options.compactNodeLabels?[2*options.nodeToEdgeDistance+options.edgeDistance,options.edgeDistance]:[2*options.nodeToEdgeDistance+options.edgeDistance];
  const edgeById=new Map(edges.map(edge=>[edge.id,edge]));
  for(const label of labels) for(const side of [1,-1]) for(const gap of gaps) {
    if(performance.now()>=deadline) return {status:'limited',considered,candidate:null};
    if(considered>=maxCandidates) return result();
    considered++;
    const placement=nodeLabelCandidate(input,plan.placement,constraints,{...options,labelId:label.id,side,gap});
    if(!placement) continue;
    const moved=placement.boxes.find(b=>b.id===label.id);
    // Include other branches of the same gateway, not only unrelated edges.
    if(plan.routing.routes.some(route=>{
      const edge=edgeById.get(route.id);
      if(options.compactNodeLabels&&edge&&[edge.source,edge.target].includes(label.targetId)) return false;
      return route.points.slice(1).some((point,i)=>cuts(route.points[i],point,inflate(moved)));
    })) continue;
    let score=0;
    for(const edge of edges) {
      if(edge.type!=='bpmn:SequenceFlow'||![edge.source,edge.target].includes(label.targetId)) continue;
      const source=nodes.get(edge.source),target=nodes.get(edge.target),route=routes.get(edge.id);
      if(!source||!target||!route||source.scopeId!==target.scopeId) continue;
      const s=boxes.get(source.id),t=boxes.get(target.id);
      let center=s[across]+s[breadth]/2;
      if(Math.abs(center-t[across]-t[breadth]/2)>EPS) {
        if(!joint) continue;
        const low=Math.max(s[across],t[across])+options.edgeDistance;
        const high=Math.min(s[across]+s[breadth],t[across]+t[breadth])-options.edgeDistance;
        if(low>high) continue;
        center=Math.max(low,Math.min(high,center));
      }
      const forward=t[along]>=s[along]+s[length],backward=s[along]>=t[along]+t[length];
      if(!forward&&!backward) continue;
      const a={[along]:s[along]+(forward?s[length]:0),[across]:center};
      const b={[along]:t[along]+(backward?t[length]:0),[across]:center};
      if(!cuts(a,b,inflate(boxes.get(label.id)))||cuts(a,b,inflate(moved))) continue;
      const blockers=[...[...input.nodes,...(input.artifacts||[])].filter(n=>n.scopeId===source.scopeId&&n.id!==source.id&&n.id!==target.id).map(n=>boxes.get(n.id)),
        ...labels.filter(l=>l.id!==label.id&&nodes.get(l.targetId).scopeId===source.scopeId).map(l=>boxes.get(l.id))];
      if(blockers.some(box=>cuts(a,b,inflate(box)))) continue;
      const routedLength=route.points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-route.points[i].x)+Math.abs(p.y-route.points[i].y),0);
      score+=Math.max(0,routedLength-Math.abs(a[along]-b[along]))+24*Math.max(0,route.points.length-2);
    }
    if(score>0) {
      const item={labelId:label.id,side,gap,score,placement};
      candidates.push(item);
      if(!candidate||score>candidate.score) candidate=item;
    }
  }
  return result();
}

// Apply the same joint preference atomically before routing, including edits.
export function placeNodeLabelPreferences(input,placement,constraints,preferences,options={}) {
  let result=placement;
  for(const preference of Array.isArray(preferences)?preferences:[preferences]) {
    result=nodeLabelCandidate(input,result,constraints,{...options,...preference});
    if(!result) return null;
  }
  return result;
}

// Nominate a bent channel from obstacle boundaries, without another routing pass.
// The caller must still validate and compare the complete routed candidate.
export function selectNodeLabelChannelCandidate(...args) {
  return measureLayoutStage('labels.channel',()=>selectLabelChannel(...args));
}
function selectLabelChannel(input,plan,constraints,{deadline=Infinity,maxCandidates=64,...overrides}={}) {
  if(!Number.isInteger(maxCandidates)||maxCandidates<0) throw new Error('Invalid label candidate limit');
  const options={...DEFAULT_LAYOUT_OPTIONS,...overrides},distance=options.nodeToEdgeDistance;
  const boxes=new Map(plan.placement.boxes.map(b=>[b.id,b])),nodes=new Map(input.nodes.map(n=>[n.id,n]));
  const routes=new Map(plan.routing.routes.map(r=>[r.id,r]));
  const axis=plan.placement.horizontal?'y':'x',size=plan.placement.horizontal?'height':'width';
  const other=plan.placement.horizontal?'x':'y';
  const inflate=b=>({...b,x:b.x-distance,y:b.y-distance,width:b.width+2*distance,height:b.height+2*distance});
  const pathLength=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0);
  let considered=0,candidate=null;
  for(const label of [...input.labels].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
    if(performance.now()>=deadline) return {status:'limited',considered,candidate:null};
    if(considered>=maxCandidates) break;
    const node=nodes.get(label.targetId),old=boxes.get(label.id),body=boxes.get(label.targetId);
    if(!node||!old||!body) continue;
    const side=old[axis]>=body[axis]+body[size]?1:old[axis]+old[size]<=body[axis]?-1:0;
    if(!side) continue;
    const currentGap=side>0?old[axis]-body[axis]-body[size]:body[axis]-old[axis]-old[size];
    const gaps=new Map();
    for(const obstacle of input.nodes) {
      if(obstacle.id===node.id||obstacle.scopeId!==node.scopeId) continue;
      const box=boxes.get(obstacle.id);
      if(!box) continue;
      for(const channel of [box[axis]-distance,box[axis]+box[size]+distance]) {
        if(channel<=old[axis]-distance+EPS||channel>=old[axis]+old[size]+distance-EPS) continue;
        const gap=side>0?channel+distance-body[axis]-body[size]:body[axis]-channel+distance;
        if(gap>currentGap+EPS&&gap>=options.edgeDistance) gaps.set(gap,channel);
      }
    }
    for(const [gap,channel] of [...gaps].sort((a,b)=>a[0]-b[0])) {
      if(performance.now()>=deadline) return {status:'limited',considered,candidate:null};
      if(considered++>=maxCandidates) return {status:'selected',considered:maxCandidates,candidate};
      const placement=nodeLabelCandidate(input,plan.placement,constraints,{...options,labelId:label.id,side,gap});
      if(!placement) continue;
      const moved=inflate(placement.boxes.find(b=>b.id===label.id));
      if(plan.routing.routes.some(r=>r.points.slice(1).some((p,i)=>cuts(r.points[i],p,moved)))) break;
      let score=0;
      for(const edge of input.edges) {
        if(edge.type!=='bpmn:SequenceFlow'||![edge.source,edge.target].includes(node.id)) continue;
        const route=routes.get(edge.id),source=nodes.get(edge.source),target=nodes.get(edge.target);
        if(!route||route.points.length<=4||!source||!target||source.scopeId!==target.scopeId) continue;
        const p=route.points,a=p[0],b=p.at(-1);
        if(a[other]!==p[1][other]||b[other]!==p.at(-2)[other]||a[other]===b[other]) continue;
        if(Math.sign(channel-a[axis])!==Math.sign(p[1][axis]-a[axis])||
          Math.sign(b[axis]-channel)!==Math.sign(b[axis]-p.at(-2)[axis])) continue;
        const path=[a,{...a,[axis]:channel},{...b,[axis]:channel},b];
        if(!path.slice(1).some((point,i)=>cuts(path[i],point,inflate(old)))) continue;
        const blockers=placement.boxes.filter(box=>box.id!==source.id&&box.id!==target.id&&
          ((nodes.has(box.id)&&nodes.get(box.id).scopeId===source.scopeId)||box.kind==='label'||box.kind==='artifact'));
        if(blockers.some(box=>path.slice(1).some((point,i)=>cuts(path[i],point,inflate(box))))) continue;
        const saved=pathLength(p)-pathLength(path);
        if(saved>=-EPS) score+=Math.max(0,saved)+24*(p.length-4);
      }
      if(score>0&&(!candidate||score>candidate.score)) candidate={labelId:label.id,side,gap,score,placement};
      break;
    }
  }
  return {status:'selected',considered,candidate};
}

// A geometry-only label candidate, evaluated before space partitioning/routing.
// No node, container, semantic ownership or previously rendered route is moved.
export function nodeLabelCandidate(...args) {
  return measureLayoutStage('labels.node',()=>placeNodeLabel(...args));
}
function placeNodeLabel(input,placement,constraints,{labelId,side=1,gap,...overrides}) {
  if(side!==1&&side!==-1) throw new Error('Invalid label side');
  const options={...DEFAULT_LAYOUT_OPTIONS,...overrides};
  gap=gap??2*options.nodeToEdgeDistance+options.edgeDistance;
  if(!Number.isFinite(gap)||gap<options.edgeDistance) throw new Error('Invalid node label gap');
  const boxes=new Map(placement.boxes.map(b=>[b.id,b])),nodes=new Map(input.nodes.map(n=>[n.id,n]));
  const label=input.labels.find(l=>l.id===labelId),node=nodes.get(label?.targetId);
  if(!node||!boxes.has(labelId)) throw new Error('Expected a placed node label');
  const body=boxes.get(node.id),old=boxes.get(labelId);
  const candidate={...old,...(placement.horizontal?{
    x:body.x+(body.width-old.width)/2,y:side>0?body.y+body.height+gap:body.y-old.height-gap
  }:{x:side>0?body.x+body.width+gap:body.x-old.width-gap,y:body.y+(body.height-old.height)/2})};
  const scope=node.scopeId===null?placement.rootBounds?.find(b=>b.scopeId===null):boxes.get(node.scopeId);
  if(!inside(candidate,scope)) return null;
  const lanes=layoutLaneIds(node,constraints).map(id=>boxes.get(id));
  if(lanes.some(l=>!l)) return null;
  if(lanes.length) {
    const x=Math.min(...lanes.map(l=>l.x)),y=Math.min(...lanes.map(l=>l.y));
    if(!inside(candidate,{x,y,width:Math.max(...lanes.map(l=>l.x+l.width))-x,height:Math.max(...lanes.map(l=>l.y+l.height))-y})) return null;
  }
  if(node.phaseId) {
    const phase=boxes.get(node.phaseId),axis=placement.horizontal?'x':'y',size=placement.horizontal?'width':'height';
    if(!phase||candidate[axis]<phase[axis]-EPS||candidate[axis]+candidate[size]>phase[axis]+phase[size]+EPS) return null;
  }
  const ancestors=new Set();
  for(let id=node.scopeId;nodes.has(id);id=nodes.get(id).scopeId) {
    if(ancestors.has(id)) throw new Error('Cyclic label scope');
    ancestors.add(id);
  }
  const headers=new Set(input.containers.filter(c=>c.type==='phase:PhaseContainer').map(c=>c.id));
  for(const container of input.containers) if(container.type==='bpmn:SubProcess') {
    const box=boxes.get(container.id);
    if(box&&overlaps(candidate,{...box,height:24})) return null;
  }
  for(const container of input.containers) if(['bpmn:Participant','bpmn:Lane'].includes(container.type)) {
    const box=boxes.get(container.id);
    if(box&&overlaps(candidate,{...box,...(placement.horizontal?{width:options.participantLabelSpace}:{height:options.participantLabelSpace})})) return null;
  }
  const blocked=placement.boxes.some(box=>box.id!==labelId&&!ancestors.has(box.id)&&
    (nodes.has(box.id)||box.kind==='artifact'||box.kind==='label'||headers.has(box.id))&&overlaps(candidate,{
      x:box.x-options.edgeDistance,y:box.y-options.edgeDistance,
      width:box.width+2*options.edgeDistance,height:box.height+2*options.edgeDistance
    }));
  if(blocked) return null;
  return {...placement,boxes:placement.boxes.map(box=>box.id===labelId?candidate:box)};
}
