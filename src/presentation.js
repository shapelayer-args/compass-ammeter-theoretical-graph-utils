export function installPresentation({ $, getTheater, setTheater }) {
  const themeMedia = matchMedia("(prefers-color-scheme: dark)");
  let themeMode = "system";
  try { themeMode = localStorage.getItem("field-theme") || "system"; } catch {}
  function applyTheme() {
    document.documentElement.dataset.theme = themeMode === "system" ? (themeMedia.matches ? "dark" : "light") : themeMode;
    $("theme-label").textContent = {system:"시스템",light:"라이트",dark:"다크"}[themeMode];
    $("theme").setAttribute("aria-label", "화면 테마: " + $("theme-label").textContent);
  }
  $("theme").addEventListener("click", () => {
    themeMode = {system:"light",light:"dark",dark:"system"}[themeMode];
    try { localStorage.setItem("field-theme",themeMode); } catch {}
    applyTheme();
  });
  themeMedia.addEventListener("change", applyTheme);
  applyTheme();
  $("present").addEventListener("click", () => {
    const active = document.body.classList.toggle("presenting");
    $("present").setAttribute("aria-pressed", String(active));
    $("present").querySelector("span").textContent = active ? "발표 종료" : "발표 모드";
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || $("help").open) return;
    if (getTheater()) setTheater(null);
    else if (document.body.classList.contains("presenting")) $("present").click();
  });
  $("help-open").addEventListener("click", () => $("help").showModal());
  $("help-close").addEventListener("click", () => $("help").close());
}
