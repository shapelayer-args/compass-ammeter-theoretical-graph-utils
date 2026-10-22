/** Schematic contours, independent of the compass's numerical field model. */
export const FIELD_PROFILE_COUNT = 512;

// Reveal matched upper/lower pairs, inserting new profiles between old ones.
export const FIELD_PROFILE_ORDER = Array.from({length:256}, (_,n)=> {
  let reversed=0;
  for(let bit=0;bit<8;bit++) reversed=(reversed<<1)|((n>>bit)&1);
  return reversed;
}).flatMap(n=>[n*2,n*2+1]);

function resample(path, spacing=.035) {
  const result=[path[0]];
  let carried=0;
  for(let i=1;i<path.length;i++) {
    let a=path[i-1];const b=path[i];
    let distance=Math.hypot(b.x-a.x,b.y-a.y);
    while(carried+distance>=spacing) {
      const t=(spacing-carried)/distance;
      a={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      result.push(a);distance=Math.hypot(b.x-a.x,b.y-a.y);carried=0;
    }
    carried+=distance;
  }
  result.push({...path[0]});return result;
}

/** Upper/lower pairs pass through the coil aperture on their inner side and
 * return outside the winding. Growing ellipses approach the central axis;
 * their large-radius inner sides become horizontal tangent runs. All profiles
 * share x=0, but have distinct inner offsets to avoid coincident field lines.
 */
export function buildFieldLines(count=FIELD_PROFILE_COUNT) {
  const pairs=Math.ceil(count/2);
  return Array.from({length:pairs},(_,i)=> {
    const t=i/Math.max(1,pairs-1);
    const rx=.85+8*t, ry=.45+4*t;
    const inner=.015+.72*(1-t)**2;
    const blend=Math.max(0,(t-.3)/.7);
    const extension=3*blend*blend;
    const points=[{x:0,y:inner}];
    for(let j=0;j<=160;j++) {
      const angle=-Math.PI/2+j*Math.PI/160;
      points.push({x:extension+rx*Math.cos(angle),y:inner+ry*(1+Math.sin(angle))});
    }
    for(let j=0;j<=160;j++) {
      const angle=Math.PI/2+j*Math.PI/160;
      points.push({x:-extension+rx*Math.cos(angle),y:inner+ry*(1+Math.sin(angle))});
    }
    points.push({...points[0]});
    const upper=resample(points);
    // Reflect positions while preserving +x traversal through the aperture.
    const lower=upper.map(p=>({x:p.x,y:-p.y}));
    for(const path of [upper,lower]) {
      path.closed=true;path.radii={x:rx,y:ry};path.extension=extension;
      path.inner=inner;path.centerY=(path===upper?1:-1)*(inner+ry);
    }
    return [upper,lower];
  }).flat().slice(0,count);
}

/** Open, viewport-spanning portions of the farthest field contours.
 * Stay inside the innermost closed contour, so filling the side gaps never
 * crosses the existing return paths. Their continuation lies outside the view.
 */
export function buildAxialLines(extent, count=128) {
  return Array.from({length:Math.ceil(count/2)},(_,i)=> {
    const fraction=i/Math.max(1,Math.ceil(count/2)-1);
    const upper=Array.from({length:401},(_,j)=> {
      const x=-extent+2*extent*j/400;
      const beyond=Math.max(0,Math.abs(x)-3);
      const boundary=.015+4.45*(1-Math.sqrt(Math.max(0,1-(beyond/8.85)**2)));
      return {x,y:.0002+fraction*.94*boundary};
    });
    const lower=upper.map(p=>({x:p.x,y:-p.y}));
    for(const path of [upper,lower])path.closed=false;
    return [upper,lower];
  }).flat().slice(0,count);
}
