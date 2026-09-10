import { assignLayoutCoordinates } from './coordinate-assignment.js';
import { routeBpmnFlows } from './route-graph.js';
import { DEFAULT_LAYOUT_OPTIONS } from '../layout-options.js';
import { layoutLaneIds } from './subprocess-lane-spans.js';
import { placeNodeLabelPreferences } from './node-label-candidate.js';

// Recompute from the same semantic input only when routing supplies a concrete
// missing-space demand. Partial geometry is diagnostic data, never an apply plan.
export function planStructuredLayout(input,constraints,{horizontal=true,maxAttempts=3,deadline=performance.now()+5000,...overrides}={}) {
  if(!Number.isInteger(maxAttempts)||maxAttempts<1) throw new Error('Invalid layout attempt limit');
  if(input.unsupported?.length) return {status:'invalid',reason:'unsupported-layout-elements',
    unsupported:input.unsupported.map(element=>({...element}))};
  const options={...DEFAULT_LAYOUT_OPTIONS,...overrides};
  const demands=new Map(),attempts=[];
  const nodes=new Map([...input.nodes,...(input.artifacts||[])].map(node=>[node.id,node]));
  const edges=new Map(input.edges.map(edge=>[edge.id,edge]));
  let placement,routing;
  for(let version=0;version<maxAttempts;version++) {
    if(performance.now()>=deadline) return {status:'limited',reason:'deadline',attempts};
    const start=performance.now();
    placement=assignLayoutCoordinates(input,constraints,{...options,horizontal,spaceDemands:[...demands.values()]});
    const labelPlacement=options.nodeLabelPlacement?placeNodeLabelPreferences(input,placement,constraints,options.nodeLabelPlacement,options):null;
    if(labelPlacement) placement=labelPlacement;
    const placedAt=performance.now();
    routing=routeBpmnFlows(input,placement,{...options,version,deadline});
    attempts.push({version,placementMs:placedAt-start,routingMs:performance.now()-placedAt,
      demands:[...demands.values()].map(demand=>({...demand,rowIds:[...demand.rowIds]})),failures:routing.failures});
    if(performance.now()>=deadline) return {status:'limited',reason:'deadline',placement,routing,attempts};
    if(routing.status==='routed') return {status:'computed',placement,routing,attempts,
      ...(options.nodeLabelPlacement?{nodeLabelPlacementApplied:!!labelPlacement}:{})};
    if(routing.failures.some(failure=>failure.reason.startsWith('invalid-')||failure.reason==='unsupported-flow-type')) return {status:'invalid',placement,routing,attempts};
    let requested=false;
    for(const failure of routing.failures) {
      if(failure.spaceDemand&&failure.status!=='limited') {
        const edge=edges.get(failure.id),source=nodes.get(edge.source),target=nodes.get(edge.target);
        const rowIds=[...new Set([...layoutLaneIds(source,constraints),...layoutLaneIds(target,constraints)])].sort();
        const existing=[...demands.values()].filter(d=>d.scopeId===failure.scopeId&&(!rowIds.length||!d.rowIds.length||d.rowIds.some(id=>rowIds.includes(id))));
        const padding=Math.max(nodes.has(failure.scopeId)?options.subprocessMargin:options.lanePadding,
          options.nodeToEdgeDistance+options.edgeDistance,...existing.map(d=>d.minAcrossPadding));
        demands.set(edge.id,{...demands.get(edge.id),edgeId:edge.id,scopeId:failure.scopeId,rowIds,
          minAlongGap:demands.get(edge.id)?.minAlongGap||0,minAcrossPadding:padding+failure.spaceDemand.additionalAcross});
        requested=true;continue;
      }
      if(!failure.labelDemand||failure.status==='limited') continue;
      const edge=edges.get(failure.id);
      if(edge.type!=='bpmn:SequenceFlow') continue;
      const source=nodes.get(edge.source),target=nodes.get(edge.target);
      const slots=(demands.get(edge.id)?.slots||0)+1;
      const along=horizontal?failure.labelDemand.width:failure.labelDemand.height;
      const across=horizontal?failure.labelDemand.height:failure.labelDemand.width;
      demands.set(edge.id,{edgeId:edge.id,scopeId:failure.scopeId,labelId:failure.labelDemand.labelId,slots,
        rowIds:[...new Set([...source.laneIds,...target.laneIds])].sort(),
        minAlongGap:along+2*options.nodeToEdgeDistance+options.edgeDistance,
        minAcrossPadding:options.nodeToEdgeDistance+slots*(across+options.edgeDistance)+options.edgeDistance});
      requested=true;
    }
    if(!requested) break;
  }
  return {status:performance.now()>=deadline?'limited':'needs-space',placement,routing,attempts};
}
