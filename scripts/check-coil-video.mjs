import assert from 'node:assert/strict';
import { installExport } from '../src/studio/export.js';

const elements=new Map(),events=new Map();
const $=id=> {
  if(!elements.has(id))elements.set(id,{value:id==='export-target'?'both':id==='export-theme'?'current':'',
    addEventListener(type,fn){events.set(`${id}:${type}`,fn);},pause(){},removeAttribute(){}});
  return elements.get(id);
};
let directFrames=0,copies=0,stopped=0,exporting=null,head=.5;
const locks=[],seeks=[];
const scene={kind:'coil pixels'};
const ctx={fillRect(){},fillText(){throw Error('UI titles and timestamps must not be exported');},drawImage(image,...rect){assert.equal(image,scene);assert.deepEqual(rect,[0,0,1920,1080]);copies++;}};
globalThis.HTMLCanvasElement=class {captureStream(){}};
globalThis.Image=class {constructor(){throw Error('Video must not decode SVG/PNG images');}};
globalThis.document={documentElement:{dataset:{theme:'dark'}},fonts:{ready:Promise.resolve()},
  querySelectorAll:()=>[],body:{append(){}},createElement(tag){
    if(tag==='a')return {click(){},remove(){}};
    assert.equal(tag,'canvas');
    return {getContext:()=>ctx,captureStream(fps){assert.equal(fps,30);return {getTracks:()=>[{stop(){stopped++;}}]};}};
  }};
globalThis.MediaRecorder=class {
  static isTypeSupported(){return true;}
  state='inactive';
  start(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable({data:new Blob(['video pixels'])});this.onstop();}
};
const previous={current:250};
const api={captureSettings:()=>({workspace:'coil'}),capture:()=>previous,settle(){},
  renderScene(){throw Error('Video must not PNG-encode the scene');},
  renderSceneCanvas(){directFrames++;return scene;},setSceneExporting(value){locks.push(value);},
  apply(value){assert.equal(value,previous);}};
installExport({api,$,stage:{},pause(){},message(){},seek(time){seeks.push(time);},duration:()=>.07,
  clock(){},getFrames:()=>[{},{}],getPlayhead:()=>head,setPlayhead(value){head=value;},
  getExporting:()=>exporting,setExporting(value){exporting=value;}});
await events.get('export-video:click')();
assert.ok(directFrames>=3);assert.equal(copies,directFrames);
assert.deepEqual(locks,[true,false]);assert.equal(stopped,1);
assert.equal(exporting,null);assert.equal(head,.5);
assert.equal(seeks[0],0);assert.equal(seeks.at(-1),.07);
assert.ok(!$('export-result').hidden);
URL.revokeObjectURL($('export-download').href);
console.log(`Passed: ${directFrames} direct canvas video frames, zero PNG/SVG conversions, preview suspension and state/stream cleanup.`);
