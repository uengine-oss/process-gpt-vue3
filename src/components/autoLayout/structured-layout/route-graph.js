import { partitionFreeSpace } from './free-space.js';
import { searchFreeSpace, compactPath } from './space-search.js';
import { DEFAULT_LAYOUT_OPTIONS } from '../layout-options.js';
import { placeFlowLabels } from './flow-labels.js';
import { cacheSegmentCosts } from './segment-cost-cache.js';
import { cachePointQuery } from './point-query-cache.js';
import { planBranchPorts } from './branch-ports.js';
import { planIncidentPorts } from './incident-ports.js';

const EPS = 1e-7;
const samePoint=(a,b)=>Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
const onSegment=(p,a,b)=>p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&
  p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
const compareId = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const hitRectangle = (a,b,r) => Math.abs(a.x-b.x)<EPS ?
  a.x>r.x+EPS && a.x<r.x+r.width-EPS && Math.min(a.y,b.y)<r.y+r.height-EPS && Math.max(a.y,b.y)>r.y+EPS :
  a.y>r.y+EPS && a.y<r.y+r.height-EPS && Math.min(a.x,b.x)<r.x+r.width-EPS && Math.max(a.x,b.x)>r.x+EPS;

// Existing reservations contribute crossing cost, but shared line segments are
// forbidden. These reservations are empty at the start of every full layout.
export function reservationCost(a,b,segments,crossingCost,minimumDistance,allowedContacts=[]) {
  const vertical=Math.abs(a.x-b.x)<EPS;
  let cost=0;
  for(const [c,d] of segments) {
    const otherVertical=Math.abs(c.x-d.x)<EPS;
    if(vertical===otherVertical) {
      const fixed=vertical?'x':'y',along=vertical?'y':'x';
      if((Math.abs(a[fixed]-c[fixed])<EPS || Math.abs(a[fixed]-c[fixed])<minimumDistance-EPS) && Math.min(Math.max(a[along],b[along]),Math.max(c[along],d[along]))-
        Math.max(Math.min(a[along],b[along]),Math.min(c[along],d[along]))>EPS) return Infinity;
    } else {
      const v=vertical?[a,b]:[c,d],h=vertical?[c,d]:[a,b];
      if(v[0].x>=Math.min(h[0].x,h[1].x)-EPS&&v[0].x<=Math.max(h[0].x,h[1].x)+EPS&&
        h[0].y>=Math.min(v[0].y,v[1].y)-EPS&&h[0].y<=Math.max(v[0].y,v[1].y)+EPS) {
        const point={x:v[0].x,y:h[0].y};
        if([c,d].some(end=>samePoint(end,point))&&!allowedContacts.some(end=>samePoint(end,point))) return Infinity;
        // A straight path can cross a portal exactly on a reserved segment.
        // Half at each endpoint makes the two adjacent steps charge it once.
        cost+=crossingCost*(samePoint(a,point)||samePoint(b,point)?0.5:1);
      }
    }
  }
  return cost;
}

// Preserve feedback and message semantics in both reservation-order candidates.
export function orderBpmnFlows(input,placement,{includeMessageFlows=true,includeAssociations=true,rankedRouteOrder=false}={}) {
  const feedback=new Set((placement.scopes||[]).flatMap(scope=>scope.ranking.feedback.map(edge=>edge.id)));
  const spans=new Map();
  if(rankedRouteOrder) for(const scope of placement.scopes||[]) for(const segment of scope.ordering.segments)
    spans.set(segment.edgeId,(spans.get(segment.edgeId)||0)+1);
  const priority=edge=>edge.type==='bpmn:SequenceFlow'?0:edge.type==='bpmn:MessageFlow'?1:2;
  return input.edges.filter(edge=>edge.type==='bpmn:SequenceFlow'||(includeMessageFlows&&edge.type==='bpmn:MessageFlow')||
      (includeAssociations&&edge.type==='bpmn:Association'))
    .slice().sort((a,b)=>priority(a)-priority(b)||
      Number(feedback.has(a.id))-Number(feedback.has(b.id))||(spans.get(b.id)||0)-(spans.get(a.id)||0)||compareId(a,b));
}

