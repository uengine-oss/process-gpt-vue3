import {captureRotationBaseline,captureUnlaidRotationBaseline} from './rotation-edits.js';
import {measureLayoutStage} from './layout-profile.js';

const COMMAND = 'uengine.structuredLayout';
const registered = new WeakSet();
const rootOrientations = new WeakMap();
const rootEditBaselines = new WeakMap();
export function getRotationEditBaseline(modeler) {
  return rootEditBaselines.get(modeler.get('canvas').getRootElement());
}
export function ensureRotationEditBaseline(modeler) {
  const root=modeler.get('canvas').getRootElement();
  if(!rootEditBaselines.has(root)||!rootEditBaselines.get(root)) {
    const horizontal=getLayoutOrientation(modeler);
    rootEditBaselines.set(root,{horizontal,edited:false,
      nodes:captureUnlaidRotationBaseline(modeler.get('elementRegistry').getAll(),horizontal,root.id)});
  }
  return rootEditBaselines.get(root);
}
export function getLayoutOrientation(modeler) {
  const root=modeler.get('canvas').getRootElement();
  const participant=modeler.get('elementRegistry').getAll().find(element=>element.type==='bpmn:Participant'&&element.parent===root);
  return participant ? participant.di?.isHorizontal ?? participant.width>=participant.height : rootOrientations.get(root) ?? true;
}
const bounds = element => ({x:element.x,y:element.y,width:element.width,height:element.height});
const points = value => value.map(point => ({...point, ...(point.original ? {original:{...point.original}} : {})}));

const captureDi = entries => [...new Set(entries.map(entry => entry.element.di).filter(Boolean))].map(di => ({
  di, bounds:di.bounds, boundsValue:di.bounds && bounds(di.bounds),
  label:di.label, labelBounds:di.label?.bounds, labelValue:di.label?.bounds && bounds(di.label.bounds),
  waypoint:di.waypoint
}));
const restoreDi = snapshots => {
  for (const snapshot of snapshots) {
    const {di} = snapshot;
    di.set('bounds',snapshot.bounds);
    if (snapshot.bounds) Object.assign(snapshot.bounds,snapshot.boundsValue);
    di.set('label',snapshot.label);
    if (snapshot.label) {
      snapshot.label.set('bounds',snapshot.labelBounds);
      if (snapshot.labelBounds) Object.assign(snapshot.labelBounds,snapshot.labelValue);
    }
    if (snapshot.waypoint) di.set('waypoint',snapshot.waypoint);
  }
};

function StructuredLayoutHandler(bpmnUpdater,eventBus) {
  this._updater = bpmnUpdater;
  // The renderer's shape.changed listener updates external label DI. Restore
  // the transaction snapshot after that synchronous flush, including undo of
  // imported labels whose rendered size differs from their original XML.
  eventBus.on('commandStack.changed',500,() => {
    if (!this._pendingDi) return;
    restoreDi(this._pendingDi);
    this._pendingDi = null;
  });
}
StructuredLayoutHandler.$inject = ['bpmnUpdater','eventBus'];

StructuredLayoutHandler.prototype.write = function(entries) {
  // All geometry is assigned before DI synchronization or redraw. No modeling
  // move/resize behavior may reroute a connection from a partial placement.
  for (const entry of entries) {
    if (entry.waypoints) entry.element.waypoints = points(entry.waypoints);
    else Object.assign(entry.element,entry.bounds);
    if (entry.labelParent) entry.element.parent = entry.labelParent.value;
    if (entry.orientation) entry.element.di.isHorizontal = entry.orientation.value;
  }
  for (const entry of entries) {
    if (entry.waypoints) this._updater.updateConnectionWaypoints(entry.element);
    else this._updater.updateBounds(entry.element);
  }
  return entries.map(entry => entry.element);
};
StructuredLayoutHandler.prototype.execute = function(context) {
  try {
    const changed = this.write(context.after);
    context.afterDi ||= captureDi(context.after);
    if (!context.hasAfterEditBaseline) {
      context.afterEditBaseline = typeof context.resolveEditBaseline === 'function'
        ? context.resolveEditBaseline() : context.resolveEditBaseline;
      context.hasAfterEditBaseline = true;
    }
    this._pendingDi = context.afterDi;
    rootOrientations.set(context.orientation.root,context.orientation.after);
    rootEditBaselines.set(context.orientation.root,context.afterEditBaseline);
    return changed;
  } catch (error) {
    this.write(context.before);
    restoreDi(context.beforeDi);
    throw error;
  }
};
StructuredLayoutHandler.prototype.revert = function(context) {
  const changed = this.write(context.before);
  rootOrientations.set(context.orientation.root,context.orientation.before);
  rootEditBaselines.set(context.orientation.root,context.beforeEditBaseline);
  this._pendingDi = context.beforeDi;
  return changed;
};

function executeEntries(modeler,before,after,afterDi,horizontal,resolveEditBaseline) {
  return measureLayoutStage('application',()=>applyEntries(modeler,before,after,afterDi,horizontal,resolveEditBaseline));
}
function applyEntries(modeler,before,after,afterDi,horizontal,resolveEditBaseline) {
  const commandStack = modeler.get('commandStack');
  if (!registered.has(commandStack)) {
    commandStack.registerHandler(COMMAND,StructuredLayoutHandler);
    registered.add(commandStack);
  }
  const orientation={root:modeler.get('canvas').getRootElement(),before:getLayoutOrientation(modeler),after:horizontal};
  const beforeEditBaseline=rootEditBaselines.get(orientation.root);
  modeler.get('atomicModeling').execute(() => commandStack.execute(COMMAND,{before,after,beforeDi:captureDi(before),afterDi,orientation,
    beforeEditBaseline,resolveEditBaseline}));
}



