import { muxWebM } from './webm.js';
export const supportsFrameExport=()=>typeof VideoEncoder!=='undefined'&&typeof VideoFrame!=='undefined';
export async function encodeFrames({canvas,fps,total,bitrate,acceleration,render,cancelled,progress}) {
  if(!supportsFrameExport())throw Error('이 브라우저는 프레임별 내보내기를 지원하지 않습니다. 실시간 녹화를 선택하세요.');
  let config;
  for(const codec of ['vp09.00.41.08','vp8']) {
    const candidate={codec,width:canvas.width,height:canvas.height,framerate:fps,bitrate,hardwareAcceleration:acceleration,latencyMode:'realtime'};
    if((await VideoEncoder.isConfigSupported(candidate)).supported){config=candidate;break;}
  }
  if(!config)throw Error('선택한 압축 가속 방식을 지원하지 않습니다. 자동 또는 소프트웨어로 변경하세요.');
  const chunks=[];let error=null,bytes=0;
  const encoder=new VideoEncoder({output(chunk){
    bytes+=chunk.byteLength;
    if(bytes>256*1024*1024){error=Error('압축 영상이 256 MB를 초과했습니다. 화질이나 길이를 낮춰 주세요.');return;}
    const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);
    chunks.push({data,timestamp:chunk.timestamp,key:chunk.type==='key'});
  },error(value){error=value;}});
  const count=Math.ceil(total*fps);
  try {
    encoder.configure(config);
    for(let i=0;i<count;i++) {
      if(cancelled())return null;if(error)throw error;
      const time=i/fps,timestamp=Math.round(time*1e6),end=Math.round(Math.min(total,(i+1)/fps)*1e6);
      await render(time);
      if(cancelled())return null;
      const frame=new VideoFrame(canvas,{timestamp,duration:end-timestamp});
      try{encoder.encode(frame,{keyFrame:i%(fps*2)===0});}finally{frame.close();}
      // Bound GPU/CPU encoder queues and yield so Cancel remains responsive.
      if(encoder.encodeQueueSize>=4)await encoder.flush();
      if(i%4===0)await new Promise(resolve=>setTimeout(resolve,0));
      progress((i+1)/count,i+1,count);
    }
    await encoder.flush();if(error)throw error;if(cancelled())return null;
    return muxWebM(chunks,{width:canvas.width,height:canvas.height,fps,duration:total,codec:config.codec});
  }finally{if(encoder.state!=='closed')encoder.close();}
}
