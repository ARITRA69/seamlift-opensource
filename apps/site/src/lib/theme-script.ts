export const themeStorageKey = "theme";

/** Runs before first paint, so the page never flashes the wrong theme. */
export const themeScript = `(() => {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    let saved = null;
    try { saved = localStorage.getItem("${themeStorageKey}"); } catch {}
    root.dataset.theme = saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light";
  };
  apply();
  media.addEventListener("change", apply);
})();`;
