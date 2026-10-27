import { paletteFor } from '../palettes.js';
import { compassField, fieldLineCount } from './physics.js';
import { buildFieldLines, buildAxialLines, FIELD_PROFILE_ORDER } from './field-paths.js';
import { fieldEmphasis, contourRank } from './field-emphasis.js';
import { axialReveal } from './field-reveal.js';
import { buildWirePath } from './wire-path.js';
import { clamp, fmt } from '../utils.js';

/** Accumulating trajectories with a bright travelling head, matching the reference's reveal method. */
export function createCoilRenderer(canvas, read) {
  const conductor=buildWirePath();
  let targetCanvas=canvas,ctx=canvas.getContext('2d'),exportCanvas=null;
  let paths = null, projectedPaths = null, frame = null, active = false, epoch = performance.now(), previousTime = epoch;
  let axialPaths=null, axialExtent=null;
  let offline=null;
  let needle = 0, lastCurrent = null, births = new Map(), savedTime = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let project = null;
  function sample(path, fraction) {
    const index=clamp(fraction,0,1)*(path.length-1),low=Math.floor(index),a=path[low],b=path[Math.min(path.length-1,low+1)],t=index-low;
    return a.map((v,i)=>v+(b[i]-v)*t);
  }
  function line(path, from, to, color, width=1) {
    if(to<=from || path.length<2)return;
    ctx.beginPath();
    const a=project(sample(path,from));ctx.moveTo(...a);
    const first=Math.floor(from*(path.length-1))+1,last=Math.floor(to*(path.length-1));
    for(let i=first;i<=last;i++)ctx.lineTo(...project(path[i]));
    ctx.lineTo(...project(sample(path,to)));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function head(path,t,color,radius=2.4) {
    const [x,y]=project(sample(path,t));
    ctx.shadowColor=color;ctx.shadowBlur=10;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  function draw(now=performance.now(),themeOverride=null,size=null) {
    const state=read(), {current,earth,compassX,showCurrent,showField,showCompass}=state;
    const rect=size||canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
    if(!w||!h)return;
    const dpr=size?1:Math.min(devicePixelRatio||1,2);
    if(targetCanvas.width!==Math.round(w*dpr)||targetCanvas.height!==Math.round(h*dpr)){targetCanvas.width=Math.round(w*dpr);targetCanvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const dark=(themeOverride||document.documentElement.dataset.theme)==='dark';
    const seminar=document.documentElement.dataset.palette==='seminar',p=paletteFor(document.documentElement.dataset.palette,dark?'dark':'light');
    const ink=seminar?p.ink:dark?'#eeebf3':'#383441',muted=seminar?p.muted:dark?'#9a92ad':'#908a9c';
    const wire=seminar?p.curve:dark?'#bda6df':'#88719f',bright=seminar?p.orange:dark?'#f0ddff':'#7551ad',charge=seminar?p.orange:dark?'#dfc9ff':'#76519d';
    ctx.fillStyle=seminar?p.plot:dark?'#111026':'#f7f6fa';ctx.fillRect(0,0,w,h);
    const scale=Math.min(w/8.5,h/3.8),cx=w/2,cy=h*.52;
    project=([x,y,z=0])=>[cx+scale*(x+.32*z),cy-scale*(y*.79+z*.44)];
    ctx.lineCap='round';ctx.lineJoin='round';

    // Fine spatial grid establishes the axis without competing with the trajectories.
    for(let x=-4;x<=4;x++){line([[x,-2,0],[x,2,0]],0,1,seminar?p.grid:dark?'#ffffff08':'#5544770a',.6);}
    line([[-4,0,0],[4,0,0]],0,1,seminar?p.axis+'55':dark?'#9182aa55':'#8d7caa44',.8);
    ctx.font='11px system-ui';ctx.fillStyle=muted;
    for(const x of [-3,-2,-1,0,1,2,3]) {const [px,py]=project([x,-.09,0]);ctx.fillText(`${x}R`,px-8,py+18);}
    ctx.fillText('중심축 x',...project([3.4,-.18,0]));
    const sign=current<0?-1:1;
    if(lastCurrent!==null && Math.sign(lastCurrent)!==Math.sign(current)){births.clear();epoch=now;}
    lastCurrent=current;
    const age=(now-epoch)/1000;
    const count=fieldLineCount(current);
    if(showField && count) {
      if(!paths) {
        paths=buildFieldLines();
        // All visible contours share one meridian plane. Rotating multiple planes
        // into a flat image created crossings that do not exist in the field.
        const plane=0; // Keep every upper/lower pair horizontally aligned with x=0.
        projectedPaths=FIELD_PROFILE_ORDER.map(index=>paths[index].map(p=>[p.x,p.y*Math.cos(plane),p.y*Math.sin(plane)]));
      }
      const extent=w/(2*scale)+.5;
      if(axialExtent!==extent) {
        axialExtent=extent;
        axialPaths=buildAxialLines(extent).map(path=>path.map(p=>[p.x,p.y,0]));
      }
      // Screen blending accumulates light where contours overlap. A soft
      // violet gradient keeps the central band restrained despite dense overlaps.
      const fieldInk=ctx.createLinearGradient(0,cy-h*.55,0,cy+h*.55);
      const stops=seminar
        ? [[0,p.curve+'18'],[.25,p.curve+'28'],[.43,p.curve+'30'],[.5,p.orange+'30'],[.57,p.curve+'30'],[.75,p.curve+'28'],[1,p.curve+'18']]
        : dark
        ? [[0,'#8065bc18'],[.25,'#9e7cd32e'],[.43,'#b293d832'],[.5,'#bda0df30'],[.57,'#b293d832'],[.75,'#9e7cd32e'],[1,'#8065bc18']]
        : [[0,'#70529c12'],[.25,'#7855aa28'],[.43,'#8053ad32'],[.5,'#70509a38'],[.57,'#8053ad32'],[.75,'#7855aa28'],[1,'#70529c12']];
      for(const [offset,color] of stops)fieldInk.addColorStop(offset,color);
      ctx.save();
      ctx.globalCompositeOperation=dark?'screen':'source-over';
      for(let n=0;n<count;n++) {
        if(!births.has(n))births.set(n,now+(n%12)*35);
        const elapsed=Math.max(0,(now-births.get(n))/1000),travel=elapsed/4.5;
        const reveal=reduced.matches?1:Math.min(travel,1);
        // Reserve one quarter of the count for the straight/very shallow
        // contours filling the gaps at both viewport edges.
        const slot=Math.floor(n/8)*2+n%2;
        let axialIndex=0;
        for(let bit=0;bit<6;bit++)axialIndex=(axialIndex<<1)|((Math.floor(slot/2)>>bit)&1);
        const axial=n%8<2, closedIndex=n-2*Math.floor(n/8)-2;
        const path=axial?axialPaths[axialIndex*2+slot%2]:projectedPaths[closedIndex];
        const rank=axial?3-axialIndex/63:contourRank(FIELD_PROFILE_ORDER[closedIndex]);
        ctx.globalAlpha=fieldEmphasis(current,rank);
        // Reverse traversal, not geometry: a polarity change follows the exact
        // same field lines in the opposite direction.
        const points=sign<0?path.toReversed():path;
        if(axial) {
          const phase=axialReveal(path,reveal,sign);
          line(phase.outgoing,0,phase.outward,fieldInk,.65);
          line(phase.incoming,0,phase.inward,fieldInk,.65);
        } else line(points,0,reveal,fieldInk,.65);
        if(!reduced.matches&&(n===2||n===3)){
          const t=travel%1;
          line(points,Math.max(0,t-.026),t,bright+'88',.85);
          head(points,t,bright,1.25);
        }
      }
      ctx.restore();
      ctx.globalAlpha=1;
    }
    for(const key of births.keys())if(key>=count||!showField)births.delete(key);
    const {coil,inlet,outlet,flow}=conductor;
    line(inlet,0,1,wire+'88',1.3);
    line(outlet,0,1,wire+'88',1.3);
    line(coil,0,1,wire+'75',1.2);
    if(showCurrent && current!==0) {
      const speed=Math.min(1.2,.35+Math.abs(current)/650),cycle=(age*speed)%1;
      // First pass grows a continuous trace; after that its accumulated line remains.
      const amount=reduced.matches?1:clamp(age*speed,0,1),wirePath=sign>0?flow:flow.toReversed();
      line(wirePath,0,amount,charge+'99',1.5);
      if(!reduced.matches)for(let n=0;n<8;n++){const t=(cycle+n/8)%1;if(t<=amount){line(wirePath,Math.max(0,t-.018),t,charge,2);head(wirePath,t,charge,2.2);}}
    }
    const fieldAtCompass=compassField(current,earth,compassX);
    const target=fieldAtCompass.angle,delta=Math.atan2(Math.sin(target-needle),Math.cos(target-needle));
    const dt=offline?Math.max(0,(now-previousTime)/1000):Math.min(.1,Math.max(0,(now-previousTime)/1000));
    needle=reduced.matches?target:needle+delta*(1-Math.exp(-dt*14));previousTime=now;
    if(showCompass){
      const [px,py]=project([compassX,0,0]),r=Math.min(43,scale*.42);
      ctx.save();ctx.translate(px,py);
      ctx.fillStyle=seminar?p.surface+'f0':dark?'#25232de8':'#fffffff0';ctx.strokeStyle=wire+'77';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle=muted;ctx.fillText('N',0,-r-9);
      for(let k=0;k<24;k++){ctx.save();ctx.rotate(k*Math.PI/12);ctx.beginPath();ctx.moveTo(0,-r+3);ctx.lineTo(0,-r+(k%6?6:10));ctx.stroke();ctx.restore();}
      ctx.rotate(needle);ctx.fillStyle=seminar?p.orange:dark?'#edab83':'#c67448';ctx.beginPath();ctx.moveTo(0,-r*.74);ctx.lineTo(r*.14,0);ctx.lineTo(-r*.14,0);ctx.fill();
      ctx.fillStyle=wire;ctx.beginPath();ctx.moveTo(0,r*.74);ctx.lineTo(r*.14,0);ctx.lineTo(-r*.14,0);ctx.fill();ctx.restore();
      if(!size){ctx.fillStyle=ink;ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(`𝜃 ${fmt(fieldAtCompass.angle*180/Math.PI,1)}°`,px,py+r+23);ctx.textAlign='start';}
    }
    if(!size){ctx.fillStyle=muted;ctx.font='11px system-ui';ctx.fillText('지구 자기장 ↑ 자북',20,28);
    ctx.fillText(`𝐼 ${fmt(current)} mA`,20,h-20);}
    savedTime=now;
  }
  function tick(now){frame=null;if(!active)return;draw(now);frame=requestAnimationFrame(tick);}
  return {
    draw,
    beginFrames() {
      offline={epoch,previousTime,needle,lastCurrent,births,savedTime,start:performance.now()};
      epoch=0;previousTime=0;needle=0;lastCurrent=null;births=new Map();
    },
    endFrames() {
      if(!offline)return;
      const elapsed=performance.now()-offline.start;
      ({epoch,previousTime,needle,lastCurrent,births,savedTime}=offline);
      epoch+=elapsed;births=new Map([...births].map(([key,time])=>[key,time+elapsed]));
      previousTime=performance.now();offline=null;
    },
    renderCanvas(theme,time) {
      exportCanvas ||= document.createElement('canvas');
      const previousCanvas=targetCanvas,previousContext=ctx;
      targetCanvas=exportCanvas;ctx=exportCanvas.getContext('2d');
      try {draw(time===undefined?performance.now():time*1000,theme,{width:1920,height:1080});return exportCanvas;}
      finally {targetCanvas=previousCanvas;ctx=previousContext;}
    },
    snapshot(theme) {
      exportCanvas ||= document.createElement('canvas');
      targetCanvas=exportCanvas;ctx=exportCanvas.getContext('2d');
      try {draw(performance.now(),theme,{width:1920,height:1080});return exportCanvas.toDataURL('image/png');}
      finally {targetCanvas=canvas;ctx=canvas.getContext('2d');draw();}
    },
    setActive(value){active=value;if(frame!==null)cancelAnimationFrame(frame);frame=null;if(active){previousTime=performance.now();frame=requestAnimationFrame(tick);}},
    restart(){epoch=performance.now();births.clear();needle=0;draw();},
    // Exposed only for deterministic physics/render verification, not DOM-global state.
    getLastDrawTime:()=>savedTime
  };
}
