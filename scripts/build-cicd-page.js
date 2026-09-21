#!/usr/bin/env node
/**
 * 把 doc/cicd/github-actions-完全指南.md 编译成同名的站点 HTML 页面。
 *
 *   node scripts/build-cicd-page.js            # 生成（或更新）HTML
 *   node scripts/build-cicd-page.js --check    # 只检查是否已同步，不写文件
 *
 * --check 适合放进 CI：如果 .md 改了但忘记重新生成 .html，它会以非零状态退出。
 *
 * 内容只有一个源：Markdown 文件。本脚本负责把 Markdown 结构映射到
 * scripts/github-actions-page.template.html 定义的外壳上。
 * 涉及 FRONTEND_DESIGN_SYSTEM.md 的页面约定，改样式前请先读那份文档。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'doc/cicd/github-actions-完全指南.md');
const OUT = path.join(REPO, 'doc/cicd/github-actions-完全指南.html');
const TEMPLATE = path.join(__dirname, 'github-actions-page.template.html');
const CONTENT_DATE = '2026-09-21';

const checkOnly = process.argv.includes('--check');

/* ---------------------------------------------------------------- 1. 读取 */

if (!fs.existsSync(SRC)) fail(`找不到源文件：${SRC}`);
let raw = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

/* 去掉 YAML frontmatter */
raw = raw.replace(/^---\n[\s\S]*?\n---\n/, '');

/* 去掉一级标题：标题由模板的 hero 承担，正文里再出现就是第二个 h1 */
raw = raw.replace(/^#\s+.*?\n/, '');

/* 站内 wikilink 映射到站点上真实存在的页面，避免生成 404 链接 */
const WIKI = {
  'frp-nginx-networking-guide': '[内网穿透 + Nginx HTTPS 详解](../frp-nginx-networking-guide.html)',
  'msvc-dll-import-export': '[C/C++ 构建工具链与运行时](../cpp-build-toolchain-runtime-guide.html)',
};
raw = raw.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) =>
  WIKI[target] || alias || target
);

/* 正文里的裸 "---" 只用来分隔章节（表格分隔行以 "|" 开头），直接删掉，
   否则每个章节尾都会渲染出一条多余的 <hr>。 */
raw = raw.split('\n').filter((line) => !/^-{3,}\s*$/.test(line)).join('\n');

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

/* ------------------------------------------------------- 2. 按章节切分 */

