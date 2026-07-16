/**
 * Extract clean HTML content from the two bloated thread HTML files.
 * - Runoob: strip darkreader styles, ads, site chrome
 * - ChatGPT: strip chat UI wrapper, keep the tutorial content
 */
const fs = require('fs');
const path = require('path');

const threadDir = path.join(__dirname, '..', 'doc', 'thread');

// ====== Left: Runoob ======
function cleanRunoob() {
  const src = path.join(threadDir, 'C++ 多线程 _ 菜鸟教程.html');
  let html = fs.readFileSync(src, 'utf-8');

  // Extract only the article-body content
  const bodyMatch = html.match(/<div class="article-body">([\s\S]*?)<div class="previous-next-links">/);
  if (!bodyMatch) {
    console.error('Could not find article-body in runoob file');
    return;
  }
  let content = bodyMatch[1];

  // Close any unclosed divs from the extraction
  content = content.replace(/<div class="archive-list"[\s\S]*?<\/div>\s*$/m, '');

  // Strip darkreader garbage
  content = content.replace(/\s*data-darkreader-[a-z-]+="[^"]*"/gi, '');
  content = content.replace(/\s*--darkreader-inline-color:\s*var\([^)]*\)\s*;?/gi, '');
  content = content.replace(/\s*--darkreader-inline-bg(image|color)?:\s*[^;"]+;?/gi, '');
  content = content.replace(/\s*--darkreader-inline-border[^;"]*:\s*[^;"]+;?/gi, '');

  // Remove style attributes that became empty or are just darkreader
  content = content.replace(/\s*style="\s*"/gi, '');
  content = content.replace(/\s*style="\s*;\s*"/gi, '');

  // Clean up <style class="darkreader..."> blocks
  content = content.replace(/<style class="darkreader[^"]*" media="screen"><\/style>/gi, '');

  // Strip ad-related divs
  content = content.replace(/<div class="article-heading-ad"[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="article-body">)/gi, '');
  content = content.replace(/<div class="sidebar-box"[\s\S]*$/gi, '');

  // Clean up prettyprint code blocks: remove the inline color styles from spans
  content = content.replace(/<pre class="prettyprint prettyprinted"[^>]*>([\s\S]*?)<\/pre>/gi, (match, inner) => {
    // Strip inline styles from spans inside code
    let cleaned = inner.replace(/<span[^>]*style="[^"]*"[^>]*>/gi, (spanMatch) => {
      // Remove only the darkreader-inline-color and similar
      let s = spanMatch.replace(/\s*--darkreader-inline-color:\s*var\([^)]*\);?/gi, '');
      s = s.replace(/\s*data-darkreader-inline-color="[^"]*"/gi, '');
      // If style is now empty or just whitespace, remove it
      s = s.replace(/\s*style="\s*;?\s*"/gi, '');
      return s;
    });
    // Also strip buttons
    cleaned = cleaned.replace(/<button class="copy-code-button"[^>]*>[\s\S]*?<\/button>/gi, '');
    return '<pre>' + cleaned + '</pre>';
  });

  // Clean up example_code divs similarly (the <br>-separated code blocks)
  content = content.replace(/<div class="example_code">([\s\S]*?)<\/div>/gi, (match, inner) => {
    // Convert <br>-separated lines with inline styles into proper <pre><code>
    // Strip darkreader attributes
    let lines = inner.split(/<br\s*\/?>/);
    let cleaned = lines.map(line => {
      let l = line.replace(/\s*style="[^"]*--darkreader-[^"]*"/gi, '');
      l = l.replace(/\s*data-darkreader-inline-color="[^"]*"/gi, '');
      l = l.replace(/\s*--darkreader-inline-color:\s*var\([^)]*\);?/gi, '');
      return l;
    }).join('\n');
    cleaned = cleaned.replace(/<button class="copy-code-button"[^>]*>[\s\S]*?<\/button>/gi, '');
    return '<pre><code>' + cleaned + '</code></pre>';
  });

  // Clean up other darkreader attributes globally
  content = content.replace(/\s*data-darkreader-inline-color="[^"]*"/gi, '');
  content = content.replace(/\s*data-darkreader-inline-bg(image|color)?="[^"]*"/gi, '');
  content = content.replace(/\s*--darkreader-inline-color:\s*var\([^)]*\)\s*;?/gi, '');
  content = content.replace(/\s*--darkreader-inline-bg(image|color)?:\s*[^;"]+;?/gi, '');
  content = content.replace(/\s*--darkreader-inline-border[^;"]*:\s*[^;"]+;?/gi, '');

  // Remove empty style attributes
  content = content.replace(/\s*style="\s*;?\s*"/gi, '');

  // Clean the archive-list AI stuff
  content = content.replace(/<div class="archive-list"[\s\S]*?<\/div>/gi, '');

  // Remove the "其他扩展" comment
  content = content.replace(/<!--\s*其他扩展\s*-->/gi, '');

  // Remove the closing </div> for article-intro and article-body (we'll wrap ourselves)
  content = content.replace(/\s*<\/div>\s*<\/div>\s*$/g, '');

  return content.trim();
}

// ====== Right: ChatGPT Export ======
function cleanChatGPT() {
  const src = path.join(threadDir, 'std thread join与detach与互斥量与锁与条件变量与原子操作与线程局部存储.html');
  let html = fs.readFileSync(src, 'utf-8');

  // Find the body content between <body> and </body>
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    console.error('Could not find body in ChatGPT file');
    return;
  }
  let body = bodyMatch[1];

  // Extract all message bodies
  const messages = [];
  const msgRegex = /<div class="exported-message exported-message--(user|ai)"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="exported-message|$)/gi;
  let msgMatch;
  while ((msgMatch = msgRegex.exec(body)) !== null) {
    const role = msgMatch[1];
    // Extract the c2f-msg-body content
    const bodyContentMatch = msgMatch[2].match(/<div class="c2f-msg-body">([\s\S]*?)<\/div>\s*<\/div>\s*<\/article>/i);
    if (bodyContentMatch) {
      messages.push({ role, content: bodyContentMatch[1] });
    }
  }

  // Build clean content
  let parts = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      // User question — show as a blockquote-style section
      let q = msg.content.trim();
      // Clean up any HTML entities
      parts.push('<div class="user-question">💬 ' + q + '</div>');
    } else {
      // AI answer — this is the main content
      parts.push(msg.content);
    }
  }

  let content = parts.join('\n\n');

  // Clean up code blocks: they already use the c2f-code-block format which is clean
  // Keep as-is, they look good

  return content.trim();
}

// ====== Output clean files ======
const runoobContent = cleanRunoob();
if (runoobContent) {
  // Wrap it so it's a valid HTML snippet
  const outPath = path.join(threadDir, '_clean_runoob.html');
  fs.writeFileSync(outPath, runoobContent, 'utf-8');
  console.log('Wrote clean runoob content:', outPath, `(${(runoobContent.length / 1024).toFixed(0)} KB)`);
}

const chatgptContent = cleanChatGPT();
if (chatgptContent) {
  const outPath = path.join(threadDir, '_clean_chatgpt.html');
  fs.writeFileSync(outPath, chatgptContent, 'utf-8');
  console.log('Wrote clean ChatGPT content:', outPath, `(${(chatgptContent.length / 1024).toFixed(0)} KB)`);
}

console.log('Done.');
