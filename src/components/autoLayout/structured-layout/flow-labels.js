import {measureLayoutStage} from './layout-profile.js';

const EPS=1e-7;
const overlaps=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+EPS&&
  Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+EPS;
const lineHits=(a,b,r)=>Math.abs(a.x-b.x)<EPS?
  a.x>r.x+EPS&&a.x<r.x+r.width-EPS&&Math.min(a.y,b.y)<r.y+r.height-EPS&&Math.max(a.y,b.y)>r.y+EPS:
  a.y>r.y+EPS&&a.y<r.y+r.height-EPS&&Math.min(a.x,b.x)<r.x+r.width-EPS&&Math.max(a.x,b.x)>r.x+EPS;

// Evaluate label occupancy before accepting a whole path. No model or existing
// label position is consulted, and a rejected label is never hidden or clipped.
export function placeFlowLabels(...args) {
  return measureLayoutStage('labels.flow',()=>placeLabels(...args));
}
function placeLabels(labels,points,{bounds,preferredBounds,obstacles,segments=[],gap=7}) {
  const ownSegments=points.slice(1).map((point,i)=>[points[i],point]);
  const occupied=[...obstacles],placed=[];
  for(const label of [...labels].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
    if(![label.width,label.height].every(n=>Number.isFinite(n)&&n>0)) throw new Error(`Invalid flow label: ${label.id}`);
    const candidates=[];
    ownSegments.forEach(([a,b],index)=>{
      const vertical=Math.abs(a.x-b.x)<EPS;
      const low=vertical?Math.min(a.y,b.y):Math.min(a.x,b.x),high=vertical?Math.max(a.y,b.y):Math.max(a.x,b.x);
      const size=vertical?label.height:label.width;
      const anchors=[(low+high)/2,Math.min(high,low+size/2),Math.max(low,high-size/2)];
      for(const anchor of [...new Set(anchors)]) for(const side of [1,-1]) candidates.push({
        id:label.id,targetId:label.targetId,kind:'label',width:label.width,height:label.height,
        x:vertical?a.x+(side>0?gap:-gap-label.width):anchor-label.width/2,
        y:vertical?anchor-label.height/2:a.y+(side>0?gap:-gap-label.height),
        score:index+Math.abs(anchor-(low+high)/2)/Math.max(1,high-low)
      });
    });
    const outsidePreferred=box=>preferredBounds&&
      (box.x<preferredBounds.x-EPS||box.y<preferredBounds.y-EPS||
       box.x+box.width>preferredBounds.x+preferredBounds.width+EPS||
       box.y+box.height>preferredBounds.y+preferredBounds.height+EPS)?1:0;
    candidates.sort((a,b)=>outsidePreferred(a)-outsidePreferred(b)||a.score-b.score);
    const candidate=candidates.find(box=>{
      if(box.x<bounds.x-EPS||box.y<bounds.y-EPS||box.x+box.width>bounds.x+bounds.width+EPS||box.y+box.height>bounds.y+bounds.height+EPS) return false;
      if(occupied.some(obstacle=>overlaps(box,obstacle))) return false;
      const padded={x:box.x-gap,y:box.y-gap,width:box.width+2*gap,height:box.height+2*gap};
      return ![...segments,...ownSegments].some(([a,b])=>lineHits(a,b,padded));
    });
    if(!candidate) return {status:'needs-space',labelId:label.id,width:label.width,height:label.height};
    const {score,...box}=candidate;
    placed.push(box);
    occupied.push({x:box.x-gap,y:box.y-gap,width:box.width+2*gap,height:box.height+2*gap});
  }
  return {status:'placed',labels:placed};
}
