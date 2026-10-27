import assert from 'node:assert/strict';
import { encodeFrames } from '../src/studio/frame-export.js';
let live=0,closed=0,stamps=[],config;
globalThis.VideoFrame=class {constructor(canvas,options){Object.assign(this,options);live++;}close(){live--;}};
globalThis.VideoEncoder=class {
 static async isConfigSupported(c){return {supported:true,config:c};}
 constructor(callbacks){this.callbacks=callbacks;this.state='unconfigured';this.encodeQueueSize=0;}
 configure(c){config=c;this.state='configured';}
 encode(frame,options){stamps.push(frame.timestamp);this.callbacks.output({byteLength:3,timestamp:frame.timestamp,type:options.keyFrame?'key':'delta',copyTo(data){data.set([1,2,3]);}});}
 async flush(){}
 close(){this.state='closed';closed++;}
};
for(const fps of [24,30,60]) {
 const times=[];stamps=[];
 const blob=await encodeFrames({canvas:{width:1920,height:1080},fps,total:.25,bitrate:8000000,acceleration:'prefer-hardware',
   render:async time=>{times.push(time);await new Promise(resolve=>setTimeout(resolve,2));},cancelled:()=>false,progress(){}});
 assert.equal(times.length,Math.ceil(.25*fps));
 assert.deepEqual(times,Array.from({length:times.length},(_,i)=>i/fps));
 assert.deepEqual(stamps,times.map(t=>Math.round(t*1e6)));
 assert.equal(config.hardwareAcceleration,'prefer-hardware');assert.equal(blob.type,'video/webm');
 assert.equal(live,0);
 const bytes=new Uint8Array(await blob.arrayBuffer());assert.deepEqual([...bytes.slice(0,4)],[0x1a,0x45,0xdf,0xa3]);
}
let count=0;
assert.equal(await encodeFrames({canvas:{width:1920,height:1080},fps:30,total:5,bitrate:4000000,acceleration:'prefer-software',render:async()=>{count++;},cancelled:()=>count>1,progress(){}}),null);
assert.equal(live,0);assert.equal(closed,4);
console.log('Passed: fixed 24/30/60 fps timestamps despite slow rendering, compressed WebM, acceleration settings, cancellation and frame/encoder cleanup.');
