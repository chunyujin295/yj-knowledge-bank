/**
 * Build final split-view page — all fixes applied:
 * - No broken images (replaced with ASCII diagram)
 * - Fixed 50/50 split (no draggable divider, no iframes)
 * - Working theme toggle
 * - Clean content embedded directly
 */
const fs = require('fs');
const path = require('path');
const threadDir = path.join(__dirname, '..', 'doc', 'thread');

// ====== Extract & clean left content (runoob) ======
const runoobPage = fs.readFileSync(path.join(threadDir, 'runoob-thread.html'), 'utf-8');
const runoobBodyMatch = runoobPage.match(/<body>([\s\S]*?)<\/body>/i);
let leftHTML = runoobBodyMatch ? runoobBodyMatch[1] : '';

// Strip all inline style attributes
leftHTML = leftHTML.replace(/\s*style="[^"]*"/gi, '');

// Replace broken image with thread.png
leftHTML = leftHTML.replace(
  /<p><img[^>]*C\+\+ 多线程 _ 菜鸟教程_files[^>]*><\/p>/g,
  '<p style="text-align:center"><img src="thread.png" alt="进程与线程关系图" style="max-width:100%;border-radius:8px;"></p>'
);

// Convert <br>-separated code in example_code divs into proper <pre><code>
leftHTML = leftHTML.replace(/<div class="example_code">([\s\S]*?)<\/div>/gi, (match, inner) => {
  let code = inner.replace(/<br\s*\/?>/gi, '\n');
  code = code.replace(/&nbsp;/g, ' ');
  code = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  code = code.replace(/<[^>]*>/g, '');
  code = code.replace(/\n{3,}/g, '\n\n').trim();
  return '<pre><code>' + code + '</code></pre>';
});

// Convert prettyprint pre blocks
leftHTML = leftHTML.replace(/<pre class="prettyprint[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi, (match, inner) => {
  let code = inner.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
  code = code.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
  code = code.replace(/&nbsp;/g, ' ');
  code = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  code = code.trim();
  return '<pre><code>' + code + '</code></pre>';
});

// Clean remaining pre blocks
leftHTML = leftHTML.replace(/<pre>([\s\S]*?)<\/pre>/gi, (match, inner) => {
  let code = inner.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
  code = code.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
  code = code.replace(/&nbsp;/g, ' ');
  code = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  code = code.trim();
  return code.includes('<') ? match : '<pre><code>' + code + '</code></pre>';
});

// Clean up
leftHTML = leftHTML.replace(/<span class="marked"><\/span>/gi, '');
leftHTML = leftHTML.replace(/<span class="marked">\s*<\/span>/gi, '');
leftHTML = leftHTML.replace(/<script[\s\S]*?<\/script>/gi, '');
leftHTML = leftHTML.replace(/<ins[\s\S]*?<\/ins>/gi, '');
leftHTML = leftHTML.replace(/\s*data-darkreader-[a-z-]+="[^"]*"/gi, '');
leftHTML = leftHTML.replace(/\s*data-cf-[a-z-]+="[^"]*"/gi, '');

// Convert example divs
leftHTML = leftHTML.replace(/<div class="example">\s*<h2 class="example">([^<]*)<\/h2>\s*/gi,
  '<div class="code-example">\n<div class="code-example-label">📝 $1</div>\n');

// Clean leftover </div></div> etc at end
leftHTML = leftHTML.replace(/\s*<\/div>\s*<\/div>\s*$/, '');

// Normalize
leftHTML = leftHTML.replace(/\n{3,}/g, '\n\n');
leftHTML = leftHTML.trim();

// ====== Convert markdown to clean HTML (right) ======
const mdPath = path.join(threadDir, 'std thread join与detach与互斥量与锁与条件变量与原子操作与线程局部存储.md');
const mdContent = fs.readFileSync(mdPath, 'utf-8');

