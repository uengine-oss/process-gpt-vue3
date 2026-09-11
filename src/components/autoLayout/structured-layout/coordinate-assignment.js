import { DEFAULT_LAYOUT_OPTIONS } from '../layout-options.js';
import { assignConstrainedLayers } from './layer-assignment.js';
import { orderConstrainedLayers } from './crossing-order.js';
import { solveCollaborationColumns } from './collaboration-columns.js';
import { solvePreferredCoordinates } from './preferred-coordinates.js';
import { layoutLaneIds } from './subprocess-lane-spans.js';
import { allocateFeedbackChannels } from './feedback-channels.js';
import { compactLayerRanks } from './layer-compaction.js';
import {measureLayoutStage} from './layout-profile.js';

const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const overlaps = (a, b) => Math.min(a.a + a.length, b.a + b.length) > Math.max(a.a, b.a) &&
  Math.min(a.b + a.breadth, b.b + b.breadth) > Math.max(a.b, b.b);

// Solve lower-bound distances on an acyclic constraint graph, not on model shapes.
function minimumCoordinates(ids, constraints) {
  const outgoing = new Map(ids.map(id => [id, []]));
  const degree = new Map(ids.map(id => [id, 0]));
  const result = new Map(ids.map(id => [id, 0]));
  for (const [source, target, distance] of constraints) {
    if (!outgoing.has(source) || !outgoing.has(target) || !Number.isFinite(distance) || distance < 0) throw new Error('Invalid space constraint');
    outgoing.get(source).push([target, distance]);
    degree.set(target, degree.get(target) + 1);
  }
  const queue = ids.filter(id => degree.get(id) === 0);
  for (let i = 0; i < queue.length; i++) {
    for (const [target, distance] of outgoing.get(queue[i])) {
      result.set(target, Math.max(result.get(target), result.get(queue[i]) + distance));
      degree.set(target, degree.get(target) - 1);
      if (degree.get(target) === 0) queue.push(target);
    }
  }
  if (queue.length !== ids.length) throw new Error('Conflicting row/shape space constraints');
  return result;
}

