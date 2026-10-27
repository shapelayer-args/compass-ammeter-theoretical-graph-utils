import { axialReveal } from '../src/coil/field-reveal.js';
import { buildWirePath } from '../src/coil/wire-path.js';
import { fieldEmphasis, contourRank } from '../src/coil/field-emphasis.js';
import assert from 'node:assert/strict';
import { createCoilRenderer } from '../src/coil/renderer.js';
import { axialStrength, compassField, meridianField, fieldLineCount } from '../src/coil/physics.js';
import { buildFieldLines, buildAxialLines, FIELD_PROFILE_COUNT } from '../src/coil/field-paths.js';
import { createAnimationModel } from '../src/studio/model.js';
import { validateProject, createDemoProject } from '../src/studio/project.js';
import { createCompassDemo } from '../src/workspaces.js';
import { nice } from '../src/utils.js';
assert.equal(axialStrength(0),1);
assert.ok(axialStrength(3)<.04);
for(const x of [-3,-1,0,1,3])assert.ok(Math.abs(axialStrength(x)-axialStrength(-x))<1e-12);
assert.equal(compassField(125,1,0).angle,Math.PI/4);
assert.equal(compassField(-125,1,0).angle,-Math.PI/4);
assert.equal(compassField(0,1,0).angle,0);
for(const x of [0,.5,2]){const b=meridianField(x,0);assert.ok(b.x>0);assert.ok(Math.abs(b.y)<1e-12);}
for(const current of [25,125,250,500,1000]) {
 const levels=[0,1,2,3].map(rank=>fieldEmphasis(current,rank));
 assert.ok(levels.every((v,i)=>i===0||v<levels[i-1]),'small ellipse > large ellipse > curve > straight');
 for(let rank=0;rank<=3;rank++) {
  assert.equal(fieldEmphasis(-current,rank),levels[rank]);
  assert.ok(fieldEmphasis(current*2,rank)>levels[rank],'emphasis accumulates with strength');
 }
}
assert.equal(fieldEmphasis(0,0),0);
assert.ok(fieldEmphasis(50,0)>.5&&fieldEmphasis(50,3)<.15,'weak current emphasizes small ellipses');
assert.ok(contourRank(0)<contourRank(150)&&contourRank(150)<contourRank(511));
const fieldPaths=buildFieldLines();
assert.equal(fieldPaths.length,FIELD_PROFILE_COUNT);
assert.ok(fieldPaths.every(path=>path[0].x===0&&path.at(-1).x===0),'all closed contours start at the coil center x');
const conductor=buildWirePath();
assert.deepEqual(conductor.flow[0],conductor.inlet[0]);
assert.deepEqual(conductor.flow.at(-1),conductor.outlet.at(-1));
for(let i=1;i<conductor.flow.length;i++)assert.ok(Math.hypot(...conductor.flow[i].map((v,k)=>v-conductor.flow[i-1][k]))<=.025001,'continuous travel including lead corners');
assert.ok(conductor.flow.some(p=>p[0]<-1.5)&&conductor.flow.some(p=>p[0]>1.5),'particles enter and leave via straight leads');
assert.ok(fieldPaths.every(path=>path.closed),'all displayed field contours must close continuously');
assert.equal(fieldLineCount(0),0);assert.equal(fieldLineCount(250),128);
for(const current of [0,125,250,500,1000]) {
 assert.equal(fieldLineCount(current),fieldLineCount(-current));
 assert.equal(fieldLineCount(current),current*.512);
}
assert.equal(fieldLineCount(1000),512);
assert.ok(fieldLineCount(500)>fieldLineCount(125));
for(const path of fieldPaths) {
 assert.ok(path.length>40);
 assert.ok(path.every(p=>Math.sign(p.y)===Math.sign(path.centerY)));
 assert.deepEqual(path[0],path.at(-1));
 assert.ok(Math.min(...path.map(p=>p.x))<0);
 assert.ok(Math.max(...path.map(p=>p.x))>0);
 assert.ok(path.every(p=>Number.isFinite(p.x+p.y)));
}
for(let i=0;i<fieldPaths.length;i+=2) {
 const upper=fieldPaths[i],lower=fieldPaths[i+1];
 assert.deepEqual(upper.map(p=>({x:p.x,y:-p.y})),Array.from(lower),'matched reflected pairs');
 assert.ok(upper.inner>0&&upper.inner<.8,'inner side passes through coil aperture');
 assert.ok(upper.centerY+upper.radii.y>1,'return passes outside winding');
 for(const path of [upper,lower]) {
  const sign=Math.sign(path.centerY);
  for(let j=1;j<path.length;j++) {
   const a=path[j-1],b=path[j];
   if(Math.abs(a.x)<.3&&Math.abs(a.y)<.8) assert.ok(b.x-a.x>0,'both inner branches must point +x');
  }
 }
}
for(const path of fieldPaths.slice(0,100)) {
 assert.equal(path.extension,0);
 for(const p of path) assert.ok(Math.abs((p.x/path.radii.x)**2+((p.y-path.centerY)/path.radii.y)**2-1)<.0002,'near contours are offset ellipses');
}
const outer=fieldPaths.at(-2);
assert.ok(outer.extension>2);
assert.ok(outer.filter(p=>Math.abs(p.y-outer.inner)<1e-10).length>100,'outer inner side has a straight tangent');