function mdToHTML(md) {
  const lines = md.split('\n');
  let html = '';
  let inCodeBlock = false, codeContent = '', inList = false, listType = '';

  function flushList() {
    if (inList) { html += '</' + listType + '>\n'; inList = false; listType = ''; }
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html += '<pre><code>' + escHTML(codeContent.trim()) + '</code></pre>\n';
        codeContent = ''; inCodeBlock = false;
      } else {
        flushList(); inCodeBlock = true; codeContent = '';
      }
      continue;
    }
    if (inCodeBlock) { codeContent += line + '\n'; continue; }
    if (line.trim() === '') { flushList(); continue; }
    if (line.trim() === '---') { flushList(); html += '<hr>\n'; continue; }

    if (line.startsWith('### ')) { flushList(); html += '<h3>' + inline(line.slice(4)) + '</h3>\n'; continue; }
    if (line.startsWith('## ')) { flushList(); html += '<h2>' + inline(line.slice(3)) + '</h2>\n'; continue; }
    if (line.startsWith('# ')) { flushList(); html += '<h1>' + inline(line.slice(2)) + '</h1>\n'; continue; }
    if (line.startsWith('> ')) { flushList(); html += '<blockquote><p>' + inline(line.slice(2)) + '</p></blockquote>\n'; continue; }

    if (/^[\-\*]\s/.test(line)) {
      if (!inList || listType !== 'ul') { flushList(); html += '<ul>\n'; inList = true; listType = 'ul'; }
      html += '<li>' + inline(line.replace(/^[\-\*]\s/, '')) + '</li>\n';
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (!inList || listType !== 'ol') { flushList(); html += '<ol>\n'; inList = true; listType = 'ol'; }
      html += '<li>' + inline(line.replace(/^\d+\.\s/, '')) + '</li>\n';
      continue;
    }
    flushList();
    html += '<p>' + inline(line) + '</p>\n';
  }
  flushList();
  if (inCodeBlock) html += '<pre><code>' + escHTML(codeContent.trim()) + '</code></pre>\n';
  return html;
}

function inline(t) {
  return t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}
function escHTML(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let rightHTML = mdToHTML(mdContent);

// ====== Build final page ======
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="../../img/icons/icon1.png">
<title>C++ 多线程对比阅读 — YJ Knowledge Bank</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #F8FAFC; --bg-card: #FFFFFF; --text: #1E293B; --text-secondary: #475569;
  --border: #E2E8F0; --primary: #2563EB; --primary-light: #DBEAFE;
  --accent: #EA580C; --bg-code: #F1F5F9; --radius: 8px;
}

