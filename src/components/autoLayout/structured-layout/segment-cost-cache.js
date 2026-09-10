// One immutable reservation snapshot per search. Costs must be symmetric;
// never reuse this evaluator after reservations or allowed contacts change.
export function cacheSegmentCosts(evaluate,{maxEntries=50000}={}) {
  const cache=new Map();
  let entries=0;
  return (a,b)=>{
    const forward=a.x<b.x||(a.x===b.x&&a.y<=b.y);
    const first=forward?a:b,last=forward?b:a;
    let ys=cache.get(first.x),xs=ys?.get(first.y),ends=xs?.get(last.x);
    const stored=ends?.get(last.y);
    if(stored!==undefined) return stored;
    const cost=evaluate(a,b);
    // Saturation only disables new caching; it never drops search candidates.
    if(entries<maxEntries) {
      if(!ys) cache.set(first.x,ys=new Map());
      if(!xs) ys.set(first.y,xs=new Map());
      if(!ends) xs.set(last.x,ends=new Map());
      if(!ends.has(last.y)) entries++;
      ends.set(last.y,cost);
    }
    return cost;
  };
}
