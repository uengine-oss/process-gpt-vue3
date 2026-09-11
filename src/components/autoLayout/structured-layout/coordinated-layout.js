import {planStructuredLayout} from './plan-layout.js';
import {selectOrderingCandidate,measureOrderingSketch} from './ordering-candidate.js';
import {assignLayoutCoordinates} from './coordinate-assignment.js';
import {validateLayoutPlan} from './validate-layout.js';
import {selectNodeLabelCandidate,selectJointNodeLabelCandidate,selectNodeLabelChannelCandidate,placeNodeLabelPreferences} from './node-label-candidate.js';
import {routeBpmnFlows,orderBpmnFlows} from './route-graph.js';
import {planBranchPorts} from './branch-ports.js';
import {hasCrowdedGatewayPorts} from './incident-ports.js';
import {DEFAULT_LAYOUT_OPTIONS} from '../layout-options.js';
import {selectFeedbackCandidate} from './feedback-candidate.js';

export function measureRoutedQuality(plan) {
  const segments=[];let length=0,bends=0,maxPoints=0,crossings=0;
  for(const route of plan.routing.routes) {
    bends+=Math.max(0,route.points.length-2);maxPoints=Math.max(maxPoints,route.points.length);
    for(let i=1;i<route.points.length;i++) {
      const a=route.points[i-1],b=route.points[i];
      length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
      segments.push({id:route.id,a,b,vertical:Math.abs(a.x-b.x)<1e-7});
    }
  }
  for(let i=0;i<segments.length;i++) for(let j=0;j<i;j++) {
    const a=segments[i],b=segments[j];
    if(a.id===b.id||a.vertical===b.vertical) continue;
    const [v,h]=a.vertical?[a,b]:[b,a];
    if(v.a.x>Math.min(h.a.x,h.b.x)+1e-7&&v.a.x<Math.max(h.a.x,h.b.x)-1e-7&&
      h.a.y>Math.min(v.a.y,v.b.y)+1e-7&&h.a.y<Math.max(v.a.y,v.b.y)-1e-7) crossings++;
  }
  return {crossings,bends,length,maxPoints};
}

export function improvesRoutedQuality(after,before) {
  return after.crossings<=before.crossings&&after.bends<=before.bends&&after.length<=before.length+1e-7&&after.maxPoints<=before.maxPoints&&
    (after.crossings<before.crossings||after.bends<before.bends||after.length<before.length-1e-7);
}

const jsonSafe=value=>value===null||typeof value==='string'||typeof value==='boolean'||
  (typeof value==='number'&&Number.isFinite(value))||
  (Array.isArray(value)?value.every(jsonSafe):typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype&&Object.values(value).every(jsonSafe));

function applyOffsets(input,constraints,base,{deadline,nodeOffsets,options}) {
  let winner=base;
  const optimization=structuredClone(base.optimization);
  if(nodeOffsets.length) {
    const nodeLabelPlacement=optimization.labels.preference;
    winner=planStructuredLayout(input,constraints,{...options,...(optimization.feedback?.accepted?optimization.feedback.options:{}),deadline,nodeOffsets,
      orderingPrecedence:optimization.orderingPrecedence,nodeLabelPlacement,
      compactRanks:optimization.ranks?.accepted||options.compactRanks,
      alignConnectedCenters:optimization.alignConnectedCenters||options.alignConnectedCenters,
      compactLabelFootprints:optimization.labels.compactFootprint||options.compactLabelFootprints,
      compactPhaseGaps:optimization.labels.phaseGaps||options.compactPhaseGaps,
      nodeLabelGap:optimization.labels.nodeLabelGap??options.nodeLabelGap,
      bendCost:optimization.labels.bendCost??options.bendCost,
      crossAxisLabelIds:optimization.labelAxis?.preference||options.crossAxisLabelIds,
      rankedRouteOrder:optimization.routingOrder?.accepted||options.rankedRouteOrder,
      planIncidentPorts:optimization.incidentPorts?.accepted||options.planIncidentPorts,
      planBranchPorts:optimization.routingOrder?.branchPorts||options.planBranchPorts});
    if(nodeLabelPlacement) optimization.labels.appliedAfterEdit=winner.nodeLabelPlacementApplied;
  }
  if(performance.now()>=deadline) return {...winner,status:'limited',reason:'deadline',optimization};
  if(winner.status==='computed') {
    const issues=validateLayoutPlan(input,winner,constraints);
    if(issues.length) return {...winner,status:'invalid',validationErrors:issues,optimization};
  }
  return {...winner,optimization};
}

