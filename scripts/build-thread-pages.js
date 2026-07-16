/**
 * Build three pages for the thread comparison:
 * 1. runoob-thread.html — standalone 菜鸟教程 page (with syntax highlighting + theme)
 * 2. std-thread-deep-dive.html — standalone std::thread page (with syntax highlighting + theme)
 * 3. cpp-threading-comparison.html — 50/50 iframe split viewer (with theme propagation)
 */
const fs = require('fs');
const path = require('path');
const threadDir = path.join(__dirname, '..', 'doc', 'thread');

// ====== Common standalone CSS ======
const standaloneCSS = `
:root {
  --text: #1E293B; --text-secondary: #475569; --bg: #F8FAFC;
  --bg-code: #F1F5F9; --border: #E2E8F0; --primary: #2563EB;
  --accent: #EA580C; --radius: 8px;
}
[data-theme="dark"] {
  --text: #E2E8F0; --text-secondary: #94A3B8; --bg: #0F172A;
  --bg-code: #1E293B; --border: #334155; --primary: #60A5FA;
  --accent: #FB923C;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --text: #E2E8F0; --text-secondary: #94A3B8; --bg: #0F172A;
    --bg-code: #1E293B; --border: #334155; --primary: #60A5FA;
    --accent: #FB923C;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.85;
  padding: 32px 36px; max-width: 100%; overflow-x: hidden;
}
h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 18px; color: var(--text); border-bottom: 2px solid var(--border); padding-bottom: 10px; }
h2 { font-size: 1.2rem; font-weight: 700; margin: 30px 0 12px; color: var(--text); }
h3 { font-size: 1.02rem; font-weight: 600; margin: 20px 0 8px; color: var(--text); }
p { margin-bottom: 14px; color: var(--text-secondary); line-height: 1.85; }
ul, ol { margin: 8px 0 16px 22px; color: var(--text-secondary); }
li { margin-bottom: 4px; line-height: 1.75; }
code { background: var(--bg-code); padding: 2px 6px; border-radius: 4px; font-family: "JetBrains Mono","Fira Code",Consolas,"Courier New",monospace; font-size: 0.87em; color: #e11d48; }
pre { background: var(--bg-code); border: 1px solid var(--border); border-radius: 6px; padding: 16px 20px; overflow-x: auto; margin: 16px 0; font-size: 0.87rem; line-height: 1.65; }
pre code { background: transparent; padding: 0; color: var(--text); font-size: inherit; }
strong { color: var(--text); }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
hr { border: none; border-top: 1px solid var(--border); margin: 26px 0; }
blockquote { border-left: 3px solid var(--primary); margin: 16px 0; padding: 10px 18px; background: var(--bg-code); border-radius: 0 6px 6px 0; color: var(--text-secondary); }
blockquote p { margin-bottom: 4px; }
img { max-width: 100%; border-radius: 6px; }

/* Runoob-specific */
.code-example { background: var(--bg-code); border: 1px solid var(--border); border-radius: 6px; margin: 16px 0; overflow: hidden; }
.code-example-label { background: #1e293b; color: #fff; font-size: 0.82rem; font-weight: 600; padding: 7px 14px; }
[data-theme="dark"] .code-example-label { background: #334155; }
.code-example pre { margin: 0; border: none; border-radius: 0; }
.color_h1 { color: var(--accent); }
.marked { background: #FEF3C7; padding: 1px 4px; border-radius: 3px; font-weight: 500; }
[data-theme="dark"] .marked { background: #78350F; color: #FDE68A; }
`;

