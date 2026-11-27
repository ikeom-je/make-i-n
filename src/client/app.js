// ブラウザ側: talk を取得 → 共通コアで描画 → ビュー(web/slides/print)・言語・PPTX・GenMedia を制御する。

import { createDefaultRegistry } from '../components/index.js';
import { esc, normalizeLang, t as tr } from '../core/i18n.js';
import { buildPptx } from '../core/pptx.js';
import { createQr } from '../core/qr.js';
import qrcode from '/vendor/qrcode.mjs';
import { createContext, renderTalk } from '../core/render.js';
import { TalkValidationError, normalizeTalk } from '../core/talk.js';
import { UI } from '../components/util.js';

const registry = createDefaultRegistry();
const qr = createQr(qrcode);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const VIEWS = ['web', 'slides', 'print'];

const params = new URLSearchParams(location.search);
const state = {
  talkId: params.get('talk'),
  view: VIEWS.includes(params.get('view')) ? params.get('view') : 'web',
  lang: params.get('lang') ? normalizeLang(params.get('lang')) : null,
  slide: Number(params.get('slide') ?? 0) || 0,
  data: null,
  model: null,
  genmedia: { configured: false, reason: null },
};
const audio = new Audio();

async function getJson(url, init) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? res.statusText), { code: json.code });
  return json;
}

function showErrors(errors) {
  const box = $('#errors');
  box.hidden = !errors.length;
  box.innerHTML = errors.map((e) => `<p>${e.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</p>`).join('');
}

function ctx() {
  return createContext({ lang: state.lang, profile: state.data.profile, media: state.data.media, mode: state.view, qr });
}

function syncUrl() {
  const q = new URLSearchParams({ talk: state.talkId, view: state.view, lang: state.lang });
  if (state.view === 'slides') q.set('slide', String(state.slide));
  history.replaceState(null, '', `?${q}`);
}

function render() {
  const keep = Object.fromEntries($$('[data-genmedia-card]').map((f) => [f.dataset.slot, f.elements.prompt.value]));
  $('#deck').innerHTML = renderTalk(state.model, registry, ctx());
  document.documentElement.lang = state.lang;
  document.title = `${ctx().t(state.data.profile.name)} — ${ctx().t(state.model.title)}`;
  $$('[data-genmedia-card]').forEach((f) => {
    if (keep[f.dataset.slot] !== undefined) f.elements.prompt.value = keep[f.dataset.slot];
    if (!state.genmedia.configured) setStatus(f, `GenMedia: ${state.genmedia.reason ?? 'not configured'}`, 'warn');
  });
  paintBusy();
  applyView();
}

function applyView() {
  document.body.classList.remove(...VIEWS.map((v) => `view-${v}`));
  document.body.classList.add(`view-${state.view}`);
  $$('[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === state.view));
  $$('[data-lang]').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === state.lang));
  const sections = $$('#deck > .section');
  state.slide = Math.min(Math.max(state.slide, 0), Math.max(sections.length - 1, 0));
  sections.forEach((s, i) => s.classList.toggle('is-active', i === state.slide));
  $('#slide-counter').textContent = `${state.slide + 1} / ${sections.length}`;
  $$('#deck video').forEach((v) => {
    const visible = state.view !== 'slides' || v.closest('.section')?.classList.contains('is-active');
    if (visible) v.play?.().catch(() => {}); else v.pause?.();
  });
  syncUrl();
}

function go(delta) {
  state.slide += delta;
  applyView();
}

async function loadTalk(id) {
  const data = await getJson(`/api/talks/${encodeURIComponent(id)}`);
  state.talkId = id;
  state.data = data;
  state.lang ??= normalizeLang(data.talk.defaultLang);
  $('#theme-css').href = `/src/themes/${encodeURIComponent(data.talk.theme ?? 'google')}.css`;
  try {
    state.model = normalizeTalk(data.talk, data.profile, registry);
    showErrors([]);
  } catch (err) {
    if (err instanceof TalkValidationError) {
      showErrors(err.errors);
      $('#deck').innerHTML = '';
      return;
    }
    throw err;
  }
  $('#talk-select').value = id;
  render();
}

async function exportPptx() {
  const c = ctx();
  const pres = buildPptx(window.PptxGenJS, state.model, registry, c, {
    resolveMediaPath: (entry, field) => new URL(c.mediaUrl(entry.slot, field), location.href).href,
  });
  await pres.writeFile({ fileName: `${state.talkId}-${state.lang}.pptx` });
}

