import { clamp, fmt, esc } from "../utils.js";
import { CAL, DEG } from "../physics.js";
  function curveTickValues(limit) {
    const desired = limit / 2.5;
    const base = 10 ** Math.floor(Math.log10(desired));
    const step = [1, 2, 2.5, 5, 10].map(n => n * base)
      .reduce((best, value) => Math.abs(Math.log(value / desired)) < Math.abs(Math.log(best / desired)) ? value : best);
    const ticks = [];
    for (let k = -Math.floor(limit / step); k <= Math.floor(limit / step); k++) ticks.push(k * step);
    return ticks;
  }

  export function paintCurve(context, { xMax, yMax }) {
    const { $, curve, axisMode, theta, ratio, current, points, curveDrag, earth, setGeometry } = context;
    const L = 70, R = 574, T = 30, B = 326;
    const W = R - L, H = B - T;
    const x = v => L + (v + xMax) / (2 * xMax) * W;
    const y = v => B - (v + yMax) / (2 * yMax) * H;
    const displayX = i => axisMode === "angle" ? theta(i) : i;

    let grid = "";
    for (const value of curveTickValues(yMax)) {
      const py = y(value);
      grid += `<line x1="${L}" y1="${py}" x2="${R}" y2="${py}" stroke="var(--grid)"/>
        <text x="${L - 10}" y="${py + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${fmt(value, 2)}</text>`;
    }

    const ticks = axisMode === "angle"
      ? [-90, -60, -30, 0, 30, 60, 90]
      : curveTickValues(xMax);

    ticks.forEach(v => {
      const px = x(v);
      grid += `<line x1="${px}" y1="${T}" x2="${px}" y2="${B}"
          stroke="var(--grid)" ${Math.abs(v) === 90 && axisMode === "angle" ? 'stroke-dasharray="4 4"' : ""}/>
        <text x="${px}" y="${B + 24}" text-anchor="middle" font-size="12" fill="var(--muted)">
          ${fmt(v)}${axisMode === "angle" ? "°" : ""}
        </text>`;
    });

    // Sampling uniformly in angle and in field ratio preserves both the
    // central curve and the steep near-asymptotic portions at large currents.
    const samples = [];
    if (axisMode === "angle") {
      for (let n = 0; n <= 1200; n++) {
        const a = -89.999999 + n / 1200 * 179.999998;
        const r = Math.tan(a / DEG);
        if (Math.abs(r) <= yMax) samples.push({ a, r });
      }
      for (let n = 0; n <= 800; n++) {
        const r = -yMax + n / 800 * 2 * yMax;
        samples.push({ a: Math.atan(r) * DEG, r });
      }
      samples.sort((a, b) => a.a - b.a);
    }
    const d = axisMode === "angle"
      ? samples.map((p, index) => `${index ? "L" : "M"}${x(p.a).toFixed(3)},${y(p.r).toFixed(3)}`).join(" ")
      : `M${x(-xMax)},${y(ratio(-xMax))} L${x(xMax)},${y(ratio(xMax))}`;

    const activeX = x(displayX(current));
    const activeY = y(ratio(current));
    setGeometry({ xMax, yMax, active: { x: activeX, y: activeY } });

    const markers = points.map((p, index) => {
      const px = x(displayX(p.i)), py = y(ratio(p.i));
      const putLeft = px > R - 100;
      const dx = putLeft ? -11 : 11;
      const labelY = clamp(py + (index % 2 === 0 ? -14 : 20), T + 13, B - 7);
      return `<g data-point="${p.id}" tabindex="0" role="button"
          aria-label="${esc(fmt(p.i))} 밀리암페어, ${esc(fmt(theta(p.i)))}도 선택"
          opacity="${p.opacity ?? 1}" style="cursor:grab">
          <title>${esc(fmt(p.i))} mA · ${esc(fmt(theta(p.i)))}°</title>
          <circle cx="${px}" cy="${py}" r="18" fill="transparent"/>
          <circle cx="${px}" cy="${py}" r="5" fill="${p.color}" stroke="var(--plot)" stroke-width="2"/>
          <text x="${px + dx}" y="${labelY}" text-anchor="${putLeft ? "end" : "start"}"
            fill="${p.color}" font-size="12" font-weight="600"
            paint-order="stroke" stroke="var(--plot)" stroke-width="4">${esc(fmt(p.i))} mA</text>
        </g>`;
    }).join("");

    const oldFocus = curve.contains(document.activeElement)
      ? document.activeElement.getAttribute("data-point") : null;
    curve.innerHTML = `
      <title id="curve-svg-title">전류에 따른 나침반 편향각 그래프</title>
      <desc id="curve-svg-desc">가로축은 ${axisMode === "angle" ? "각도" : "전류"}, 세로축은 코일 자기장과 지구 자기장의 비입니다.</desc>
      <defs><clipPath id="plot-clip"><rect x="${L}" y="${T}" width="${W}" height="${H}"/></clipPath></defs>
      ${grid}
      <g clip-path="url(#plot-clip)">
        <line x1="${L}" y1="${y(0)}" x2="${R}" y2="${y(0)}" stroke="var(--axis)" stroke-width="1.3"/>
        <line x1="${x(0)}" y1="${T}" x2="${x(0)}" y2="${B}" stroke="var(--axis)" stroke-width="1.3"/>
        <path d="${d}" fill="none" stroke="var(--curve)" stroke-width="3" stroke-linecap="round"/>
        <path d="M${activeX},${y(0)} V${activeY} H${x(0)}"
          fill="none" stroke="var(--orange)" stroke-dasharray="4 4" opacity=".65"/>
      </g>
      <g clip-path="url(#plot-clip)">${markers}</g>
      <circle cx="${activeX}" cy="${activeY}" r="9" fill="none" stroke="var(--orange)"
        stroke-width="2.5" pointer-events="none"/>
      <text x="${L}" y="17" fill="var(--muted)" font-size="16" class="svg-math">𝑟 = 𝐵<tspan baseline-shift="sub" font-size="10.5">manual</tspan><tspan baseline-shift="baseline"> / 𝐵</tspan><tspan baseline-shift="sub" font-size="10.5">Earth</tspan></text>
      <text x="${(L + R) / 2}" y="376" text-anchor="middle" fill="var(--ink)" font-size="13">
        ${axisMode === "angle" ? "편향각 𝜃 (°)" : "전류 𝐼 (mA)"}
      </text>`;

    if (oldFocus && !curveDrag) curve.querySelector(`[data-point="${oldFocus}"]`)?.focus({ preventScroll: true });
    $("curve-caption").innerHTML = axisMode === "angle"
      ? '<span class="math">𝑟 = <span class="math-op">tan</span> 𝜃</span>. 가로축은 전류가 아니라 각도입니다. ±90°의 점선은 점근선이며, 전류가 커질수록 각도 변화는 작아집니다.'
      : `<span class="math">𝑟 = 𝐼 / (${fmt(CAL * earth)}<span class="math-unit">mA</span>)</span>. 가로축을 전류로 바꾸면 직선입니다. 물리적 관계가 바뀌는 것이 아니라 가로축의 변수만 바뀝니다.`;
  }

