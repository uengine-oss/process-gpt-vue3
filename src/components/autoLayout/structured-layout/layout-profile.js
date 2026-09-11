let activeProfile=null;

// Layout calculation is synchronous. Keep diagnostics outside semantic options
// and cache keys; nested diagnostic sessions restore their caller's collector.
export function runLayoutProfile(operation,{now=()=>performance.now()}={}) {
  const previous=activeProfile;
  const profile={now,frames:[],stages:new Map()};
  activeProfile=profile;
  try {
    const result=measureLayoutStage('total',operation);
    if(result&&typeof result.then==='function') throw new TypeError('Layout profiling requires a synchronous operation');
    return {result,profile:{totalMs:profile.stages.get('total').inclusiveMs,
      stages:[...profile.stages.values()].sort((a,b)=>a.stage.localeCompare(b.stage))}};
  } finally {activeProfile=previous;}
}

export function measureLayoutStage(stage,operation) {
  const profile=activeProfile;
  if(!profile) return operation();
  const frame={start:profile.now(),childrenMs:0};
  profile.frames.push(frame);
  let failed=true;
  try {
    const result=operation();failed=false;return result;
  } finally {
    const elapsed=profile.now()-frame.start;
    profile.frames.pop();
    if(profile.frames.length) profile.frames.at(-1).childrenMs+=elapsed;
    if(!profile.stages.has(stage)) profile.stages.set(stage,{stage,calls:0,failedCalls:0,inclusiveMs:0,exclusiveMs:0});
    const row=profile.stages.get(stage);
    row.calls++;row.failedCalls+=Number(failed);row.inclusiveMs+=elapsed;
    row.exclusiveMs+=Math.max(0,elapsed-frame.childrenMs);
  }
}