// ====== Syntax highlighting CSS ======
const syntaxCSS = `
/* Syntax highlighting */
.tk-keyword { color: #7c3aed; font-weight: 600; }
.tk-type { color: #0ea5e9; }
.tk-function { color: #2563eb; }
.tk-string { color: #16a34a; }
.tk-comment { color: #94a3b8; font-style: italic; }
.tk-number { color: #db2777; }
.tk-preprocessor { color: #ea580c; }
[data-theme="dark"] .tk-keyword { color: #c084fc; }
[data-theme="dark"] .tk-type { color: #38bdf8; }
[data-theme="dark"] .tk-function { color: #60a5fa; }
[data-theme="dark"] .tk-string { color: #4ade80; }
[data-theme="dark"] .tk-comment { color: #64748b; }
[data-theme="dark"] .tk-number { color: #f472b6; }
[data-theme="dark"] .tk-preprocessor { color: #fb923c; }
`;

// ====== Shared JS for standalone pages ======
const sharedJS = `(function() {
  // Theme — read localStorage + listen for parent postMessage
  var h = document.documentElement;
  function setTheme(t) {
    if (t === 'dark') h.setAttribute('data-theme','dark');
    else if (t === 'light') h.setAttribute('data-theme','light');
    else h.removeAttribute('data-theme');
  }
  setTheme(localStorage.getItem('theme'));
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'setTheme') {
      localStorage.setItem('theme', e.data.value);
      setTheme(e.data.value);
    }
  });

  // C++ syntax highlighter
  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  var KW = new Set('int void bool char short long float double unsigned signed size_t auto const static volatile mutable explicit inline if else for while do switch case break continue return goto try catch throw class struct enum union namespace public private protected virtual override final template typename using operator new delete sizeof typedef decltype true false nullptr this constexpr noexcept thread_local'.split(' '));

  function tokenize(code) {
    if (/<span\\s/.test(code)) return code;
    var out = '', i = 0, len = code.length;
    while (i < len) {
      var c = code[i];
      // line comment
      if (c === '/' && code[i+1] === '/') {
        var e = code.indexOf('\\n', i); if (e === -1) e = len;
        out += '<span class="tk-comment">' + esc(code.slice(i, e)) + '</span>';
        i = e; continue;
      }
      // block comment
      if (c === '/' && code[i+1] === '*') {
        var e = code.indexOf('*/', i+2); if (e === -1) e = len-2;
        out += '<span class="tk-comment">' + esc(code.slice(i, e+2)) + '</span>';
        i = e+2; continue;
      }
      // string
      if (c === '"') {
        var e = i+1;
        while (e < len && code[e] !== '"') { if (code[e] === '\\\\') e++; e++; }
        if (e < len) e++;
        out += '<span class="tk-string">' + esc(code.slice(i, e)) + '</span>';
        i = e; continue;
      }
      // preprocessor
      if (c === '#' && (i === 0 || code[i-1] === '\\n')) {
        var e = code.indexOf('\\n', i); if (e === -1) e = len;
        out += '<span class="tk-preprocessor">' + esc(code.slice(i, e)) + '</span>';
        i = e; continue;
      }
      // number
      if (/[0-9]/.test(c) && (i === 0 || !/[a-zA-Z_]/.test(code[i-1]))) {
        var s = i;
        while (i < len && /[0-9a-fA-FxXbB.uUlL]/.test(code[i])) i++;
        out += '<span class="tk-number">' + esc(code.slice(s, i)) + '</span>';
        continue;
      }
      // word
      if (/[a-zA-Z_]/.test(c)) {
        var s = i;
        while (i < len && /[a-zA-Z_0-9]/.test(code[i])) i++;
        var w = code.slice(s, i);
        if (KW.has(w)) out += '<span class="tk-keyword">' + esc(w) + '</span>';
        else if (/^[A-Z]/.test(w) || w === 'std') out += '<span class="tk-type">' + esc(w) + '</span>';
        else if (i < len && code[i] === '(') out += '<span class="tk-function">' + esc(w) + '</span>';
        else out += esc(w);
        continue;
      }
      out += esc(c); i++;
    }
    return out;
  }

  document.addEventListener('DOMContentLoaded', function() {
    var blocks = document.querySelectorAll('pre code');
    for (var b = 0; b < blocks.length; b++) {
      var el = blocks[b], txt = el.textContent || el.innerText || '';
      if (txt.trim().length === 0) continue;
      el.innerHTML = tokenize(txt);
    }
  });
})();`;

