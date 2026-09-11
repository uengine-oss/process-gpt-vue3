import { solvePreferredCoordinates } from './preferred-coordinates.js';
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;

// Columns carry measured body/label extents. Message alignment is a preference:
// reject a merge if it would contradict a process or phase progression chain.
export function solveCollaborationColumns(roots,messages,preferences=[]) {
  const variables=new Map(),anchors=new Map(),edges=[];
  for(const root of roots) root.columns.forEach((column,index)=>{
    const id=JSON.stringify([root.scopeId,column.rank]);
    variables.set(id,{minimum:index===0?column.center:0,column,scopeId:root.scopeId});
    for(const nodeId of column.nodeIds) anchors.set(nodeId,id);
    if(index) {
      const previous=root.columns[index-1];
      edges.push({source:JSON.stringify([root.scopeId,previous.rank]),target:id,
        distance:previous.after+previous.gapAfter+column.before});
    }
  });
  const fixed=new Map();
  let adjusted=[];
  if(preferences.length) {
    const distances=edges.map(edge=>[edge.source,edge.target,edge.distance]);
    for(const [id,variable] of variables) distances.push(['origin',id,variable.minimum]);
    const solved=solvePreferredCoordinates(['origin',...variables.keys()],distances,
      [{id:'origin',value:0},...preferences]);
    for(const preference of preferences) fixed.set(preference.id,solved.positions.get(preference.id));
    adjusted=solved.adjusted;
  }
  let parent=new Map([...variables.keys()].map(id=>[id,id]));
  const find=(map,id)=>{
    while(map.get(id)!==id) id=map.get(id);
    return id;
  };
  const solve=(map,respectEdits=true)=>{
    const values=new Map(),outgoing=new Map(),degree=new Map();
    for(const [id,variable] of variables) {
      const group=find(map,id);
      values.set(group,Math.max(values.get(group)||0,variable.minimum));
      outgoing.set(group,[]);degree.set(group,0);
    }
    const fixedGroups=new Map();
    if(respectEdits) for(const [id,value] of fixed) {
      const group=find(map,id);
      if(fixedGroups.has(group)&&Math.abs(fixedGroups.get(group)-value)>1e-7) return null;
      fixedGroups.set(group,value);values.set(group,Math.max(values.get(group),value));
    }
    for(const edge of edges) {
      const source=find(map,edge.source),target=find(map,edge.target);
      if(source===target) return null;
      outgoing.get(source).push({target,distance:edge.distance});
      degree.set(target,degree.get(target)+1);
    }
    const queue=[...degree.keys()].filter(id=>degree.get(id)===0).sort(compare);
    for(let i=0;i<queue.length;i++) for(const edge of outgoing.get(queue[i])) {
      values.set(edge.target,Math.max(values.get(edge.target),values.get(queue[i])+edge.distance));
      degree.set(edge.target,degree.get(edge.target)-1);
      if(degree.get(edge.target)===0) queue.push(edge.target);
    }
    if([...fixedGroups].some(([id,value])=>values.get(id)>value+1e-7)) return null;
    return queue.length===values.size?values:null;
  };
  const accepted=[],rejected=[];
  for(const message of [...messages].sort((a,b)=>compare(a.id,b.id))) {
    const source=anchors.get(message.source),target=anchors.get(message.target);
    if(!source||!target) {rejected.push({id:message.id,reason:'no-root-column-anchor'});continue;}
    if(variables.get(source).scopeId===variables.get(target).scopeId) {rejected.push({id:message.id,reason:'same-participant'});continue;}
    const trial=new Map(parent),a=find(trial,source),b=find(trial,target);
    if(a!==b) trial.set(compare(a,b)<0?b:a,compare(a,b)<0?a:b);
    if(!solve(trial)) {rejected.push({id:message.id,reason:fixed.size&&solve(trial,false)?'edit-priority':'progression-order'});continue;}
    parent=trial;accepted.push(message.id);
  }
  const solution=solve(parent);
  if(!solution) throw new Error('Invalid participant column constraints');
  const offsets=new Map();
  for(const [id,variable] of variables) offsets.set(id,solution.get(find(parent,id))-variable.column.center);
  return {offsets,accepted,rejected,adjusted};
}
