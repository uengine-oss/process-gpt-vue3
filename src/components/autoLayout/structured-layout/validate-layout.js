import { layoutLaneIds } from './subprocess-lane-spans.js';
import { DEFAULT_LAYOUT_OPTIONS } from '../layout-options.js';
import {measureLayoutStage} from './layout-profile.js';

const EPS = 1e-6;
const overlaps = (a,b) => Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+EPS &&
  Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+EPS;
const inside = (a,b) => b && a.x>=b.x-EPS && a.y>=b.y-EPS &&
  a.x+a.width<=b.x+b.width+EPS && a.y+a.height<=b.y+b.height+EPS;

function onOutline(point,box,type) {
  const x=Math.abs((point.x-box.x-box.width/2)/(box.width/2));
  const y=Math.abs((point.y-box.y-box.height/2)/(box.height/2));
  const distance=/Gateway$/.test(type)?x+y:/Event$/.test(type)?x*x+y*y:Math.max(x,y);
  return Math.abs(distance-1)<=EPS;
}

function cutsBody(a,b,box,type='') {
  const vertical=a.x===b.x, fixed=vertical?'x':'y',along=vertical?'y':'x';
  const radius=(vertical?box.width:box.height)/2, half=(vertical?box.height:box.width)/2;
  const offset=Math.abs(a[fixed]-box[fixed]-radius)/radius;
  if(offset>=1-EPS) return false;
  const reach=half*(/Gateway$/.test(type)?1-offset:/Event$/.test(type)?Math.sqrt(1-offset*offset):1);
  const center=box[along]+half;
  return Math.max(a[along],b[along])>center-reach+EPS && Math.min(a[along],b[along])<center+reach-EPS;
}