const axial=buildAxialLines(7);
for(const sign of [1,-1]) {
 const early=axialReveal(axial[20],.1,sign);
 assert.equal(early.outgoing[0].x,0);
 assert.equal(Math.sign(early.outgoing.at(-1).x),sign);
 assert.equal(early.inward,0,'opposite edge remains hidden during outgoing stage');
 const returning=axialReveal(axial[20],.5,sign);
 assert.equal(returning.outward,1);
 assert.ok(returning.inward>0&&returning.inward<1);
 assert.equal(Math.sign(returning.incoming[0].x),-sign);
 assert.equal(returning.incoming.at(-1).x,0,'opposite edge returns toward center');
 assert.equal(axialReveal(axial[20],1,sign).inward,1);
}
assert.equal(axial.length,128);
assert.ok(axial.every(p=>!p.closed&&p[0].x===-7&&p.at(-1).x===7));
assert.ok(axial[0].every(p=>p.y===.0002),'straight line spans the viewport');
for(let i=0;i<axial.length;i+=2) {
 assert.deepEqual(axial[i].map(p=>({x:p.x,y:-p.y})),Array.from(axial[i+1]));
 assert.ok(axial[i].at(-1).y>=axial[i][200].y,'ends lift gently away from center');
}
const paths=[...fieldPaths,...axial],cells=new Map();let crossings=0,checked=0;
const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
for(let p=0;p<paths.length;p++)for(let j=1;j<paths[p].length;j++){
 const a=paths[p][j-1],b=paths[p][j],segment={p,j,a,b};
 const visited=new Set();
 for(let x=Math.floor(Math.min(a.x,b.x)*10);x<=Math.floor(Math.max(a.x,b.x)*10);x++)for(let y=Math.floor(Math.min(a.y,b.y)*10);y<=Math.floor(Math.max(a.y,b.y)*10);y++){
  const key=`${x},${y}`,list=cells.get(key)||[];
  for(const s of list){if(visited.has(s))continue;visited.add(s);if(p===s.p&&(Math.abs(j-s.j)<=1||(paths[p].closed&&Math.abs(j-s.j)>=paths[p].length-2)))continue;
   checked++;if(orient(a,b,s.a)*orient(a,b,s.b)<-1e-15&&orient(s.a,s.b,a)*orient(s.a,s.b,b)<-1e-15){crossings++;if(crossings<4)console.log({p,j,other:s.p,index:s.j});}
  }
  list.push(segment);cells.set(key,list);
 }
}
assert.equal(crossings,0);console.log(`Passed: ${paths.length} nested contours, ${checked} local segment checks, zero crossings.`);