// Resolve ordering on the unedited semantic baseline, then apply explicit edits
// relative to that ordering. Never let an edit silently select a new baseline.
export function planCoordinatedLayout(input,constraints,{deadline=performance.now()+5000,nodeOffsets=[],baselineCache,minimumLayerDistance=44,visibilityChannels=true,feedbackCandidate=true,...overrides}={}) {
  const options={...overrides,minimumLayerDistance,visibilityChannels,feedbackCandidate};
  if(performance.now()>=deadline) return {status:'limited',reason:'deadline'};
  const key=baselineCache&&jsonSafe([input,constraints,options])?JSON.stringify([input,constraints,options]):null;
  if(key&&baselineCache.has(key)) return {...applyOffsets(input,constraints,structuredClone(baselineCache.get(key)),
    {deadline,nodeOffsets,options}),baselineReused:true};
  const baseline=planStructuredLayout(input,constraints,{...options,deadline,nodeOffsets:[]});
  if(baseline.status!=='computed') return baseline;
  const errors=validateLayoutPlan(input,baseline,constraints);
  if(errors.length) return {...baseline,status:'invalid',validationErrors:errors};
  let orderingPlacement=baseline.placement,orderingOptions=options,feedbackSelection,feedbackOptions;
  if(options.feedbackCandidate&&!options.feedbackExchange) {
    feedbackSelection=selectFeedbackCandidate(baseline.placement,{deadline});
    if(feedbackSelection.reason==='deadline') return {status:'limited',reason:'feedback-selection-deadline'};
    if(feedbackSelection.candidate) {
      feedbackOptions={feedbackExchange:feedbackSelection.candidate.exchange,feedbackChannelGuides:true,preferSameLaneFlowLabels:true};
      orderingOptions={...options,...feedbackOptions};
      orderingPlacement=assignLayoutCoordinates(input,constraints,orderingOptions);
    }
  }
  const selected=selectOrderingCandidate(input,constraints,orderingPlacement,{...orderingOptions,deadline});
  if(selected.status==='limited') return {status:'limited',reason:'ordering-deadline'};
  if(!orderingOptions.alignConnectedCenters) {
    const precedence=[...(orderingOptions.orderingPrecedence||[]),...(selected.candidate?.orderingPrecedence||[])];
    const placement=assignLayoutCoordinates(input,constraints,{...orderingOptions,orderingPrecedence:precedence,alignConnectedCenters:true});
    const before=selected.candidate?.score||selected.before,after=measureOrderingSketch(input,placement);
    if(after.crossings<=before.crossings&&after.length<before.length-1e-7) {
      selected.candidate={...selected.candidate,orderingPrecedence:selected.candidate?.orderingPrecedence||[],
        placement,score:after,alignConnectedCenters:true};
    }
  }
  if(feedbackOptions&&!selected.candidate) selected.candidate={orderingPrecedence:[],placement:orderingPlacement,
    score:measureOrderingSketch(input,orderingPlacement)};
  let winner=baseline,orderingPrecedence=options.orderingPrecedence||[];
  let alignConnectedCenters=options.alignConnectedCenters;
  const optimization={considered:selected.considered,proposed:!!selected.candidate,accepted:false,before:measureRoutedQuality(baseline)};
  if(feedbackSelection) optimization.feedback={selection:feedbackSelection,accepted:false};
  if(selected.candidate) {
    const proposedPrecedence=[...orderingPrecedence,...selected.candidate.orderingPrecedence];
    const proposed=planStructuredLayout(input,constraints,{...orderingOptions,deadline,nodeOffsets:[],orderingPrecedence:proposedPrecedence,
      alignConnectedCenters:selected.candidate.alignConnectedCenters||orderingOptions.alignConnectedCenters});
    if(proposed.status==='limited'||proposed.routing?.failures.some(f=>f.status==='limited')) return {...proposed,status:'limited'};
    const issues=proposed.status==='computed'?validateLayoutPlan(input,proposed,constraints):[proposed.status];
    optimization.candidateErrors=issues;
    if(!issues.length) {
      optimization.after=measureRoutedQuality(proposed);
      if(improvesRoutedQuality(optimization.after,optimization.before)) {
        winner=proposed;orderingPrecedence=proposedPrecedence;optimization.accepted=true;
        alignConnectedCenters=selected.candidate.alignConnectedCenters||options.alignConnectedCenters;
        if(feedbackOptions) {
          Object.assign(options,feedbackOptions);
          optimization.feedback.accepted=true;optimization.feedback.options=feedbackOptions;
        }
      }
    }
  }
  optimization.alignConnectedCenters=!!alignConnectedCenters;
  let labels=selectJointNodeLabelCandidate(input,winner,constraints,{...options,deadline,
    compactNodeLabels:options.compactNodeLabels!==false});
  if(labels.status==='limited') return {status:'limited',reason:'label-selection-deadline',optimization};
  let nodeLabelPlacement=options.nodeLabelPlacement;
  let compactLabelFootprints=options.compactLabelFootprints;
  let compactPhaseGaps=options.compactPhaseGaps,bendCost=options.bendCost;
  let nodeLabelGap=options.nodeLabelGap;
  optimization.labels={considered:labels.considered,proposed:!!labels.candidate,accepted:false};
  let labelRoutingAttempts=0;
  for(let labelAttempt=0;labelAttempt<2&&labels.candidate;labelAttempt++) {
    if(labelAttempt===1) {
      // A rejected joint proposal must not discard an existing single-label win.
      labels=selectNodeLabelCandidate(input,winner,constraints,{...options,deadline,compactNodeLabels:false});
      if(labels.status!=='limited'&&!labels.candidate&&options.compactNodeLabels!==false) {
        const considered=labels.considered;
        labels=selectNodeLabelCandidate(input,winner,constraints,{...options,deadline,compactNodeLabels:true,
          maxCandidates:Math.max(0,(options.maxCandidates??64)-considered)});
        labels.considered+=considered;
      }
      optimization.labels.considered+=labels.considered;
      optimization.labels.singleFallback=true;
      if(labels.status==='limited') return {status:'limited',reason:'label-selection-deadline',optimization};
      if(!labels.candidate) break;
    }
    const start=performance.now();
    let placement=labels.candidate.placement,compacted=false;
    const preference=labels.candidate.preferences?.length>1?labels.candidate.preferences:
      {labelId:labels.candidate.labelId,side:labels.candidate.side,gap:labels.candidate.gap};
    if(options.compactLabelFootprints!==false) {
      const compact=assignLayoutCoordinates(input,constraints,{...options,horizontal:winner.placement.horizontal,
        orderingPrecedence,alignConnectedCenters,nodeLabelPlacement:preference,compactLabelFootprints:true});
      const bounds=p=>new Map([...p.boxes.filter(box=>box.kind==='container').map(box=>[`box:${box.id}`,box]),
        ...(p.rootBounds||[]).map(box=>[`root:${box.scopeId}`,box])]);
      const before=bounds(placement),after=bounds(compact);
      const fits=[...after].every(([id,box])=>before.has(id)&&box.width<=before.get(id).width+1e-7&&box.height<=before.get(id).height+1e-7);
      const smaller=[...after].some(([id,box])=>before.has(id)&&(box.width<before.get(id).width-1e-7||box.height<before.get(id).height-1e-7));
      if(fits&&smaller) {placement=compact;compacted=true;}
    }
    let phaseGaps=false,candidateBendCost=bendCost,candidateLabelGap=nodeLabelGap;
    if(options.phaseGapCandidate!==false&&placement.scopes.some(scope=>scope.phases.length>1)) {
      let compact=assignLayoutCoordinates(input,constraints,{...options,horizontal:winner.placement.horizontal,
        orderingPrecedence,alignConnectedCenters,nodeLabelPlacement:preference,
        compactLabelFootprints:compacted||options.compactLabelFootprints,compactPhaseGaps:true});
      if(!winner.placement.horizontal&&options.phaseLabelGapCandidate!==false&&nodeLabelGap===undefined) {
        const gap=options.edgeDistance??DEFAULT_LAYOUT_OPTIONS.edgeDistance;
        const smaller=assignLayoutCoordinates(input,constraints,{...options,horizontal:false,
          orderingPrecedence,alignConnectedCenters,nodeLabelPlacement:preference,
          compactLabelFootprints:compacted||options.compactLabelFootprints,compactPhaseGaps:true,nodeLabelGap:gap});
        const before=new Map(compact.boxes.filter(b=>b.kind==='container').map(b=>[b.id,b]));
        const boxes=smaller.boxes.filter(b=>b.kind==='container');
        if(boxes.every(b=>before.has(b.id)&&b.width<=before.get(b.id).width&&b.height<=before.get(b.id).height)&&
          boxes.some(b=>b.width<before.get(b.id).width||b.height<before.get(b.id).height)) {
          compact=smaller;candidateLabelGap=gap;
        }
      }
      const labeled=placeNodeLabelPreferences(input,compact,constraints,preference,options);
      if(labeled) {placement=labeled;phaseGaps=true;candidateBendCost=96;}
      else candidateLabelGap=nodeLabelGap;
    }
    labelRoutingAttempts++;
    const routing=routeBpmnFlows(input,placement,{...options,deadline,bendCost:candidateBendCost});
    optimization.labels.routingMs=performance.now()-start;
    if(performance.now()>=deadline||routing.failures.some(f=>f.status==='limited')) return {status:'limited',reason:'label-routing-deadline',optimization};
    const proposed={...winner,status:routing.status==='routed'?'computed':routing.status,placement,routing};
    const issues=validateLayoutPlan(input,proposed,constraints);
    optimization.labels.candidateErrors=issues;
    if(!issues.length) {
      const before=measureRoutedQuality(winner),after=measureRoutedQuality(proposed);
      Object.assign(optimization.labels,{before,after});
      if(improvesRoutedQuality(after,before)) {
        winner=proposed;
        nodeLabelPlacement=preference;
        compactLabelFootprints=compacted||options.compactLabelFootprints;
        optimization.labels.compactFootprint=!!compactLabelFootprints;
        compactPhaseGaps=phaseGaps||options.compactPhaseGaps;
        bendCost=candidateBendCost;
        optimization.labels.phaseGaps=!!compactPhaseGaps;
        optimization.labels.bendCost=bendCost;
        nodeLabelGap=candidateLabelGap;
        optimization.labels.nodeLabelGap=nodeLabelGap;
        optimization.labels.accepted=true;
      }
    }
    if(optimization.labels.accepted||!Array.isArray(preference)) break;
  }
  optimization.labels.routingAttempts=labelRoutingAttempts;
  optimization.labels.preference=nodeLabelPlacement;
  let routingCandidateSlots=1+Number(optimization.proposed)+labelRoutingAttempts;
  let crossAxisLabelIds=options.crossAxisLabelIds;
  optimization.labelAxis={proposed:false,accepted:false};
  if(!winner.placement.horizontal&&routingCandidateSlots<3) {
    const nodeIds=new Set(input.nodes.map(node=>node.id));
    const ids=input.labels.filter(label=>nodeIds.has(label.targetId)).map(label=>label.id).sort();
    if(ids.some(id=>!crossAxisLabelIds?.includes(id))) {
      optimization.labelAxis.proposed=true;routingCandidateSlots++;
      const proposed=planStructuredLayout(input,constraints,{...options,deadline,nodeOffsets:[],orderingPrecedence,
        nodeLabelPlacement,crossAxisLabelIds:ids,alignConnectedCenters,compactLabelFootprints,compactPhaseGaps,bendCost,nodeLabelGap});
      if(proposed.status==='limited'||proposed.routing?.failures.some(f=>f.status==='limited')) return {...proposed,status:'limited'};
      const issues=proposed.status==='computed'?validateLayoutPlan(input,proposed,constraints):[proposed.status];
      optimization.labelAxis.candidateErrors=issues;
      if(!issues.length) {
        const before=measureRoutedQuality(winner),after=measureRoutedQuality(proposed);
        Object.assign(optimization.labelAxis,{before,after});
        if(improvesRoutedQuality(after,before)) {winner=proposed;crossAxisLabelIds=ids;optimization.labelAxis.accepted=true;}
      }
    }
  } else if(routingCandidateSlots>=3) optimization.labelAxis.skipped='candidate-budget';
  optimization.labelAxis.preference=crossAxisLabelIds;
  optimization.ranks={proposed:false,accepted:false};
  if(!options.compactRanks&&routingCandidateSlots<3) {
    const placement=assignLayoutCoordinates(input,constraints,{...options,crossAxisLabelIds,orderingPrecedence,compactRanks:true,alignConnectedCenters,
      nodeLabelPlacement,compactLabelFootprints,compactPhaseGaps,nodeLabelGap});
    const before=measureOrderingSketch(input,winner.placement),after=measureOrderingSketch(input,placement);
    optimization.ranks.proposed=after.crossings<=before.crossings&&after.length<before.length-1e-7;
    if(optimization.ranks.proposed) {
      routingCandidateSlots++;
      let rankLabelPlacement=nodeLabelPlacement;
      if(!rankLabelPlacement) {
        const channel=selectNodeLabelChannelCandidate(input,winner,constraints,{...options,deadline});
        if(channel.status==='limited') return {status:'limited',reason:'rank-label-selection-deadline',optimization};
        if(channel.candidate) {
          const {labelId,side,gap}=channel.candidate;
          rankLabelPlacement={labelId,side,gap};
          optimization.ranks.labelChannel=rankLabelPlacement;
        }
      }
      const proposed=planStructuredLayout(input,constraints,{...options,deadline,nodeOffsets:[],orderingPrecedence,
        nodeLabelPlacement:rankLabelPlacement,crossAxisLabelIds,compactRanks:true,alignConnectedCenters,compactLabelFootprints,compactPhaseGaps,bendCost,nodeLabelGap});
      if(proposed.status==='limited'||proposed.routing?.failures.some(f=>f.status==='limited')) return {...proposed,status:'limited'};
      const issues=proposed.status==='computed'?validateLayoutPlan(input,proposed,constraints):[proposed.status];
      optimization.ranks.candidateErrors=issues;
      if(!issues.length) {
        const before=measureRoutedQuality(winner),after=measureRoutedQuality(proposed);
        Object.assign(optimization.ranks,{before,after});
        if(improvesRoutedQuality(after,before)) {
          winner=proposed;optimization.ranks.accepted=true;
          nodeLabelPlacement=rankLabelPlacement;
          optimization.labels.preference=nodeLabelPlacement;
        }
      }
    }
  } else if(routingCandidateSlots>=3) optimization.ranks.skipped='candidate-budget';
  const rankedOrder=orderBpmnFlows(input,winner.placement,{...options,rankedRouteOrder:true});
  // Nominate geometrically aligned splits cheaply; the router checks actual
  // scoped obstacles before assigning ports. Reuse the route-order slot.
  const branchPorts=options.branchPortCandidate!==false&&planBranchPorts(input,winner.placement,()=>[]).size>0;
  optimization.routingOrder={proposed:branchPorts||rankedOrder.some((edge,i)=>edge.id!==winner.routing.routes[i]?.id),accepted:false};
  // Reuse the existing three candidate slots; do not add a fourth full routing
  // pass after both node-order and label alternatives have already been routed.
  if(optimization.routingOrder.proposed&&routingCandidateSlots>=3) optimization.routingOrder.skipped='candidate-budget';
  if(optimization.routingOrder.proposed&&routingCandidateSlots<3) {
    routingCandidateSlots++;
    const start=performance.now();
    const routing=routeBpmnFlows(input,winner.placement,{...options,deadline,bendCost,rankedRouteOrder:true,
      planBranchPorts:branchPorts||options.planBranchPorts});
    optimization.routingOrder.routingMs=performance.now()-start;
    if(performance.now()>=deadline||routing.failures.some(f=>f.status==='limited'))
      return {status:'limited',reason:'route-order-deadline',optimization};
    const proposed={...winner,status:routing.status==='routed'?'computed':routing.status,routing};
    const issues=validateLayoutPlan(input,proposed,constraints);
    optimization.routingOrder.candidateErrors=issues;
    if(!issues.length) {
      const before=measureRoutedQuality(winner),after=measureRoutedQuality(proposed);
      Object.assign(optimization.routingOrder,{before,after});
      if(improvesRoutedQuality(after,before)) {
        winner=proposed;optimization.routingOrder.accepted=true;optimization.routingOrder.branchPorts=branchPorts;
      }
    }
  }
  const incidentPorts=options.incidentPortCandidate!==false&&!options.planIncidentPorts&&
    hasCrowdedGatewayPorts(input,winner.routing,2*(options.edgeDistance??DEFAULT_LAYOUT_OPTIONS.edgeDistance));
  optimization.incidentPorts={proposed:incidentPorts,accepted:false};
  if(incidentPorts&&routingCandidateSlots>=3) optimization.incidentPorts.skipped='candidate-budget';
  if(incidentPorts&&routingCandidateSlots<3) {
    const routing=routeBpmnFlows(input,winner.placement,{...options,deadline,bendCost,planIncidentPorts:true,
      rankedRouteOrder:optimization.routingOrder.accepted||options.rankedRouteOrder,
      planBranchPorts:optimization.routingOrder.branchPorts||options.planBranchPorts});
    if(performance.now()>=deadline||routing.failures.some(f=>f.status==='limited'))
      return {status:'limited',reason:'incident-port-deadline',optimization};
    const proposed={...winner,status:routing.status==='routed'?'computed':routing.status,routing};
    const issues=validateLayoutPlan(input,proposed,constraints);
    optimization.incidentPorts.candidateErrors=issues;
    if(!issues.length) {
      const before=measureRoutedQuality(winner),after=measureRoutedQuality(proposed);
      Object.assign(optimization.incidentPorts,{before,after});
      if(improvesRoutedQuality(after,before)) {winner=proposed;optimization.incidentPorts.accepted=true;}
    }
  }
  if(performance.now()>=deadline) return {...winner,status:'limited',reason:'deadline',optimization};
  const base={...winner,optimization:{...optimization,orderingPrecedence}};
  if(key) {
    baselineCache.set(key,structuredClone(base));
    while(baselineCache.size>2) baselineCache.delete(baselineCache.keys().next().value);
  }
  return {...applyOffsets(input,constraints,base,{deadline,nodeOffsets,options}),baselineReused:false};
}
