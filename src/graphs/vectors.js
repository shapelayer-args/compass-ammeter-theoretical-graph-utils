import { clamp, fmt, esc, raw } from "../utils.js";
import { CAL, MAX_I, MIN_EARTH, MAX_EARTH } from "../physics.js";
  function vectorTicks(vectors, scale) {
    // Tick spacing is measured on screen, including theater and mobile layouts.
    const matrix = vectors.getScreenCTM();
    const screenScale = matrix ? Math.hypot(matrix.a, matrix.b) || 1 : 1;
    const desiredStep = 68 / (scale * screenScale);
    const base = 10 ** Math.floor(Math.log10(desiredStep));
    const step = [1, 2, 2.5, 5, 10].map(n => n * base)
      .reduce((best, value) => Math.abs(Math.log(value / desiredStep)) < Math.abs(Math.log(best / desiredStep)) ? value : best);
    const minorStep = step / 5;
    const minorOpacity = clamp((minorStep * scale * screenScale - 9) / 7, 0, 0.65);
    const digits = Math.max(0, -Math.floor(Math.log10(step)) + 1);
    const label = value => fmt(value, digits);
    const ticks = (min, max, unit) => {
      const result = [];
      for (let k = Math.ceil(min / unit); k <= Math.floor(max / unit); k++) {
        if (k !== 0) result.push({ value: k * unit, major: Math.abs(k * unit / step - Math.round(k * unit / step)) < 1e-7 });
      }
      return result;
    };
    let grid = "", marks = "";
    for (const tick of ticks((24 - 300) / scale, (576 - 300) / scale, minorStep)) {
      const x = 300 + tick.value * scale;
      const opacity = tick.major ? 1 : minorOpacity;
      if (tick.major) grid += `<line x1="${x}" y1="28" x2="${x}" y2="366" stroke="var(--grid)" opacity=".5"/>`;
      marks += `<line x1="${x}" y1="${312 - (tick.major ? 5 : 3)}" x2="${x}" y2="${312 + (tick.major ? 5 : 3)}" stroke="var(--axis)" stroke-width="1" opacity="${opacity}"/>`;
      if (tick.major) marks += `<text x="${x}" y="332" text-anchor="middle">${label(tick.value)}</text>`;
    }
    for (const tick of ticks((312 - 366) / scale, (312 - 28) / scale, minorStep)) {
      const y = 312 - tick.value * scale;
      const opacity = tick.major ? 1 : minorOpacity;
      if (tick.major) grid += `<line x1="24" y1="${y}" x2="576" y2="${y}" stroke="var(--grid)" opacity=".5"/>`;
      marks += `<line x1="${300 - (tick.major ? 5 : 3)}" y1="${y}" x2="${300 + (tick.major ? 5 : 3)}" y2="${y}" stroke="var(--axis)" stroke-width="1" opacity="${opacity}"/>`;
      if (tick.major) marks += `<text x="288" y="${y + 4}" text-anchor="end">${label(tick.value)}</text>`;
    }
    return `<g data-tick-step="${step}" aria-hidden="true" pointer-events="none">${grid}<g fill="var(--muted)" font-size="11" font-variant-numeric="tabular-nums" paint-order="stroke" stroke="var(--plot)" stroke-width="3" stroke-linejoin="round">${marks}<text x="288" y="332" text-anchor="end">0</text></g></g>`;
  }

  export function paintVectors(context, scale) {
    const { vectors, current, earth, theta, drag, setGeometry } = context;
    const r = current / CAL;
    const ox = 300, oy = 312;
    const mx = ox + r * scale;
    const ey = oy - earth * scale;
    setGeometry({ ox, oy, scale, end: { x: mx, y: ey } });

    const arcRadius = 48;
    const a = Math.atan2(r, earth);
    const steps = Math.max(2, Math.ceil(Math.abs(a) * 28));
    let arc = `M${ox},${oy - arcRadius}`;
    for (let n = 1; n <= steps; n++) {
      const t = a * n / steps;
      arc += ` L${ox + arcRadius * Math.sin(t)},${oy - arcRadius * Math.cos(t)}`;
    }
    const textAngle = a / 2;
    const labelX = ox + 76 * Math.sin(textAngle);
    const labelY = oy - 76 * Math.cos(textAngle);
    const endAnchor = r >= 0 ? "end" : "start";
    const sideInset = r >= 0 ? -12 : 12;

    const handle = (kind, cx, cy, color, name) => `
      <g data-handle="${kind}" tabindex="0" role="slider"
        aria-label="${name}" aria-orientation="horizontal"
        aria-valuemin="${-MAX_I}" aria-valuemax="${MAX_I}" aria-valuenow="${raw(current)}"
        aria-valuetext="${esc(fmt(current))} 밀리암페어, ${esc(fmt(theta(current)))}도, 지구 자기장 ${raw(earth)}"
        style="cursor:${kind === "total" ? "move" : "ew-resize"}">
        <title>${name} — ${kind === "total" ? "상하좌우" : "좌우"} 드래그 또는 방향키</title>
        <circle cx="${cx}" cy="${cy}" r="25" fill="transparent"/>
        <circle cx="${cx}" cy="${cy}" r="9" fill="var(--surface)" stroke="${color}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="3" fill="${color}"/>
      </g>`;

    const oldFocus = vectors.contains(document.activeElement)
      ? document.activeElement.getAttribute("data-handle") : null;

    vectors.innerHTML = `
      <title id="vector-svg-title">지구 자기장, 코일 자기장, 합벡터</title>
      <desc id="vector-svg-desc">
        지구 자기장은 위쪽으로 ${raw(earth)}, 코일 자기장은 가로 방향으로 ${raw(r)}입니다.
        두 드래그 손잡이로 전류를 조절할 수 있습니다.
      </desc>
      <defs>
        <marker id="arrow-earth" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--green)"/>
        </marker>
        <marker id="arrow-manual" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--blue)"/>
        </marker>
        <marker id="arrow-total" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--orange)"/>
        </marker>
        <clipPath id="vector-clip"><rect x="8" y="20" width="584" height="364"/></clipPath>
      </defs>
      ${vectorTicks(vectors, scale)}
      <line x1="24" y1="${oy}" x2="576" y2="${oy}" stroke="var(--grid)"/>
      <line x1="${ox}" y1="28" x2="${ox}" y2="366" stroke="var(--grid)"/>
      <text x="590" y="${oy - 12}" fill="var(--muted)" font-size="12" text-anchor="end">+𝑥</text>
      <text x="${ox + 12}" y="37" fill="var(--muted)" font-size="12">+𝑦 · 자북</text>
      <g clip-path="url(#vector-clip)">
        <path d="M${ox},${ey} H${mx} V${oy}" fill="none" stroke="var(--axis)" stroke-dasharray="5 5"/>
        <line x1="${ox}" y1="${oy}" x2="${ox}" y2="${ey}"
          stroke="var(--green)" stroke-width="3" marker-end="url(#arrow-earth)"/>
        ${Math.abs(r) > 1e-10 ? `
          <line x1="${ox}" y1="${oy}" x2="${mx}" y2="${oy}"
            stroke="var(--blue)" stroke-width="3" marker-end="url(#arrow-manual)"/>
        ` : ""}
        <line x1="${ox}" y1="${oy}" x2="${mx}" y2="${ey}"
          stroke="var(--orange)" stroke-width="3" marker-end="url(#arrow-total)"/>
        <path d="${arc}" fill="none" stroke="var(--muted)" stroke-width="1.5"/>
        <circle cx="${ox}" cy="${oy}" r="3" fill="var(--ink)"/>
        ${handle("manual", mx, oy, "var(--blue)", "조절: 코일 자기장")}
        ${handle("total", mx, ey, "var(--orange)", "조절: 합벡터")}
      </g>
      <text x="${ox - 13}" y="${Math.max(66, ey - 14)}" text-anchor="end"
        fill="var(--green)" font-size="17" paint-order="stroke" stroke="var(--plot)" stroke-width="4" class="svg-math">𝐵<tspan baseline-shift="sub" font-size="11.5">Earth</tspan><tspan baseline-shift="baseline"> = ${fmt(earth, 3)}</tspan></text>
      <text x="${clamp(mx + sideInset, 75, 525)}" y="${oy + 42}"
        text-anchor="${endAnchor}" fill="var(--blue)" font-size="13"
        paint-order="stroke" stroke="var(--plot)" stroke-width="4" class="svg-math">𝐵<tspan baseline-shift="sub" font-size="11.5">manual</tspan><tspan baseline-shift="baseline"> = ${fmt(r, 3)}</tspan></text>
      <text x="${clamp(mx + sideInset, 100, 500)}" y="${Math.max(55, ey - 19)}"
        text-anchor="${endAnchor}" fill="var(--orange)" font-size="13"
        paint-order="stroke" stroke="var(--plot)" stroke-width="4" class="svg-math">∣𝑩<tspan baseline-shift="sub" font-size="11.5">합</tspan><tspan baseline-shift="baseline">∣ = ${fmt(Math.hypot(earth, r), 3)}</tspan></text>
      <text x="${labelX}" y="${labelY}" text-anchor="middle" fill="var(--ink)" font-size="17"
        paint-order="stroke" stroke="var(--plot)" stroke-width="4" class="svg-math">𝜃 = ${fmt(theta(current))}°</text>
      <text x="24" y="390" fill="var(--muted)" font-size="11">자기장 1단위 = ${fmt(scale, 1)} px</text>`;

    if (oldFocus && !drag) {
      vectors.querySelector(`[data-handle="${oldFocus}"]`)?.focus({ preventScroll: true });
    }
  }

