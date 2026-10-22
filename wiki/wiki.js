// Tapfighter Wiki: a tiny hash-routed wiki that renders straight from the game's own data and sprites,
// so every number and picture here matches the game.
import { buildSprites } from '../src/sprites.js';
import { text, textWidth } from '../src/font.js';
import { buildPages, SIDEBAR } from './content.js';

buildSprites();

// ---------- helpers shared with content.js ----------
const urlCache = new WeakMap();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const H = {
  esc,
  id: t => t.replace(/ /g, '_'),
  img(canvas, scale = 3, alt = '') {
    let url = urlCache.get(canvas);
    if (!url) { url = canvas.toDataURL(); urlCache.set(canvas, url); }
    return `<img class="sprite" src="${url}" width="${canvas.width * scale}" height="${canvas.height * scale}" alt="${esc(alt)}" loading="lazy">`;
  },
  link(title, label) {
    const id = title.replace(/ /g, '_');
    const exists = !!PAGES[id];
    return `<a href="#${esc(id)}"${exists ? '' : ' class="new" title="Page does not exist"'}>${label ?? esc(title.replace(/_/g, ' '))}</a>`;
  },
  table(headers, rows, opts = {}) {
    const th = headers.map(h => `<th${opts.sortable !== false ? ' class="sortable"' : ''}>${h}</th>`).join('');
    const tr = rows.map(r => '<tr>' + r.map(c => {
      if (c && typeof c === 'object' && 'html' in c) return `<td class="${c.cls || ''}">${c.html}</td>`;
      const isNum = typeof c === 'number' || /^[-+]?[\d.,]+%?( ?(ms|HP|gp))?$/.test(String(c));
      return `<td class="${isNum ? 'num' : ''}">${c}</td>`;
    }).join('') + '</tr>').join('');
    return `<div class="tablewrap"><table class="wikitable"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  },
  infobox({ title, image, caption, sections }) {
    let h = `<table class="infobox"><tr><th colspan="2" class="ib-title">${esc(title)}</th></tr>`;
    if (image) h += `<tr><td colspan="2" class="ib-image">${image}${caption ? `<div style="font-size:12px">${caption}</div>` : ''}</td></tr>`;
    for (const s of sections) {
      if (s.head) h += `<tr><th colspan="2" class="ib-head">${s.head}</th></tr>`;
      for (const [k, v] of s.rows || []) h += `<tr><th>${k}</th><td>${v}</td></tr>`;
    }
    return h + '</table>';
  },
  navbox(title, groups) {
    return `<div class="navbox"><div class="nb-title">${title}</div>` +
      groups.map(([g, items]) => `<div class="nb-row"><div class="nb-group">${g}</div><div class="nb-list">${items.join(' ')}</div></div>`).join('') + '</div>';
  },
  chip(type, label) { return `<span class="chip ${type}">${esc(label)}</span>`; },
  note(html, warn = false) { return `<div class="note${warn ? ' warn' : ''}">${html}</div>`; },
  toc(items) { return `<div class="toc"><b>Contents</b><ol>${items.map(t => `<li><a href="#${CUR}" data-anchor="${esc(t)}">${esc(t)}</a></li>`).join('')}</ol></div>`; },
  h2(t) { return `<h2 id="${esc(t.replace(/ /g, '_'))}">${esc(t)}</h2>`; },
};

let PAGES = {};
let CUR = 'Main_Page';

function drawLogo() {
  const c = document.getElementById('logo');
  const s = 'TAPFIGHTER WIKI';
  const w = textWidth(s) + 4;
  c.width = w; c.height = 9;
  const g = c.getContext('2d');
  text(g, s, 2, 2, '#f0d050', { outline: '#4a2010' });
  c.style.height = '27px';
  c.style.width = w * 3 + 'px';
}

function buildSidebar() {
  const nav = document.getElementById('sidebar');
  nav.innerHTML = SIDEBAR.map(([head, items]) => `<section><h3>${head}</h3><ul>${items.map(([label, target]) =>
    `<li>${target.startsWith('http') || target.startsWith('../') ? `<a href="${target}">${label}</a>` : target === '@random' ? `<a href="#" data-random="1">${label}</a>` : H.link(target, label)}</li>`).join('')}</ul></section>`).join('');
  nav.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    if (a.dataset.random) {
      e.preventDefault();
      const ids = Object.keys(PAGES).filter(k => k !== CUR);
      location.hash = ids[Math.floor(Math.random() * ids.length)];
    }
    nav.classList.remove('open');
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
  });
  const list = document.getElementById('pageList');
  list.innerHTML = Object.values(PAGES).map(p => `<option value="${esc(p.title)}">`).join('');
}

function makeSortable(root) {
  root.querySelectorAll('table.wikitable').forEach(table => {
    table.querySelectorAll('th.sortable').forEach((th, col) => {
      th.addEventListener('click', () => {
        const body = table.tBodies[0];
        const rows = [...body.rows];
        const dir = th.dataset.dir === 'asc' ? -1 : 1;
        table.querySelectorAll('th').forEach(t => delete t.dataset.dir);
        th.dataset.dir = dir === 1 ? 'asc' : 'desc';
        const val = r => {
          const t = r.cells[col]?.textContent.trim() ?? '';
          const n = parseFloat(t.replace(/[^\d.-]/g, ''));
          return /^[-+]?[\d.,]/.test(t) && !isNaN(n) ? n : t.toLowerCase();
        };
        rows.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
        rows.forEach(r => body.appendChild(r));
      });
    });
  });
}

function route() {
  let id = decodeURIComponent(location.hash.slice(1)) || 'Main_Page';
  const anchor = id.includes('#') ? id.split('#')[1] : null;
  id = id.split('#')[0];
  const content = document.getElementById('content');
  const page = PAGES[id] || PAGES[Object.keys(PAGES).find(k => k.toLowerCase() === id.toLowerCase())];
  CUR = page ? page.id : id;
  if (!page) {
    content.innerHTML = `<h1>${esc(id.replace(/_/g, ' '))}</h1><p>There is currently no text in this page. You can ${H.link('Main_Page', 'return to the Main Page')} or search for a similar title.</p>`;
    document.title = 'Tapfighter Wiki';
  } else {
    const body = page.render();
    content.innerHTML = (page.id === 'Main_Page' ? '' : `<h1>${esc(page.title)}</h1><div class="subtitle">From the Tapfighter Wiki</div>`) + body +
      (page.cats?.length ? `<div class="catlinks"><b>Categories:</b> ${page.cats.map(c => H.link(c)).join(' | ')}</div>` : '');
    document.title = page.id === 'Main_Page' ? 'Tapfighter Wiki' : `${page.title} - Tapfighter Wiki`;
    makeSortable(content);
    content.querySelectorAll('[data-anchor]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById(a.dataset.anchor.replace(/ /g, '_'))?.scrollIntoView({ behavior: 'smooth' });
    }));
  }
  document.getElementById('foot').innerHTML = `This page is generated from the live game data, so its numbers always match the current version of Tapfighter. &middot; ${H.link('Update_history', 'Update history')} &middot; <a href="../">Play Tapfighter</a>`;
  if (anchor) document.getElementById(anchor)?.scrollIntoView(); else window.scrollTo(0, 0);
}

function search(q) {
  q = q.trim().toLowerCase();
  if (!q) return;
  const all = Object.values(PAGES);
  const hit = all.find(p => p.title.toLowerCase() === q) || all.find(p => p.title.toLowerCase().startsWith(q)) ||
    all.find(p => p.title.toLowerCase().includes(q)) || all.find(p => (p.keywords || '').toLowerCase().includes(q));
  location.hash = hit ? hit.id : q.replace(/ /g, '_');
}

PAGES = buildPages(H);
for (const [id, p] of Object.entries(PAGES)) p.id = id;
drawLogo();
buildSidebar();
document.getElementById('searchForm').addEventListener('submit', e => { e.preventDefault(); search(document.getElementById('search').value); document.getElementById('search').blur(); });
document.getElementById('search').addEventListener('change', e => { if (PAGES[H.id(e.target.value)]) search(e.target.value); });
document.getElementById('menuBtn').addEventListener('click', () => {
  const nav = document.getElementById('sidebar');
  const open = nav.classList.toggle('open');
  document.getElementById('menuBtn').setAttribute('aria-expanded', String(open));
});
window.addEventListener('hashchange', route);
route();
