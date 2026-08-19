// dsh-elf — Client half
// Slowly drifting DeepSeek whale elf powered by the official favicon.svg whale
// (https://www.deepseek.com/harness/favicon.svg), translucent blue-purple-green
// gradient tile; click to open a draggable floating chat; minimize returns to
// elf mode. Supports following the session default model, or a custom
// OpenAI-compatible endpoint (base URL + API key + model), streamed directly
// from the browser for true token-by-token responses.
import React from 'react';
import { en, zh, NS } from './locales.js';

const API_PREFIX = '/dsh-elf/api';

async function callHost(method, args) {
  const response = await fetch(`${API_PREFIX}/${encodeURIComponent(method)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !payload.ok) {
    throw new Error((payload && payload.error) || zh.hostFail.replace('{0}', String(response.status)));
  }
  return payload.value;
}

const plugin = {
  inject: ['slots', 'locale'],
  apply(ctx) {
    const locale = ctx.locale;
    const t = locale ? locale.bind(NS) : null;
    if (locale) {
      ctx.effect(() => locale.register(NS, { zh, en }), 'dsh-elf: dictionaries');
    }
    function currentLang() {
      const active = locale ? String(locale.getSnapshot().active) : String(document.documentElement.lang || navigator.language || 'zh');
      return active.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }

    // NOTE: this is a profile-bundle client plugin, so cordis's `timer` service is
    // NOT available on the bundle ctx (that service is only installed for dynamic
    // cordis-runner packages). Use plain browser timers instead — the same pattern
    // dshmarket and other bundle plugins use — and dispose them from React effect
    // cleanup.
    const styles = {
      insert(css) {
        const selector = 'style[data-plugin-css="dsh-elf"]';
        if (document.querySelector(selector)) return;
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-elf';
        tag.dataset.pluginCss = 'dsh-elf';
        tag.textContent = css;
        document.head.appendChild(tag);
        ctx.effect(() => () => tag.remove(), 'dsh-elf: styles');
      },
    };

    // ---- Official favicon whale path (viewBox 0 0 50 50), split into short
    // chunks so the definition stays robust; joined below into WHALE_D. ----
    const WHALE_SEGS = [
      'M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 ',
      '34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9',
      '.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 2',
      '1.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.',
      '7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1',
      '152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.016',
      '1 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z',
    ];
    const WHALE_D = WHALE_SEGS.join('');
    const WHALE_VB = '0 0 50 50';

    // ---- Preset providers (id, label, default OpenAI-compatible base URL) ----
    const PRESETS = [
      { id: 'deepseek', labelKey: 'presetDeepseek', base: 'https://api.deepseek.com/v1' },
      { id: 'openai', labelKey: 'presetOpenai', base: 'https://api.openai.com/v1' },
      { id: 'moonshot', labelKey: 'presetMoonshot', base: 'https://api.moonshot.cn/v1' },
      { id: 'zhipu', labelKey: 'presetZhipu', base: 'https://open.bigmodel.cn/api/paas/v4' },
      { id: 'qwen', labelKey: 'presetQwen', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { id: 'custom', labelKey: 'presetCustom', base: '' },
    ];

    // ---- Styles ----
    styles.insert(`
.dsh-elf-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
.dsh-elf-root * { box-sizing: border-box; }
.dsh-elf-orb { position: fixed; pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; animation: dsh-elf-bob 4.2s ease-in-out infinite; transition: transform .15s ease; touch-action: none; }
.dsh-elf-orb:hover { transform: scale(1.08); }
.dsh-elf-orb svg { width: 40px; height: 40px; filter: drop-shadow(0 2px 5px rgba(77,107,254,.35)); }
@keyframes dsh-elf-bob { 0%,100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-5px) rotate(1.5deg); } }
@keyframes dsh-elf-in { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

.dsh-elf-win { position: fixed; pointer-events: auto; display: flex; flex-direction: column; width: 400px; max-width: calc(100vw - 24px); height: 540px; max-height: calc(100vh - 24px); border-radius: 16px; overflow: hidden; background: rgba(255,255,255,.92); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(139,92,246,.28); box-shadow: 0 18px 50px rgba(30,41,99,.28), 0 2px 10px rgba(30,41,99,.14); animation: dsh-elf-in .18s ease-out; z-index: 1; }
.dsh-elf-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: move; user-select: none; -webkit-user-select: none; background: linear-gradient(135deg, rgba(77,107,254,.16), rgba(139,92,246,.13) 55%, rgba(52,211,153,.16)); border-bottom: 1px solid rgba(139,92,246,.18); touch-action: none; }
.dsh-elf-head svg { width: 24px; height: 24px; flex: none; }
.dsh-elf-title { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; }
.dsh-elf-model { font-size: 11px; color: #64748b; background: rgba(139,92,246,.12); padding: 2px 8px; border-radius: 999px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
.dsh-elf-headbtn { border: none; background: transparent; cursor: pointer; color: #475569; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 13px; padding: 0; flex: none; }
.dsh-elf-headbtn:hover { background: rgba(139,92,246,.16); }
.dsh-elf-headbtn:disabled { opacity: .4; cursor: default; }
.dsh-elf-clear { border: 1px solid rgba(239,68,68,.35); background: rgba(239,68,68,.06); color: #dc2626; cursor: pointer; font-size: 11px; line-height: 1; padding: 4px 9px; border-radius: 999px; flex: none; }
.dsh-elf-clear:hover { background: rgba(239,68,68,.14); }
.dsh-elf-clear:disabled { opacity: .4; cursor: default; }
.dsh-elf-spacer { flex: 1; }

.dsh-elf-config { padding: 10px 12px; border-bottom: 1px solid rgba(139,92,246,.16); background: rgba(148,163,184,.07); font-size: 12px; color: #334155; display: none; max-height: 250px; overflow-y: auto; }
.dsh-elf-config.open { display: block; }
.dsh-elf-configrow { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.dsh-elf-configrow label { width: 84px; flex: none; color: #475569; }
.dsh-elf-configrow input[type='text'], .dsh-elf-configrow input[type='password'], .dsh-elf-configrow select { flex: 1; border: 1px solid rgba(139,92,246,.3); border-radius: 6px; padding: 4px 8px; font-size: 12px; background: rgba(255,255,255,.85); color: #1e293b; outline: none; min-width: 0; }
.dsh-elf-configrow input[type='text']:focus, .dsh-elf-configrow input[type='password']:focus, .dsh-elf-configrow select:focus { border-color: #8b5cf6; }
.dsh-elf-check { display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.dsh-elf-configrow label.dsh-elf-check { width: auto; flex: none; }
.dsh-elf-configrow input[type='checkbox'] { flex: none; width: 14px; height: 14px; min-width: 14px; min-height: 14px; margin: 0; padding: 0; border: none; background: transparent; accent-color: #8b5cf6; cursor: pointer; }
.dsh-elf-hint { font-size: 11px; color: #64748b; margin: 4px 0 2px; }

.dsh-elf-msgs { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: transparent; }
.dsh-elf-msg { max-width: 86%; padding: 8px 11px; border-radius: 12px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; position: relative; }
.dsh-elf-msg.user { align-self: flex-end; background: linear-gradient(135deg, #4d6bfe, #8b5cf6); color: #fff; border-bottom-right-radius: 4px; }
.dsh-elf-msg.assistant { align-self: flex-start; background: rgba(139,92,246,.1); color: #1e293b; border: 1px solid rgba(139,92,246,.18); border-bottom-left-radius: 4px; }
.dsh-elf-msg.error { border-color: rgba(239,68,68,.5); color: #b91c1c; background: rgba(239,68,68,.08); }
.dsh-elf-msg .copy { position: absolute; top: 4px; right: 6px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #94a3b8; opacity: 0; transition: opacity .12s; padding: 2px 4px; border-radius: 4px; }
.dsh-elf-msg:hover .copy { opacity: 1; }
.dsh-elf-msg .copy:hover { color: #8b5cf6; background: rgba(139,92,246,.1); }
.dsh-elf-msg.user .copy { color: rgba(255,255,255,.75); }
.dsh-elf-typing { display: inline-flex; gap: 4px; align-items: center; height: 18px; }
.dsh-elf-typing i { width: 5px; height: 5px; border-radius: 50%; background: #8b5cf6; animation: dsh-elf-bounce 1s ease-in-out infinite; }
.dsh-elf-typing i:nth-child(2) { animation-delay: .15s; }
.dsh-elf-typing i:nth-child(3) { animation-delay: .3s; }
@keyframes dsh-elf-bounce { 0%,100% { transform: translateY(0); opacity: .5; } 50% { transform: translateY(-5px); opacity: 1; } }

.dsh-elf-inputrow { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(139,92,246,.16); background: rgba(255,255,255,.6); }
.dsh-elf-input { flex: 1; border: 1px solid rgba(139,92,246,.28); border-radius: 10px; padding: 8px 10px; font-size: 13px; line-height: 1.4; resize: none; outline: none; background: rgba(255,255,255,.9); color: #1e293b; max-height: 96px; font-family: inherit; }
.dsh-elf-input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,.15); }
.dsh-elf-send { border: none; cursor: pointer; background: linear-gradient(135deg, #4d6bfe, #8b5cf6); color: #fff; width: 34px; height: 34px; border-radius: 10px; font-size: 15px; display: flex; align-items: center; justify-content: center; flex: none; }
.dsh-elf-send:hover { filter: brightness(1.08); }
.dsh-elf-send:disabled { opacity: .5; cursor: default; }

@media (prefers-color-scheme: dark) {
  .dsh-elf-win { background: rgba(15,23,42,.9); border-color: rgba(139,92,246,.4); }
  .dsh-elf-title { color: #e2e8f0; }
  .dsh-elf-msg.assistant { color: #e2e8f0; background: rgba(139,92,246,.18); border-color: rgba(139,92,246,.3); }
  .dsh-elf-msg.error { color: #fca5a5; }
  .dsh-elf-model { color: #cbd5e1; background: rgba(139,92,246,.2); }
  .dsh-elf-headbtn { color: #cbd5e1; }
  .dsh-elf-config { color: #cbd5e1; background: rgba(148,163,184,.08); }
  .dsh-elf-configrow label { color: #cbd5e1; }
  .dsh-elf-configrow input[type='text'], .dsh-elf-configrow input[type='password'], .dsh-elf-configrow select { background: rgba(30,41,59,.8); color: #e2e8f0; border-color: rgba(139,92,246,.4); }
  .dsh-elf-hint { color: #94a3b8; }
  .dsh-elf-inputrow { background: rgba(15,23,42,.55); }
  .dsh-elf-input { background: rgba(30,41,59,.85); color: #e2e8f0; border-color: rgba(139,92,246,.4); }
}
`);

    // ---- Whale icon ----
    // white: white whale on the translucent gradient tile (photos of the orb).
    // default: gradient whale (used in the chat window head).
    function WhaleIcon(props) {
      const white = props.white;
      const gid = props.gid || 'dsh-elf-grad';
      const defs = [];
      if (!white) {
        defs.push(React.createElement('defs', { key: 'defs' },
          React.createElement('linearGradient', { id: gid, x1: '0', y1: '0', x2: '1', y2: '1' },
            React.createElement('stop', { offset: '0%', stopColor: '#4D6BFE' }),
            React.createElement('stop', { offset: '50%', stopColor: '#8B5CF6' }),
            React.createElement('stop', { offset: '100%', stopColor: '#34D399' }),
          ),
        ));
      }
      const cls = 'dsh-elf-whale' + (props.cls ? ' ' + props.cls : '');
      return React.createElement('svg', {
        viewBox: WHALE_VB,
        width: props.size || 46,
        height: props.size || 46,
        preserveAspectRatio: 'xMidYMid meet',
        'aria-hidden': true,
        className: cls,
      }, defs,
        React.createElement('path', {
          d: WHALE_D,
          fill: white ? '#ffffff' : 'url(#' + gid + ')',
          fillOpacity: white ? (props.opacity != null ? props.opacity : 0.97) : 1,
        }),
      );
    }

    // ---- Small helpers ----
    function lastOf(arr) { return arr[arr.length - 1]; }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    // Module-level flag: whether the last pointer drag actually moved.
    let lastDragMoved = false;

    function ElfApp() {
      const lang = React.useSyncExternalStore(
        (cb) => (locale ? locale.subscribe(cb) : () => {}),
        () => currentLang(),
      );
      const T = lang === 'zh' ? zh : en;
      const [mode, setMode] = React.useState('orb'); // 'orb' | 'chat'
      const [msgs, setMsgs] = React.useState([]);
      const [input, setInput] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [cfgOpen, setCfgOpen] = React.useState(false);
      // cfg: { follow, provider, base, apiKey, model, effort }
      const [cfg, setCfg] = React.useState(null);
      const [session, setSession] = React.useState(null);
      const [orbPos, setOrbPos] = React.useState(null); // anchor {x,y}
      const [winPos, setWinPos] = React.useState(null);
      const [drag, setDrag] = React.useState(null);
      const [chatId, setChatId] = React.useState(null);

      // ---- persistence ----
      React.useEffect(() => {
        try {
          const raw = localStorage.getItem('dsh-elf:chat');
          if (raw) {
            const saved = JSON.parse(raw);
            if (Array.isArray(saved)) setMsgs(saved.filter((m) => !m.pending));
          }
        } catch (e) { /* ignore */ }
        try {
          const raw = localStorage.getItem('dsh-elf:cfg');
          const def = { follow: true, provider: 'deepseek', base: PRESETS[0].base, apiKey: '', model: '', effort: '' };
          if (raw) { const saved = JSON.parse(raw); setCfg(Object.assign(def, saved)); }
          else setCfg(def);
        } catch (e) { setCfg({ follow: true, provider: 'deepseek', base: PRESETS[0].base, apiKey: '', model: '', effort: '' }); }
        try {
          const raw = localStorage.getItem('dsh-elf:orb');
          if (raw) setOrbPos(JSON.parse(raw));
        } catch (e) { /* ignore */ }
        try {
          const raw = localStorage.getItem('dsh-elf:win');
          if (raw) setWinPos(JSON.parse(raw));
        } catch (e) { /* ignore */ }
        try {
          const raw = localStorage.getItem('dsh-elf:mode');
          if (raw) setMode(raw);
        } catch (e) { /* ignore */ }
        callHost('elf.sessionModel', {}).then((r) => { if (r && r.available) setSession(r); }).catch(() => {});
      }, []);

      React.useEffect(() => { try { localStorage.setItem('dsh-elf:chat', JSON.stringify(msgs)); } catch (e) {} }, [msgs]);
      React.useEffect(() => { if (cfg) { try { localStorage.setItem('dsh-elf:cfg', JSON.stringify(cfg)); } catch (e) {} } }, [cfg]);
      // Orb/win positions are persisted only when a manual drag ends (see onUp),
      // so the drift animation never thrashes localStorage.
      React.useEffect(() => { try { localStorage.setItem('dsh-elf:mode', mode); } catch (e) {} }, [mode]);

      // ---- effective model label ----
      let effModel = '…';
      if (cfg) {
        if (!cfg.follow && cfg.model) effModel = (cfg.base || 'custom').replace(/^https?:\/\//, '').split('/')[0] + '/' + cfg.model + (cfg.effort ? ' · ' + cfg.effort : '');
        else if (session) effModel = session.provider + '/' + session.model;
        else effModel = T.modelFollow;
      }

      // ---- orb drift: slow wandering, clamped to the viewport ----
      // Drifts around its anchor point while idle; stops while being dragged.
      React.useEffect(() => {
        if (mode !== 'orb') return undefined;
        let t = Math.random() * 10;
        const id = window.setInterval(() => {
          if (drag) return; // paused while dragging
          t += 0.02;
          const vw = window.innerWidth || 1200;
          const vh = window.innerHeight || 800;
          const size = 48;
          // anchor: current orbPos (or default bottom-right when none)
          const ax = orbPos ? orbPos.x : (vw - size - 22);
          const ay = orbPos ? orbPos.y : (vh - size - 22);
          const rx = Math.min(46, vw / 12);
          const ry = Math.min(30, vh / 16);
          const x = clamp(ax + Math.sin(t) * rx, 6, vw - size - 6);
          const y = clamp(ay + Math.cos(t * 1.4) * ry, 6, vh - size - 6);
          setOrbPos({ x, y });
        }, 100);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [mode, !!drag]);

      // ---- drag handling (clamped inside the viewport) ----
      React.useEffect(() => {
        if (!drag) return undefined;
        const onMove = (e) => {
          lastDragMoved = true;
          const vw = window.innerWidth || 1200;
          const vh = window.innerHeight || 800;
          if (drag.kind === 'orb') {
            const size = 48;
            setOrbPos({
              x: clamp(e.clientX - drag.dx, 6, vw - size - 6),
              y: clamp(e.clientY - drag.dy, 6, vh - size - 6),
            });
          } else {
            const w = 400;
            const h = 540;
            setWinPos({
              x: clamp(e.clientX - drag.dx, 6, vw - w - 6),
              y: clamp(e.clientY - drag.dy, 6, vh - h - 6),
            });
          }
        };
        const onUp = (e) => {
          setDrag(null);
          // Persist the drop position computed from the final pointer event.
          const vw = window.innerWidth || 1200;
          const vh = window.innerHeight || 800;
          if (drag.kind === 'orb') {
            const size = 48;
            const x = clamp(e.clientX - drag.dx, 6, vw - size - 6);
            const y = clamp(e.clientY - drag.dy, 6, vh - size - 6);
            setOrbPos({ x, y });
            try { localStorage.setItem('dsh-elf:orb', JSON.stringify({ x, y })); } catch (err) {}
          } else {
            const w = 400;
            const h = 540;
            const x = clamp(e.clientX - drag.dx, 6, vw - w - 6);
            const y = clamp(e.clientY - drag.dy, 6, vh - h - 6);
            setWinPos({ x, y });
            try { localStorage.setItem('dsh-elf:win', JSON.stringify({ x, y })); } catch (err) {}
          }
        };
        if (window.addEventListener) {
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
        }
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [drag]);

      const startOrbDrag = (e) => {
        if (mode !== 'orb') return;
        if (e.button !== undefined && e.button !== 0) return;
        lastDragMoved = false;
        const rect = e.currentTarget.getBoundingClientRect();
        setDrag({ kind: 'orb', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
        if (e.preventDefault) e.preventDefault();
      };
      const startWinDrag = (e) => {
        if (e.target && e.target.closest && e.target.closest('.dsh-elf-headbtn, .dsh-elf-clear')) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setDrag({ kind: 'win', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
        if (e.preventDefault) e.preventDefault();
      };

      // ---- streaming: host route (follow session default) ----
      React.useEffect(() => {
        if (!chatId) return undefined;
        let stopped = false;
        const pollOnce = async () => {
          if (stopped) return;
          try {
            const r = await callHost('elf.chat.poll', { chatId });
            if (stopped) return;
            if (r && r.ok) {
              setMsgs((prev) => {
                const copy = prev.slice();
                const last = lastOf(copy);
                if (last && last.role === 'assistant' && last.pending) {
                  if (r.error) copy[copy.length - 1] = { role: 'assistant', text: '', pending: false, error: r.error };
                  else copy[copy.length - 1] = { role: 'assistant', text: r.text, pending: !r.done };
                }
                return copy;
              });
              if (r.done) {
                stopped = true;
                setBusy(false);
                setChatId(null);
                try { callHost('elf.chat.close', { chatId }); } catch (e) {}
              }
            } else {
              stopped = true;
              setBusy(false);
              setChatId(null);
              setMsgs((prev) => {
                const copy = prev.slice();
                const last = lastOf(copy);
                if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: '', pending: false, error: (r && r.error) || T.chatEnded };
                return copy;
              });
            }
          } catch (err) {
            if (!stopped) {
              stopped = true;
              setBusy(false);
              setChatId(null);
              setMsgs((prev) => {
                const copy = prev.slice();
                const last = lastOf(copy);
                if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: '', pending: false, error: String((err && err.message) || err) };
                return copy;
              });
            }
          }
        };
        // Poll immediately for the first token, then on a tight interval.
        const first = window.setTimeout(pollOnce, 0);
        const interval = window.setInterval(pollOnce, 55);
        return () => { stopped = true; window.clearTimeout(first); window.clearInterval(interval); };
      }, [chatId]);

      // ---- actions ----
      const send = () => {
        const text = input.trim();
        if (!text || busy) return;
        const next = msgs.concat([{ role: 'user', text }, { role: 'assistant', text: '', pending: true }]);
        setMsgs(next);
        setInput('');
        setBusy(true);

        const wire = next.filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text }));

        if (cfg && !cfg.follow) {
          // Custom OpenAI-compatible route: stream directly from the browser.
          const base = (cfg.base || '').trim().replace(/\/+$/, '');
          const model = (cfg.model || '').trim();
          if (!base || !model || !cfg.apiKey) {
            setBusy(false);
            setMsgs((prev) => {
              const copy = prev.slice();
              const last = lastOf(copy);
              if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: '', pending: false, error: T.needCustomCfg };
              return copy;
            });
            return;
          }
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const url = base + '/chat/completions';
          const body = { model, messages: wire.map((m) => ({ role: m.role, content: m.text })), stream: true };
          if (cfg.effort) body.reasoning_effort = cfg.effort;

          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + (cfg.apiKey || '').trim(),
            },
            body: JSON.stringify(body),
            signal: controller ? controller.signal : undefined,
          }).then(async (res) => {
            if (!res.ok) {
              let msg = 'HTTP ' + res.status;
              try { const j = await res.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch (e) {}
              throw new Error(msg);
            }
            if (!res.body || !res.body.getReader) {
              // Fallback: whole-body JSON (non-streaming endpoint)
              const j = await res.json();
              const t = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
              setMsgs((prev) => {
                const copy = prev.slice();
                const last = lastOf(copy);
                if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: t, pending: false };
                return copy;
              });
              return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let acc = '';
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let nl;
              while ((nl = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (!line || line[0] !== 'd') continue;
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') { buffer = ''; break; }
                try {
                  const j = JSON.parse(data);
                  const piece = j && j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
                  if (typeof piece === 'string' && piece) {
                    acc += piece;
                    setMsgs((prev) => {
                      const copy = prev.slice();
                      const last = lastOf(copy);
                      if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: acc, pending: true };
                      return copy;
                    });
                  }
                } catch (e) { /* partial json lines are skipped */ }
              }
            }
            setMsgs((prev) => {
              const copy = prev.slice();
              const last = lastOf(copy);
              if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: acc, pending: false };
              return copy;
            });
          }).catch((err) => {
            setBusy(false);
            setMsgs((prev) => {
              const copy = prev.slice();
              const last = lastOf(copy);
              if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: '', pending: false, error: String((err && err.message) || err) };
              return copy;
            });
          }).then(() => {
            setBusy(false);
          });
          return;
        }

        // Session-default route via the host (the harness's configured provider).
        const payload = { messages: wire, lang: lang === 'zh' ? 'zh' : 'en' };
        callHost('elf.chat.start', payload).then((r) => {
          if (r && r.ok) {
            setChatId(r.chatId);
          } else {
            setBusy(false);
            setMsgs((prev) => {
              const copy = prev.slice();
              const last = lastOf(copy);
              if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: '', pending: false, error: (r && r.error) || T.reqFailed };
              return copy;
            });
          }
        }).catch((err) => {
          setBusy(false);
          setMsgs((prev) => {
            const copy = prev.slice();
            const last = lastOf(copy);
            if (last && last.role === 'assistant' && last.pending) copy[copy.length - 1] = { role: 'assistant', text: '', pending: false, error: String((err && err.message) || err) };
            return copy;
          });
        });
      };

      const clearChat = () => {
        setMsgs([]);
        setBusy(false);
        setChatId(null);
      };

      const copyMsg = (text, ev) => {
        const done = () => {
          if (ev && ev.currentTarget) {
            const old = ev.currentTarget.textContent;
            ev.currentTarget.textContent = '✓';
            setTimeout(() => { if (ev.currentTarget) ev.currentTarget.textContent = old; }, 900);
          }
        };
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        } else {
          fallbackCopy(text, done);
        }
      };
      const fallbackCopy = (text, done) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done();
        } catch (e) { done(); }
      };

      const onInputKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      };

      const onProviderChange = (e) => {
        const id = e.target.value;
        const preset = PRESETS.find((p) => p.id === id) || PRESETS[PRESETS.length - 1];
        setCfg(Object.assign({}, cfg, { provider: id, base: preset.base }));
      };

      // ---- render ----
      const orbStyle = orbPos ? { left: orbPos.x + 'px', top: orbPos.y + 'px', right: 'auto', bottom: 'auto' } : { right: '22px', bottom: '22px' };
      const winStyle = winPos ? { left: winPos.x + 'px', top: winPos.y + 'px', right: 'auto', bottom: 'auto' } : { right: '22px', bottom: '22px' };

      const children = [];
        if (mode === 'orb') {
          children.push(
            React.createElement('div', {
              key: 'orb',
              className: 'dsh-elf-orb',
              style: orbStyle,
              onPointerDown: startOrbDrag,
              onClick: (e) => { const moved = lastDragMoved; lastDragMoved = false; if (!moved) { setMode('chat'); } },
              title: T.name,
            },
              React.createElement(WhaleIcon, { key: 'whale', size: 40, gid: 'dsh-elf-grad-orb' }),
            ),
          );
        } else {
          const headChildren = [
            React.createElement(WhaleIcon, { key: 'whale', size: 24, gid: 'dsh-elf-grad-head' }),
            React.createElement('span', { key: 'title', className: 'dsh-elf-title' }, T.title),
            React.createElement('span', { key: 'model', className: 'dsh-elf-model', title: T.modelBadgeTitle }, effModel),
            React.createElement('span', { key: 'sp', className: 'dsh-elf-spacer' }),
            React.createElement('button', { key: 'cfg', className: 'dsh-elf-headbtn', title: T.cfgBtn, onClick: () => setCfgOpen(!cfgOpen) }, '⚙'),
            React.createElement('button', { key: 'min', className: 'dsh-elf-headbtn', title: T.mini, onClick: () => setMode('orb') }, '—'),
            React.createElement('button', { key: 'clear', className: 'dsh-elf-clear', title: T.clearTitle, onClick: clearChat, disabled: !msgs.length }, T.clear),
          ];

          const cfgChildren = [];
          if (cfg) {
            const presetOptions = PRESETS.map((p) =>
              React.createElement('option', { key: p.id, value: p.id }, T[p.labelKey]));
            cfgChildren.push(
              React.createElement('div', { key: 'r0', className: 'dsh-elf-configrow' },
                React.createElement('label', null, T.modelSource),
                React.createElement('label', { className: 'dsh-elf-check', key: 'follow' },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: !!cfg.follow,
                    onChange: (e) => setCfg(Object.assign({}, cfg, { follow: e.target.checked })),
                  }),
                  T.follow,
                ),
              ),
              React.createElement('div', { key: 'r1', className: 'dsh-elf-configrow' },
                React.createElement('label', { htmlFor: 'dsh-elf-provider' }, T.provider),
                React.createElement('select', {
                  id: 'dsh-elf-provider',
                  value: cfg.provider,
                  disabled: cfg.follow,
                  onChange: onProviderChange,
                }, presetOptions),
              ),
              React.createElement('div', { key: 'r2', className: 'dsh-elf-configrow' },
                React.createElement('label', { htmlFor: 'dsh-elf-base' }, T.apiBase),
                React.createElement('input', {
                  id: 'dsh-elf-base', type: 'text', placeholder: 'https://api.deepseek.com/v1', value: cfg.base,
                  disabled: cfg.follow,
                  onChange: (e) => setCfg(Object.assign({}, cfg, { base: e.target.value })),
                }),
              ),
              React.createElement('div', { key: 'r3', className: 'dsh-elf-configrow' },
                React.createElement('label', { htmlFor: 'dsh-elf-key' }, T.apiKey),
                React.createElement('input', {
                  id: 'dsh-elf-key', type: 'password', placeholder: 'sk-…', value: cfg.apiKey,
                  disabled: cfg.follow,
                  onChange: (e) => setCfg(Object.assign({}, cfg, { apiKey: e.target.value })),
                }),
              ),
              React.createElement('div', { key: 'r4', className: 'dsh-elf-configrow' },
                React.createElement('label', { htmlFor: 'dsh-elf-model' }, T.model),
                React.createElement('input', {
                  id: 'dsh-elf-model', type: 'text', placeholder: T.modelPh, value: cfg.model,
                  disabled: cfg.follow,
                  onChange: (e) => setCfg(Object.assign({}, cfg, { model: e.target.value })),
                }),
              ),
              React.createElement('div', { key: 'r5', className: 'dsh-elf-configrow' },
                React.createElement('label', { htmlFor: 'dsh-elf-effort' }, T.reasoning),
                React.createElement('input', {
                  id: 'dsh-elf-effort', type: 'text', placeholder: T.effortPh, value: cfg.effort,
                  disabled: cfg.follow,
                  onChange: (e) => setCfg(Object.assign({}, cfg, { effort: e.target.value })),
                }),
              ),
              React.createElement('div', { key: 'hint', className: 'dsh-elf-hint' },
                T.cfgHint,
              ),
            );
          }

          const msgChildren = msgs.map((m, i) => {
            const cls = 'dsh-elf-msg ' + (m.role === 'user' ? 'user' : 'assistant') + (m.error ? ' error' : '');
            const typing = React.createElement('span', { className: 'dsh-elf-typing' },
              React.createElement('i', null), React.createElement('i', null), React.createElement('i', null));
            const inner = m.pending ? (m.text || typing) : (m.text || (m.error ? m.error : ''));
            return React.createElement('div', { key: 'm' + i, className: cls },
              inner,
              (!m.pending && m.text ? React.createElement('button', {
                className: 'copy',
                onClick: (e) => copyMsg(m.text, e),
                title: T.copy,
              }, '📋') : null),
            );
          });
          if (!msgs.length) {
            msgChildren.push(React.createElement('div', { key: 'empty', className: 'dsh-elf-msg assistant', style: { opacity: '.72' } }, T.empty));
          }

          children.push(
            React.createElement('div', { key: 'win', className: 'dsh-elf-win', style: winStyle },
              React.createElement('div', { key: 'head', className: 'dsh-elf-head', onPointerDown: startWinDrag },
                headChildren,
              ),
              React.createElement('div', { key: 'cfg', className: 'dsh-elf-config' + (cfgOpen ? ' open' : '') }, cfgChildren),
              React.createElement('div', { key: 'msgs', className: 'dsh-elf-msgs' }, msgChildren),
              React.createElement('div', { key: 'in', className: 'dsh-elf-inputrow' },
                React.createElement('textarea', {
                  className: 'dsh-elf-input',
                  rows: 1,
                  placeholder: T.inputPh,
                  value: input,
                  onChange: (e) => setInput(e.target.value),
                  onKeyDown: onInputKey,
                }),
                React.createElement('button', { className: 'dsh-elf-send', onClick: send, disabled: busy || !input.trim() || !cfg }, '➤'),
              ),
            ),
          );
        }

        return React.createElement('div', { className: 'dsh-elf-root' }, children);
    }

    // ---- Slot registration ----
    ctx.slots.inject('shell.overlay', () => ctx.slots.register(
      { name: 'shell.overlay', id: 'dsh-elf', order: 500, label: () => (t ? t('name') : (currentLang() === 'zh' ? zh.name : en.name)), locale: NS },
      () => React.createElement(ElfApp, null),
    ));
  },
};

export const inject = plugin.inject;
export const apply = plugin.apply;
