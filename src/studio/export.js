import { paletteFor } from '../palettes.js';
import { encodeFrames, supportsFrameExport } from './frame-export.js';
export function installExport({ api, $, stage, pause, message, seek, duration, clock, getFrames, getPlayhead, setPlayhead, getExporting, setExporting }) {
  const exportPalette=theme=>paletteFor(document.documentElement.dataset.palette,theme);
  function exportOptions() {
    return {target:$('export-target').value,theme:$('export-theme').value==='current'?document.documentElement.dataset.theme:$('export-theme').value};
  }
  function graphSvg(id,palette,x,y,width,height) {
    const source=$(id).cloneNode(true);
    source.removeAttribute('id');source.removeAttribute('class');source.removeAttribute('style');source.setAttribute('xmlns','http://www.w3.org/2000/svg');
    source.setAttribute('x',x);source.setAttribute('y',y);source.setAttribute('width',width);source.setAttribute('height',height);
    source.setAttribute('font-family','system-ui, -apple-system, sans-serif');
    source.querySelectorAll('[data-handle], [data-export-ui], circle[fill="transparent"]').forEach(el=>el.remove());
    source.querySelectorAll('.svg-math').forEach(el=>el.setAttribute('font-family','STIX Two Math, Cambria Math, STIXGeneral, serif'));
    source.querySelectorAll('[tabindex]').forEach(el=>{el.removeAttribute('tabindex');el.removeAttribute('role');el.removeAttribute('style');});
    return new XMLSerializer().serializeToString(source).replace(/var\(--([a-z-]+)\)/g,(_,name)=>palette[name]||palette.ink);
  }
  function composition(options) {
    const coil=api.captureSettings().workspace==='coil';
    const width=coil||options.target==='both'?1920:1600,height=1080,p=exportPalette(options.theme);
    let body=`<rect width="100%" height="100%" fill="${p.plot}"/>`;
    if(coil) {
      body+=`<image href="${api.renderScene(options.theme)}" x="0" y="0" width="${width}" height="${height}"/>`;
    } else {
      const ids=options.target==='both'?['curve','vectors']:[options.target];
      const boxWidth=width/ids.length;
      ids.forEach((id,index)=>{body+=graphSvg(id,p,index*boxWidth,0,boxWidth,height);});
    }
    return {width,height,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`};
  }
  async function rasterize(ctx,svg,width,height) {
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try {
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('그래프 이미지를 만들지 못했습니다.'));image.src=url;});
      ctx.clearRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
    } finally {URL.revokeObjectURL(url);}
  }
  async function renderVideoFrame(ctx,options,time,offline=false) {
    if(api.captureSettings().workspace!=='coil') {
      const image=composition(options,time);
      await rasterize(ctx,image.svg,image.width,image.height);
      return;
    }
    // Keep video frames as pixels: no PNG encoding, SVG wrapping or image decode.
    const p=exportPalette(options.theme);
    ctx.fillStyle=p.plot;ctx.fillRect(0,0,1920,1080);
    ctx.drawImage(api.renderSceneCanvas(options.theme,offline?time:undefined),0,0,1920,1080);
  }
  let lastExportUrl = null;
  function download(blob,name) {
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
    if(lastExportUrl) URL.revokeObjectURL(lastExportUrl);
    lastExportUrl=url;
    const isVideo=blob.type.startsWith('video/');
    $('export-image-preview').hidden=isVideo;$('export-video-preview').hidden=!isVideo;
    $('export-video-preview').pause();$('export-video-preview').removeAttribute('src');
    (isVideo?$('export-video-preview'):$('export-image-preview')).src=url;
    $('export-download').href=url;$('export-download').download=name;
    $('export-download').textContent=`${name} 다시 저장`;$('export-result').hidden=false;
  }
  $('export-image').addEventListener('click',async()=>{
    const button=$('export-image');button.disabled=true;pause();message('export-status','이미지를 만들고 있습니다…');
    try {
      api.settle();await document.fonts.ready;
      const options=exportOptions(),{svg,width,height}=composition(options);
      if($('export-format').value==='svg')download(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),`compass-${options.target}.svg`);
      else {
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        await rasterize(canvas.getContext('2d'),svg,width,height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        if(!blob)throw Error('PNG 이미지를 만들지 못했습니다.');
        download(blob,`compass-${options.target}.png`);
      }
      message('export-status',`${width} × ${height} 이미지 다운로드를 시작했습니다.`);
    }catch(error){message('export-status',error.message);}finally{button.disabled=false;}
  });
  const videoMime=typeof MediaRecorder!=='undefined'&&HTMLCanvasElement.prototype.captureStream?
    ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type)):null;
  const videoExtension=videoMime?.startsWith('video/mp4')?'mp4':'webm';
  const canFrames=supportsFrameExport();
  if(!canFrames)$('video-method').value='realtime';
  function videoSupport() {
    const frames=$('video-method').value==='frames';
    $('video-acceleration').disabled=!frames;
    $('video-support').textContent=frames
      ? '1080p · WebM · 프레임별 렌더링'
      : '1080p · 실시간 녹화 · 처리 성능에 따라 프레임이 누락될 수 있습니다.';
    if(frames)$('video-support').textContent=canFrames?'각 프레임을 순서대로 렌더링·압축합니다. 처리 속도와 관계없이 선택한 FPS를 유지합니다. 하드웨어 가속은 기기 지원에 따라 적용됩니다.':'프레임별 렌더링을 지원하지 않는 브라우저입니다. 실시간 녹화를 선택하세요.';
  }
  $('video-method').addEventListener('change',videoSupport);videoSupport();
  function exportLock(locked) {
    stage.inert=locked;$('coil-workspace').inert=locked;$('panel-controls').inert=locked;
    $('view-settings').disabled=locked;$('file-settings').disabled=locked;$('animation-controls').disabled=locked;$('keyframe-inspector-controls').disabled=locked;$('timeline-scroll').inert=locked;$('timeline-splitter').inert=locked;$('export-settings').disabled=locked;$('export-target').disabled=locked||api.captureSettings().workspace==='coil';
    document.querySelectorAll('[data-panel-tab], .header-actions button, #reset, #add-active, #help-open').forEach(button=>{button.disabled=locked;});
    $('panel-close').disabled=locked;$('panel-splitter').inert=locked;
    $('export-progress').hidden=!locked;$('export-cancel').hidden=!locked;
  }
  $('export-cancel').addEventListener('click',()=>{if(getExporting())getExporting().cancelled=true;});
  $('export-video').addEventListener('click',async()=>{
    if(getExporting()||getFrames().length<2||!duration())return;
    const offline=$('video-method').value==='frames';
    if(offline?!canFrames:!videoMime){message('export-status','선택한 내보내기 방식을 지원하지 않습니다. 다른 방식을 선택하세요.');return;}
    const fps=Number($('video-fps').value)||30,bitrate=Number($('video-bitrate').value)||8000000;
    pause();const previous=api.capture(),previousHead=getPlayhead(),options=exportOptions(),control={cancelled:false};
    const chunks=[];let recorder=null,stream=null,finished=null,recordError=null;
    setExporting(control);exportLock(true);$('export-progress').value=0;
    message('export-status','영상을 준비하고 있습니다…');
    try {
      await document.fonts.ready;seek(0);api.settle();
      api.setSceneExporting?.(true);
      const canvas=document.createElement('canvas');
      canvas.width=api.captureSettings().workspace==='coil'||options.target==='both'?1920:1600;canvas.height=1080;
      const ctx=canvas.getContext('2d');
      if(offline) {
        api.beginSceneFrames?.();
        const blob=await encodeFrames({canvas,fps,total:duration(),bitrate,acceleration:$('video-acceleration').value||'no-preference',
          render:async time=>{seek(time);api.settle();await renderVideoFrame(ctx,options,time,true);},
          cancelled:()=>control.cancelled,progress:(value,done,count)=>{$('export-progress').value=value;message('export-status',`프레임 렌더링·압축 중 · ${done} / ${count}`);}});
        if(blob){download(blob,'compass-animation.webm');message('export-status',`${fps} fps WebM 영상 다운로드를 시작했습니다.`);}
        return;
      }
      await renderVideoFrame(ctx,options,0);
      if(control.cancelled)return;
      stream=canvas.captureStream(fps);recorder=new MediaRecorder(stream,{mimeType:videoMime,videoBitsPerSecond:bitrate});
      finished=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>{recordError=Error('영상 녹화 중 오류가 발생했습니다.');reject(recordError);};});
      finished.catch(()=>{});
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.start(250);
      const start=performance.now(),total=duration();
      while(!control.cancelled && !recordError) {
        const frameStart=performance.now(),time=Math.min(total,(frameStart-start)/1000);
        seek(time);await renderVideoFrame(ctx,options,time);
        $('export-progress').value=time/total;message('export-status',`영상 저장 중 · ${Math.round(time/total*100)}% · 이 탭을 열어 두세요.`);
        if(time>=total)break;
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000/fps-(performance.now()-frameStart))));
      }
      if(!control.cancelled)await new Promise(resolve=>setTimeout(resolve,100));
      if(recorder.state!=='inactive')recorder.stop();await finished;
      if(recordError)throw recordError;
      if(!control.cancelled) {
        const blob=new Blob(chunks,{type:videoMime});if(!blob.size)throw Error('영상 데이터가 비어 있습니다.');
        download(blob,`compass-animation.${videoExtension}`);message('export-status',`${videoExtension.toUpperCase()} 영상 다운로드를 시작했습니다.`);
      }
    }catch(error){message('export-status',error.message);}finally{
      if(recorder&&recorder.state!=='inactive'){recorder.stop();if(finished)await finished.catch(()=>{});}
      stream?.getTracks().forEach(track=>track.stop());
      api.endSceneFrames?.();
      setExporting(null);exportLock(false);api.apply(previous,null);setPlayhead(previousHead);clock();api.setSceneExporting?.(false);
      if(control.cancelled)message('export-status','영상 내보내기를 취소했습니다.');
    }
  });
return { videoMime:canFrames?'video/webm':videoMime };
}