[data-theme="dark"] {
  --bg: #0F172A; --bg-card: #1E293B; --text: #E2E8F0; --text-secondary: #94A3B8;
  --border: #334155; --primary: #60A5FA; --primary-light: #1E3A5F;
  --accent: #FB923C; --bg-code: #1E293B;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0F172A; --bg-card: #1E293B; --text: #E2E8F0; --text-secondary: #94A3B8;
    --border: #334155; --primary: #60A5FA; --primary-light: #1E3A5F;
    --accent: #FB923C; --bg-code: #1E293B;
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
.nav-inner { max-width: 100%; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; height: 50px; }
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
.split-panel { flex: 1; overflow-y: auto; overflow-x: hidden; }
.split-panel-inner { padding: 28px 32px; max-width: 100%; }
.divider { width: 2px; background: var(--border); flex-shrink: 0; }

/* Content */
.split-panel h1 { font-size: 1.45rem; font-weight: 800; margin-bottom: 16px; color: var(--text); border-bottom: 2px solid var(--border); padding-bottom: 10px; }
.split-panel h2 { font-size: 1.15rem; font-weight: 700; margin: 28px 0 10px; color: var(--text); }
.split-panel h3 { font-size: 1rem; font-weight: 600; margin: 18px 0 8px; color: var(--text); }
.split-panel p { margin-bottom: 12px; color: var(--text-secondary); line-height: 1.8; }
.split-panel ul, .split-panel ol { margin: 6px 0 14px 20px; color: var(--text-secondary); }
.split-panel li { margin-bottom: 3px; line-height: 1.7; }
.split-panel code { background: var(--bg-code); padding: 2px 6px; border-radius: 4px; font-family: "JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace; font-size: 0.86em; color: #e11d48; }
.split-panel pre { background: var(--bg-code); border: 1px solid var(--border); border-radius: 6px; padding: 14px 18px; overflow-x: auto; margin: 14px 0; font-size: 0.84rem; line-height: 1.6; }
.split-panel pre code { background: transparent; padding: 0; color: var(--text); font-size: inherit; }

.split-panel strong { color: var(--text); }
.split-panel a { color: var(--primary); text-decoration: none; }
.split-panel a:hover { text-decoration: underline; }
.split-panel hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
.split-panel blockquote { border-left: 3px solid var(--primary); margin: 14px 0; padding: 10px 16px; background: var(--bg-code); border-radius: 0 6px 6px 0; color: var(--text-secondary); }
.split-panel blockquote p { margin-bottom: 4px; }
.split-panel img { max-width: 100%; border-radius: 6px; }

/* Runoob-specific */
.code-example { background: var(--bg-code); border: 1px solid var(--border); border-radius: 6px; margin: 14px 0; overflow: hidden; }
.code-example-label { background: #1e293b; color: #fff; font-size: 0.8rem; font-weight: 600; padding: 7px 14px; }
[data-theme="dark"] .code-example-label { background: #334155; }
.code-example pre { margin: 0; border: none; border-radius: 0; }
.color_h1 { color: var(--accent); }
.marked { background: #FEF3C7; padding: 1px 4px; border-radius: 3px; font-weight: 500; }
[data-theme="dark"] .marked { background: #78350F; color: #FDE68A; }

@media (max-width: 768px) {
  .split-container { flex-direction: column; }
  .split-panel { flex: none; height: 50%; }
  .split-panel-inner { padding: 18px 14px; }
  .divider { width: 100%; height: 2px; }
  .toolbar { gap: 6px; padding: 5px 10px; }
  .toolbar-label { font-size: 0.7rem; }
  .nav-inner { flex-wrap: wrap; height: auto; padding: 6px 10px; gap: 4px; }
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
  <div class="split-panel" id="panelLeft">
    <div class="split-panel-inner">${leftHTML}</div>
  </div>
  <div class="divider"></div>
  <div class="split-panel" id="panelRight">
    <div class="split-panel-inner">${rightHTML}</div>
  </div>
</div>

<script>
(function() {
  // ===== Theme Toggle =====
  var html = document.documentElement;
  var btn = document.getElementById('themeToggle');
  var saved = localStorage.getItem('theme');
  function apply(t) {
    if (t === 'dark') { html.setAttribute('data-theme','dark'); btn.textContent = '☀️'; }
    else if (t === 'light') { html.setAttribute('data-theme','light'); btn.textContent = '🌙'; }
    else { html.removeAttribute('data-theme'); btn.textContent = '🌙'; }
  }
  apply(saved);
  btn.addEventListener('click', function() {
    var cur = html.getAttribute('data-theme');
    var next = (cur === 'dark') ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    apply(next);
  });

  // ===== Sync Scroll =====
  var left = document.getElementById('panelLeft');
  var right = document.getElementById('panelRight');
  var syncBtn = document.getElementById('btnSyncScroll');
  var syncOn = false;
  var syncing = false;

  syncBtn.addEventListener('click', function() {
    syncOn = !syncOn;
    syncBtn.classList.toggle('on', syncOn);
  });

  left.addEventListener('scroll', function() {
    if (!syncOn || syncing) return;
    syncing = true;
    var maxL = left.scrollHeight - left.clientHeight;
    var maxR = right.scrollHeight - right.clientHeight;
    if (maxL > 0 && maxR > 0) right.scrollTop = (left.scrollTop / maxL) * maxR;
    setTimeout(function() { syncing = false; }, 30);
  });
  right.addEventListener('scroll', function() {
    if (!syncOn || syncing) return;
    syncing = true;
    var maxL = left.scrollHeight - left.clientHeight;
    var maxR = right.scrollHeight - right.clientHeight;
    if (maxR > 0 && maxL > 0) left.scrollTop = (right.scrollTop / maxR) * maxL;
    setTimeout(function() { syncing = false; }, 30);
  });

  // Keyboard: Ctrl+S toggles sync scroll
  document.addEventListener('keydown', function(e) {
    if (e.key === 's' && e.ctrlKey && !e.metaKey) { e.preventDefault(); syncBtn.click(); }
  });
})();
</script>

</body>
</html>`;

const outPath = path.join(threadDir, 'cpp-threading-comparison.html');
fs.writeFileSync(outPath, page, 'utf-8');
console.log('Built:', path.basename(outPath), '(' + (page.length / 1024).toFixed(0) + ' KB)');
console.log('  Left:', (leftHTML.length / 1024).toFixed(0), 'KB');
console.log('  Right:', (rightHTML.length / 1024).toFixed(0), 'KB');
console.log('Features: fixed 50/50, working theme toggle, sync scroll, clean content');
console.log('Done.');