function currentEntry(element) {
  const orientation=element.di&&['bpmn:Participant','bpmn:Lane','phase:Phase','phase:PhaseContainer'].includes(element.type)
    ? {orientation:{value:element.di.isHorizontal}} : {};
  return element.waypoints ? {element,waypoints:points(element.waypoints)} : {element,bounds:bounds(element),...orientation,
    ...(element.labelTarget?{labelParent:{value:element.parent}}:{})};
}

// This closure can only restore geometry captured from this live model. It is
// separate from computed-plan validation: original XML may contain diagonal
// connections or zero-sized blank labels, and restoration must preserve them.
export function captureLayoutRestore(modeler) {
  const registry=modeler.get('elementRegistry'),root=modeler.get('canvas').getRootElement();
  const activeElements=()=>registry.getAll().filter(element=>{
    let ancestor=element;
    const seen=new Set();
    while(ancestor.parent) {
      if(seen.has(ancestor)) throw new Error('Layout model hierarchy changed');
      seen.add(ancestor);ancestor=ancestor.parent;
    }
    return ancestor===root;
  });
  const captured=activeElements();
  const topology=captured.map(element=>({element,parent:element.parent,source:element.source,target:element.target,host:element.host}));
  const entries=captured.filter(element=>element.di && (element.waypoints || Object.values(bounds(element)).every(Number.isFinite))).map(currentEntry);
  const di=captureDi(entries);
  const horizontal=getLayoutOrientation(modeler);
  const editBaseline=getRotationEditBaseline(modeler);
  return () => {
    if(modeler.get('canvas').getRootElement()!==root || entries.some(entry=>registry.get(entry.element.id)!==entry.element))
      throw new Error('Layout snapshot belongs to a different model');
    const current=new Set(activeElements());
    if(current.size!==captured.length || topology.some(({element,parent,source,target,host})=>
      !current.has(element) || (!element.labelTarget && element.parent!==parent) ||
      element.source!==source || element.target!==target || element.host!==host))
      throw new Error('Layout model topology changed');
    executeEntries(modeler,entries.map(entry=>currentEntry(entry.element)),entries,di,horizontal,editBaseline);
  };
}

export function applyComputedLayout(modeler,plan,{input,nodeOffsets=[]}={}) {
  if (plan.status !== 'computed' || plan.routing?.status !== 'routed') throw new Error('Layout is not complete');
  const registry = modeler.get('elementRegistry');
  const before = [], after = [], seen = new Set();
  const resolve = id => {
    if (seen.has(id)) throw new Error(`Duplicate layout element: ${id}`);
    seen.add(id);
    const element = registry.get(id);
    if (!element) throw new Error(`Missing layout element: ${id}`);
    return element;
  };
  for (const box of [...plan.placement.boxes,...plan.routing.labels]) {
    const element = resolve(box.id), target = bounds(box);
    if (element.waypoints || !Object.values(target).every(Number.isFinite) || target.width <= 0 || target.height <= 0)
      throw new Error(`Invalid layout bounds: ${box.id}`);
    const oriented = element.di && ['bpmn:Participant','bpmn:Lane','phase:Phase','phase:PhaseContainer'].includes(element.type);
    // Custom Phase rendering uses true for vertical, opposite to BPMN pools.
    const horizontal = ['phase:Phase','phase:PhaseContainer'].includes(element.type) ? !plan.placement.horizontal : plan.placement.horizontal;
    before.push({element,bounds:bounds(element),...(oriented?{orientation:{value:element.di.isHorizontal}}:{})});
    after.push({element,bounds:target,...(oriented?{orientation:{value:horizontal}}:{})});
  }
  for (const route of plan.routing.routes) {
    const element = resolve(route.id);
    if (!element.waypoints || route.points.length < 2 || route.points.some((p,i) =>
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || (i && p.x !== route.points[i-1].x && p.y !== route.points[i-1].y)))
      throw new Error(`Invalid layout waypoints: ${route.id}`);
    before.push({element,waypoints:points(element.waypoints)});
    after.push({element,waypoints:points(route.points)});
  }
  // Blank rendered labels are absent from the routing input, but their stale
  // positions still affect SVG export bounds. Keep them with their new target.
  const planned=new Map(after.map(entry=>[entry.element.id,entry]));
  for(const element of registry.getAll()) {
    const target=element.labelTarget,entry=target&&planned.get(target.id);
    const name=target?.businessObject?.name;
    if(!entry||seen.has(element.id)||typeof name!=='string'||name.trim()||element.width!==0||
      !Object.values(bounds(element)).every(Number.isFinite)||element.height<0) continue;
    const anchor=entry.waypoints?entry.waypoints[Math.floor(entry.waypoints.length/2)]:
      {x:entry.bounds.x+entry.bounds.width/2,y:entry.bounds.y+entry.bounds.height/2};
    before.push(currentEntry(element));
    after.push({element,bounds:{...bounds(element),x:anchor.x,y:anchor.y-element.height/2}});
  }
  // Keep the edit reference in the same history entry as the geometry it describes.
  const baseline=input ? () => ({horizontal:plan.placement.horizontal,edited:false,
    nodes:captureRotationBaseline(registry.getAll(),input,plan.placement.horizontal,nodeOffsets)}) : undefined;
  executeEntries(modeler,before,after,undefined,plan.placement.horizontal,baseline);
}
