import { PROJECT_FORMAT, PROJECT_VERSION, validateProject } from './studio/project.js';

export function createCompassDemo(api) {
  const base=api.capture();
  const frames=[[0,-3],[1,-3],[3,0],[4,0],[6,3],[7,3]].map(([time,compassX],i)=>({
    id:i+2,time:time+.5,name:`나침반 ${compassX===0?'중앙':compassX<0?'왼쪽':'오른쪽'}`,
    state:{...structuredClone(base),current:1000,earth:1,points:[],compassX}
  }));
  frames.unshift({id:1,time:0,name:'전류 켜기 전',state:{...structuredClone(frames[0].state),current:0}});
  return {
    format:PROJECT_FORMAT,version:PROJECT_VERSION,name:'코일과 나침반',
    state:structuredClone(frames[0].state),frames,playhead:0,
    settings:{...api.captureSettings(),workspace:'coil',layout:{panelClosed:false,timelineHidden:false,presenting:false},easing:'smooth',loop:false,coil:{showCurrent:true,showField:true,showCompass:true}}
  };
}
/** Exactly one workspace is active; each retains its own snapshots and timeline. */
export function installWorkspaces(api,studio) {
  const saved=new Map();
  let previous='graphs',initial=null;
  const storage='field-lab-workspaces-v1';
  try {
    const value=JSON.parse(localStorage.getItem(storage)||'null');
    if(value)for(const name of ['graphs','coil'])if(value.projects?.[name])saved.set(name,validateProject(value.projects[name]));
    if(value&&saved.has(value.active))initial=value.active;
  } catch { saved.clear(); }
  function persist() {
    saved.set(previous,studio.captureProject(document.getElementById('project-name').value||(previous==='coil'?'코일과 나침반':'그래프 실험')));
    try {localStorage.setItem(storage,JSON.stringify({active:previous,projects:Object.fromEntries(saved)}));}catch{}
  }
  api.setInterrupt(()=>studio.pause());
  document.querySelectorAll('[name=workspace-view]').forEach(input=>input.addEventListener('change',()=>{
    if(!input.checked||studio.isBusy())return;
    saved.set(previous,studio.captureProject(document.getElementById('project-name').value||(previous==='coil'?'코일과 나침반':'그래프 실험')));
    const next=input.value;
    const target=saved.get(next)||(next==='coil'?createCompassDemo(api):studio.captureProject('그래프 실험'));
    target.settings.workspace=next;
    studio.openProject(target);persist();
  }));
  api.onWorkspaceChange(workspace=>{previous=workspace;});
  window.addEventListener('pagehide',persist);
  if(initial)studio.openProject(saved.get(initial));
  document.getElementById('compass-demo').addEventListener('click',()=>{
    if(!studio.isBusy()){studio.openProject(createCompassDemo(api));api.restartTrails();}
  });
}
