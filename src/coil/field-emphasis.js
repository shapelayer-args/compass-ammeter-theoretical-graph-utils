/** Emphasis builds from small ellipses (0) to large ellipses (1),
 * outward curves (2), and almost straight contours (3). */
export function fieldEmphasis(current, rank) {
  const strength=Math.abs(current);
  if(strength===0)return 0;
  return .08+.92*(1-Math.exp(-strength/(60*4**rank)));
}

export function contourRank(profileIndex) {
  const size=profileIndex/511;
  return size<.3?size/.3:1+(size-.3)/.7;
}
