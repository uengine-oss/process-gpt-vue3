import {capturePhaseGrid} from '../bpmn-auto-layout/phase-grid.js';
import {captureLayoutInput} from './layout-input.js';
import {captureScopeConstraints} from './scope-constraints.js';
import {planCoordinatedLayout} from './coordinated-layout.js';
import {validateLayoutPlan} from './validate-layout.js';
import {applyComputedLayout,getLayoutOrientation} from './apply-layout.js';
import {measureLayoutStage} from './layout-profile.js';

const sessions=new WeakMap();

function sessionFor(modeler) {
  if(sessions.has(modeler)) return sessions.get(modeler);
  const session={root:null,constraints:null,baselineCache:new Map()};
  sessions.set(modeler,session);
  modeler.get('eventBus').on('import.done',()=>{session.root=null;session.constraints=null;session.baselineCache.clear();});
  modeler.get('eventBus').on('commandStack.changed',()=>{
    if(!modeler.get('atomicModeling').isExecuting()) session.constraints=null;
  });
  return session;
}

// Re-read semantic elements and dimensions, but never infer a new Phase/row
// assignment from coordinates produced by our own layout or orientation change.
function captureModelerState(modeler) {
  return measureLayoutStage('input',()=>readModelerState(modeler));
}
function readModelerState(modeler) {
  const session=sessionFor(modeler),root=modeler.get('canvas').getRootElement();
  const elements=modeler.get('elementRegistry').getAll();
  const active=captureLayoutInput(elements,{rootId:root.id});
  const activeIds=new Set([...active.nodes,...active.containers].map(e=>e.id));
  if(session.root!==root) session.baselineCache.clear();
  if(session.root!==root||!session.constraints) {
    const participants=elements.filter(e=>activeIds.has(e.id)&&e.type==='bpmn:Participant');
    const currentHorizontal=participants[0]?.di?.isHorizontal ?? getLayoutOrientation(modeler);
    const grids=capturePhaseGrid(elements.filter(e=>activeIds.has(e.id)),currentHorizontal).map(grid=>({
      participantId:grid.participant.id,containerId:grid.container.id,phaseIds:grid.phases.map(p=>p.id),
      membership:[...grid.membership].map(([id,index])=>[id,grid.phases[index].id])
    }));
    session.constraints=captureScopeConstraints(elements.filter(e=>activeIds.has(e.id)),{horizontal:currentHorizontal,phaseGrids:grids});
    session.root=root;
  }
  const constraints=session.constraints;
  const input=captureLayoutInput(elements,{rootId:root.id,phaseMembership:new Map(constraints.phaseGrids.flatMap(grid=>grid.membership))});
  return {input,constraints,elements,session};
}

export function validateModelerSnapshot(modeler) {
  const {input,constraints,elements}=captureModelerState(modeler);
  const byId=new Map(elements.map(element=>[element.id,element]));
  const ids=new Set([...input.nodes,...input.containers,...input.labels,...(input.artifacts||[])].map(shape=>shape.id));
  const boxes=[...ids].map(id=>{
    const {x,y,width,height}=byId.get(id);
    return {id,x,y,width,height};
  });
  const routes=input.edges.map(edge=>({id:edge.id,points:(byId.get(edge.id).waypoints||[]).map(p=>({x:p.x,y:p.y}))}));
  // A root process has no enclosing visible rectangle; include all its geometry.
  const points=[...boxes.flatMap(b=>[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y+b.height}]),...routes.flatMap(r=>r.points)];
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  const rootBounds=points.length?[{scopeId:null,x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y}]:[];
  return validateLayoutPlan(input,{status:'computed',
    placement:{boxes,rootBounds,horizontal:getLayoutOrientation(modeler)},
    routing:{status:'routed',routes,labels:[]}},constraints);
}

export function computeModelerLayout(modeler,{horizontal=true,...options}={}) {
  const {input,constraints,session}=captureModelerState(modeler);
  const plan=planCoordinatedLayout(input,constraints,{...options,horizontal,baselineCache:session.baselineCache});
  const errors=validateLayoutPlan(input,plan,constraints);
  return {input,constraints,plan:errors.length?{...plan,status:plan.status==='computed'?'invalid':plan.status,validationErrors:errors}:plan};
}

export function layoutModeler(modeler,options={}) {
  const result=computeModelerLayout(modeler,options);
  if(result.plan.status==='computed') applyComputedLayout(modeler,result.plan,{input:result.input,nodeOffsets:options.nodeOffsets});
  return result;
}
