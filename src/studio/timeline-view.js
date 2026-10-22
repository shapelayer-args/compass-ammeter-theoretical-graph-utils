import { esc } from "../utils.js";
export function createTimelineView({ $, api, timelineEnd, read }) {
  function timelineRuler() {
    const end=timelineEnd(),width=$('timeline-ruler').getBoundingClientRect().width||800;
    const step=api.nice(end*75/Math.max(1,width));
    let markup='';
    for(let n=0;n<=Math.ceil(end/(step/5));n++){
      const time=n*step/5;if(time>end)break;
      const major=n%5===0;
      markup+=`<i class="ruler-tick${major?' major':''}" style="left:${time/end*100}%">${major?`<span>${api.fmt(time,2)} s</span>`:''}</i>`;
    }
    $('timeline-ruler').innerHTML=markup;
    $('timeline-content').style.setProperty('--grid-gap',`${step/end*100}%`);
    $('timeline-ruler').setAttribute('aria-valuemax',end);
  }
  function drawTracks() {
    const { frames, selected } = read();
    const ids=[...new Set([...api.capture().points.map(p=>p.id), ...frames.flatMap(f=>f.state.points.map(p=>p.id))])].sort((a,b)=>a-b);
    const lanes=[{id:'state',name:'전체 상태',unit:'',value:f=>f.name},{id:'current',name:'전류 𝐼',unit:'mA',value:f=>api.fmt(f.state.current)+' mA'},{id:'earth',name:'지구 자기장 𝑒',unit:'초기값 대비',value:f=>api.fmt(f.state.earth,3)},...(api.captureSettings().workspace==='coil'?[{id:'compass',name:'나침반 x',unit:'R',value:f=>api.fmt(f.state.compassX??0,2)+'R'}]:[]),...ids.map(id=>({id:'point-'+id,name:`저장한 점 ${id}`,unit:'mA',value:f=>{const p=f.state.points.find(p=>p.id===id);return p?api.fmt(p.i)+' mA':null;}}))];
    const end=timelineEnd();
    $('keyframe-list').innerHTML=lanes.map(lane=>`<div class="track-row"><div class="track-label">${esc(lane.name)}<small>${esc(lane.unit)}</small></div><div class="timeline-lane" data-lane="${lane.id}" role="group" aria-label="${esc(lane.name)} 트랙">${frames.filter(f=>lane.value(f)!==null).map(frame=>`<button type="button" class="timeline-key" data-keyframe="${frame.id}" data-lane-id="${lane.id}" style="left:${frame.time/end*100}%" aria-current="${frame.id===selected}" aria-label="${esc(frame.name)} · ${api.fmt(frame.time,2)}초 · ${esc(lane.name)} ${esc(lane.value(frame))}" title="${esc(frame.name)} · ${api.fmt(frame.time,2)} s · ${esc(lane.value(frame))} — 드래그로 시간 이동">◆${lane.id==='state'?`<span class="key-name">${esc(frame.name)}</span>`:''}</button>`).join('')}</div></div>`).join('')+(!frames.length?'<div class="timeline-empty">빈 트랙을 두 번 클릭해 키프레임을 놓으세요.</div>':'');
    timelineRuler();
  }
  return { timelineRuler, drawTracks };
}
