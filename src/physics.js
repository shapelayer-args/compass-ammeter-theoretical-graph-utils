export const CAL = 125;
export const MAX_I = 1e6;
export const MAX_R = MAX_I / CAL;
export const DEG = 180 / Math.PI;
export const MIN_EARTH = .05, MAX_EARTH = 100;
export function createPhysics(getEarth) {
  const ratio = i => i / (CAL * getEarth());
  const theta = i => Math.atan(ratio(i)) * DEG;
  const magnitude = i => Math.hypot(1, ratio(i));
  return { ratio, theta, magnitude };
}
