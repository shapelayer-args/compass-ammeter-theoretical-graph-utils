import { createGraphScales } from "./scales.js";
import { clamp, fmt, raw, esc, nearly, nice } from "../utils.js";
import { CAL, MAX_I, MAX_R, DEG, MIN_EARTH, MAX_EARTH, createPhysics } from "../physics.js";
import { paintCurve as renderCurve } from "./curve.js";
import { paintVectors as renderVectors } from "./vectors.js";
import { installPresentation } from "../presentation.js";

/** Owns graph state and interaction; exposes snapshots to the animation studio. */
export function createGraphController() {
  const $ = id => document.getElementById(id);
  const colors = ["var(--blue)", "var(--green)", "#a855f7", "#dc6041", "#0891b2", "#b7791f"];
  let nextId = 1;
  let colorIndex = 0;
  let points = [];
  const pointListeners = new Set();
  const notifyPoints = (reason) => pointListeners.forEach(listener => listener(reason));
  let current = 125;
  let axisMode = "angle";
  let preferredDirection = 1;
  let sliderLimit = 500;
  let playbackView = null;
  let drag = null;
  let vectorGeometry = null;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let curveGeometry = null;
  const scales = createGraphScales({
    read: () => ({ current, earth, points, ratio, axisMode, drag, curveDrag, playbackView }),
    paintCurve, paintVectors, reducedMotion
  });
  const { stopScaleAnimation, stopCurveAnimation, autoVectorScale, autoCurveBounds, drawCurve, drawVectors } = scales;
  let earth = 1;
  let curveDrag = null;
  let suppressCurveClick = false;
  let theater = null;
  let theaterScroll = 0;
  function setTheater(id) {
    const previous = theater;
    if (!previous && id) theaterScroll = window.scrollY;
    theater = id;
    if (id) document.body.dataset.theater = id;
    else delete document.body.dataset.theater;
    ["curve", "vectors"].forEach(chartId => {
      const active = chartId === id;
      $(chartId).closest(".graph-card").classList.toggle("theater-active", active);
      const button = $("theater-" + chartId);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", (chartId === "curve" ? "전류와 편향각" : "자기장의 합") + (active ? " 그래프 기본 보기" : " 그래프 영화관 보기"));
      button.title = active ? "원래 배치로 돌아가기 (Esc)" : "그래프를 화면 대부분에 표시";
      const label = button.querySelector("span");
      if (label) label.textContent = active ? "기본 보기 · Esc" : "영화관 보기";
      else button.textContent = active ? "⤢" : "⛶";
    });
    window.scrollTo({ top: id ? 0 : theaterScroll, behavior: "instant" });
    if (previous && !id) $("theater-" + previous).focus({ preventScroll: true });
  }
  const curve = $("curve");
  const vectors = $("vectors");
  const { ratio, theta, magnitude } = createPhysics(() => earth);
  function status(message = "") {
    $("status").textContent = message;
  }

  function makePoint(i) {
    return { id: nextId++, i, color: colors[colorIndex++ % colors.length] };
  }

  function setCurrent(value, options = {}) {
    if (!Number.isFinite(value)) return false;
    const bounded = clamp(value, -MAX_I, MAX_I);
    current = Math.abs(bounded) < 1e-9 ? 0 : bounded;
    if (current !== 0) preferredDirection = Math.sign(current);
    if (!options.keepSlider) sliderLimit = Math.min(MAX_I, Math.max(500, nice(Math.abs(current) * 1.15)));
    render();
    if (bounded !== value) status("표시 범위에 맞춰 전류를 ±1,000,000 mA 이내로 제한했습니다.");
    else if (!options.keepStatus) status();
    return true;
  }

  function addPoint(value) {
    if (!Number.isFinite(value) || Math.abs(value) > MAX_I) {
      status("−1,000,000 ~ 1,000,000 mA 범위의 숫자를 입력하세요.");
      return;
    }
    if (points.some(p => nearly(p.i, value))) {
      setCurrent(value);
      status("이미 있는 전류 값입니다. 해당 값을 선택했습니다.");
      return;
    }
    points.push(makePoint(value));
    setCurrent(value);
    renderList();
    status(`${fmt(value)} mA 점을 추가했습니다.`);
    notifyPoints("edit");
  }

  function renderList() {
    $("point-list").innerHTML = points.length
      ? [...points].sort((a, b) => a.i - b.i).map(p => `
        <tr>
          <td>
            <button type="button" class="point-select" data-select="${p.id}"
              aria-label="${esc(fmt(p.i))} 밀리암페어 선택">
              <span class="dot" style="background:${p.color}"></span>
              ${esc(fmt(p.i))} mA
            </button>
          </td>
          <td>${fmt(theta(p.i))}°</td>
          <td>${fmt(ratio(p.i), 3)}</td>
          <td><button type="button" data-remove="${p.id}"
            aria-label="${esc(fmt(p.i))} 밀리암페어 점 삭제">삭제</button></td>
        </tr>`).join("")
      : '<tr><td class="empty" colspan="4">저장된 점이 없습니다. 새 전류 값을 추가하세요.</td></tr>';
  }

  function paintCurve(bounds) {
    renderCurve({ $, curve, axisMode, theta, ratio, current, points, curveDrag, earth,
      setGeometry: value => { curveGeometry = value; } }, bounds);
  }

  function paintVectors(scale) {
    renderVectors({ vectors, current, earth, theta, drag,
      setGeometry: value => { vectorGeometry = value; } }, scale);
  }

  const vectorResize = new ResizeObserver(() => {
    if (scales.vectorScale !== null) paintVectors(scales.vectorScale);
  });
  vectorResize.observe(vectors);

  function render() {
    drawCurve();
    drawVectors();
    $("earth").value = raw(earth);
    document.querySelector(".calibration").textContent = `${fmt(CAL * earth)} mA ↔ 45°`;
    $("manual").min = -MAX_R / earth;
    $("manual").max = MAX_R / earth;
    $("current").value = raw(current);
    $("angle").value = raw(theta(current));
    $("manual").value = raw(ratio(current));
    $("total").value = raw(magnitude(current));
    $("direction").value = String(preferredDirection);
    document.querySelectorAll("[data-current]").forEach(button => button.setAttribute("aria-pressed", String(nearly(Number(button.dataset.current), current))));
    $("read-current").textContent = `${fmt(current)} mA`;
    $("read-angle").textContent = `${fmt(theta(current))}°`;
    $("read-total").textContent = fmt(magnitude(current), 3);
    const slider = $("current-slider");
    slider.min = -sliderLimit;
    slider.max = sliderLimit;
    slider.step = Math.max(.1, sliderLimit / 50000);
    slider.value = current;
    $("slider-min").textContent = `${fmt(-sliderLimit)} mA`;
    $("slider-max").textContent = `${fmt(sliderLimit)} mA`;
  }

  // Native number validation, with a numerical safety check for programmatic input.
  function bindNumber(id, convert, valid, message) {
    const input = $(id);
    input.addEventListener("change", () => {
      const value = input.valueAsNumber;
      if (!Number.isFinite(value) || !valid(value)) {
        status(message);
        render();
        return;
      }
      setCurrent(convert(value));
    });
  }

  bindNumber("current", v => v, v => Math.abs(v) <= MAX_I,
    "전류는 −1,000,000 ~ 1,000,000 mA 범위로 입력하세요.");
  bindNumber("angle", v => CAL * earth * Math.tan(v / DEG), v => Math.abs(v) <= Math.atan(MAX_R / earth) * DEG,
    "현재 지구 자기장과 전류 범위에 해당하는 각도를 입력하세요. ±90°는 유한한 전류에 대응하지 않습니다.");
  bindNumber("manual", v => CAL * earth * v, v => Math.abs(v) <= MAX_R / earth,
    "현재 지구 자기장과 전류 범위에 해당하는 자기장 비를 입력하세요.");
  bindNumber("total", v => preferredDirection * CAL * earth * Math.sqrt((v - 1) * (v + 1)),
    v => v >= 1 && v <= Math.hypot(1, MAX_R / earth),
    "합벡터 크기는 1 이상이고, 전류 표시 범위에 해당하는 값이어야 합니다.");

  $("earth").addEventListener("change", event => {
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value) || value < MIN_EARTH || value > MAX_EARTH) {
      status("지구 자기장은 초기값 대비 0.05~100 범위로 입력하세요."); render(); return;
    }
    earth = value; render(); renderList(); status();
  });
  document.querySelectorAll("[data-theater]").forEach(button => button.addEventListener("click", () => {
    setTheater(theater === button.dataset.theater ? null : button.dataset.theater);
  }));
  $("direction").addEventListener("change", event => {
    preferredDirection = Number(event.target.value);
    setCurrent(preferredDirection * Math.abs(current));
  });
  $("current-slider").addEventListener("input", event => {
    setCurrent(Number(event.target.value), { keepSlider: true });
  });
  $("add-form").addEventListener("submit", event => {
    event.preventDefault();
    addPoint($("new-current").valueAsNumber);
  });
  $("add-active").addEventListener("click", () => addPoint(current));

  $("point-list").addEventListener("click", event => {
    const select = event.target.closest("[data-select]");
    const remove = event.target.closest("[data-remove]");
    if (select) {
      const p = points.find(p => p.id === Number(select.dataset.select));
      if (p) setCurrent(p.i);
    }
    if (remove) {
      points = points.filter(p => p.id !== Number(remove.dataset.remove));
      renderList();
      render();
      status("점을 삭제했습니다. 현재 조절값은 유지됩니다.");
      notifyPoints("edit");
    }
  });

  document.querySelectorAll("[data-axis]").forEach(button => {
    button.addEventListener("click", () => {
      axisMode = button.dataset.axis;
      document.querySelectorAll("[data-axis]").forEach(b => {
        b.setAttribute("aria-pressed", String(b === button));
      });
      drawCurve();
    });
  });

  function selectCurvePoint(event) {
    const target = event.target.closest("[data-point]");
    if (!target || suppressCurveClick) return;
    const p = points.find(p => p.id === Number(target.dataset.point));
    if (p) setCurrent(p.i);
  }
  curve.addEventListener("click", selectCurvePoint);
  curve.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCurvePoint(event);
    }
  });

  function svgPosition(event) {
    const matrix = vectors.getScreenCTM();
    if (!matrix) return null;
    const point = vectors.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  vectors.addEventListener("pointerdown", event => {
    if (event.button !== 0 || drag) return;
    const handle = event.target.closest("[data-handle]");
    if (!handle) return;
    const pos = svgPosition(event);
    if (!pos) return;
    event.preventDefault();
    // A new drag takes over the geometry currently visible, even mid-zoom.
    stopScaleAnimation();
    const { ox, oy, scale } = vectorGeometry;
    drag = {
      pointerId: event.pointerId,
      kind: handle.dataset.handle,
      scale,
      ox, oy,
      // Preserve the finger-to-endpoint offset to avoid a jump on touch.
      offsetX: pos.x - (ox + current / CAL * scale),
      offsetY: pos.y - (oy - earth * scale)
    };
    vectors.setPointerCapture(event.pointerId);
  });

  vectors.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const pos = svgPosition(event);
    if (!pos) return;
    event.preventDefault();
    // Horizontal movement changes coil current; total's vertical movement changes Earth field.
    if (drag.kind === "total") earth = clamp((drag.oy - pos.y + drag.offsetY) / drag.scale, MIN_EARTH, MAX_EARTH);
    const value = CAL * (pos.x - drag.ox - drag.offsetX) / drag.scale;
    setCurrent(value, { keepSlider: false });
    renderList();
  });

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const id = drag.pointerId;
    drag = null;
    if (vectors.hasPointerCapture(id)) vectors.releasePointerCapture(id);
    render();
  }
  vectors.addEventListener("pointerup", finishDrag);
  vectors.addEventListener("pointercancel", finishDrag);
  vectors.addEventListener("lostpointercapture", event => {
    if (drag && event.pointerId === drag.pointerId) {
      drag = null;
      render();
    }
  });

  vectors.addEventListener("keydown", event => {
    const handle = event.target.closest("[data-handle]");
    if (!handle) return;
    const step = event.shiftKey ? 25 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setCurrent(current + (event.key === "ArrowRight" ? step : -step));
    } else if (handle.dataset.handle === "total" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      earth = clamp(earth + (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 0.25 : 0.05), MIN_EARTH, MAX_EARTH);
      render(); renderList();
    } else if (event.key === "Home") {
      event.preventDefault();
      setCurrent(0);
    }
  });

  function reset() {
    stopCurveAnimation();
    scales.curveBounds = null;
    stopScaleAnimation();
    scales.vectorScale = null;
    earth = 1;
    nextId = 1;
    colorIndex = 0;
    points = [100, 125, 250].map(makePoint);
    preferredDirection = 1;
    sliderLimit = 500;
    $("new-current").value = "100";
    setCurrent(125);
    renderList();
    status();
    notifyPoints("reset");
  }
  const presentation = installPresentation({ $, getTheater: () => theater, setTheater });
  document.querySelectorAll("[data-current]").forEach(button => button.addEventListener("click", () => setCurrent(Number(button.dataset.current))));
  function curvePosition(event) {
    const matrix = curve.getScreenCTM();
    if (!matrix) return null;
    const point = curve.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }
  function moveCurvePoint(event) {
    const pos = curvePosition(event);
    if (!pos || !curveDrag) return;
    const { xMax, yMax, pointId, offsetX, offsetY } = curveDrag;
    const px = clamp(pos.x - offsetX, 70, 574), py = clamp(pos.y - offsetY, 30, 326);
    let value;
    if (pointId !== null) {
      // Project onto the theoretical curve in screen space so both horizontal
      // and vertical dragging remain useful, including near the asymptotes.
      let bestDistance = Infinity, bestRatio = 0;
      const consider = r => {
        const i = clamp(r * CAL * earth, -MAX_I, MAX_I);
        const xValue = axisMode === "angle" ? theta(i) : i;
        const x = 70 + (xValue + xMax) / (2 * xMax) * 504;
        const y = 326 - (ratio(i) + yMax) / (2 * yMax) * 296;
        const distance = (x - px) ** 2 + (y - py) ** 2;
        if (distance < bestDistance) { bestDistance = distance; bestRatio = ratio(i); }
        return distance;
      };
      for (let n = 0; n <= 600; n++) {
        consider(-yMax + n / 600 * 2 * yMax);
        const angle = -Math.atan(yMax) + n / 600 * 2 * Math.atan(yMax);
        consider(Math.tan(angle));
      }
      let lo = Math.max(-yMax, bestRatio - 2 * yMax / 600);
      let hi = Math.min(yMax, bestRatio + 2 * yMax / 600);
      for (let n = 0; n < 28; n++) {
        const left = lo + (hi - lo) / 3, right = hi - (hi - lo) / 3;
        if (consider(left) < consider(right)) hi = right; else lo = left;
      }
      value = bestRatio * CAL * earth;
      const point = points.find(p => p.id === pointId);
      if (point) point.i = value;
    } else {
      const xValue = ((px - 70) / 504 * 2 - 1) * xMax;
      value = axisMode === "angle" ? CAL * earth * Math.tan(clamp(xValue, -89.999, 89.999) / DEG) : xValue;
    }
    curveDrag.moved = true;
    setCurrent(value); renderList();
  }
  curve.addEventListener("pointerdown", event => {
    if (event.button !== 0 || curveDrag) return;
    const pos = curvePosition(event);
    if (!pos || pos.x < 70 || pos.x > 574 || pos.y < 30 || pos.y > 326) return;
    const target = event.target.closest("[data-point]");
    const point = target ? points.find(p => p.id === Number(target.dataset.point)) : null;
    // Resume interaction at the currently visible bounds, even mid-transition.
    stopCurveAnimation();
    const { xMax, yMax } = curveGeometry;
    const px = point ? 70 + ((axisMode === "angle" ? theta(point.i) : point.i) + xMax) / (2 * xMax) * 504 : pos.x;
    const py = point ? 326 - (ratio(point.i) + yMax) / (2 * yMax) * 296 : pos.y;
    curveDrag = { pointerId: event.pointerId, pointId: point?.id ?? null, xMax, yMax, offsetX: pos.x - px, offsetY: pos.y - py, moved: false, startX: pos.x, startY: pos.y };
    event.preventDefault(); curve.setPointerCapture(event.pointerId);
    if (point) setCurrent(point.i); else moveCurvePoint(event);
  });
  curve.addEventListener("pointermove", event => {
    if (!curveDrag || event.pointerId !== curveDrag.pointerId) return;
    const pos = curvePosition(event);
    if (!pos || (!curveDrag.moved && Math.hypot(pos.x - curveDrag.startX, pos.y - curveDrag.startY) < 2)) return;
    moveCurvePoint(event);
  });
  function finishCurveDrag(event) {
    if (!curveDrag || event.pointerId !== curveDrag.pointerId) return;
    const { pointerId, moved } = curveDrag;
    curveDrag = null;
    suppressCurveClick = moved;
    if (curve.hasPointerCapture(pointerId)) curve.releasePointerCapture(pointerId);
    render(); renderList();
    setTimeout(() => { suppressCurveClick = false; }, 0);
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => curve.addEventListener(type, finishCurveDrag));
  curve.addEventListener("keydown", event => {
    const target = event.target.closest("[data-point]");
    if (!target || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const point = points.find(p => p.id === Number(target.dataset.point));
    if (!point) return;
    event.preventDefault();
    point.i = clamp(point.i + (["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1) * (event.shiftKey ? 25 : 1), -MAX_I, MAX_I);
    setCurrent(point.i); renderList();
  });
  $("reset").addEventListener("click", reset);
  reset();
  return {
    captureSettings: () => ({ axisMode, theme: presentation.getTheme() }),
    applySettings(settings) {
      axisMode = settings.axisMode;
      document.querySelectorAll('[data-axis]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.axis === axisMode));
      });
      presentation.setTheme(settings.theme);
    },
    reservePointIds(savedFrames) {
      for (const frame of savedFrames) for (const point of frame.state.points) nextId = Math.max(nextId, point.id + 1);
    },
    onPointsChange(listener) {
      pointListeners.add(listener);
      return () => pointListeners.delete(listener);
    },
    capture: () => ({ current, earth, points: points.map(p => ({ ...p })) }),
    apply(state, view) {
      stopCurveAnimation(); stopScaleAnimation();
      current = clamp(state.current, -MAX_I, MAX_I); earth = clamp(state.earth, MIN_EARTH, MAX_EARTH);
      points = state.points.map(p => ({ ...p }));
      nextId = Math.max(nextId, ...points.map(p => p.id + 1));
      if (current) preferredDirection = Math.sign(current);
      sliderLimit = Math.min(MAX_I, Math.max(500, nice(Math.abs(current) * 1.15)));
      playbackView = view;
      scales.curveBounds = view ? { yMax: view.yMax, xMax: axisMode === "angle" ? 90 : view.xMax, mode: axisMode } : autoCurveBounds();
      scales.vectorScale = view ? view.vectorScale : autoVectorScale();
      render(); renderList();
    },
    release() { playbackView = null; render(); },
    settle() {
      stopCurveAnimation(); stopScaleAnimation();
      scales.curveBounds = playbackView ? { yMax: playbackView.yMax, xMax: axisMode === "angle" ? 90 : playbackView.xMax, mode: axisMode } : autoCurveBounds();
      scales.vectorScale = playbackView ? playbackView.vectorScale : autoVectorScale();
      paintCurve(scales.curveBounds); paintVectors(scales.vectorScale);
    },
    nice, fmt, theta: () => theta(current), magnitude: () => magnitude(current)
  };
}