function splitSections(text) {
  const sections = [];
  let cur = null;
  let fence = null;
  for (const line of text.split('\n')) {
    const fenceMark = line.match(/^\s*(```+)/);
    if (fenceMark) {
      if (!fence) fence = fenceMark[1];
      else if (line.trim().startsWith(fence)) fence = null;
    }
    const heading = !fence && line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      cur = { title: heading[1], lines: [] };
      sections.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return sections;
}

const sections = splitSections(raw);

/* --------------------------------------------- 3. 渲染（含提示框处理） */

/* Obsidian 的 "> [!note] 标题" 要变成设计系统里的 .callout 组件。
   提示框内部可能嵌着围栏代码块，所以按行扫描而不是用正则整段替换。 */
function renderBlocks(lines) {
  const out = [];
  let buffer = [];
  let quote = null;

  const flushMarkdown = () => {
    const text = buffer.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text) out.push({ kind: 'md', text });
    buffer = [];
  };

  const flushQuote = () => {
    if (!quote) return;
    const callout = quote[0].match(/^>\s*\[!(\w+)\]\s*(.*)$/);
    if (callout) {
      out.push({
        kind: 'callout',
        type: callout[1].toLowerCase(),
        title: callout[2].trim(),
        body: quote.slice(1).map((l) => l.replace(/^>\s?/, '')).join('\n'),
      });
    } else {
      out.push({ kind: 'md', text: quote.join('\n') });
    }
    quote = null;
  };

  for (const line of lines) {
    if (quote) {
      if (/^>/.test(line)) quote.push(line);
      else {
        flushQuote();
        if (line.trim() !== '') buffer.push(line);
      }
      continue;
    }
    if (/^>/.test(line)) {
      flushMarkdown();
      quote = [line];
      continue;
    }
    buffer.push(line);
  }
  flushQuote();
  flushMarkdown();
  return out;
}

function renderChunk(block, nextHeadingId) {
  if (block.kind === 'md') {
    return md.render(block.text).replace(/<h3>/g, () => `<h3 id="${nextHeadingId()}">`);
  }
  /* warning / danger 用警告色，其余提示框用品牌色（见设计系统 8.7） */
  const warnish = block.type === 'warning' || block.type === 'danger';
  return (
    `<div class="callout${warnish ? ' warning' : ''}">` +
    `<p class="callout-title">${md.renderInline(block.title)}</p>\n` +
    `${md.render(block.body)}</div>`
  );
}

/* 表格外层包一个可横向滚动的容器，移动端才不会撑破页面 */
const wrapTables = (html) => html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

/* 站外链接统一加 target/rel（设计系统 11.1） */
const hardenExternalLinks = (html) => html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');

/* --------------------------------------------------- 4. 章节编号与目录 */

const CN_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function chineseToNumber(text) {
  if (text === '十') return 10;
  if (text.startsWith('十')) return 10 + (CN_DIGITS[text[1]] || 0);
  if (text.endsWith('十')) return (CN_DIGITS[text[0]] || 0) * 10;
  if (text.includes('十')) {
    const [tens, ones] = text.split('十');
    return (CN_DIGITS[tens] || 0) * 10 + (CN_DIGITS[ones] || 0);
  }
  return CN_DIGITS[text] || 0;
}

const SPECIAL_SECTIONS = {
  概述: { id: 'ch-overview', no: 'INTRO' },
  前置知识: { id: 'ch-prereq', no: 'PREREQ' },
};

function describeSection(title) {
  if (SPECIAL_SECTIONS[title]) return { ...SPECIAL_SECTIONS[title], label: title };
  const numbered = title.match(/^([一二三四五六七八九十]+)、(.+)$/);
  if (numbered) {
    const n = chineseToNumber(numbered[1]);
    return { id: `ch-${n}`, no: String(n).padStart(2, '0'), label: numbered[2] };
  }
  fail(`章节标题既不是“一、…”也不是已知的特殊章节：${title}`);
}

/* 目录用短标签：章节标题太长，截断到一半反而更难扫读 */
const TOC_LABELS = {
  'ch-overview': '导言',
  'ch-prereq': '前置知识',
  'ch-1': '起点：手工发布的代价',
  'ch-2': '四个核心问题',
  'ch-3': '五个核心概念',
  'ch-4': '触发链路',
  'ch-5': 'Runner 与执行环境',
  'ch-6': '工作流语法解剖',
  'ch-7': 'Action 与复用',
  'ch-8': '身份、密钥与权限',
  'ch-9': '缓存与产物',
  'ch-10': '实战：自动部署',
  'ch-11': '调试与排错',
  'ch-12': '成本与限额',
  'ch-13': '关键概念速查表',
  'ch-14': '延伸阅读',
};

/* ---------------------------------------------------------- 5. 组装页面 */

const stats = { chapters: 0, callouts: 0, tables: 0, code: 0 };

const contentHtml = sections
  .map((section) => {
    const meta = describeSection(section.title);
    let headingIndex = 0;
    const nextHeadingId = () => `${meta.id}-${++headingIndex}`;

    let inner = renderBlocks(section.lines)
      .map((block) => {
        if (block.kind === 'callout') stats.callouts++;
        return renderChunk(block, nextHeadingId);
      })
      .join('\n');

    inner = hardenExternalLinks(wrapTables(inner));

    stats.chapters++;
    stats.tables += (inner.match(/<table>/g) || []).length;
    stats.code += (inner.match(/<pre>/g) || []).length;

    return (
      `      <section class="chapter" id="${meta.id}">\n` +
      `        <div class="chapter-head"><span class="chapter-no">${meta.no}</span>` +
      `<h2>${md.renderInline(section.title)}</h2></div>\n${inner}\n      </section>`
    );
  })
  .join('\n\n');

const tocHtml = sections
  .map((section) => {
    const meta = describeSection(section.title);
    const prefix = meta.no === 'INTRO' || meta.no === 'PREREQ' ? '' : meta.no + ' ';
    return `        <a href="#${meta.id}">${prefix}${TOC_LABELS[meta.id] || meta.label}</a>`;
  })
  .join('\n');

if (!fs.existsSync(TEMPLATE)) fail(`找不到外壳模板：${TEMPLATE}`);
const template = fs.readFileSync(TEMPLATE, 'utf8');

/* 占位符必须恰好出现一次。
   否则内容会被注入到最先出现的那一处——如果它落在模板注释里，页面就会
   整片空白，而且不报任何错。这个检查就是为了拦住那种情况。 */
const MARKERS = { '<!--TOC-->': tocHtml, '<!--CONTENT-->': contentHtml, '<!--DATE-->': CONTENT_DATE };
let page = template;
for (const [marker, value] of Object.entries(MARKERS)) {
  const occurrences = template.split(marker).length - 1;
  if (occurrences !== 1) {
    fail(
      `模板中 ${marker} 出现了 ${occurrences} 次，应当恰好 1 次。\n` +
        `  常见原因：在 ${path.relative(REPO, TEMPLATE)} 的注释里写出了占位符本身。`
    );
  }
  page = page.split(marker).join(value);
}
for (const marker of Object.keys(MARKERS)) {
  if (page.includes(marker)) fail(`占位符 ${marker} 替换后仍然残留`);
}

const previous = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
const changed = previous !== page;

if (checkOnly) {
  if (changed) {
    fail(
      `页面与 Markdown 不同步：${path.relative(REPO, OUT)}\n` +
        `  跑一次 \`npm run build:cicd\` 重新生成。`
    );
  }
  console.log(`✓ 已同步（${stats.chapters} 章 / ${stats.callouts} 提示框 / ${stats.tables} 表格）`);
} else {
  fs.writeFileSync(OUT, page, 'utf8');
  console.log(
    `${changed ? '已更新' : '内容无变化'} ${path.relative(REPO, OUT)}\n` +
      `  ${stats.chapters} 章 / ${stats.callouts} 提示框 / ${stats.tables} 表格 / ${stats.code} 代码块 / ${(page.length / 1024).toFixed(0)} KB`
  );
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
