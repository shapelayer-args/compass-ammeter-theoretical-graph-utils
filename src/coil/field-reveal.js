/** Visible portions of an open contour, with the far return outside the view.
 * The first quarter follows the coil's outgoing direction; the opposite edge
 * begins its inward return as a closed ellipse turns back after its first cap.
 */
export function axialReveal(path, progress, sign) {
  const middle=Math.floor(path.length/2);
  const right=path.slice(middle),left=path.slice(0,middle+1);
  return {
    outgoing:sign<0?left.toReversed():right,
    incoming:sign<0?right.toReversed():left,
    outward:Math.min(1,Math.max(0,progress/.25)),
    inward:Math.min(1,Math.max(0,(progress-.25)/.75))
  };
}