// ====== 1. Extract left content from existing runoob-thread.html ======
const existingRunoob = fs.readFileSync(path.join(threadDir, 'runoob-thread.html'), 'utf-8');
const leftMatch = existingRunoob.match(/<body>([\s\S]*?)<\/body>/i);
let leftHTML = leftMatch ? leftMatch[1] : '';
// Remove the script tag (sharedJS) if present — it will be re-added
leftHTML = leftHTML.replace(/<script>[\s\S]*?<\/script>/gi, '');
if (!leftHTML.trim()) { console.error('Could not extract left content from runoob-thread.html'); process.exit(1); }

// ====== 2. Convert markdown to HTML ======
const mdPath = path.join(threadDir, 'std thread join与detach与互斥量与锁与条件变量与原子操作与线程局部存储.md');
const mdContent = fs.readFileSync(mdPath, 'utf-8');

function mdToHTML(md) {
  const lines = md.split('\n');
  let html = '';
  let inCode = false, codeBuf = '', inList = false, listTag = '';

  function flush() { if (inList) { html += '</' + listTag + '>\n'; inList = false; listTag = ''; } }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) { html += '<pre><code>' + esc(codeBuf.trim()) + '</code></pre>\n'; codeBuf = ''; inCode = false; }
      else { flush(); inCode = true; codeBuf = ''; }
      continue;
    }
    if (inCode) { codeBuf += line + '\n'; continue; }
    if (line.trim() === '') { flush(); continue; }
    if (line.trim() === '---') { flush(); html += '<hr>\n'; continue; }
    if (line.startsWith('### ')) { flush(); html += '<h3>' + il(line.slice(4)) + '</h3>\n'; continue; }
    if (line.startsWith('## ')) { flush(); html += '<h2>' + il(line.slice(3)) + '</h2>\n'; continue; }
    if (line.startsWith('# ')) { flush(); html += '<h1>' + il(line.slice(2)) + '</h1>\n'; continue; }
    if (line.startsWith('> ')) { flush(); html += '<blockquote><p>' + il(line.slice(2)) + '</p></blockquote>\n'; continue; }
    if (/^[\-\*]\s/.test(line)) {
      if (!inList || listTag !== 'ul') { flush(); html += '<ul>\n'; inList = true; listTag = 'ul'; }
      html += '<li>' + il(line.replace(/^[\-\*]\s/, '')) + '</li>\n'; continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (!inList || listTag !== 'ol') { flush(); html += '<ol>\n'; inList = true; listTag = 'ol'; }
      html += '<li>' + il(line.replace(/^\d+\.\s/, '')) + '</li>\n'; continue;
    }
    flush(); html += '<p>' + il(line) + '</p>\n';
  }
  flush(); if (inCode) html += '<pre><code>' + esc(codeBuf.trim()) + '</code></pre>\n';
  return html;
}
function il(t) { return t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>'); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let rightHTML = mdToHTML(mdContent);

// ====== 3. Write standalone pages ======
const runoobPage = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<style>' + standaloneCSS + syntaxCSS + '</style>\n</head>\n<body>\n' + leftHTML + '\n<script>' + sharedJS + '</script>\n</body>\n</html>';
const stdPage = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<style>' + standaloneCSS + syntaxCSS + '</style>\n</head>\n<body>\n' + rightHTML + '\n<script>' + sharedJS + '</script>\n</body>\n</html>';

fs.writeFileSync(path.join(threadDir, 'runoob-thread.html'), runoobPage, 'utf-8');
fs.writeFileSync(path.join(threadDir, 'std-thread-deep-dive.html'), stdPage, 'utf-8');
console.log('runoob-thread.html:', (runoobPage.length / 1024).toFixed(0), 'KB');
console.log('std-thread-deep-dive.html:', (stdPage.length / 1024).toFixed(0), 'KB');

// ====== 4. Write split-view iframe page ======
const splitPage = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="../../img/icons/icon1.png">
<title>C++ 多线程对比阅读 — YJ Knowledge Bank</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #F8FAFC; --bg-card: #FFFFFF; --text: #1E293B; --text-secondary: #64748B;
  --border: #E2E8F0; --primary: #2563EB; --primary-light: #DBEAFE;
  --accent: #EA580C; --radius: 8px;
}
[data-theme="dark"] {
  --bg: #0F172A; --bg-card: #1E293B; --text: #E2E8F0; --text-secondary: #94A3B8;
  --border: #334155; --primary: #60A5FA; --primary-light: #1E3A5F;
  --accent: #FB923C;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0F172A; --bg-card: #1E293B; --text: #E2E8F0; --text-secondary: #94A3B8;
    --border: #334155; --primary: #60A5FA; --primary-light: #1E3A5F;
    --accent: #FB923C;
  }
}

