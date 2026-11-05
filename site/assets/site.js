/* Navigation and content remain available without JavaScript. */
const themeButton = document.querySelector('.theme-toggle');
if (themeButton) {
 const english = document.documentElement.lang === 'en';
 const applyTheme = theme => {
  document.documentElement.dataset.theme = theme;
  themeButton.setAttribute('aria-label', english ? (theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') : (theme === 'dark' ? '明るい配色に切り替える' : '暗い配色に切り替える'));
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0a0c10' : '#f9f8f5';
 };
 let saved;
 try { saved = localStorage.getItem('aquabeacon-theme'); } catch { /* Storage is optional. */ }
 applyTheme(saved === 'dark' ? 'dark' : 'light');
 themeButton.hidden = false;
 themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('aquabeacon-theme', theme); } catch { /* Private browsing. */ }
 });
}
const menu = document.querySelector('.mobile-menu');
document.addEventListener('keydown', event => {
 if (event.key === 'Escape' && menu?.open) { menu.open = false; menu.querySelector('summary').focus(); }
});
document.addEventListener('click', event => { if (menu?.open && !menu.contains(event.target)) menu.open = false; });
const search = document.querySelector('#resource-search');
if (search) {
 const rows = [...document.querySelectorAll('[data-resource]')];
 const groups = [...document.querySelectorAll('[data-resource-group]')];
 const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ja');
 const update = () => {
  const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const row of rows) { row.hidden = !terms.every(term => normalize(row.textContent).includes(term)); if (!row.hidden) count++; }
  for (const group of groups) group.hidden = ![...group.querySelectorAll('[data-resource]')].some(row => !row.hidden);
  document.querySelector('#resource-count').textContent = `${count} / ${rows.length} リポジトリ`;
  document.querySelector('#resource-empty').hidden = count !== 0;
 };
 search.addEventListener('input', update); update();
}
