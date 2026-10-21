import { clamp, nice, nearly } from "../utils.js";
import { CAL } from "../physics.js";
const SCALE_TRANSITION_DURATION = 500;
export function createGraphScales({ read, paintCurve, paintVectors, reducedMotion }) {
  let vectorScale = null;
  let scaleAnimation = null;
  let scaleFrame = null;
  function stopScaleAnimation() {
    if (scaleFrame !== null) cancelAnimationFrame(scaleFrame);
    scaleFrame = null;
    scaleAnimation = null;
  }

  function autoVectorScale() {
    const { current, earth, points, ratio, axisMode, drag, curveDrag, playbackView } = read();
    return Math.min(180, 240 / Math.max(1.3, Math.abs(current / CAL) * 1.18, earth * 1.18));
  }

  function animateVectorScale(time) {
    scaleFrame = null;
    if (!scaleAnimation) return;
    const { from, to, start } = scaleAnimation;
    const progress = clamp((time - start) / SCALE_TRANSITION_DURATION, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    // Interpolate magnification logarithmically for a smooth zoom at any scale.
    vectorScale = progress === 1 ? to : from * Math.pow(to / from, eased);
    paintVectors(vectorScale);
    if (progress < 1) scaleFrame = requestAnimationFrame(animateVectorScale);
    else scaleAnimation = null;
  }

  function drawVectors() {
    const { current, earth, points, ratio, axisMode, drag, curveDrag, playbackView } = read();
    const target = drag ? drag.scale : playbackView ? playbackView.vectorScale : autoVectorScale();
    if (vectorScale === null || drag || reducedMotion.matches) {
      stopScaleAnimation();
      vectorScale = target;
    } else if (scaleAnimation?.to !== target && Math.abs(vectorScale - target) > 1e-9) {
      stopScaleAnimation();
      scaleAnimation = { from: vectorScale, to: target, start: performance.now() };
      scaleFrame = requestAnimationFrame(animateVectorScale);
    } else if (scaleAnimation && Math.abs(vectorScale - target) <= 1e-9 && scaleAnimation.to !== target) {
      stopScaleAnimation();
      vectorScale = target;
    }
    paintVectors(vectorScale);
  }
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) { drawVectors(); drawCurve(); } });
  let curveBounds = null;
  let curveAnimation = null;
  let curveFrame = null;

  function stopCurveAnimation() {
    if (curveFrame !== null) cancelAnimationFrame(curveFrame);
    curveFrame = null;
    curveAnimation = null;
  }

  function autoCurveBounds() {
    const { current, earth, points, ratio, axisMode, drag, curveDrag, playbackView } = read();
    const extent = Math.max(2, ...points.map(p => Math.abs(ratio(p.i))), Math.abs(ratio(current)));
    const yMax = nice(extent * 1.15);
    return { yMax, xMax: axisMode === "angle" ? 90 : yMax * CAL * earth, mode: axisMode };
  }

  function animateCurveBounds(time) {
    curveFrame = null;
    if (!curveAnimation) return;
    const { from, to, start } = curveAnimation;
    const progress = clamp((time - start) / SCALE_TRANSITION_DURATION, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    curveBounds = {
      mode: to.mode,
      xMax: progress === 1 ? to.xMax : from.xMax * Math.pow(to.xMax / from.xMax, eased),
      yMax: progress === 1 ? to.yMax : from.yMax * Math.pow(to.yMax / from.yMax, eased)
    };
    paintCurve(curveBounds);
    if (progress < 1) curveFrame = requestAnimationFrame(animateCurveBounds);
    else curveAnimation = null;
  }

  function drawCurve() {
    const { current, earth, points, ratio, axisMode, drag, curveDrag, playbackView } = read();
    const target = curveDrag ? { xMax: curveDrag.xMax, yMax: curveDrag.yMax, mode: axisMode } : playbackView ? { yMax: playbackView.yMax, xMax: axisMode === "angle" ? 90 : playbackView.xMax, mode: axisMode } : autoCurveBounds();
    const sameBounds = bounds => bounds && bounds.mode === target.mode && nearly(bounds.xMax, target.xMax) && nearly(bounds.yMax, target.yMax);
    if (!curveBounds || curveBounds.mode !== target.mode || curveDrag || reducedMotion.matches) {
      stopCurveAnimation(); curveBounds = target;
    } else if (!sameBounds(curveAnimation?.to)) {
      stopCurveAnimation();
      if (!sameBounds(curveBounds)) {
        curveAnimation = { from: { ...curveBounds }, to: target, start: performance.now() };
        curveFrame = requestAnimationFrame(animateCurveBounds);
      } else curveBounds = target;
    }
    paintCurve(curveBounds);
  }
  return {
    stopScaleAnimation, stopCurveAnimation, autoVectorScale, autoCurveBounds, drawCurve, drawVectors,
    get vectorScale() { return vectorScale; }, set vectorScale(value) { vectorScale = value; },
    get curveBounds() { return curveBounds; }, set curveBounds(value) { curveBounds = value; }
  };
}
