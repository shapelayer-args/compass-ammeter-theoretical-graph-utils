import assert from 'node:assert/strict';
import { independentFrames,changedChannels,moveChannels,channelToken } from '../src/studio/channels.js';
import { createAnimationModel,validateFrames } from '../src/studio/model.js';
const state=(current=0,compassX=0)=>({current,earth:1,compassX,points:[{id:1,i:50,color:'#123456'}]});
const frames=[
 {id:1,time:0,name:'start',state:state(),channels:['current','earth','compass','point-1']},
 {id:2,time:1,name:'position only',state:state(99,2),channels:['compass']},
 {id:3,time:2,name:'current only',state:state(100,3),channels:['current']}
];
const model=createAnimationModel({api:{},getFrames:()=>frames,getEasing:()=> 'linear',duration:()=>2});
assert.equal(model.stateAt(1).current,50,'unrelated position key must not interrupt current interpolation');
assert.equal(model.stateAt(1.5).compassX,2,'unrelated current key must not affect position');
assert.equal(model.stateAt(2).earth,1);
assert.deepEqual(changedChannels(state(),state(100)),['current']);
assert.deepEqual(changedChannels(state(),{...state(),points:[{...state().points[0],opacity:1}]}),[]);
const legacy=independentFrames([{id:1,time:0,state:state()},{id:2,time:1,state:state(50)},{id:3,time:2,state:state(100)}]);
assert.deepEqual(legacy[1].channels,['current']);
assert.deepEqual(legacy[2].channels,['current']);
const selected=new Set([channelToken(1,'current'),channelToken(2,'compass')]);
const moved=moveChannels(frames,selected,.5);
assert.ok(moved);assert.equal(moved.selection.size,2);
assert.ok(moved.frames.find(f=>f.time===0).channels.includes('earth'));
assert.ok(!moved.frames.find(f=>f.time===0).channels.includes('current'));
assert.deepEqual(moved.frames.find(f=>f.time===.5).channels,['current']);
assert.equal(moved.frames.find(f=>f.time===1.5).state.compassX,2);
assert.equal(moveChannels(frames,new Set(['1:current']),2),null,'same-variable collision rejects entire move');
assert.equal(moveChannels(frames,selected,-.5),null,'negative group move rejected atomically');
const merged=moveChannels(frames,new Set(['1:earth']),1);
assert.ok(merged.frames.find(f=>f.time===1).channels.includes('earth'),'different variables may share a timestamp');
const roundtrip=validateFrames(JSON.parse(JSON.stringify(moved.frames)));
assert.deepEqual(roundtrip.map(f=>f.channels),moved.frames.map(f=>f.channels));
assert.throws(()=>validateFrames([{time:0,state:state(),channels:['invalid']} ]));
console.log('Passed: independent interpolation, unchanged variables, point defaults, legacy migration, multi-key moves, split/merge, collisions, persistence.');
