import { createCoilRenderer } from './renderer.js';
import { compassField } from './physics.js';
import { clamp, fmt } from '../utils.js';

/** Adds the coil's position channel to the graph snapshot contract. */
export function createExperimentController(graph) {
  const $=id=>document.getElementById(id);
  let workspace='graphs',compassX=-3;
  let showCurrent=true,showField=true,showCompass=true;
  const listeners=new Set();
  const read=()=>({...graph.capture(),compassX,showCurrent,showField,showCompass});
  const renderer=createCoilRenderer($('coil-canvas'),read);
  let interrupt=()=>{};
  const takeOver=()=>{graph.release({silent:true});interrupt();};
  function update() {
    const s=read(),b=compassField(s.current,s.earth,compassX);
    const sync=(id,value)=>{if(document.activeElement!==$(id))$(id).value=value;};
    sync('coil-current',s.current);sync('coil-current-number',s.current);
    sync('compass-position',compassX);sync('compass-position-number',compassX);
    sync('coil-earth',s.earth);
    $('coil-angle').textContent=`${fmt(b.angle*180/Math.PI,1)}°`;
    $('coil-field').textContent=fmt(b.coil,3);
    $('coil-position-readout').textContent=`${fmt(compassX,2)}R`;
  }
  function setWorkspace(value) {
    graph.exitTheater();
    workspace=value==='coil'?'coil':'graphs';
    document.body.dataset.workspace=workspace;
    document.querySelectorAll('[name=workspace-view]').forEach(input=>{input.checked=input.value===workspace;});
    const coil=workspace==='coil';
    $('export-target').disabled=coil;
    $('export-target').querySelector('option[value="both"]').textContent=coil?'코일 · 나침반':'두 그래프 함께';
    if(coil)$('export-target').value='both';
    renderer.setActive(coil);update();
    listeners.forEach(fn=>fn(workspace));
  }
  function setPosition(x) {
    if(!Number.isFinite(x))return;
    compassX=clamp(x,-3,3);update();
  }
  graph.onStateChange(update);
  for(const id of ['coil-current','coil-current-number'])$(id).addEventListener('input',event=>{
    const value=event.target.type==='number'?event.target.valueAsNumber:Number(event.target.value);if(!Number.isFinite(value))return;
    takeOver();graph.setCurrent(value);
  });
  for(const id of ['coil-current-number','compass-position-number','coil-earth'])$(id).addEventListener('blur',update);
  $('coil-earth').addEventListener('input',event=>{
    const value=Number(event.target.value);if(!Number.isFinite(value)||value<.05||value>100){update();return;}
    takeOver();graph.apply({...graph.capture(),earth:value},null);
  });
  for(const id of ['compass-position','compass-position-number'])$(id).addEventListener('input',event=>{takeOver();const value=event.target.type==='number'?event.target.valueAsNumber:Number(event.target.value);setPosition(value);});
  for(const [id,key] of [['coil-show-current','current'],['coil-show-field','field'],['coil-show-compass','compass']])$(id).addEventListener('change',event=>{
    if(key==='current')showCurrent=event.target.checked;
    if(key==='field')showField=event.target.checked;
    if(key==='compass')showCompass=event.target.checked;
    renderer.restart();
  });
  $('coil-retrace').addEventListener('click',()=>renderer.restart());
  $('compass-center').addEventListener('click',()=>{takeOver();setPosition(0);});
  // Direct manipulation follows the same x channel as the timeline.
  let pointer=null;
  function drag(event){
    const rect=$('coil-canvas').getBoundingClientRect(),scale=Math.min(rect.width/8.5,rect.height/3.8);
    setPosition((event.clientX-rect.left-rect.width/2)/scale);
  }
  $('coil-canvas').addEventListener('pointerdown',event=>{if(event.button!==0||!showCompass)return;takeOver();pointer=event.pointerId;event.currentTarget.setPointerCapture(pointer);drag(event);});
  $('coil-canvas').addEventListener('pointermove',event=>{if(pointer===event.pointerId)drag(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('coil-canvas').addEventListener(type,()=>{pointer=null;});
  $('coil-canvas').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();takeOver();setPosition(compassX+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?.5:.05));});
  update();setWorkspace('graphs');
  return {
    ...graph,
    setInterrupt(fn){interrupt=fn;},
    setWorkspace,
    onWorkspaceChange(fn){listeners.add(fn);},
    capture:()=>({...graph.capture(),compassX}),
    apply(state,view){compassX=state.compassX??0;graph.apply(state,view);update();},
    captureSettings:()=>({...graph.captureSettings(),workspace,coil:{showCurrent,showField,showCompass},layout:{panelClosed:document.body.classList.contains('panel-closed'),timelineHidden:document.body.classList.contains('timeline-hidden'),presenting:document.body.classList.contains('presenting')}}),
    applySettings(settings){
      graph.applySettings(settings);
      ({showCurrent=true,showField=true,showCompass=true}=settings.coil||{});
      $('coil-show-current').checked=showCurrent;$('coil-show-field').checked=showField;$('coil-show-compass').checked=showCompass;
      const layout=settings.layout||{};
      document.body.classList.toggle('panel-closed',!!layout.panelClosed);
      document.body.classList.toggle('timeline-hidden',!!layout.timelineHidden);
      if(document.body.classList.contains('presenting')!==!!layout.presenting)$('present').click();
      $('panel-toggle').setAttribute('aria-expanded',String(!layout.panelClosed));
      $('timeline-toggle').setAttribute('aria-expanded',String(!layout.timelineHidden));
      setWorkspace(settings.workspace||'graphs');renderer.restart();
    },
    renderScene: theme => renderer.snapshot(theme),
    restartTrails:()=>renderer.restart()
  };
}
