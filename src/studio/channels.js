const clone=value=>structuredClone(value);
export const channelToken=(id,lane)=>`${id}:${lane}`;
export function stateChannels(state) {
  return ['current','earth',...(state.compassX===undefined?[]:['compass']),...state.points.map(p=>`point-${p.id}`)];
}
export function channelValue(state,lane) {
  if(lane==='compass')return state.compassX??0;
  if(lane.startsWith('point-')){const point=state.points.find(p=>p.id===Number(lane.slice(6)));return point?{...point,opacity:point.opacity??1}:null;}
  return state[lane];
}
export function writeChannel(state,lane,value) {
  if(lane==='compass')state.compassX=value;
  else if(lane.startsWith('point-')) {
    const id=Number(lane.slice(6));state.points=state.points.filter(p=>p.id!==id);
    if(value)state.points.push(clone(value));
  } else state[lane]=value;
}
export function changedChannels(before,after) {
  return [...new Set([...stateChannels(before),...stateChannels(after)])]
    .filter(lane=>JSON.stringify(channelValue(before,lane))!==JSON.stringify(channelValue(after,lane)));
}
/** Migrate full-pose projects while retaining explicit arrival/hold boundaries. */
export function independentFrames(frames) {
  const sorted=[...frames].sort((a,b)=>a.time-b.time);
  const lanes=[...new Set(sorted.flatMap(f=>stateChannels(f.state)))];
  return sorted.map((f,i)=>({...f,channels:f.channels?[...f.channels]:lanes.filter(lane=> {
    if(i===0)return true;
    const value=JSON.stringify(channelValue(f.state,lane));
    return value!==JSON.stringify(channelValue(sorted[i-1].state,lane))||
      (i<sorted.length-1&&value!==JSON.stringify(channelValue(sorted[i+1].state,lane)));
  })}));
}
export function selectedChannels(frames,selection) {
  return frames.flatMap(f=>f.channels.filter(lane=>selection.has(channelToken(f.id,lane))).map(lane=>({id:f.id,lane,time:f.time})));
}
/** Split/merge timestamp containers while moving only selected variable keys. */
export function moveChannels(frames,selection,delta) {
  const keys=selectedChannels(frames,selection);
  if(!keys.length)return null;
  const result=clone(frames),moving=keys.map(key=>({...key,value:channelValue(frames.find(f=>f.id===key.id).state,key.lane)}));
  for(const key of moving) {
    const time=Number((key.time+delta).toFixed(2));
    if(time<0||time>300||frames.some(f=>Math.abs(f.time-time)<.005&&f.channels.includes(key.lane)&&!selection.has(channelToken(f.id,key.lane))))return null;
  }
  for(const key of moving) {
    const frame=result.find(f=>f.id===key.id);frame.channels=frame.channels.filter(lane=>lane!==key.lane);
  }
  let next=Math.max(0,...frames.map(f=>f.id))+1;const selected=new Set();
  for(const key of moving) {
    const time=Number((key.time+delta).toFixed(2));
    let target=result.find(f=>Math.abs(f.time-time)<.005);
    if(!target) {target={...clone(frames.find(f=>f.id===key.id)),id:next++,time,channels:[]};result.push(target);}
    target.channels.push(key.lane);writeChannel(target.state,key.lane,key.value);
    selected.add(channelToken(target.id,key.lane));
  }
  const kept=result.filter(f=>f.channels.length);
  if(kept.length>120)return null;
  return {frames:kept.sort((a,b)=>a.time-b.time),selection:selected};
}
