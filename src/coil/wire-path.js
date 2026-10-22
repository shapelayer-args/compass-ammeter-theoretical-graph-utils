import { TURN_CENTERS } from './physics.js';

/** One continuous conductor, including both leads, sampled by distance. */
export function buildWirePath(spacing=.025) {
  const coil=Array.from({length:1601},(_,n)=> {
    const t=n/1600,angle=t*8*Math.PI*2;
    return [TURN_CENTERS[0]+t*(TURN_CENTERS.at(-1)-TURN_CENTERS[0]),Math.cos(angle),Math.sin(angle)];
  });
  const inlet=[[-2.7,-1.6,0],[TURN_CENTERS[0]-.16,-1.6,0],coil[0]];
  const outlet=[coil.at(-1),[TURN_CENTERS.at(-1)+.16,1.5,0],[2.7,1.5,0]];
  const raw=[...inlet,...coil.slice(1),...outlet.slice(1)],flow=[raw[0]];
  let carried=0;
  for(let i=1;i<raw.length;i++) {
    let a=raw[i-1];const b=raw[i];
    let distance=Math.hypot(...b.map((v,k)=>v-a[k]));
    while(carried+distance>=spacing) {
      const t=(spacing-carried)/distance;
      a=a.map((v,k)=>v+(b[k]-v)*t);flow.push(a);
      distance=Math.hypot(...b.map((v,k)=>v-a[k]));carried=0;
    }
    carried+=distance;
  }
  flow.push(raw.at(-1));
  return {coil,inlet,outlet,flow};
}