html, body { height: 100%; overflow: hidden; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.6;
  display: flex; flex-direction: column;
}

/* Nav */
.nav { background: var(--bg-card); border-bottom: 1px solid var(--border); z-index: 100; flex-shrink: 0; }
.nav-inner { margin: 0 auto; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; height: 50px; }
.nav-brand { font-size: 1.15rem; font-weight: 700; color: var(--text); text-decoration: none; display: flex; align-items: center; gap: 8px; }
.nav-brand .icon { width: 22px; height: 22px; }
.nav-links { display: flex; align-items: center; gap: 2px; list-style: none; }
.nav-links a { text-decoration: none; color: var(--text-secondary); padding: 5px 10px; border-radius: 6px; font-size: 0.82rem; font-weight: 500; transition: all 0.15s; }
.nav-links a:hover { color: var(--primary); background: var(--primary-light); }
.nav-links a.active { color: var(--primary); background: var(--primary-light); font-weight: 600; }
.theme-btn { background: none; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 1rem; padding: 4px 8px; color: var(--text-secondary); line-height: 1; }
.theme-btn:hover { background: var(--bg); color: var(--primary); }

/* Toolbar */
.toolbar { background: var(--bg-card); border-bottom: 1px solid var(--border); padding: 6px 20px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.toolbar-label { font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.toolbar-label.left-label { color: var(--accent); }
.toolbar-label.right-label { color: var(--primary); text-align: right; }
.toolbar-btn { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; font-size: 0.76rem; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; white-space: nowrap; font-family: inherit; }
.toolbar-btn:hover { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }
.toolbar-btn.on { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }
.sync-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; background: var(--text-secondary); transition: background 0.2s; }
.toolbar-btn.on .sync-dot { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.5); }

/* Split */
.split-container { display: flex; flex: 1; overflow: hidden; }
.split-panel { flex: 1; overflow: hidden; position: relative; }
.split-panel iframe { width: 100%; height: 100%; border: none; }
.divider { width: 2px; background: var(--border); flex-shrink: 0; }

@media (max-width: 768px) {
  .split-container { flex-direction: column; }
  .split-panel { flex: none; height: 50%; }
  .divider { width: 100%; height: 2px; }
}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a class="nav-brand" href="../../index.html">
      <img src="../../img/icons/icon1.png" alt="logo" class="icon"> YJ Knowledge Bank
    </a>
    <ul class="nav-links">
      <li><a href="../../index.html">首页</a></li>
      <li><a href="../frp-nginx-networking-guide.html">内网穿透</a></li>
      <li><a href="../llm-tutorial.html">LLM 入门</a></li>
      <li><a href="../设计模式完全指南.html">设计模式</a></li>
      <li><a class="active" href="cpp-threading-comparison.html">C++ 多线程</a></li>
      <li><button class="theme-btn" id="themeToggle" title="切换深色/浅色模式">🌙</button></li>
    </ul>
  </div>