// Produces geometry only. Edges/edge labels are reserved here and routed by the
// next stage; this function never invokes modeling, legacy routing, or the DOM.
export function assignLayoutCoordinates(...args) {
  return measureLayoutStage('coordinates',()=>assignCoordinates(...args));
}
function assignCoordinates(input, constraints, { horizontal = true, ...overrides } = {}) {
  const options = { ...DEFAULT_LAYOUT_OPTIONS, ...overrides };
  for (const key of ['minimumLayerDistance', 'nodeDistance', 'nodeToEdgeDistance', 'edgeDistance', 'lanePadding', 'subprocessMargin', 'participantLabelSpace', 'margin']) {
    if (!Number.isFinite(options[key]) || options[key] < 0) throw new Error(`Invalid spacing: ${key}`);
  }
  const logicalSize = node => ({ length: horizontal ? node.width : node.height, breadth: horizontal ? node.height : node.width });
  const nodes = new Map(input.nodes.map(node => [node.id, node]));
  const crossAxisLabelIds = new Set(options.crossAxisLabelIds || []);
  const labelPreferences = new Map((Array.isArray(options.nodeLabelPlacement) ? options.nodeLabelPlacement :
    options.nodeLabelPlacement ? [options.nodeLabelPlacement] : []).map(preference => [preference.labelId, preference]));
  const offsets = new Map((options.nodeOffsets || []).map(offset => {
    if (!Number.isFinite(offset.along) || !Number.isFinite(offset.across)) throw new Error('Invalid node offset');
    return [offset.id, offset];
  }));
  const adjustedOffsets = [];
  const artifactsByAnchor = new Map();
  for (const artifact of [...(input.artifacts || [])].sort(compareId)) {
    if (!artifactsByAnchor.has(artifact.anchorId)) artifactsByAnchor.set(artifact.anchorId, []);
    artifactsByAnchor.get(artifact.anchorId).push(artifact);
  }
  const containerById = new Map(input.containers.map(container => [container.id, container]));
  const labelsByTarget = new Map();
  for (const label of input.labels) {
    if (!labelsByTarget.has(label.targetId)) labelsByTarget.set(label.targetId, []);
    labelsByTarget.get(label.targetId).push(label);
  }
  const scopedNodes = new Map(), attached = new Map();
  for (const node of input.nodes) {
    if (!scopedNodes.has(node.scopeId)) scopedNodes.set(node.scopeId, []);
    scopedNodes.get(node.scopeId).push(node);
    if (node.hostId) {
      if (!nodes.has(node.hostId) || nodes.get(node.hostId).scopeId !== node.scopeId) throw new Error(`Invalid attachment scope: ${node.id}`);
      if (!attached.has(node.hostId)) attached.set(node.hostId, []);
      attached.get(node.hostId).push(node);
    }
  }
  const results = new Map(), active = new Set(), projectors = new Map();
  const calculateScope = scopeId => {
    if (results.has(scopeId)) return results.get(scopeId);
    if (active.has(scopeId)) throw new Error(`Cyclic subprocess scope: ${scopeId}`);
    active.add(scopeId);
    const scopeType = containerById.get(scopeId)?.type;
    const subprocess = scopeType === 'bpmn:SubProcess';
    const members = (scopedNodes.get(scopeId) || []).filter(n => !n.hostId).sort(compareId);
    const explicitRows = constraints.rows.find(row => row.scopeId === scopeId)?.rowIds || [];
    const inheritedSpan = constraints.subprocessSpans?.find(span => span.id === scopeId);
    const sharedRows = !explicitRows.length && !!inheritedSpan;
    const rowIds = explicitRows.length ? explicitRows : inheritedSpan?.rowIds || [scopeId];
    if (new Set(rowIds).size !== rowIds.length) throw new Error(`Duplicate rows: ${scopeId}`);
    const rowIndex = new Map(rowIds.map((id, i) => [id, i]));
    const grid = constraints.phaseGrids.find(g => g.participantId === scopeId);
    const demands = (options.spaceDemands || []).filter(demand => demand.scopeId === scopeId);
    const phaseIndex = new Map((grid?.phaseIds || []).map((id, i) => [id, i]));
    const footprints = new Map();
    const localNodes = members.map(node => {
      const indexes = explicitRows.length || sharedRows ? layoutLaneIds(node,constraints).map(id => rowIndex.get(id)) : [0];
      if (!indexes.length || indexes.some(i => i === undefined)) throw new Error(`Unresolved row membership: ${node.id}`);
      indexes.sort((a, b) => a - b);
      if (indexes.some((value, i) => i && value !== indexes[i-1] + 1)) throw new Error(`Noncontiguous row span: ${node.id}`);
      const nested = node.expanded ? calculateScope(node.id) : null;
      const size = nested ? { length: nested.length, breadth: nested.breadth } : logicalSize(node);
      const parts = [{ id: node.id, kind: 'node', a: 0, b: 0, ...size }];
      const placeLabels = (part, occupied) => {
        const labels = [];
        for (const label of labelsByTarget.get(part.id) || []) {
          const preferred = options.compactLabelFootprints ? labelPreferences.get(label.id) : null;
          const labelGap = preferred?.gap ?? options.nodeLabelGap ?? 2 * options.nodeToEdgeDistance + options.edgeDistance;
          if (!Number.isFinite(labelGap) || labelGap < options.edgeDistance) throw new Error('Invalid node label gap');
          const dims = logicalSize(label);
          const alongCenter = part.a + (part.length - dims.length) / 2;
          const acrossCenter = part.b + (part.breadth - dims.breadth) / 2;
          const below = { a: alongCenter, b: part.b + part.breadth + labelGap };
          const after = { a: part.a + part.length + labelGap, b: acrossCenter };
          const acrossFirst = horizontal || crossAxisLabelIds.has(label.id);
          const candidates = preferred ? [(preferred.side ?? 1) > 0 ? below : { a: alongCenter, b: part.b - dims.breadth - labelGap }] :
            [acrossFirst ? below : after, acrossFirst ? after : below,
            { a: alongCenter, b: part.b - dims.breadth - labelGap }, { a: part.a - dims.length - labelGap, b: acrossCenter }];
          const position = candidates.find(position => ![...occupied, ...labels].some(box => overlaps({ ...position, ...dims }, box)));
          if (!position) return null;
          const stretchB = part.id === node.id
            ? (position === below ? 1 : position.b === acrossCenter ? 0.5 : 0)
            : part.stretchB || 0;
          labels.push({ id: label.id, targetId: part.id, kind: 'label', ...dims, ...position, stretchB });
        }
        return labels;
      };
      const mainLabels = placeLabels(parts[0], parts);
      if (!mainLabels) throw new Error(`Insufficient label space: ${node.id}`);
      parts.push(...mainLabels);
      const boundaryNodes = (attached.get(node.id) || []).slice().sort(compareId);
      boundaryNodes.forEach(event => {
        const dims = logicalSize(event);
        const candidates = [];
        for (const side of ['across-end', 'along-end', 'across-start', 'along-start']) {
          const acrossSide = side.startsWith('across');
          const span = acrossSide ? size.length : size.breadth, diameter = acrossSide ? dims.length : dims.breadth;
          const slots = Math.max(1, Math.floor((span - diameter) / (diameter + options.edgeDistance)) + 1);
          const centers = Array.from({ length: slots }, (_, i) => slots === 1 ? span / 2 : diameter / 2 + (span - diameter) * i / (slots - 1));
          centers.sort((a, b) => Math.abs(a - span / 2) - Math.abs(b - span / 2) || a - b);
          for (const center of centers) candidates.push({ id: event.id, kind: 'node', ...dims,
            stretchB: acrossSide ? (side === 'across-end' ? 1 : 0) : center / size.breadth,
            a: acrossSide ? center - dims.length / 2 : (side === 'along-end' ? size.length : 0) - dims.length / 2,
            b: acrossSide ? (side === 'across-end' ? size.breadth : 0) - dims.breadth / 2 : center - dims.breadth / 2 });
        }
        let placed = false;
        for (const part of candidates) {
          if (parts.slice(1).some(box => overlaps(part, box))) continue;
          const labels = placeLabels(part, [...parts, part]);
          if (!labels) continue;
          parts.push(part, ...labels); placed = true; break;
        }
        if (!placed) throw new Error(`Insufficient attachment perimeter: ${node.id}`);
      });
      for (const anchor of parts.filter(part => part.kind === 'node')) for (const artifact of artifactsByAnchor.get(anchor.id) || []) {
        const dims = logicalSize(artifact), offset = offsets.get(artifact.id);
        const minimumB = Math.max(...parts.map(part => part.b + part.breadth)) +
          2 * options.nodeToEdgeDistance + options.edgeDistance;
        const requestedB = minimumB + (offset?.across || 0), actualB = Math.max(minimumB, requestedB);
        if (actualB !== requestedB) adjustedOffsets.push({id:`node:${artifact.id}`,scopeId,axis:'across',requested:requestedB,actual:actualB});
        parts.push({id:artifact.id,kind:'artifact',...dims,
          a:anchor.a+(anchor.length-dims.length)/2+(offset?.along || 0),b:actualB,stretchB:1});
      }
      const minA = Math.min(...parts.map(p => p.a)), minB = Math.min(...parts.map(p => p.b));
      const length = Math.max(...parts.map(p => p.a + p.length)) - minA;
      const breadth = Math.max(...parts.map(p => p.b + p.breadth)) - minB;
      footprints.set(node.id, { length, breadth, parts, minA, minB, nested, start: indexes[0], end: indexes.at(-1) });
      const phaseOrder = grid ? phaseIndex.get(node.phaseId) : undefined;
      if (grid && phaseOrder === undefined) throw new Error(`Unresolved phase membership: ${node.id}`);
      return { ...node, cell: `${indexes[0]}:${indexes.at(-1)}`, cellOrder: indexes[0],
        ...(grid ? { phaseOrder } : {}) };
    });
    const memberIds = new Set(members.map(n => n.id));
    const projected = id => nodes.get(id)?.hostId || id;
    const scopeEdges = input.edges.filter(e => e.type === 'bpmn:SequenceFlow' && memberIds.has(projected(e.source)) && memberIds.has(projected(e.target)))
      .map(e => ({ ...e, source: projected(e.source), target: projected(e.target) }));
    let ranked = assignConstrainedLayers({ nodes: localNodes, edges: scopeEdges },{
      feedbackExchange:options.feedbackExchange?.scopeId===scopeId?options.feedbackExchange:undefined
    });
    // Post-compaction ordering must not pin nodes back to their original ranks.
    if(options.compactRanks) ranked = compactLayerRanks(ranked,{fixedIds:(options.orderingPrecedence||[])
      .filter(rule=>rule.scopeId===scopeId&&rule.rankStage!=='compacted').flatMap(rule=>[rule.before,rule.after])});
    // Shared-row subprocesses stretch with lane boundaries, so overlapping
    // row spans cannot share a column with them. Allocate columns before sizing.
    const rankGroups = new Map();
    for (const node of ranked.nodes) {
      if (!rankGroups.has(node.rank)) rankGroups.set(node.rank, []);
      rankGroups.get(node.rank).push(node);
    }
    let nextRank = 0;
    for (const [, group] of [...rankGroups].sort((a,b) => a[0]-b[0])) {
      const columns = [];
      for (const node of group.sort(compareId)) {
        const f = footprints.get(node.id);
        const conflicts = other => {
          const g = footprints.get(other.id);
          return (f.nested?.sharedRows || g.nested?.sharedRows) && f.start <= g.end && g.start <= f.end;
        };
        let column = columns.findIndex(nodes => !nodes.some(conflicts));
        if (column < 0) { column = columns.length; columns.push([]); }
        columns[column].push(node);
        node.rank = nextRank + column;
      }
      nextRank += columns.length;
    }
    for (const phase of ranked.phaseRanks) {
      const ranks = ranked.nodes.filter(node => node.phaseOrder === phase.phaseOrder).map(node => node.rank);
      phase.start = Math.min(...ranks);
      phase.count = Math.max(...ranks)-phase.start+1;
    }
    const precedence=(options.orderingPrecedence||[]).filter(rule=>rule.scopeId===scopeId).map(rule=>[rule.before,rule.after]);
    const ordered = orderConstrainedLayers({...ranked,precedence:[...(ranked.precedence||[]),...precedence]});
    const rankById = new Map(ranked.nodes.map(n => [n.id, n.rank]));
    const rankBefore = ordered.layers.map(layer => Math.max(0, ...layer.map(id => {
      const f=footprints.get(id);return f.parts[0].length/2-f.minA;
    })));
    const rankAfter = ordered.layers.map(layer => Math.max(0, ...layer.map(id => {
      const f=footprints.get(id);return f.length-(f.parts[0].length/2-f.minA);
    })));
    const rankSizes = rankBefore.map((before,i) => before+rankAfter[i]);
    const gapEdges = Array.from({ length: Math.max(0, rankSizes.length - 1) }, () => []);
    const feedbackIds = new Set(ranked.feedback.map(e => e.id));
    for (const edge of scopeEdges) {
      if (feedbackIds.has(edge.id)) continue;
      for (let rank = rankById.get(edge.source); rank < rankById.get(edge.target); rank++) gapEdges[rank].push(edge.id);
    }
    const gapSizes = gapEdges.map(ids => Math.max(options.minimumLayerDistance,
      ...demands.filter(demand => ids.includes(demand.edgeId)).map(demand => demand.minAlongGap),
      2 * options.nodeToEdgeDistance + ids.length * options.edgeDistance,
      ...ids.flatMap(id => (labelsByTarget.get(id) || []).map(label => logicalSize(label).length + 2 * options.nodeToEdgeDistance))));
    const pad = Math.max(subprocess ? options.subprocessMargin : options.lanePadding, options.nodeToEdgeDistance + options.edgeDistance);
    const rowPads = rowIds.map(id => Math.max(pad, ...demands.filter(demand => !demand.rowIds.length || demand.rowIds.includes(id)).map(demand => demand.minAcrossPadding)));
    const leading = subprocess ? pad + (horizontal ? 0 : 24) : scopeId === null ? pad : options.participantLabelSpace * (explicitRows.length ? 2 : 1) + pad;
    const top = subprocess && horizontal ? 24 : 0;
    const rankStarts = [], phases = [];
    const phaseGapSizes=[...gapSizes];
    let length = 0;
    if (grid) {
      for (let i = 0; i < grid.phaseIds.length; i++) {
        const phase = ranked.phaseRanks.find(p => p.phaseOrder === i);
        const start = length;
        length += i === 0 ? leading : pad;
        if (phase) for (let rank = phase.start; rank < phase.start + phase.count; rank++) {
          rankStarts[rank] = length;
          // Both Phase pads already occupy the inter-layer corridor.
          if(options.compactPhaseGaps&&i+1<grid.phaseIds.length&&rank===phase.start+phase.count-1)
            phaseGapSizes[rank]=Math.max(0,(gapSizes[rank]||0)-2*pad);
          length += rankSizes[rank] + (phaseGapSizes[rank] || 0);
        }
        else length += options.defaultNodeWidth;
        length += pad;
        phases.push({ id: grid.phaseIds[i], a: start, length: length - start });
      }
    } else {
      length = leading;
      rankSizes.forEach((size, i) => { rankStarts.push(length); length += size + (gapSizes[i] || 0); });
      length += pad;
    }
    const rowVariables = rowIds.map((_, i) => `row:${i}`).concat(`row:${rowIds.length}`);
    const nominalColumns=ordered.layers.map((layer,rank)=>({rank,nodeIds:[...layer],before:rankBefore[rank],after:rankAfter[rank],
      center:rankStarts[rank]+rankBefore[rank],gapAfter:rank+1<rankSizes.length?rankStarts[rank+1]-rankStarts[rank]-rankSizes[rank]:0}));
    const alongWithinRank = new Map();
    const alongEdits = ordered.layers.flatMap((layer,rank) => {
      const edited=layer.filter(id=>offsets.get(id)?.along).sort();
      if(!edited.length) return [];
      const shift=Math.min(...edited.map(id=>offsets.get(id).along));
      for(const id of edited) alongWithinRank.set(id,offsets.get(id).along-shift);
      // Reserve each edited footprint inside the rank before solving gaps and
      // Phase boundaries; distinct edits must not collapse to one shared value.
      rankAfter[rank]=Math.max(...layer.map(id=>{
        const f=footprints.get(id);
        return f.length-(f.parts[0].length/2-f.minA)+(alongWithinRank.get(id)||0);
      }));
      rankSizes[rank]=rankBefore[rank]+rankAfter[rank];
      return [{id:`rank:${rank}`,value:rankStarts[rank]+shift}];
    });
    if (alongEdits.length) {
      const variables=['origin','end',...rankStarts.map((_,i)=>`rank:${i}`)], distances=[];
      const nominal=rankStarts.map((value,i)=>({id:`rank:${i}`,value}));
      const hardGap=rank=>Math.max(2*options.nodeToEdgeDistance+gapEdges[rank].length*options.edgeDistance,
        ...demands.filter(d=>gapEdges[rank].includes(d.edgeId)).map(d=>d.minAlongGap),
        ...gapEdges[rank].flatMap(id=>(labelsByTarget.get(id)||[]).map(label=>logicalSize(label).length+2*options.nodeToEdgeDistance)));
      if (grid) {
        variables.push(...grid.phaseIds.map((_,i)=>`phase:${i}`));
        distances.push(['origin','phase:0',0]);
        phases.forEach((phase,i)=>{
          const ranks=ranked.phaseRanks.find(p=>p.phaseOrder===i);
          const end=i+1<phases.length?`phase:${i+1}`:'end';
          nominal.push({id:`phase:${i}`,value:phase.a});
          if (!ranks) {distances.push([`phase:${i}`,end,phase.length]);return;}
          const last=ranks.start+ranks.count-1;
          distances.push([`phase:${i}`,`rank:${ranks.start}`,i===0?leading:pad]);
          for(let rank=ranks.start;rank<last;rank++) distances.push([`rank:${rank}`,`rank:${rank+1}`,rankSizes[rank]+hardGap(rank)]);
          distances.push([`rank:${last}`,end,rankSizes[last]+(phaseGapSizes[last]||0)+pad]);
        });
      } else if(rankStarts.length) {
        distances.push(['origin','rank:0',leading]);
        for(let rank=0;rank+1<rankStarts.length;rank++) distances.push([`rank:${rank}`,`rank:${rank+1}`,rankSizes[rank]+hardGap(rank)]);
        distances.push([`rank:${rankStarts.length-1}`,'end',rankSizes.at(-1)+pad]);
      }
      const wanted=new Set(alongEdits.map(p=>p.id));
      const solved=solvePreferredCoordinates(variables,distances,[{id:'origin',value:0},...alongEdits,...nominal.filter(p=>!wanted.has(p.id))]);
      rankStarts.forEach((_,i)=>{rankStarts[i]=solved.positions.get(`rank:${i}`);});
      length=solved.positions.get('end');
      phases.forEach((phase,i)=>{phase.a=solved.positions.get(`phase:${i}`);phase.length=(i+1<phases.length?solved.positions.get(`phase:${i+1}`):length)-phase.a;});
      for(const preference of alongEdits) {
        const rank=Number(preference.id.slice(5)),actual=solved.positions.get(preference.id);
        if(actual===preference.value) continue;
        for(const id of ordered.layers[rank].filter(id=>offsets.get(id)?.along).sort()) {
          const inset=rankBefore[rank]-footprints.get(id).parts[0].length/2+(alongWithinRank.get(id)||0);
          adjustedOffsets.push({id:`node:${id}`,scopeId,axis:'along',requested:preference.value+inset,actual:actual+inset});
        }
      }
    }
    const nodeVariable = id => `node:${id}`;
    const distances = rowIds.map((_, i) => [rowVariables[i], rowVariables[i+1], subprocess ? 2 * pad : 64]);
    const tracks = rowIds.map(() => []), nodeTrack = new Map();
    for (const layer of ordered.layers) {
      const next = rowIds.map(() => 0);
      for (const id of layer) {
        const f = footprints.get(id);
        if (f.start !== f.end) continue;
        const index = next[f.start]++;
        const before = f.parts[0].breadth / 2 - f.minB, after = f.breadth - before;
        const track = tracks[f.start][index] ||= {before:0,after:0};
        track.before = Math.max(track.before,before); track.after = Math.max(track.after,after);
        nodeTrack.set(id,{index,before});
      }
    }
    const trackGap = Math.max(options.nodeDistance, 2 * options.nodeToEdgeDistance + options.edgeDistance);
    tracks.forEach((row,i) => {
      let offset = rowPads[i];
      row.forEach(track => {track.center=offset+track.before;offset+=track.before+track.after+trackGap;});
      if(row.length) distances.push([rowVariables[i],rowVariables[i+1],offset-trackGap+rowPads[i]]);
    });
    for (const layer of ordered.layers) {
      const packed = [...layer].sort((a, b) => footprints.get(a).start - footprints.get(b).start || layer.indexOf(a) - layer.indexOf(b));
      for (let i = 0; i < packed.length; i++) {
        const id = packed[i], footprint = footprints.get(id);
        const track = nodeTrack.get(id);
        const inset = track ? tracks[footprint.start][track.index].center - track.before : rowPads[footprint.start];
        distances.push([rowVariables[footprint.start], nodeVariable(id), inset]);
        distances.push([nodeVariable(id), rowVariables[footprint.end+1], footprint.breadth + rowPads[footprint.end]]);
        if (footprint.nested?.sharedRows && footprint.end > footprint.start) {
          const cuts = footprint.nested.rowCuts;
          distances.push([nodeVariable(id), rowVariables[footprint.start+1], cuts[1] - footprint.minB]);
          for (let row=1; row<cuts.length-2; row++)
            distances.push([rowVariables[footprint.start+row],rowVariables[footprint.start+row+1],cuts[row+1]-cuts[row]]);
          distances.push([rowVariables[footprint.end],rowVariables[footprint.end+1],
            footprint.breadth + footprint.minB - cuts.at(-2) + rowPads[footprint.end]]);
        }
        for (let j = 0; j < i; j++) {
          const previous = footprints.get(packed[j]);
          if (previous.end >= footprint.start) distances.push([nodeVariable(packed[j]), nodeVariable(id), previous.breadth +
            Math.max(options.nodeDistance, 2 * options.nodeToEdgeDistance + options.edgeDistance)]);
        }
      }
    }
    const coordinateIds=[...rowVariables, ...members.map(n => nodeVariable(n.id))];
    let positions = minimumCoordinates(coordinateIds, distances);
    if(options.alignConnectedCenters) {
      // Keep row boundaries fixed; only use spare room within ordered tracks.
      const center=id=>positions.get(nodeVariable(id))-footprints.get(id).minB+footprints.get(id).parts[0].breadth/2;
      const adjacent=new Map(members.map(node=>[node.id,[]]));
      for(const edge of scopeEdges) {
        adjacent.get(edge.source)?.push(edge.target);
        adjacent.get(edge.target)?.push(edge.source);
      }
      const preferences=rowVariables.map(id=>({id,value:positions.get(id)}));
      for(const node of [...members].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
        const footprint=footprints.get(node.id);
        const neighbors=adjacent.get(node.id)
          .filter(id=>id!==node.id&&footprints.has(id)&&footprints.get(id).start===footprint.start&&footprints.get(id).end===footprint.end)
          .map(center).sort((a,b)=>a-b);
        if(!neighbors.length) continue;
        const lower=neighbors[Math.floor((neighbors.length-1)/2)],upper=neighbors[Math.floor(neighbors.length/2)];
        const target=Math.max(lower,Math.min(center(node.id),upper));
        preferences.push({id:nodeVariable(node.id),value:target+footprint.minB-footprint.parts[0].breadth/2});
      }
      positions=solvePreferredCoordinates(coordinateIds,distances,preferences).positions;
    }
    const acrossEdits=members.filter(n=>offsets.get(n.id)?.across).map(n=>({id:nodeVariable(n.id),value:positions.get(nodeVariable(n.id))+offsets.get(n.id).across}));
    if(acrossEdits.length) {
      const wanted=new Set(acrossEdits.map(p=>p.id));
      const nominal=members.map(n=>({id:nodeVariable(n.id),value:positions.get(nodeVariable(n.id))})).filter(p=>!wanted.has(p.id));
      const solved=solvePreferredCoordinates(coordinateIds,distances,[...acrossEdits,...nominal]);
      positions=solved.positions;
      adjustedOffsets.push(...solved.adjusted.filter(p=>wanted.has(p.id)).map(p=>({...p,scopeId,axis:'across'})));
    }
    // Row padding already reserves one obstacle-clear routing channel.
    const feedbackChannels = allocateFeedbackChannels(scopeEdges.filter(edge=>feedbackIds.has(edge.id)),rankById);
    const feedbackSpace = Math.max(0, feedbackChannels.count - 1) * options.edgeDistance;
    const breadth = top + positions.get(rowVariables.at(-1)) + feedbackSpace;
    const rowCuts = rowVariables.map(id => top + positions.get(id));
    // Bottom-up measurements become top-down coordinates using shared lane
    // boundaries. This projection is completed before any routing or model edit.
    const project = (targetCuts = rowCuts) => {
    const boxes = [];
    for (const node of members) {
      const f = footprints.get(node.id), rank = rankById.get(node.id);
      const a = rankStarts[rank] + rankBefore[rank] - f.parts[0].length / 2 + (alongWithinRank.get(node.id) || 0);
      const b = top + positions.get(nodeVariable(node.id)) - f.minB + targetCuts[f.start] - rowCuts[f.start];
      let bodyBreadth = f.parts[0].breadth, nestedBoxes = f.nested?.boxes;
      if (f.nested?.sharedRows && f.end > f.start) {
        const outside = f.breadth + f.minB - bodyBreadth;
        bodyBreadth = targetCuts[f.end+1] - rowPads[f.end] - outside - b;
        const nestedCuts = [f.nested.rowCuts[0],
          ...targetCuts.slice(f.start+1,f.end+1).map(cut => cut-b),
          bodyBreadth-f.nested.feedbackSpace];
        nestedBoxes = projectors.get(node.id)(nestedCuts);
      }
      const growth = bodyBreadth-f.parts[0].breadth;
      for (const part of f.parts) boxes.push({ ...part, anchor:node.id, a: a + part.a,
        b: b + part.b + growth*(part.stretchB || 0),
        ...(part.id===node.id ? {breadth:bodyBreadth} : {}) });
      if (nestedBoxes) for (const box of nestedBoxes) boxes.push({ ...box, anchor:node.id, a: a + box.a, b: b + box.b });
    }
    if (explicitRows.length) rowIds.forEach((id, i) => boxes.push({ id, kind: 'container',
      a: options.participantLabelSpace, b: targetCuts[i],
      length: length - options.participantLabelSpace,
      breadth: targetCuts[i+1] - targetCuts[i] + (i === rowIds.length - 1 ? feedbackSpace : 0) }));
    const remainingLanes = input.containers.filter(container => container.type === 'bpmn:Lane' && !explicitRows.includes(container.id));
    for (let pass = 0; pass < remainingLanes.length; pass++) {
      let added = false;
      for (const lane of remainingLanes) {
        if (boxes.some(box => box.id === lane.id)) continue;
        const children = input.containers.filter(container => container.parentId === lane.id && container.type === 'bpmn:Lane');
        const childBoxes = children.map(child => boxes.find(box => box.id === child.id));
        if (!children.length || childBoxes.some(box => !box)) continue;
        const start = Math.min(...childBoxes.map(box => box.b));
        boxes.push({ id: lane.id, kind: 'container', a: options.participantLabelSpace, b: start,
          length: length - options.participantLabelSpace, breadth: Math.max(...childBoxes.map(box => box.b + box.breadth)) - start });
        added = true;
      }
      if (!added) break;
    }
    return boxes;
    };
    projectors.set(scopeId,project);
    const boxes = project();
    const columns = ordered.layers.map((layer,rank) => ({rank,nodeIds:[...layer],before:rankBefore[rank],after:rankAfter[rank],
      center:rankStarts[rank]+rankBefore[rank],gapAfter:rank+1<rankSizes.length?rankStarts[rank+1]-rankStarts[rank]-rankSizes[rank]:0}));
    const result = { scopeId, length, breadth, boxes, rows: rowIds, columns, nominalColumns, rowCuts, sharedRows,
      ranking: ranked, ordering: ordered, gaps: gapEdges.map((edgeIds, i) => ({
        a: rankStarts[i] + rankSizes[i], length: rankStarts[i+1] - rankStarts[i] - rankSizes[i], edgeIds })), feedbackSpace,
      phases, feedbackChannels };
    results.set(scopeId, result); active.delete(scopeId);
    return result;
  };

  const participantIds = [...constraints.participantIds];
  if (scopedNodes.has(null)) participantIds.push(null);
  for (const scopeId of scopedNodes.keys()) if (scopeId !== null && !nodes.has(scopeId) && !participantIds.includes(scopeId)) participantIds.push(scopeId);
  let roots = participantIds.map(calculateScope);
  const messages = input.edges.filter(edge => edge.type === 'bpmn:MessageFlow');
  let collaboration = {accepted:[],rejected:[]};
  if (messages.length && roots.length > 1) {
    const editedColumns=roots.flatMap(root=>root.columns.filter(column=>column.nodeIds.some(id=>offsets.get(id)?.along))
      .map(column=>({root,column,id:JSON.stringify([root.scopeId,column.rank])})));
    let preferences=[];
    if(editedColumns.length) {
      const nominalRoots=roots.map(root=>({...root,columns:root.nominalColumns}));
      const baseline=solveCollaborationColumns(nominalRoots,messages);
      preferences=editedColumns.map(({root,column,id})=>({id,value:root.nominalColumns[column.rank].center+baseline.offsets.get(id)+
        Math.min(...column.nodeIds.filter(id=>offsets.get(id)?.along).map(id=>offsets.get(id).along))}));
      // Local rank clamping precedes collaboration and is not authoritative
      // for a root edit whose baseline was shifted by message alignment.
      for(let i=adjustedOffsets.length-1;i>=0;i--) if(adjustedOffsets[i].axis==='along'&&roots.some(root=>root.scopeId===adjustedOffsets[i].scopeId)) adjustedOffsets.splice(i,1);
    }
    const solved = solveCollaborationColumns(roots,messages,preferences);
    for(const adjustment of solved.adjusted) {
      const {root,column}=editedColumns.find(item=>item.id===adjustment.id);
      for(const id of column.nodeIds.filter(id=>offsets.get(id)?.along)) {
        const inset=root.boxes.find(box=>box.id===id).a-column.center;
        adjustedOffsets.push({id:`node:${id}`,scopeId:root.scopeId,axis:'along',requested:adjustment.requested+inset,actual:adjustment.actual+inset});
      }
    }
    collaboration = {accepted:solved.accepted,rejected:solved.rejected};
    roots = roots.map(root => {
      const byNode = new Map();
      root.columns.forEach(column => column.nodeIds.forEach(id => byNode.set(id,solved.offsets.get(JSON.stringify([root.scopeId,column.rank])))));
      const shiftBoundary = coordinate => {
        let delta=0;
        for(const column of root.columns) if(column.center<=coordinate) delta=solved.offsets.get(JSON.stringify([root.scopeId,column.rank]));
        return coordinate+delta;
      };
      const length=shiftBoundary(root.length);
      const boxes=root.boxes.map(box => box.anchor ? {...box,a:box.a+byNode.get(box.anchor)} :
        box.kind==='container'?{...box,length:length-box.a}:box);
      const phases=root.phases.map(phase=>({...phase,a:shiftBoundary(phase.a),length:shiftBoundary(phase.a+phase.length)-shiftBoundary(phase.a)}));
      const columns=root.columns.map(column=>({...column,center:column.center+solved.offsets.get(JSON.stringify([root.scopeId,column.rank]))}));
      const gaps=root.gaps.map((gap,i)=>({...gap,a:columns[i].center+columns[i].after,
        length:columns[i+1]?columns[i+1].center-columns[i+1].before-columns[i].center-columns[i].after:gap.length}));
      const projected={...root,boxes,phases,length,columns,gaps};
      results.set(root.scopeId,projected);return projected;
    });
  }
  const commonLength = Math.max(0, ...roots.map(root => root.length));
  let across = 0;
  const logicalBoxes = [], rootBounds = [];
  for (const root of roots) {
    const header = constraints.phaseGrids.some(g => g.participantId === root.scopeId) ? 30 : 0;
    across += header;
    rootBounds.push({scopeId:root.scopeId,x:horizontal?0:across,y:horizontal?across:0,
      width:horizontal?commonLength:root.breadth,height:horizontal?root.breadth:commonLength});
    if (root.scopeId !== null) logicalBoxes.push({ id: root.scopeId, kind: 'container', a: 0, b: across, length: commonLength, breadth: root.breadth });
    for (const box of root.boxes) logicalBoxes.push({ ...box, b: box.b + across,
      ...(box.kind === 'container' && root.rows.includes(box.id) ? { length: commonLength - box.a } : {}) });
    const grid = constraints.phaseGrids.find(g => g.participantId === root.scopeId);
    if (grid) {
      logicalBoxes.push({ id: grid.containerId, kind: 'container', a: 0, b: across - header, length: commonLength, breadth: header });
      root.phases.forEach((phase, i) => logicalBoxes.push({ id: phase.id, kind: 'container', a: phase.a, b: across - header,
        length: i === root.phases.length - 1 ? commonLength - phase.a : phase.length, breadth: header }));
    }
    across += root.breadth + options.margin;
  }
  const boxes = logicalBoxes.map(({ a, b, length, breadth, anchor, stretchB, ...box }) => ({ ...box,
    x: horizontal ? a : b, y: horizontal ? b : a,
    width: horizontal ? length : breadth, height: horizontal ? breadth : length })).sort(compareId);
  if (new Set(boxes.map(box => box.id)).size !== boxes.length) throw new Error('Duplicate output geometry');
  const placedIds = new Set(boxes.map(box => box.id));
  for (const node of input.nodes) if (!placedIds.has(node.id)) throw new Error(`Unplaced node: ${node.id}`);
  return { horizontal, boxes, rootBounds, scopes: [...results.values()], collaboration, adjustedOffsets,
    metrics: { crossingsBefore: [...results.values()].reduce((sum, scope) => sum + scope.ordering.metrics.before, 0),
      crossingsAfter: [...results.values()].reduce((sum, scope) => sum + scope.ordering.metrics.after, 0) } };
}
