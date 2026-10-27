// Minimal video-only WebM muxer (VP8/VP9), millisecond timecodes.
const text=value=>new TextEncoder().encode(value);
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
function uint(value){let n=BigInt(value),length=1;while(n>=1n<<BigInt(length*8))length++;const out=new Uint8Array(length);for(let i=length-1;i>=0;i--){out[i]=Number(n&255n);n>>=8n;}return out;}
function size(value){let length=1;while(value>=2**(7*length)-1)length++;const out=new Uint8Array(length);let n=BigInt(value)|(1n<<BigInt(length*7));for(let i=length-1;i>=0;i--){out[i]=Number(n&255n);n>>=8n;}return out;}
const element=(id,...parts)=>{const body=join(parts);return join([uint(id),size(body.length),body]);};
const number=(id,value)=>element(id,uint(value));
function float(id,value){const b=new Uint8Array(8);new DataView(b.buffer).setFloat64(0,value);return element(id,b);}
export function muxWebM(chunks,{width,height,fps,duration,codec}) {
  if(!chunks.length)throw Error('인코딩된 프레임이 없습니다.');
  const header=element(0x1a45dfa3,number(0x4286,1),number(0x42f7,1),number(0x42f2,4),number(0x42f3,8),element(0x4282,text('webm')),number(0x4287,4),number(0x4285,2));
  const info=element(0x1549a966,number(0x2ad7b1,1000000),float(0x4489,duration*1000),element(0x4d80,text('Field Lab')),element(0x5741,text('Field Lab')));
  const tracks=element(0x1654ae6b,element(0xae,number(0xd7,1),number(0x73c5,1),number(0x83,1),element(0x86,text(codec==='vp8'?'V_VP8':'V_VP9')),number(0x23e383,Math.round(1e9/fps)),element(0xe0,number(0xb0,width),number(0xba,height))));
  const clusters=[],cues=[];let blocks=[],start=0,position=info.length+tracks.length;
  const finish=()=>{if(!blocks.length)return;const cluster=element(0x1f43b675,number(0xe7,start),...blocks);cues.push(element(0xbb,number(0xb3,start),element(0xb7,number(0xf7,1),number(0xf1,position))));clusters.push(cluster);position+=cluster.length;blocks=[];};
  for(const chunk of chunks) {
    const time=Math.round(chunk.timestamp/1000);
    if(blocks.length&&(chunk.key||time-start>30000))finish();
    if(!blocks.length)start=time;
    const block=new Uint8Array(4+chunk.data.length);block[0]=0x81;new DataView(block.buffer).setInt16(1,time-start);block[3]=chunk.key?0x80:0;block.set(chunk.data,4);
    blocks.push(element(0xa3,block));
  }
  finish();
  // Blob parts avoid another full-size copy of the compressed video.
  const cueData=element(0x1c53bb6b,...cues),length=info.length+tracks.length+clusters.reduce((n,p)=>n+p.length,0)+cueData.length;
  return new Blob([header,uint(0x18538067),size(length),info,tracks,...clusters,cueData],{type:'video/webm'});
}
