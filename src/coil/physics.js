/** Circular turns about +x, radius R=1. Field is normalized to the center.
 * Biot–Savart: OpenStax University Physics II, sections 12.1 and 12.4.
 * Visualization is magnetostatic; moving dots indicate direction, not transport of B.
 */
export const TURN_CENTERS = Array.from({length:8}, (_, i) => (i - 3.5) * .12);
const segments = Array.from({length:64}, (_, i) => {
  const a = (i + .5) * Math.PI * 2 / 64;
  return { y: Math.cos(a), z: Math.sin(a), dy: -Math.sin(a), dz: Math.cos(a) };
});
export function meridianField(x, y) {
  let bx = 0, by = 0;
  // Averaging the tightly spaced turns preserves the existing center calibration.
  for (const center of TURN_CENTERS) for (const segment of segments) {
    const dx = x - center, dy = y - segment.y, dz = -segment.z;
    const r3 = Math.max(1e-7, (dx*dx + dy*dy + dz*dz) ** 1.5);
    bx += (segment.dy * dz - segment.dz * dy) / r3;
    by += segment.dz * dx / r3;
  }
  const norm = 64 * TURN_CENTERS.length;
  return { x: bx / norm, y: by / norm };
}
const centerField = TURN_CENTERS.reduce((sum,x)=>sum+(1+x*x)**-1.5,0);
export function axialStrength(x) {
  return TURN_CENTERS.reduce((sum,center)=>sum+(1+(x-center)**2)**-1.5,0) / centerField;
}
export function compassField(current, earth, x) {
  const coil = current / 125 * axialStrength(x);
  return { coil, earth, magnitude: Math.hypot(coil,earth), angle: Math.atan2(coil,earth) };
}
export function fieldLineCount(current) {
  // One pair per 3.90625 mA; quantize only to preserve upper/lower symmetry.
  return Math.min(512,2*Math.round(Math.abs(current)*.256));
}