</nav>

<div class="toolbar">
  <span class="toolbar-label left-label">📖 菜鸟教程 — C++ 多线程</span>
  <button class="toolbar-btn" id="btnSyncScroll"><span class="sync-dot"></span>同步滚动</button>
  <span class="toolbar-label right-label">🧵 std::thread — join / detach / mutex / 条件变量 / atomic / TLS</span>
</div>

<div class="split-container">
  <div class="split-panel">
    <iframe src="runoob-thread.html" id="iframeLeft" title="菜鸟教程 — C++ 多线程"></iframe>
  </div>
  <div class="divider"></div>
  <div class="split-panel">
    <iframe src="std-thread-deep-dive.html" id="iframeRight" title="std::thread 深度剖析"></iframe>
  </div>
</div>

<script>
(function() {
  var leftIframe = document.getElementById('iframeLeft');
  var rightIframe = document.getElementById('iframeRight');

  // ====== Theme toggle + propagate to iframes ======
  var h = document.documentElement;
  var btn = document.getElementById('themeToggle');
  var saved = localStorage.getItem('theme');

  function sendTheme(value) {
    var msg = { type: 'setTheme', value: value };
    [leftIframe, rightIframe].forEach(function(f) {
      try { f.contentWindow && f.contentWindow.postMessage(msg, '*'); } catch(e) {}
    });
  }

  function applyTheme(t) {
    if (t === 'dark') { h.setAttribute('data-theme','dark'); btn.textContent = '☀️'; }
    else if (t === 'light') { h.setAttribute('data-theme','light'); btn.textContent = '🌙'; }
    else { h.removeAttribute('data-theme'); btn.textContent = '🌙'; }
    sendTheme(t || 'system');
  }
  applyTheme(saved);

  btn.addEventListener('click', function() {
    var cur = h.getAttribute('data-theme');
    var next = (cur === 'dark') ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });

  // When iframes load, send them the current theme
  leftIframe.addEventListener('load', function() {
    applyTheme(localStorage.getItem('theme'));
    setupScrollSync();
  });
  rightIframe.addEventListener('load', function() {
    applyTheme(localStorage.getItem('theme'));
    setupScrollSync();
  });

  // ====== Sync scroll ======
  var syncBtn = document.getElementById('btnSyncScroll');
  var syncOn = false, syncing = false;

  syncBtn.addEventListener('click', function() {
    syncOn = !syncOn;
    syncBtn.classList.toggle('on', syncOn);
  });

  function setupScrollSync() {
    [leftIframe, rightIframe].forEach(function(f) {
      try {
        var doc = f.contentDocument || (f.contentWindow && f.contentWindow.document);
        if (doc) {
          doc.addEventListener('scroll', function() { doSync(f === leftIframe ? 'L' : 'R'); }, true);
        }
      } catch(e) {}
    });
  }

  function doSync(from) {
    if (!syncOn || syncing) return;
    syncing = true;
    try {
      var fd = (from === 'L' ? leftIframe : rightIframe).contentDocument;
      var td = (from === 'L' ? rightIframe : leftIframe).contentDocument;
      if (!fd || !td) return;
      var fe = fd.documentElement, te = td.documentElement;
      var maxF = fe.scrollHeight - fd.documentElement.clientHeight;
      var maxT = te.scrollHeight - td.documentElement.clientHeight;
      if (maxF > 0 && maxT > 0) te.scrollTop = (fe.scrollTop / maxF) * maxT;
    } catch(e) {}
    setTimeout(function() { syncing = false; }, 30);
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 's' && e.ctrlKey && !e.metaKey) { e.preventDefault(); syncBtn.click(); }
  });
})();
</script>

</body>
</html>`;

fs.writeFileSync(path.join(threadDir, 'cpp-threading-comparison.html'), splitPage, 'utf-8');
console.log('cpp-threading-comparison.html:', (splitPage.length / 1024).toFixed(0), 'KB');
console.log('Done.');