function setStatus(form, text, tone = '') {
  const el = $('.gm-status', form);
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

// 生成中の状態はフォーム(DOM)ではなく state に持つ。言語切替や別カードの完了で再描画されても
// 進捗表示とボタン無効化を復元し、課金リクエストの二重送信を防ぐ。
const busy = new Map();
const cardFor = (slot) => $(`[data-genmedia-card][data-slot="${CSS.escape(slot)}"]`);

function paintBusy() {
  const c = ctx();
  for (const [slot, started] of busy) {
    const form = cardFor(slot);
    if (!form) continue;
    $('button[type=submit]', form).disabled = true;
    setStatus(form, `${c.t(UI.generating)} ${Math.round((Date.now() - started) / 1000)}s`, 'busy');
  }
}

async function generate(form) {
  const slot = form.dataset.slot;
  if (busy.has(slot)) return;
  const body = {
    kind: form.dataset.kind,
    slot,
    prompt: form.elements.prompt.value,
    voice: form.elements.voice?.value,
    aspectRatio: form.elements.aspectRatio?.value,
  };
  busy.set(slot, Date.now());
  paintBusy();
  const timer = setInterval(paintBusy, 1000);
  let result;
  try {
    const json = await getJson('/api/genmedia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    state.data.media = json.media;
    result = { text: state.lang === 'ja' ? 'ページに反映しました' : 'Updated on the page', tone: 'ok', rerender: true };
  } catch (err) {
    result = { text: err.message, tone: 'error' };
  } finally {
    clearInterval(timer);
    busy.delete(slot);
  }
  if (result.rerender) render();
  const fresh = cardFor(slot);
  if (fresh) {
    $('button[type=submit]', fresh).disabled = false;
    setStatus(fresh, result.text, result.tone);
  }
}

function toggleAudio(btn) {
  const src = btn.dataset.src;
  if (!src) return;
  const same = audio.src.endsWith(src);
  $$('.audio-btn.is-playing').forEach((b) => b.classList.remove('is-playing'));
  if (same && !audio.paused) {
    audio.pause();
    return;
  }
  if (!same) audio.src = src;
  audio.play().then(() => btn.classList.add('is-playing')).catch(() => {});
}
audio.addEventListener('ended', () => $$('.audio-btn.is-playing').forEach((b) => b.classList.remove('is-playing')));

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  if (t.dataset.view) { state.view = t.dataset.view; applyView(); }
  if (t.dataset.lang) { state.lang = normalizeLang(t.dataset.lang); render(); }
  if (t.dataset.action === 'print') { state.view = 'print'; applyView(); requestAnimationFrame(() => window.print()); }
  if (t.dataset.action === 'pptx') exportPptx().catch((err) => showErrors([`PPTX: ${err.message}`]));
  if (t.dataset.nav === 'prev') go(-1);
  if (t.dataset.nav === 'next') go(1);
  if (t.dataset.nav === 'fullscreen') document.documentElement.requestFullscreen?.();
  if (t.dataset.playSlot) toggleAudio(t);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-genmedia-card]');
  if (!form) return;
  e.preventDefault();
  generate(form);
});

document.addEventListener('keydown', (e) => {
  if (state.view !== 'slides' || e.target.closest('input, textarea, select')) return;
  const keys = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 };
  if (keys[e.key]) { e.preventDefault(); go(keys[e.key]); }
  if (e.key === 'Home') { state.slide = 0; applyView(); }
  if (e.key === 'End') { state.slide = Infinity; applyView(); }
  if (e.key === 'f') document.documentElement.requestFullscreen?.();
  if (e.key === 'Escape' && state.view === 'slides' && !document.fullscreenElement) { state.view = 'web'; applyView(); }
});

$('#talk-select').addEventListener('change', (e) => { state.slide = 0; loadTalk(e.target.value); });
window.addEventListener('afterprint', () => { if (state.view === 'print') { state.view = 'web'; applyView(); } });

async function main() {
  const [{ talks }, status] = await Promise.all([getJson('/api/talks'), getJson('/api/genmedia/status').catch(() => ({}))]);
  state.genmedia = { configured: Boolean(status.configured), reason: status.reason };
  $('#talk-select').innerHTML = talks.map((t) => `<option value="${esc(t.id)}">${esc(tr(t.title, state.lang ?? 'ja') || t.id)}</option>`).join('');
  const id = talks.some((t) => t.id === state.talkId) ? state.talkId : talks[0]?.id;
  if (!id) { showErrors(['talks/ に talk 定義がありません']); return; }
  await loadTalk(id);
  window.__introReady = true;
}

main().catch((err) => showErrors([err.message]));
