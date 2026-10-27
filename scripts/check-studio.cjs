const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const nodes=new Map();
class Element{
 constructor(){this.value='';this.checked=false;this.dataset={};this.listeners={};this.attributes={};this.style={setProperty(){}};this.classes=new Set();this.classList={contains:c=>this.classes.has(c),remove:c=>this.classes.delete(c),toggle:(c,on)=>{if(on??!this.classes.has(c)){this.classes.add(c);return true;}this.classes.delete(c);return false;}};}
 addEventListener(t,fn){(this.listeners[t]||=[]).push(fn);}dispatch(t,props={}){for(const fn of this.listeners[t]||[])fn({target:this,currentTarget:this,button:0,preventDefault(){},...props});}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}contains(){return false;}closest(s){return s==='.graph-card'?get('card'):null;}querySelector(){return get('span');}focus(){}click(){this.dispatch('click');}getBoundingClientRect(){return {left:0,top:0,right:340,bottom:100,width:340};}getScreenCTM(){return {a:1,b:0,inverse(){return {};}};}getContext(){return {};}matches(){return false;}
}
const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
const axis=['angle','current'].map(v=>{const e=new Element();e.dataset.axis=v;return e;});
const tabs=['controls','animation','export'].map(v=>{const e=get('tab-'+v);e.dataset.panelTab=v;return e;});
const radios=['graphs','coil'].map(value=>{const e=new Element();e.value=value;return e;});
const document={getElementById:get,querySelector:get,querySelectorAll:s=>s==='[data-axis]'?axis:s==='[data-panel-tab]'?tabs:s==='[name=workspace-view]'?radios:[],addEventListener(){},documentElement:{dataset:{theme:'light'}},body:new Element()};
const sandbox={document,window:{scrollY:0,scrollTo(){},addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}},matchMedia:()=>({matches:false,addEventListener(){}}),ResizeObserver:class{observe(){}},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout(){},structuredClone};
const ctx=vm.createContext(sandbox),cache=new Map();
function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.resolve(dir,entry.name);if(entry.isDirectory()){collect(file);continue;}if(!file.endsWith('.js'))continue;let source=fs.readFileSync(file,'utf8');
 if(file.endsWith('/studio/index.js'))source=source.replace('export function installStudio(api) {','export function installStudio(api) { globalThis.apiUnderTest=api;').replace("  return {captureProject,openProject,pause,isBusy:()=>!!exporting};","  globalThis.studioUnderTest={captureProject,openProject,pause,isBusy:()=>!!exporting};globalThis.timelineUnderTest={stateAt,rangeAt,seek,frames:()=>frames,selection:()=>selection,addKeyframe};return globalThis.studioUnderTest;");
 cache.set(file,new vm.SourceTextModule(source,{context:ctx,identifier:file}));}}
collect('src');function load(file){return cache.get(path.resolve(file));}
(async()=>{
 get('animation-easing').value='smooth';get('animation-loop').checked=false;
 const main=load('src/app.js');await main.link((spec,ref)=>load(path.resolve(path.dirname(ref.identifier),spec)));await main.evaluate();
 const api=ctx.apiUnderTest,studio=ctx.studioUnderTest,t=ctx.timelineUnderTest;

 const original=JSON.stringify(api.capture());
 radios[1].checked=true;radios[0].checked=false;radios[1].dispatch('change');
 assert.equal(t.frames().length,7);
 assert.match(get('keyframe-list').innerHTML,/data-lane="compass"/);
 const before=t.frames().length;
 t.seek(2);t.addKeyframe(2);assert.equal(t.frames().length,before,'unchanged state adds no keys');
 api.setCurrent(500);t.addKeyframe(2);
 assert.equal(JSON.stringify(t.frames().find(f=>f.time===2).channels),'["current"]');
 const list=get('keyframe-list');
 function button(frame,lane){const e=new Element();e.dataset={keyframe:String(frame.id),laneId:lane};e.closest=selector=>selector==='[data-keyframe]'?e:selector==='.timeline-lane'?get('lane'):null;return e;}
 list.setPointerCapture=()=>{};list.hasPointerCapture=()=>false;
 const key1=button(t.frames()[0],'current'),key2=button(t.frames()[1],'current');
 list.dispatch('pointerdown',{target:key1,pointerId:1,clientX:10,clientY:5});
 list.dispatch('pointerup',{target:key1,pointerId:1});
 list.dispatch('pointerdown',{target:key2,pointerId:2,clientX:20,clientY:5,metaKey:true});
 list.dispatch('pointerup',{target:key2,pointerId:2});
 assert.equal(t.selection().size,2,'Command-click adds a second variable key');
 list.dispatch('pointerdown',{target:key2,pointerId:3,clientX:20,clientY:5});
 list.dispatch('pointermove',{target:key2,pointerId:3,clientX:54,clientY:5});
 list.dispatch('pointerup',{target:key2,pointerId:3});
 assert.equal(t.selection().size,2);
 const moved=t.frames().filter(f=>f.channels.includes('current'));
 assert.ok(moved.some(f=>f.time===1)&&moved.some(f=>f.time===1.5),'selected current keys move together');
 assert.equal(t.frames().find(f=>f.time===0).channels.includes('compass'),true,'unselected position stays put');
 const active=button(t.frames().find(f=>f.time===1),'current');
 list.dispatch('keydown',{target:active,key:'Delete'});
 assert.equal(t.selection().size,0);
 assert.ok(!t.frames().some(f=>f.time===1&&f.channels.includes('current')));
 // Feed observed key bounds to the marquee handler; no live DOM needed.
 const positionKeys=t.frames().filter(f=>f.channels.includes('compass')).slice(0,2).map((f,i)=>{
  const e=button(f,'compass');e.getBoundingClientRect=()=>({left:10+i*30,right:20+i*30,top:50,bottom:60});return e;
 });
 list.querySelectorAll=()=>positionKeys;
 const blank=new Element();blank.closest=selector=>selector==='.timeline-lane'?get('lane'):null;
 document.createElement=()=>new Element();document.body.append=()=>{};
 list.dispatch('pointerdown',{target:blank,pointerId:4,clientX:0,clientY:40});
 list.dispatch('pointermove',{target:blank,pointerId:4,clientX:70,clientY:70});
 get('timeline-marquee').remove=()=>{};
 list.dispatch('pointerup',{target:blank,pointerId:4});
 assert.equal(t.selection().size,2,'drag rectangle selects both position keys');
 const project=studio.captureProject('Timeline');
 const projectModule=load('src/studio/project.js');await projectModule.evaluate();
 const valid=projectModule.namespace.validateProject(project);studio.openProject(valid);
 assert.equal(t.selection().size,0);
 assert.equal(JSON.stringify(t.frames().map(f=>f.channels)),JSON.stringify(valid.frames.map(f=>f.channels)));
 console.log('Passed: real studio event handlers for unchanged recording, Command selection, group drag, independent deletion, marquee selection and project reload.');
})().catch(e=>{console.error(e);process.exitCode=1;});
