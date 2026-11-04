/* Apply before CSS loads to avoid a light/dark flash; no network dependency. */
(() => {
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem('atlas-theme'); } catch {}
  let explicit = ['dark', 'light'].includes(saved);
  function label() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = root.dataset.theme === 'dark';
    const en = root.lang === 'en';
    const action = en ? (dark ? 'Switch to light background' : 'Switch to dark background') : (dark ? '切换浅色背景' : '切换深色背景');
    button.setAttribute('aria-label', action);
    button.setAttribute('aria-pressed', String(dark));
    button.title = action;
    button.querySelector('.theme-label').textContent = en ? (dark ? 'Light' : 'Dark') : (dark ? '浅色' : '深色');
    button.firstElementChild.textContent = dark ? '☀' : '☾';
  }
  function apply(theme, persist = false) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (persist) { explicit = true; try { localStorage.setItem('atlas-theme', theme); } catch {} }
    label();
    window.dispatchEvent(new CustomEvent('atlas-theme-change', {detail:{theme}}));
  }
  apply(explicit ? saved : system.matches ? 'dark' : 'light');
  system.addEventListener('change', e => { if (!explicit) apply(e.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', e => {
    if (e.key !== 'atlas-theme') return;
    explicit = ['dark', 'light'].includes(e.newValue);
    apply(explicit ? e.newValue : system.matches ? 'dark' : 'light');
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-toggle').addEventListener('click', () => apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
    new MutationObserver(label).observe(root, {attributes:true, attributeFilter:['lang']});
    label();
  });
})();