const graphDemo=createDemoProject();
assert.equal(graphDemo.settings.workspace,'graphs');assert.equal(graphDemo.frames.at(-1).time,10);
const coilDemo=validateProject(createCompassDemo({capture:()=>graphDemo.state,captureSettings:()=>graphDemo.settings}));
const model=createAnimationModel({api:{nice},getFrames:()=>coilDemo.frames,getEasing:()=>coilDemo.settings.easing,duration:()=>7.5});
for(const [time,x] of [[0,-3],[1,-3],[2,-1.5],[3,0],[4,0],[5,1.5],[6,3],[7,3]])assert.equal(model.stateAt(time+.5).compassX,x);
assert.equal(coilDemo.settings.workspace,'coil');assert.equal(coilDemo.frames.length,7);
assert.equal(coilDemo.frames[0].time,0);assert.equal(coilDemo.frames[0].state.current,0);
assert.equal(coilDemo.frames[1].time,.5);assert.ok(coilDemo.frames.slice(1).every(frame=>frame.state.current===1000));
assert.equal(model.stateAt(.25).current,500);assert.equal(coilDemo.frames.at(-1).time,7.5);
const roundTrip=validateProject(JSON.parse(JSON.stringify(coilDemo)));
assert.deepEqual(roundTrip,coilDemo);
assert.throws(()=>validateProject({...coilDemo,state:{...coilDemo.state,compassX:4}}));
console.log('Passed: Biot–Savart symmetry, zero/reverse current, distance falloff, compass timeline, project serialization.');
let now=0;
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
globalThis.matchMedia=()=>({matches:false});globalThis.devicePixelRatio=1;globalThis.document={documentElement:{dataset:{theme:'light'}}};
const commands=[];
const context=new Proxy({createLinearGradient:()=>({kind:"field-gradient",stops:[],addColorStop(offset,color){this.stops.push([offset,color]);}})}, {get:(obj,key)=>key in obj?obj[key]:(...args)=>commands.push({key,args,stroke:obj.strokeStyle}),set:(obj,key,value)=>{obj[key]=value;return true;}});
const canvas={getContext:()=>context,getBoundingClientRect:()=>({width:900,height:450})};
const state={current:50,earth:1,compassX:-3,showCurrent:true,showField:true,showCompass:true};
const renderer=createCoilRenderer(canvas,()=>state);
function at(time){now=time;commands.length=0;renderer.draw(time);return [...commands];}
const initial=at(0), growing=at(1700), complete=at(4500);
const fieldSegments=list=>list.filter(c=>c.key==='lineTo'&&c.stroke?.kind==='field-gradient').length;
assert.ok(complete.some(c=>c.key==='stroke'&&c.stroke?.stops?.some(([offset,color])=>offset===.5&&color==='#70509a38')),'light theme central contrast');
assert.ok(fieldSegments(growing)>fieldSegments(initial));assert.ok(fieldSegments(complete)>fieldSegments(growing));
assert.ok(complete.some(c=>c.key==='arc'&&c.args[2]===1.25),'bright field heads');
assert.ok(complete.some(c=>c.key==='arc'&&c.args[2]===2.2),'bright current heads');
const beforeSeam=at(4560).filter(c=>c.key==='arc'&&c.args[2]===1.25)[0];
const afterSeam=at(4580).filter(c=>c.key==='arc'&&c.args[2]===1.25)[0];
assert.ok(Math.hypot(beforeSeam.args[0]-afterSeam.args[0],beforeSeam.args[1]-afterSeam.args[1])<20,'closed field head must not jump at cycle seam');
assert.ok(!complete.some(c=>c.key==='fillText'&&c.args[0].includes('자기력선')));
state.current=500;at(5000);
state.current=0;const zero=at(6000);
assert.ok(!zero.some(c=>c.key==='arc'&&[1.25,2.2].includes(c.args[2])));
state.current=250;state.compassX=0;const center=at(7000);assert.ok(center.some(c=>c.key==='fillText'&&c.args[0].includes('63.4°')));
state.current=-250;const reverse=at(8000);assert.ok(reverse.some(c=>c.key==='fillText'&&c.args[0].includes('-63.4°')));
state.showField=false;state.showCurrent=false;state.showCompass=false;const hidden=at(9000);assert.ok(!hidden.some(c=>c.key==='arc'));
document.documentElement.dataset.theme='dark';
state.showField=true;at(10000);const dark=at(15000);
assert.ok(dark.some(c=>c.key==='stroke'&&c.stroke?.stops?.some(([offset,color])=>offset===.5&&color==='#bda0df30')),'dark theme central light');
console.log('Passed: progressive accumulated traces, bright moving heads, field density with current, zero/reverse current, compass heading, independent layers.');

let encoded=0;
const videoCanvas={getContext:()=>context,toDataURL(){encoded++;return 'unused';}};
document.createElement=()=>videoCanvas;
commands.length=0;
assert.equal(renderer.renderCanvas('dark'),videoCanvas);
assert.equal(encoded,0,'direct video frame avoids PNG encoding');
assert.equal(commands.filter(c=>c.key==='clearRect').length,1,'video frame must not redraw preview');
assert.equal(videoCanvas.width,1920);assert.equal(videoCanvas.height,980);
commands.length=0;renderer.draw();
assert.equal(canvas.width,900,'preview target restored after offscreen frame');
console.log('Passed: offscreen canvas frame without encoding or duplicate preview rendering.');

state.showField=false;state.showCurrent=true;
function offlineHeads(wallTime) {
 now=wallTime;renderer.beginFrames();renderer.renderCanvas('dark',0);
 commands.length=0;renderer.renderCanvas('dark',.5);
 const heads=commands.filter(c=>c.key==='arc'&&c.args[2]===2.2).map(c=>c.args);
 renderer.endFrames();return heads;
}
assert.deepEqual(offlineHeads(20000),offlineHeads(80000),'offline particles follow frame time independently of real rendering time');
console.log('Passed: deterministic coil frame clock across different wall-clock times.');