export function routeBpmnFlows(input,placement,{version=0,deadline=Infinity,includeMessageFlows=true,includeAssociations=true,...overrides}={}) {
  const options={...DEFAULT_LAYOUT_OPTIONS,...overrides};
  const crossingCost=options.crossingCost??96;
  if(!Number.isFinite(crossingCost)||crossingCost<0) throw new Error('Invalid crossing cost');
  const boxes=new Map(placement.boxes.map(box=>[box.id,box]));
  const feedbackGuides=options.feedbackChannelGuides?new Map((placement.scopes||[]).flatMap(scope=>
    scope.feedbackChannels.assignments.map(assignment=>[assignment.id,{...assignment,count:scope.feedbackChannels.count}]))):null;
  const drawableNodes=[...input.nodes,...(input.artifacts||[])];
  const nodes=new Map(drawableNodes.map(node=>[node.id,node]));
  const edgeById=new Map(input.edges.map(edge=>[edge.id,edge]));
  const degrees=new Map();
  for(const edge of input.edges) if(edge.type==='bpmn:SequenceFlow'||(includeMessageFlows&&edge.type==='bpmn:MessageFlow')||
    (includeAssociations&&edge.type==='bpmn:Association'))
    for(const id of [edge.source,edge.target]) degrees.set(id,(degrees.get(id)||0)+1);
  const scopes=new Map(),messageScopes=new Map(),routes=[],failures=[],labels=[];
  if(includeMessageFlows) for(const edge of input.edges) {
    if(!['bpmn:SequenceFlow','bpmn:MessageFlow','bpmn:Association'].includes(edge.type)) failures.push({id:edge.id,reason:'unsupported-flow-type',type:edge.type});
  }
  const containers=new Map(input.containers.map(container=>[container.id,container]));
  const endpoints=new Map([...nodes,...input.containers.filter(container=>container.type==='bpmn:Participant').map(container=>[container.id,container])]);
  const clearance=options.nodeToEdgeDistance;
  const inflate=box=>({id:box.id,x:box.x-clearance,y:box.y-clearance,width:box.width+2*clearance,height:box.height+2*clearance});
  const getScope=id=>{
    if(scopes.has(id)) return scopes.get(id);
    const members=drawableNodes.filter(node=>node.scopeId===id);
    const memberIds=new Set(members.map(node=>node.id));
    const obstacles=members.map(node=>inflate(boxes.get(node.id)));
    for(const container of input.containers) if(container.type==='phase:PhaseContainer') {
      const box=boxes.get(container.id),gap=options.edgeDistance;
      obstacles.push({id:box.id,x:box.x-gap,y:box.y-gap,width:box.width+2*gap,height:box.height+2*gap});
    }
    for(const label of input.labels) if(memberIds.has(label.targetId)) obstacles.push(inflate(boxes.get(label.id)));
    const owner=boxes.get(id)||(id===null?placement.rootBounds?.find(bounds=>bounds.scopeId===null):null);
    if(!owner) throw new Error(`Missing routing scope: ${id}`);
    const type=input.containers.find(container=>container.id===id)?.type;
    const hasLanes=input.containers.some(container=>container.type==='bpmn:Lane'&&container.parentId===id);
    let bounds={x:owner.x,y:owner.y,width:owner.width,height:owner.height};
    if(type==='bpmn:Participant') {
      const header=options.participantLabelSpace*(hasLanes?2:1);
      if(placement.horizontal) {bounds.x+=header;bounds.width-=header;}
      else {bounds.y+=header;bounds.height-=header;}
    } else if(type==='bpmn:SubProcess') {bounds.y+=24;bounds.height-=24;}
    const scope={space:partitionFreeSpace(bounds,obstacles,{version}),obstacles,segments:[]};
    scopes.set(id,scope);return scope;
  };
  const participantOf=node=>{
    if(node.type==='bpmn:Participant') return node.id;
    if(node.participantId) return node.participantId;
    const seen=new Set();
    for(let id=node.scopeId;id;id=containers.get(id)?.parentId) {
      if(seen.has(id)) throw new Error('Cyclic participant ownership');seen.add(id);
      if(containers.get(id)?.type==='bpmn:Participant') return id;
    }
    return null;
  };
  const ancestor=(id,node)=>{
    const seen=new Set();
    for(let scope=node.scopeId;scope;scope=nodes.get(scope)?.scopeId) {
      if(seen.has(scope)) throw new Error('Cyclic routing scope');seen.add(scope);
      if(scope===id) return true;
    }
    return false;
  };
  const getMessageScope=(source,target)=>{
    const sourceParticipant=participantOf(source),targetParticipant=participantOf(target);
    if(!sourceParticipant||!targetParticipant||sourceParticipant===targetParticipant) return null;
    const openContainers=input.nodes.filter(node=>ancestor(node.id,source)||ancestor(node.id,target)).map(node=>node.id).sort();
    const participantEndpoints=[source,target].filter(node=>node.type==='bpmn:Participant').map(node=>node.id).sort();
    const key=JSON.stringify([[sourceParticipant,targetParticipant].sort(),openContainers,participantEndpoints]);
    let scope=messageScopes.get(key);
    if(!scope||scope.labelRevision!==labels.length) {
      const obstacles=drawableNodes.filter(node=>!ancestor(node.id,source)&&!ancestor(node.id,target)).map(node=>inflate(boxes.get(node.id)));
      for(const label of [...placement.boxes.filter(box=>box.kind==='label'),...labels]) obstacles.push(inflate(label));
      for(const container of input.containers) {
        const box=boxes.get(container.id);
        if(!box) continue;
        if(container.type==='phase:PhaseContainer') obstacles.push(inflate(box));
        if(container.type!=='bpmn:Participant') continue;
        if(![sourceParticipant,targetParticipant].includes(container.id)||source.id===container.id||target.id===container.id) obstacles.push(inflate(box));
        else {
          const header=options.participantLabelSpace*(input.containers.some(c=>c.type==='bpmn:Lane'&&c.parentId===container.id)?2:1);
          obstacles.push({id:`header:${container.id}`,x:box.x,y:box.y,width:placement.horizontal?header:box.width,height:placement.horizontal?box.height:header});
        }
      }
      const all=[...placement.boxes,...labels];
      const x=Math.min(...all.map(box=>box.x))-options.margin,y=Math.min(...all.map(box=>box.y))-options.margin;
      const bounds={x,y,width:Math.max(...all.map(box=>box.x+box.width))-x+options.margin,height:Math.max(...all.map(box=>box.y+box.height))-y+options.margin};
      scope={obstacles,space:partitionFreeSpace(bounds,obstacles,{version}),labelRevision:labels.length,segments:[]};
      messageScopes.set(key,scope);
    }
    scope.segments=routes.flatMap(route=>route.points.slice(1).map((point,i)=>[route.points[i],point]));
    return scope;
  };
  const portOffset=(node,box)=>/Gateway/.test(node.type)?Math.min(0.15,Math.min(box.width,box.height)/(4*Math.max(box.width,box.height))):0.25;
  const baseFractions=(node,box,side)=>{
    const offset=portOffset(node,box),degree=degrees.get(node.id)||0;
    if(degree<=3||/Event|Gateway/.test(node.type)) return [0.5,0.5-offset,0.5+offset];
    const extent=Math.abs(side)===1?box.height:box.width;
    const margin=Math.max(Math.min(extent/4,options.nodeToEdgeDistance),Math.min(18,extent*0.2));
    const spacing=options.edgeDistance||options.nodeToEdgeDistance||DEFAULT_LAYOUT_OPTIONS.edgeDistance;
    const count=Math.min(degree,Math.floor((extent-2*margin)/spacing)+1);
    if(count<2) return [0.5];
    // A stable evenly spaced set uses side capacity without allowing an early
    // center port to block both neighbours of an even-sized allocation.
    return Array.from({length:count},(_,i)=>(margin+(extent-2*margin)*i/(count-1))/extent)
      .sort((a,b)=>Math.abs(a-0.5)-Math.abs(b-0.5)||a-b);
  };
  const ports=(node,scope,target,peer,allowedContacts,edgeId)=>{
    const box=boxes.get(node.id),result=[];
    // Keep diamond ports away from the equal-distance corner between two
    // cardinal sides. Additional ports remain available for degree > 4.
    const peerBox=boxes.get(peer.id);
    const sideFractions=side=>{
      const fractions=baseFractions(node,box,side);
      const axis=Math.abs(side)===1?'y':'x',size=Math.abs(side)===1?'height':'width';
      const expanded=node.type==='bpmn:SubProcess'&&node.expanded;
      const margin=Math.min(18,box[size]*0.2);
      const low=expanded?Math.max(margin,axis==='y'?24:0)/box[size]:Math.min(...fractions);
      const high=expanded?1-margin/box[size]:Math.max(...fractions);
      // Project the opposite endpoint's legal ports before searching, so a
      // shared coordinate can be selected without modifying the routed path.
      for(const value of baseFractions(peer,peerBox,side)) {
        const fraction=(peerBox[axis]+peerBox[size]*value-box[axis])/box[size];
        if(fraction>=low&&fraction<=high&&!fractions.some(f=>Math.abs(f-fraction)<EPS)) fractions.push(fraction);
      }
      return fractions;
    };
    for(const side of node.type==='bpmn:TextAnnotation'?[-1]:[1,2,-1,-2]) for(const fraction of sideFractions(side)) {
      const claim=branchPorts.get(`${node.id}:${side}`);
      if(claim&&claim.edgeId!==edgeId) continue;
      const point=Math.abs(side)===1?{x:side===1?box.x+box.width:box.x,y:box.y+box.height*fraction}:
        {x:box.x+box.width*fraction,y:side===2?box.y+box.height:box.y};
      const outside={x:point.x+(Math.abs(side)===1?side*clearance:0),y:point.y+(Math.abs(side)===2?side/2*clearance:0)};
      if(/Event|Gateway/.test(node.type)) {
        const offset=Math.abs(2*fraction-1);
        const factor=/Gateway/.test(node.type)?1-offset:Math.sqrt(1-offset*offset);
        if(Math.abs(side)===1) point.x=box.x+box.width/2+side*box.width/2*factor;
        else point.y=box.y+box.height/2+side/2*box.height/2*factor;
      }
      if(scope.obstacles.some(obstacle=>obstacle.id!==node.id&&hitRectangle(point,outside,obstacle))) continue;
      if(scope.segments.some(([a,b])=>onSegment(point,a,b))&&!allowedContacts.some(end=>samePoint(end,point))) continue;
      const extra=reservationCost(point,outside,scope.segments,crossingCost,options.edgeDistance,allowedContacts);
      if(!Number.isFinite(extra)) continue;
      result.push({id:`${node.id}:${side}:${fraction}`,point:outside,dock:point,direction:target?-side:side,
        cost:Math.abs(point.x-outside.x)+Math.abs(point.y-outside.y)+extra});
    }
    return result;
  };
  const edges=orderBpmnFlows(input,placement,{includeMessageFlows,includeAssociations,rankedRouteOrder:options.rankedRouteOrder});
  let branchPorts=new Map();
  if(options.planIncidentPorts) branchPorts=planIncidentPorts(input,placement,
    (node,peer,edge,target)=>ports(node,getScope(node.scopeId),target,peer,[],edge.id));
  if(options.planBranchPorts) for(const [key,claim] of planBranchPorts(input,placement,id=>getScope(id).obstacles))
    if(!branchPorts.has(key)) branchPorts.set(key,claim);
  for(const edge of edges) {
    const message=edge.type==='bpmn:MessageFlow';
    const source=endpoints.get(edge.source),target=endpoints.get(edge.target);
    if(!source||!target||(!message&&(!nodes.has(source.id)||!nodes.has(target.id)||source.scopeId!==target.scopeId))) {
      failures.push({id:edge.id,reason:edge.type==='bpmn:Association'?'invalid-association-scope':'invalid-sequence-scope'});continue;
    }
    const scope=message?getMessageScope(source,target):getScope(source.scopeId);
    if(!scope) {failures.push({id:edge.id,reason:'invalid-message-participants'});continue;}
    const allowedContacts=[];
    for(const previous of routes) {
      const previousEdge=edgeById.get(previous.id);
      if([edge.source,edge.target].includes(previousEdge.source)) allowedContacts.push(previous.points[0]);
      if([edge.source,edge.target].includes(previousEdge.target)) allowedContacts.push(previous.points.at(-1));
    }
    const sources=ports(source,scope,false,target,allowedContacts,edge.id),targets=ports(target,scope,true,source,allowedContacts,edge.id);
    const sourcePorts=new Map(sources.map(port=>[port.id,port])),targetPorts=new Map(targets.map(port=>[port.id,port]));
    const edgeLabels=input.labels.filter(label=>label.targetId===edge.id);
    const commonLanes=options.preferSameLaneFlowLabels&&edge.type==='bpmn:SequenceFlow'
      ? (source.laneIds||[]).filter(id=>(target.laneIds||[]).includes(id)) : [];
    const laneLabelBounds=commonLanes.length===1?boxes.get(commonLanes[0]):undefined;
    const guide=feedbackGuides?.get(edge.id),axis=placement.horizontal?'y':'x',extent=placement.horizontal?'height':'width';
    const plannedGuides=guide?{[axis]:[scope.space.bounds[axis]+scope.space.bounds[extent]-
      (guide.count-guide.channel)*options.edgeDistance]}:undefined;
    let labelFailure;
    const maxStates=options.maxStates ?? 50000;
    const searchOptions={sources,targets,deadline,maxStates,bendCost:options.bendCost,
      guides:plannedGuides,
      visibilityChannels:options.visibilityChannels,
      channelQuality:(path,sourceId,targetId)=>{
        const points=compactPath([sourcePorts.get(sourceId).dock,...path,targetPorts.get(targetId).dock]);
        let crossings=0,length=0;
        for(let i=1;i<points.length;i++) {
          crossings+=reservationCost(points[i-1],points[i],scope.segments,1,options.edgeDistance,allowedContacts);
          length+=Math.abs(points[i].x-points[i-1].x)+Math.abs(points[i].y-points[i-1].y);
        }
        return [crossings,Math.max(0,points.length-2),length];
      },
      segmentCost:cacheSegmentCosts((a,b)=>reservationCost(a,b,scope.segments,crossingCost,options.edgeDistance,allowedContacts)),
      turnAllowed:cachePointQuery(point=>!scope.segments.some(([a,b])=>onSegment(point,a,b))||allowedContacts.some(end=>samePoint(end,point))),
      evaluatePath:edgeLabels.length?(path,sourceId,targetId)=>{
        const points=compactPath([sourcePorts.get(sourceId).dock,...path,targetPorts.get(targetId).dock]);
        const result=placeFlowLabels(edgeLabels,points,{bounds:scope.space.bounds,preferredBounds:laneLabelBounds,
          obstacles:scope.obstacles,segments:scope.segments,gap:options.edgeDistance});
        if(result.status==='placed') return result;
        labelFailure=result;return null;
      }:undefined};
    let found=searchFreeSpace(scope.space,searchOptions),searchPasses=1,guides;
    if(found.status==='unreachable'&&found.reason==='disconnected-space'&&scope.segments.length&&found.expanded<maxStates&&performance.now()<deadline) {
      // Try edge-spaced coordinates in the same immutable geometry before
      // interpreting sparse candidate failure as a demand for larger lanes.
      guides={x:[],y:[]};const spacing=options.edgeDistance;
      for(const segment of scope.segments) for(const point of segment) {
        guides.x.push(point.x-spacing,point.x+spacing);
        guides.y.push(point.y-spacing,point.y+spacing);
      }
      const previousExpanded=found.expanded;
      found=searchFreeSpace(scope.space,{...searchOptions,guides,maxStates:maxStates-previousExpanded});
      found.expanded+=previousExpanded;searchPasses++;
    }
    if(!message&&!edgeLabels.length&&guides&&found.status==='unreachable'&&found.expanded<maxStates&&performance.now()<deadline) {
      const axis=placement.horizontal?'y':'x',size=placement.horizontal?'height':'width',gap=options.edgeDistance;
      const bounds=scope.space.bounds;
      const expanded={...bounds,[axis]:bounds[axis]-gap,[size]:bounds[size]+2*gap};
      const probe=searchFreeSpace(partitionFreeSpace(expanded,scope.obstacles,{version}),
        {...searchOptions,guides,maxStates:maxStates-found.expanded});
      found.expanded+=probe.expanded;searchPasses++;
      if(probe.status==='limited') {found.status='limited';found.reason=probe.reason;}
      if(probe.status==='routed') {
        const values=probe.points.map(p=>p[axis]);
        const additionalAcross=Math.max(0,bounds[axis]-Math.min(...values),Math.max(...values)-bounds[axis]-bounds[size]);
        // This witness is outside the current scope and must never be applied.
        // Request its measured corridor from coordinate assignment instead.
        if(additionalAcross>EPS) found.spaceDemand={reason:'boundary-corridor',additionalAcross,axis};
      }
    }
    found.searchPasses=searchPasses;
    if(found.status!=='routed') {failures.push({id:edge.id,scopeId:source.scopeId,...found,...(labelFailure?{labelDemand:labelFailure}:{})});continue;}
    const sourcePort=sources.find(port=>port.id===found.sourceId),targetPort=targets.find(port=>port.id===found.targetId);
    const points=compactPath([sourcePort.dock,...found.points,targetPort.dock]);
    for(let i=1;i<points.length;i++) scope.segments.push([points[i-1],points[i]]);
    const chosenLabels=found.evaluation?.labels||[];
    labels.push(...chosenLabels);
    if(chosenLabels.length) {
      scope.obstacles.push(...chosenLabels.map(inflate));
      scope.space=partitionFreeSpace(scope.space.bounds,scope.obstacles,{version});
      if(message) scope.labelRevision=labels.length;
    }
    routes.push({id:edge.id,type:edge.type,points,sourcePort:found.sourceId,targetPort:found.targetId,expanded:found.expanded,cost:found.cost,searchPasses});
  }
  return {status:failures.length?'needs-space':'routed',version,routes,labels,failures,edgeDistance:options.edgeDistance,
    spaces:[...scopes].map(([scopeId,scope])=>({scopeId,cells:scope.space.cells.length}))};
}

export function routeSequenceFlows(input,placement,options={}) {
  return routeBpmnFlows(input,placement,{...options,includeMessageFlows:false,includeAssociations:false});
}
