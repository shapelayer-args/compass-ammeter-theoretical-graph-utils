import { independentFrames, channelValue, stateChannels } from './channels.js';
import { clamp } from "../utils.js";
const clone = value => structuredClone(value);
const lerp = (a, b, t) => a + (b - a) * t;
export function validateFrames(value) {
    if (!Array.isArray(value) || value.length > 120) throw Error('키프레임은 최대 120개까지 사용할 수 있습니다.');
    const times = new Set();
    const validated = value.map((f, index) => {
      if (!Number.isFinite(f.time) || f.time < 0 || f.time > 300 || times.has(f.time)) throw Error('키프레임 시간은 중복 없이 0~300초로 지정하세요.');
      times.add(f.time);
      const s = f.state;
      if (!s || !Number.isFinite(s.current) || Math.abs(s.current) > 1e6 || !Number.isFinite(s.earth) || s.earth < .05 || s.earth > 100 || !Array.isArray(s.points) || s.points.length > 200) throw Error('키프레임의 값이 허용 범위를 벗어났습니다.');
      if(s.compassX !== undefined && (!Number.isFinite(s.compassX)||Math.abs(s.compassX)>3)) throw Error('나침반 위치는 −3R~3R 범위여야 합니다.');
      const ids = new Set();
      const points = s.points.map(p => {
        if (!Number.isSafeInteger(p.id) || p.id < 1 || ids.has(p.id) || !Number.isFinite(p.i) || Math.abs(p.i) > 1e6 || !/^(#[0-9a-f]{3,8}|var\(--(blue|green)\))$/i.test(p.color)) throw Error('저장한 점의 값이 올바르지 않습니다.');
        if(p.opacity!==undefined && (!Number.isFinite(p.opacity)||p.opacity<0||p.opacity>1)) throw Error('점의 표시 상태가 올바르지 않습니다.');
        ids.add(p.id); return {id:p.id, i:p.i, color:p.color, ...(p.opacity===undefined?{}:{opacity:p.opacity})};
      });
      if(f.channels!==undefined&&(!Array.isArray(f.channels)||f.channels.some(lane=>!(/^(current|earth|compass|point-[1-9][0-9]*)$/.test(lane)))))throw Error('키프레임 변수 정보가 올바르지 않습니다.');
      return {...(f.channels===undefined?{}:{channels:[...new Set(f.channels)]}),id:index + 1, name:String(f.name || `키프레임 ${index + 1}`).slice(0,40), time:f.time, state:{current:s.current, earth:s.earth, points, ...(s.compassX===undefined?{}:{compassX:s.compassX})}};
    }).sort((a,b) => a.time-b.time);
    return independentFrames(validated);
  }

export function createAnimationModel({ api, getFrames, getEasing, duration }) {
  function rangeAt(time) {
    const state = stateAt(time);
    const frames = getFrames();
    const extent = s => Math.max(2, Math.abs(s.current / (125 * s.earth)),
      ...s.points.map(p => Math.abs(p.i / (125 * s.earth)) * (p.opacity ?? 1))) * 1.15;
    // Interpolate the padding, rather than rounded bounds: scale stays continuous
    // as current, earth strength, and point visibility change.
    let padding = 1;
    if (frames.length) {
      const end = frames.findIndex(frame => frame.time > time);
      const a = end === 0 ? frames[0] : end < 0 ? frames.at(-1) : frames[end - 1];
      const b = end <= 0 ? a : frames[end];
      let t = a === b ? 0 : clamp((time - a.time) / (b.time - a.time), 0, 1);
      if (getEasing() === 'smooth') t = t*t*(3-2*t);
      const ea = extent(a.state), eb = extent(b.state);
      padding = lerp(api.nice(ea) / ea, api.nice(eb) / eb, t);
    }
    const yMax = extent(state) * padding;
    return {yMax, xMax:yMax * 125 * state.earth,
      vectorScale:Math.min(180,240/Math.max(1.3,Math.abs(state.current / 125)*1.18,state.earth*1.18))};
  }
  function stateAt(time) {
    const frames=independentFrames(getFrames());
    if(!frames.length)return api.capture();
    const state=clone(frames[0].state);
    const lanes=[...new Set(frames.flatMap(f=>[...stateChannels(f.state),...f.channels]))];
    state.points=[];
    for(const lane of lanes) {
      const keys=frames.filter(f=>f.channels.includes(lane));
      if(!keys.length)continue;
      const end=keys.findIndex(f=>f.time>time);
      const a=end===0?keys[0]:end<0?keys.at(-1):keys[end-1];
      const b=end<=0?a:keys[end];
      let t=a===b?0:clamp((time-a.time)/(b.time-a.time),0,1);
      if(getEasing()==='smooth')t=t*t*(3-2*t);
      const va=channelValue(a.state,lane),vb=channelValue(b.state,lane);
      if(lane.startsWith('point-')) {
        if(!va&&!vb)continue;
        state.points.push({id:Number(lane.slice(6)),color:(vb||va).color,
          i:lerp((va||vb).i,(vb||va).i,t),opacity:lerp(va?(va.opacity??1):0,vb?(vb.opacity??1):0,t)});
      } else state[lane==='compass'?'compassX':lane]=lerp(va,vb,t);
    }
    return state;
  }
return { stateAt, rangeAt };
}
