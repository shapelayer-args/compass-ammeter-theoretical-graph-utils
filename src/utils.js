export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = (v, digits = 2) => {
  const rounded = Number(Number(v).toFixed(digits));
    return rounded.toLocaleString("ko-KR", { maximumFractionDigits: digits });
  };
export const raw = (v, digits = 6) => String(Number(v.toFixed(digits)));
export const esc = text => String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
export const nearly = (a, b) => Math.abs(a - b) < 1e-7;
export const nice = x => {
    if (!(x > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(x));
  const n = x / base;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * base;
  };

