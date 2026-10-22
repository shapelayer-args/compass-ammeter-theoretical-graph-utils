import { installFiles } from "./files.js";
import { PROJECT_FORMAT, PROJECT_VERSION } from "./project.js";
import { createTimelineView } from "./timeline-view.js";
import { clamp, esc } from "../utils.js";
import { installPanels } from "./panels.js";
import { createAnimationModel, validateFrames } from "./model.js";
import { installExport } from "./export.js";
/* Docked animation authoring and browser-native image/video export. */
export function installStudio(api) {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const STORAGE = 'field-lab-keyframes-v1';
  let frames = [], selected = null, nextId = 1, playhead = 0;
  let playback = null, playbackFrame = null, exporting = null;
  const panel = $('studio-panel'), stage = $('graph-stage');
  const duration = () => frames.at(-1)?.time || 0;
  const selectedFrame = () => frames.find(frame => frame.id === selected);
  const message = (id, text = '') => { $(id).textContent = text; };

  const { panelTab } = installPanels({ $, panel });
  try { frames = validateFrames(JSON.parse(localStorage.getItem(STORAGE) || '[]')); nextId = frames.length + 1; } catch { frames = []; }
  function save() {
    try { localStorage.setItem(api.captureSettings().workspace==='coil'?'field-lab-coil-keyframes-v1':STORAGE, JSON.stringify(frames)); } catch {}
  }
  const { stateAt, rangeAt } = createAnimationModel({ api, getFrames: () => frames, getEasing: () => $('animation-easing').value, duration });
  let timelineZoom = 1;
  let keyDrag = null;
  const timelineEnd = () => keyDrag?.end ?? Math.min(300,Math.max(10,Math.ceil((duration()+2)/5)*5));
  function timeFromPointer(event, element) {
    const rect=element.getBoundingClientRect();
    return clamp((event.clientX-rect.left)/Math.max(1,rect.width)*timelineEnd(),0,timelineEnd());
  }
  const snapTime = (value, fine=false) => {
    const step = fine ? 0.01 : 0.1;
    return Number((Math.round(value/step)*step).toFixed(2));
  };
  function moveFrame(id,time) {
    const frame=frames.find(f=>f.id===id);
    if(!frame||!Number.isFinite(time)||time<0||time>300||frames.some(f=>f.id!==id&&Math.abs(f.time-time)<.005))return false;
    frame.time=time;playhead=time;frames.sort((a,b)=>a.time-b.time);
    api.apply(clone(frame.state),rangeAt(playhead));timeline();return true;
  }
  const { timelineRuler, drawTracks } = createTimelineView({ $, api, timelineEnd, read: () => ({ frames, selected }) });
  function addKeyframe(time) {
    pause();time=Number(time.toFixed(2));
    if(frames.length>=120||time>300){message('animation-status','최대 120개, 300초까지 작성할 수 있습니다.');return;}
    if(frames.some(f=>Math.abs(f.time-time)<.005)){message('animation-status','이 시간에는 이미 키프레임이 있습니다. 다른 시간을 선택하세요.');return;}
    const id=nextId++;frames.push({id,name:`키프레임 ${id}`,time,state:api.capture()});selected=id;playhead=time;
    timeline();panelTab('animation');message('animation-status',`${api.fmt(time,2)}초에 현재 상태를 기록했습니다.`);
  }

  function clock() {
    $('animation-scrub').max = timelineEnd();
    $('animation-scrub').value = playhead;
    $('animation-clock').textContent = `${playhead.toFixed(2)} / ${duration().toFixed(2)} s`;
    const labelWidth=matchMedia('(max-width: 700px)').matches?105:148;
    const fraction=playhead/timelineEnd();
    $('timeline-cursor').style.left=`calc(${labelWidth}px + ${fraction*100}% - ${fraction*labelWidth}px)`;
    $('timeline-cursor-time').textContent=playhead.toFixed(2);
    $('timeline-ruler').setAttribute('aria-valuenow',playhead.toFixed(2));
  }
  function seek(time) {
    playhead = clamp(time,0,timelineEnd());
    if (frames.length) api.apply(stateAt(playhead),rangeAt(playhead));
    clock();
  }
  function pause(release = false) {
    if (playbackFrame !== null) cancelAnimationFrame(playbackFrame);
    playbackFrame = null; playback = null;
    $('animation-play').textContent = '▶ 재생';
    $('animation-play').setAttribute('aria-label','애니메이션 재생');
    if (release) api.release();
  }
  function tick(now) {
    if (!playback) return;
    const time = playback.offset + (now-playback.start)/1000;
    if (time >= duration()) {
      if ($('animation-loop').checked) {
        playback = {start:now,offset:0}; seek(0);
      } else { seek(duration()); pause(); return; }
    } else seek(time);
    playbackFrame = requestAnimationFrame(tick);
  }
  $('animation-play').addEventListener('click', () => {
    if (playback) { pause(); return; }
    if (frames.length<2 || !duration()) return;
    if (playhead >= duration()) playhead = 0;
    $('animation-play').textContent = 'Ⅱ 일시정지';
    $('animation-play').setAttribute('aria-label','애니메이션 일시정지');
    playback = {start:performance.now(),offset:playhead};
    playbackFrame = requestAnimationFrame(tick);
  });
  $('animation-rewind').addEventListener('click', () => { pause(); seek(0); });
  $('animation-scrub').addEventListener('input', event => { pause(); seek(Number(event.target.value)); });
  $('animation-easing').addEventListener('change', () => { if (frames.length) seek(playhead); });
  function editor() {
    const frame = selectedFrame(); $('keyframe-editor').hidden = !frame; $('keyframe-empty').hidden = !!frame;
    if (!frame) return;
    $('keyframe-name').value=frame.name; $('keyframe-time').value=frame.time;
    $('keyframe-current').value=Number(frame.state.current.toFixed(6)); $('keyframe-earth').value=Number(frame.state.earth.toFixed(6));
    $('keyframe-compass-field').hidden=api.captureSettings().workspace!=='coil';
    $('keyframe-compass').value=frame.state.compassX??0;
    $('keyframe-points').innerHTML=frame.state.points.map(p=>`<label class="field"><span>점 ${p.id} · mA</span><input type="number" step="any" min="-1000000" max="1000000" data-key-point="${p.id}" value="${Number(p.i.toFixed(6))}" aria-label="점 ${p.id}의 전류"></label>`).join('') || '<p class="panel-note">이 키프레임에는 저장한 점이 없습니다.</p>';
  }
  function timeline() {
    frames.sort((a,b)=>a.time-b.time);
    drawTracks();
    const ready=frames.length>=2&&duration()>0;
    $('animation-play').disabled=!ready; $('animation-rewind').disabled=!frames.length; $('animation-scrub').disabled=false;
    $('export-video').disabled=!ready||!videoMime;
    playhead=clamp(playhead,0,timelineEnd()); editor(); clock(); save();
  }
  function select(id) {
    pause(); selected=id;
    const frame=selectedFrame();
    if (frame) {playhead=frame.time; api.apply(clone(frame.state),rangeAt(playhead));}
    timeline(); panelTab('animation');
  }
  $('keyframe-list').addEventListener('click', event => { const button=event.target.closest('[data-keyframe]'); if(button) select(Number(button.dataset.keyframe)); });
  $('keyframe-add').addEventListener('click', () => {
    addKeyframe(frames.some(f=>Math.abs(f.time-playhead)<.005)?duration()+2:playhead);
  });

  $('keyframe-list').addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-keyframe]');
    if(!button||event.button!==0||exporting)return;
    event.preventDefault();pause();selected=Number(button.dataset.keyframe);
    const frame=selectedFrame(),lane=button.closest('.timeline-lane');
    keyDrag={id:frame.id,pointer:event.pointerId,lane:button.dataset.laneId,end:timelineEnd(),rect:lane.getBoundingClientRect(),startX:event.clientX,startTime:frame.time,moved:false};
    $('keyframe-list').setPointerCapture(event.pointerId);
    playhead=frame.time;api.apply(clone(frame.state),rangeAt(playhead));timeline();panelTab('animation');
  });
  $('keyframe-list').addEventListener('pointermove',event=>{
    if(!keyDrag||event.pointerId!==keyDrag.pointer)return;
    if(!keyDrag.moved&&Math.abs(event.clientX-keyDrag.startX)<3)return;
    keyDrag.moved=true;
    const time=keyDrag.startTime+(event.clientX-keyDrag.startX)/Math.max(1,keyDrag.rect.width)*keyDrag.end;
    moveFrame(keyDrag.id,snapTime(clamp(time,0,keyDrag.end),event.shiftKey));
  });
  function finishKeyDrag(event){
    if(!keyDrag||event.pointerId!==keyDrag.pointer)return;
    const {id,lane,pointer}=keyDrag;keyDrag=null;
    if($('keyframe-list').hasPointerCapture(pointer))$('keyframe-list').releasePointerCapture(pointer);
    timeline();
    $('keyframe-list').querySelector(`[data-keyframe="${id}"][data-lane-id="${lane}"]`)?.focus({preventScroll:true});
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('keyframe-list').addEventListener(type,finishKeyDrag));
  $('keyframe-list').addEventListener('keydown',event=>{
    const button=event.target.closest('[data-keyframe]');if(!button||exporting)return;
    if(event.key==='Delete'||event.key==='Backspace'){
      event.preventDefault();selected=Number(button.dataset.keyframe);$('keyframe-delete').click();return;
    }
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();pause();selected=Number(button.dataset.keyframe);
    const frame=selectedFrame(),lane=button.dataset.laneId;
    const time=event.key==='Home'?0:event.key==='End'?timelineEnd():frame.time+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?1:.1);
    moveFrame(frame.id,Number(clamp(time,0,300).toFixed(2)));
    $('keyframe-list').querySelector(`[data-keyframe="${frame.id}"][data-lane-id="${lane}"]`)?.focus({preventScroll:true});
  });
  $('keyframe-list').addEventListener('dblclick',event=>{
    if(exporting||event.target.closest('[data-keyframe]'))return;
    const lane=event.target.closest('.timeline-lane');if(lane)addKeyframe(snapTime(timeFromPointer(event,lane),event.shiftKey));
  });
  let rulerDrag=null;
  $('timeline-ruler').addEventListener('pointerdown',event=>{
    if(event.button!==0||exporting)return;
    event.preventDefault();pause();rulerDrag=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);
    seek(timeFromPointer(event,event.currentTarget));
  });
  $('timeline-ruler').addEventListener('pointermove',event=>{
    if(rulerDrag===event.pointerId)seek(timeFromPointer(event,event.currentTarget));
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('timeline-ruler').addEventListener(type,event=>{if(rulerDrag===event.pointerId)rulerDrag=null;}));
  $('timeline-ruler').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();pause();seek(event.key==='Home'?0:event.key==='End'?timelineEnd():playhead+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?1:.1));
  });
  $('timeline-zoom').addEventListener('change',event=>{
    timelineZoom=Number(event.target.value);$('timeline-content').style.width=`${timelineZoom*100}%`;timelineRuler();clock();
  });
  new ResizeObserver(()=>{timelineRuler();clock();}).observe($('timeline-scroll'));
  let heightDrag=null;
  function timelineHeight(value){
    const height=clamp(value,140,Math.min(380,window.innerHeight*.6));
    document.querySelector('main').style.setProperty('--timeline-height',`${height}px`);
    $('timeline-splitter').setAttribute('aria-valuenow',Math.round(height));
  }
  $('timeline-splitter').addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();
    heightDrag={pointer:event.pointerId,y:event.clientY,height:$('timeline-dock').getBoundingClientRect().height};event.currentTarget.setPointerCapture(event.pointerId);
  });
  $('timeline-splitter').addEventListener('pointermove',event=>{if(heightDrag?.pointer===event.pointerId)timelineHeight(heightDrag.height+heightDrag.y-event.clientY);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('timeline-splitter').addEventListener(type,()=>{heightDrag=null;}));
  $('timeline-splitter').addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();
    timelineHeight(event.key==='Home'?140:event.key==='End'?380:$('timeline-dock').getBoundingClientRect().height+(event.key==='ArrowUp'?20:-20));
  });
  $('timeline-toggle').addEventListener('click',()=>{
    const hidden=document.body.classList.toggle('timeline-hidden');$('timeline-toggle').setAttribute('aria-expanded',String(!hidden));
  });

  $('keyframe-update').addEventListener('click', () => {
    const frame=selectedFrame(); if(!frame)return;
    pause(); frame.state=api.capture(); timeline(); message('animation-status','선택한 키프레임을 현재 값으로 갱신했습니다.');
  });
  $('keyframe-delete').addEventListener('click', () => {
    pause(); frames=frames.filter(frame=>frame.id!==selected); selected=null; timeline();
    if(!frames.length) api.release(); message('animation-status','키프레임을 삭제했습니다.');
  });
  function editFrame(id,read,valid,write) {
    $(id).addEventListener('change',()=>{
      const frame=selectedFrame(); if(!frame)return;
      const value=read($(id));
      if(!valid(value,frame)){message('animation-status','값의 범위를 확인하세요. 시간은 중복 없이 0~300초로 지정합니다.');editor();return;}
      pause();write(frame,value);playhead=frame.time;api.apply(clone(frame.state),rangeAt(playhead));timeline();message('animation-status');
    });
  }
  editFrame('keyframe-name',e=>e.value,v=>v.trim().length>0,(f,v)=>{f.name=v.slice(0,40);});
  editFrame('keyframe-time',e=>e.valueAsNumber,(v,f)=>Number.isFinite(v)&&v>=0&&v<=300&&!frames.some(o=>o.id!==f.id&&o.time===v),(f,v)=>{f.time=v;frames.sort((a,b)=>a.time-b.time);});
  editFrame('keyframe-current',e=>e.valueAsNumber,v=>Number.isFinite(v)&&Math.abs(v)<=1e6,(f,v)=>{f.state.current=v;});
  editFrame('keyframe-compass',e=>e.valueAsNumber,v=>Number.isFinite(v)&&Math.abs(v)<=3,(f,v)=>{f.state.compassX=v;});
  editFrame('keyframe-earth',e=>e.valueAsNumber,v=>Number.isFinite(v)&&v>=.05&&v<=100,(f,v)=>{f.state.earth=v;});
  $('keyframe-points').addEventListener('change', event => {
    const input=event.target.closest('[data-key-point]'),frame=selectedFrame();if(!input||!frame)return;
    const value=input.valueAsNumber;
    if(!Number.isFinite(value)||Math.abs(value)>1e6){editor();message('animation-status','점의 전류는 ±1,000,000 mA 이내로 입력하세요.');return;}
    pause();const point=frame.state.points.find(p=>p.id===Number(input.dataset.keyPoint));if(point)point.i=value;
    playhead=frame.time;api.apply(clone(frame.state),rangeAt(playhead));timeline();
  });
  // Manual interaction takes over immediately; authoring never fights playback.
  for(const type of ['pointerdown','keydown','input','change']) {
    document.addEventListener(type,event=>{
      if(exporting)return;
      if(event.target.closest('.coil-controls')) { if(!event.target.closest('.coil-layers, #coil-retrace'))pause(); return; }
      if(event.target.closest('.graph-stage, #panel-controls, #reset, [data-axis]')) pause(true);
    },true);
  }

  const { videoMime } = installExport({ api, $, stage, pause, message, seek, duration, clock,
    getFrames: () => frames, getPlayhead: () => playhead, setPlayhead: value => { playhead = value; },
    getExporting: () => exporting, setExporting: value => { exporting = value; } });
  function captureProject(name) {
    return {format: PROJECT_FORMAT, version: PROJECT_VERSION, name,
      state: api.capture(), frames: clone(frames), playhead,
      settings: { ...api.captureSettings(), easing: $('animation-easing').value, loop: $('animation-loop').checked }};
  }
  function openProject(project) {
    pause(); keyDrag = null; rulerDrag = null;
    frames = clone(project.frames); selected = null;
    nextId = Math.max(0, ...frames.map(frame => frame.id)) + 1;
    playhead = project.playhead;
    $('project-name').value=project.name;
    $('animation-easing').value = project.settings.easing;
    $('animation-loop').checked = project.settings.loop;
    api.applySettings(project.settings); api.apply(project.state, null); api.reservePointIds(frames);
    timeline(); message('animation-status', `${project.name} · ${api.fmt(duration(),2)}초`);
  }
  installFiles({ $, isBusy: () => !!exporting, capture: captureProject, open: openProject });
  api.onPointsChange(reason => {
    if (exporting) return;
    pause();
    // Keep historical snapshots intact; point edits belong to the playhead.
    if (reason === 'edit' && frames.length) {
      const state = api.capture();
      let frame = frames.find(f => Math.abs(f.time - playhead) < .005);
      if (frame) {
        frame.state.points = clone(state.points);
      } else if (frames.length < 120) {
        const id = nextId++;
        frame = { id, name: `키프레임 ${id}`, time: Number(playhead.toFixed(2)), state };
        frames.push(frame);
      } else {
        message('animation-status', '점은 변경되었지만 키프레임이 120개여서 기록하지 못했습니다. 키프레임을 삭제한 뒤 현재 상태를 기록하세요.');
      }
      if (frame) {
        selected = frame.id;
        message('animation-status', `${api.fmt(frame.time,2)}초의 점 구성을 반영했습니다.`);
      }
    }
    timeline();
  });
  timeline();
  panelTab('controls');
  return {captureProject,openProject,pause,isBusy:()=>!!exporting};
}