export function validateLayoutPlan(...args) {
  return measureLayoutStage('validation',()=>validatePlan(...args));
}
function validatePlan(input,plan,constraints) {
  if(input.unsupported?.length) return input.unsupported.map(element=>`unsupported-element:${element.id}:${element.type}`);
  const errors=[];
  const drawableNodes=[...input.nodes,...(input.artifacts||[])];
  if(plan.status!=='computed'||plan.routing?.status!=='routed') return ['incomplete-plan'];
  const boxes=new Map(),routes=new Map();
  for(const box of [...plan.placement.boxes,...plan.routing.labels]) {
    if(boxes.has(box.id)) errors.push(`duplicate-shape:${box.id}`);
    if(![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0) errors.push(`invalid-bounds:${box.id}`);
    boxes.set(box.id,box);
  }
  for(const route of plan.routing.routes) {
    if(routes.has(route.id)) errors.push(`duplicate-route:${route.id}`);
    if(route.points.length<2||route.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) errors.push(`invalid-points:${route.id}`);
    routes.set(route.id,route);
  }
  for(const shape of [...drawableNodes,...input.containers,...input.labels]) if(!boxes.has(shape.id)) errors.push(`missing-shape:${shape.id}`);
  for(const edge of input.edges) if(!routes.has(edge.id)) errors.push(`missing-route:${edge.id}`);
  const expectedShapes=new Set([...drawableNodes,...input.containers,...input.labels].map(e=>e.id));
  for(const id of boxes.keys()) if(!expectedShapes.has(id)) errors.push(`unexpected-shape:${id}`);
  for(const id of routes.keys()) if(!input.edges.some(e=>e.id===id)) errors.push(`unexpected-route:${id}`);
  if(errors.length) return errors;
  const participants=input.containers.filter(container=>container.type==='bpmn:Participant');
  for(let i=0;i<participants.length;i++) for(let j=0;j<i;j++) {
    const a=participants[i],b=participants[j];
    if(a.parentId===b.parentId&&overlaps(boxes.get(a.id),boxes.get(b.id))) errors.push(`participant-overlap:${a.id}:${b.id}`);
  }
  for(const lane of input.containers.filter(container=>container.type==='bpmn:Lane')) {
    if(boxes.has(lane.parentId)&&!inside(boxes.get(lane.id),boxes.get(lane.parentId))) errors.push(`lane-parent:${lane.id}`);
  }
  const nodes=new Map([...input.containers,...drawableNodes].map(n=>[n.id,n]));
  const scopeBounds=id=>id===null?plan.placement.rootBounds?.find(bounds=>bounds.scopeId===null):boxes.get(id);
  const ancestor=(parent,id)=>{
    const visited=new Set();
    for(let node=nodes.get(id);node?.scopeId;node=nodes.get(node.scopeId)) {
      if(visited.has(node.id)) return false;
      visited.add(node.id);
      if(node.scopeId===parent) return true;
    }
    return false;
  };
  for(const node of drawableNodes) {
    const box=boxes.get(node.id);
    if(!node.expanded&&(box.width!==node.width||box.height!==node.height)) errors.push(`node-size:${node.id}`);
    if(node.scopeId!==undefined&&!inside(box,scopeBounds(node.scopeId))) errors.push(`scope:${node.id}`);
    const laneIds=layoutLaneIds(node,constraints),lanes=laneIds.map(id=>boxes.get(id));
    if(lanes.length) {
      if(lanes.some(lane=>!lane)) errors.push(`missing-lane:${node.id}`);
      else {
        const x=Math.min(...lanes.map(lane=>lane.x)),y=Math.min(...lanes.map(lane=>lane.y));
        const bounds={x,y,width:Math.max(...lanes.map(lane=>lane.x+lane.width))-x,height:Math.max(...lanes.map(lane=>lane.y+lane.height))-y};
        if(!inside(box,bounds)) errors.push(`lane:${node.id}`);
        if(node.expanded&&lanes.length>1&&lanes.some(lane=>!overlaps(box,lane))) errors.push(`lane-span:${node.id}`);
      }
    }
    if(node.phaseId) {
      const phase=boxes.get(node.phaseId),axis=plan.placement.horizontal?'x':'y',size=plan.placement.horizontal?'width':'height';
      if(box[axis]<phase[axis]-EPS||box[axis]+box[size]>phase[axis]+phase[size]+EPS) errors.push(`phase:${node.id}`);
    }
  }
  for(let i=0;i<drawableNodes.length;i++) for(let j=0;j<i;j++) {
    const a=drawableNodes[i],b=drawableNodes[j];
    if(a.hostId===b.id||b.hostId===a.id||ancestor(a.id,b.id)||ancestor(b.id,a.id)) continue;
    if(overlaps(boxes.get(a.id),boxes.get(b.id))) errors.push(`node-overlap:${a.id}:${b.id}`);
  }
  for(const grid of constraints.phaseGrids) for(let i=1;i<grid.phaseIds.length;i++) {
    const a=boxes.get(grid.phaseIds[i-1]),b=boxes.get(grid.phaseIds[i]);
    const axis=plan.placement.horizontal?'x':'y',size=plan.placement.horizontal?'width':'height';
    if(Math.abs(a[axis]+a[size]-b[axis])>EPS) errors.push(`phase-boundary:${b.id}`);
  }
  for(let i=0;i<input.labels.length;i++) {
    const label=input.labels[i],box=boxes.get(label.id),edge=input.edges.find(e=>e.id===label.targetId);
    if(box.width!==label.width||box.height!==label.height) errors.push(`label-size:${label.id}`);
    for(const node of drawableNodes) {
      if(edge?(ancestor(node.id,edge.source)&&ancestor(node.id,edge.target)):ancestor(node.id,label.targetId)) continue;
      if(overlaps(box,boxes.get(node.id))) errors.push(`label-node:${label.id}:${node.id}`);
    }
    for(let j=0;j<i;j++) if(overlaps(box,boxes.get(input.labels[j].id))) errors.push(`label-overlap:${label.id}`);
  }
  const edgeDistance=plan.routing.edgeDistance ?? DEFAULT_LAYOUT_OPTIONS.edgeDistance;
  const phaseHeaders=input.containers.filter(container=>container.type==='phase:PhaseContainer').map(container=>{
    const box=boxes.get(container.id);
    return {id:box.id,x:box.x-edgeDistance,y:box.y-edgeDistance,width:box.width+2*edgeDistance,height:box.height+2*edgeDistance};
  });
  const segments=[];
  for(const edge of input.edges) {
    const route=routes.get(edge.id),message=edge.type==='bpmn:MessageFlow';
    for(const [id,p] of [[edge.source,route.points[0]],[edge.target,route.points.at(-1)]]) {
      if(!boxes.has(id)||!onOutline(p,boxes.get(id),nodes.get(id)?.type||'')) errors.push(`dock:${edge.id}:${id}`);
      const box=boxes.get(id);
      if(box&&nodes.get(id)?.type==='bpmn:TextAnnotation'&&Math.abs(p.x-box.x)>EPS) errors.push(`annotation-dock:${edge.id}:${id}`);
      if(box&&/Task|CallActivity|SubProcess/.test(nodes.get(id)?.type||'')) {
        const vertical=Math.abs(p.x-box.x)<EPS||Math.abs(p.x-box.x-box.width)<EPS;
        const extent=vertical?box.height:box.width,offset=vertical?p.y-box.y:p.x-box.x;
        if(Math.min(offset,extent-offset)<Math.min(18,extent*0.2)-EPS) errors.push(`corner-dock:${edge.id}:${id}`);
      }
    }
    for(let i=1;i<route.points.length;i++) {
      const a=route.points[i-1],b=route.points[i];
      if(a.x!==b.x&&a.y!==b.y) {errors.push(`diagonal:${edge.id}`);continue;}
      if(a.x===b.x&&a.y===b.y) errors.push(`zero-segment:${edge.id}`);
      const scope=nodes.get(edge.source)?.scopeId;
      if(!message&&scope!==undefined&&![a,b].every(p=>inside({...p,width:0,height:0},scopeBounds(scope)))) errors.push(`route-scope:${edge.id}`);
      for(const node of drawableNodes) {
        if(message?(ancestor(node.id,edge.source)||ancestor(node.id,edge.target)):(ancestor(node.id,edge.source)&&ancestor(node.id,edge.target))) continue;
        if(cutsBody(a,b,boxes.get(node.id),node.type)) errors.push(`route-node:${edge.id}:${node.id}`);
      }
      for(const label of input.labels) if(cutsBody(a,b,boxes.get(label.id))) errors.push(`route-label:${edge.id}:${label.id}`);
      for(const header of phaseHeaders) if(cutsBody(a,b,header)) errors.push(`phase-header:${edge.id}:${header.id}`);
      segments.push({id:edge.id,index:i,a,b});
    }
  }
  const samePoint=(a,b)=>Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
  const edges=new Map(input.edges.map(edge=>[edge.id,edge]));
  const endpoint=(id,point)=>samePoint(routes.get(id).points[0],point)?edges.get(id)?.source:
    samePoint(routes.get(id).points.at(-1),point)?edges.get(id)?.target:null;
  for(let i=0;i<segments.length;i++) for(let j=0;j<i;j++) {
    const a=segments[i],b=segments[j],av=a.a.x===a.b.x,bv=b.a.x===b.b.x;
    if(av===bv) {
      const fixed=av?'x':'y',along=av?'y':'x';
      const distance=Math.abs(a.a[fixed]-b.a[fixed]);
      if(Math.min(Math.max(a.a[along],a.b[along]),Math.max(b.a[along],b.b[along]))>
        Math.max(Math.min(a.a[along],a.b[along]),Math.min(b.a[along],b.b[along]))+EPS) {
        if(distance<EPS) errors.push(`shared-segment:${a.id}:${b.id}`);
        else if(a.id!==b.id&&distance<edgeDistance-EPS) errors.push(`edge-spacing:${a.id}:${b.id}`);
      }
    } else if(a.id===b.id&&Math.abs(a.index-b.index)>1) {
      const v=av?a:b,h=av?b:a;
      if(v.a.x>=Math.min(h.a.x,h.b.x)-EPS&&v.a.x<=Math.max(h.a.x,h.b.x)+EPS&&
        h.a.y>=Math.min(v.a.y,v.b.y)-EPS&&h.a.y<=Math.max(v.a.y,v.b.y)+EPS) errors.push(`self-intersection:${a.id}`);
    } else if(a.id!==b.id) {
      const v=av?a:b,h=av?b:a,point={x:v.a.x,y:h.a.y};
      if(point.x<Math.min(h.a.x,h.b.x)-EPS||point.x>Math.max(h.a.x,h.b.x)+EPS||
        point.y<Math.min(v.a.y,v.b.y)-EPS||point.y>Math.max(v.a.y,v.b.y)+EPS) continue;
      if(![a.a,a.b,b.a,b.b].some(end=>samePoint(end,point))) continue;
      const node=endpoint(a.id,point);
      if(!node||node!==endpoint(b.id,point)) errors.push(`edge-contact:${a.id}:${b.id}`);
    }
  }
  return errors;
}
