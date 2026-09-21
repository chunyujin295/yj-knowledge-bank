#!/usr/bin/env node
/**
 * 站内链接校验：扫描 index.html 与 doc/**\/*.html，检查每个 href/src 指向的文件真实存在。
 *
 *   node scripts/check-site-links.js            # 有问题则以非零状态退出
 *   node scripts/check-site-links.js --verbose  # 同时列出检查过的文件
 *
 * 只校验站内相对链接。外链（http/https）、锚点、data: URI 一律跳过——
 * 外链是否可达取决于网络和对端，放进 CI 只会带来随机失败。
 *
 * 注意：不扫描 scripts/ 下的页面模板，那里的相对路径是相对最终产物而言的。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const verbose = process.argv.includes('--verbose');

const SKIP_DIRS = new Set(['node_modules', '.git', '.obsidian', '.claude', 'workflow']);
const SKIP_FILES = new Set([path.join(REPO, 'scripts', 'github-actions-page.template.html')]);

/**
 * 已知的历史遗留死链：报出来但不判定为失败，避免 CI 一上来就是红的。
 * 修好之后请把对应的条目删掉——这个清单不应该增长。
 *
 * 现存的一条：doc/FPlayer-FF-Service-技术全景教程.html 引用了一张从未提交进仓库的
 * 产品 logo（../doc/img/icon.png，alt 是 "FPlayer FF Service"）。页面上用
 * onerror="this.style.display='none'" 把它藏了起来，所以一直没人发现。
 * 不替作者决定该换成哪张图：要么补上资源，要么删掉这个 <img>。
 */
const KNOWN_MISSING = new Set(['doc/FPlayer-FF-Service-技术全景教程.html → ../doc/img/icon.png']);

function collectHtml(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...collectHtml(full));
    } else if (entry.name.endsWith('.html') && !SKIP_FILES.has(full)) {
      found.push(full);
    }
  }
  return found;
}

function checkFile(file, broken) {
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  let checked = 0;

  for (const match of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const raw = match[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
    const target = raw.split('#')[0].split('?')[0];
    if (!target) continue; // 纯锚点

    checked++;
    const resolved = path.resolve(dir, decodeURIComponent(target));
    if (!fs.existsSync(resolved)) {
      broken.push({ file: path.relative(REPO, file), href: raw });
    }
  }
  if (verbose) console.log(`  ${path.relative(REPO, file)}  (${checked} 个站内引用)`);
  return checked;
}

const pages = [path.join(REPO, 'index.html'), ...collectHtml(path.join(REPO, 'doc'))].filter((f) =>
  fs.existsSync(f)
);

if (verbose) console.log(`扫描 ${pages.length} 个页面：`);

const found = [];
let total = 0;
for (const page of pages) total += checkFile(page, found);

const known = [];
const broken = [];
for (const item of found) {
  const key = `${item.file.split(path.sep).join('/')} → ${item.href}`;
  (KNOWN_MISSING.has(key) ? known : broken).push(item);
}

for (const item of known) {
  console.log(`⚠ 已知死链（不判定失败）：${item.file} → ${item.href}`);
}

if (broken.length) {
  console.error(`\n✗ ${pages.length} 个页面共 ${total} 个站内引用，其中 ${broken.length} 个指向不存在的文件：\n`);
  for (const item of broken) console.error(`  ${item.file}\n    → ${item.href}`);
  process.exit(1);
}

const knownNote = known.length ? `（另有 ${known.length} 条已知死链）` : '';
console.log(`✓ ${pages.length} 个页面，${total} 个站内引用，全部可达${knownNote}`);
