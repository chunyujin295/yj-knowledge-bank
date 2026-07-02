#!/usr/bin/env python3
"""Refactor FPlayer Desktop HTML: add sidebar ToC, single nav, centered diagrams."""

import re

with open('doc/FPlayer-Desktop-技术全景教程.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract section info
sections = []
for m in re.finditer(r'<section class="section[^"]*"\s+id="([^"]+)"', content):
    sec_id = m.group(1)
    sec_start = m.start()
    chunk = content[sec_start:sec_start+5000]
    eyebrow_m = re.search(r'<div class="section-eyebrow">([^<]+)</div>', chunk)
    h2_m = re.search(r'<h2[^>]*>([^<]+)</h2>', chunk)
    chapter = eyebrow_m.group(1) if eyebrow_m else ''
    title = h2_m.group(1) if h2_m else sec_id
    sections.append((sec_id, chapter, title))

print(f"Found {len(sections)} sections")

# 2. Build sidebar HTML
sidebar_items = []
for sec_id, chapter, title in sections:
    sidebar_items.append(f'            <a href="#{sec_id}">{chapter}: {title}</a>')

sidebar_html = '<nav class="sidebar" id="sidebar">\n'
sidebar_html += '          <div class="sidebar-title">教程章节</div>\n'
sidebar_html += '\n'.join(sidebar_items)
sidebar_html += '\n        </nav>'

# 3. Remove old dual nav (global-nav + sub-nav)
content = re.sub(
    r'<nav class="global-nav">.*?</nav>\s*<div class="sub-nav">.*?</div>',
    '', content, flags=re.DOTALL
)

# 4. Add single new nav before hero
new_nav = '''<nav class="top-nav">
    <div class="nav-inner">
      <a class="nav-brand" href="../index.html">&#8592; YJ Knowledge Bank</a>
      <span class="nav-title">FPlayer Desktop — 技术全景教程</span>
      <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" aria-label="切换主题">🌓</button>
    </div>
  </nav>
'''
content = content.replace('<header class="hero">', new_nav + '\n<header class="hero">')

# 5. Replace CSS
old_style_start = content.find('<style>')
old_style_end = content.find('</style>') + len('</style>')

new_css = '''<style>
:root {
  --primary: #cc785c; --primary-active: #a9583e;
  --accent-teal: #5db8a6; --accent-amber: #e8a55a;
  --canvas: #faf9f5; --surface-soft: #f5f0e8; --surface-card: #efe9de;
  --surface-cream-strong: #e8e0d2; --surface-code: #f3efe6;
  --hairline: #e6dfd8; --hairline-soft: #ebe6df;
  --ink: #141413; --body-strong: #252523; --body: #3d3d3a;
  --muted: #6c6a64; --muted-soft: #8e8b82;
  --on-primary: #ffffff;
  --code-bg: #f4f0e8; --code-text: #3d3d3a; --code-border: #e6dfd8;
  --font-display: "Tiempos Headline","Cormorant Garamond","EB Garamond","Garamond","Times New Roman",serif;
  --font-body: "Inter",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC","PingFang SC",sans-serif;
  --font-mono: "JetBrains Mono","Cascadia Code","Consolas",ui-monospace,monospace;
  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-pill: 9999px;
  --space-xs: 8px; --space-sm: 12px; --space-md: 16px; --space-lg: 24px; --space-xl: 32px; --space-xxl: 48px; --space-section: 80px;
}
[data-theme="dark"] {
  --canvas: #1a1916; --surface-soft: #201f1c; --surface-card: #252320;
  --surface-cream-strong: #2a2824; --surface-code: #252320;
  --hairline: #2a2824; --hairline-soft: #22211e;
  --ink: #faf9f5; --body-strong: #e8e6df; --body: #c4c1b8;
  --muted: #8e8b82; --muted-soft: #6c6a64;
  --code-bg: #252320; --code-text: #c4c1b8; --code-border: #2a2824;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:80px}
body{font-family:var(--font-body);font-size:16px;font-weight:400;line-height:1.7;color:var(--body);background:var(--canvas);transition:background .2s,color .2s;overflow-x:hidden}

h1,h2,h3{font-family:var(--font-display);font-weight:400;color:var(--ink)}
h1{font-size:clamp(32px,5vw,48px);line-height:1.1;letter-spacing:-1px}
h2{font-size:clamp(26px,4vw,36px);line-height:1.15;letter-spacing:-0.5px}
h3{font-size:clamp(18px,2.5vw,22px);line-height:1.3;letter-spacing:-0.3px;margin-top:36px;margin-bottom:12px}
h4{font-size:18px;font-weight:500;line-height:1.4;color:var(--ink);margin:32px 0 8px}
p{margin-bottom:14px;color:var(--body);line-height:1.7}
p:last-child{margin-bottom:0}
a{color:var(--primary);text-decoration:none}
a:hover{opacity:0.8}

.top-nav{position:sticky;top:0;z-index:100;background:var(--canvas);height:60px;border-bottom:1px solid var(--hairline);backdrop-filter:saturate(180%) blur(16px)}
.nav-inner{max-width:1200px;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between;height:100%;gap:16px}
.nav-brand{font-size:14px;font-weight:500;color:var(--muted);display:flex;align-items:center;gap:6px;white-space:nowrap}
.nav-brand:hover{color:var(--ink);opacity:1}
.nav-title{font-family:var(--font-display);font-size:16px;color:var(--ink);letter-spacing:-0.3px}
.theme-toggle{flex-shrink:0;background:var(--surface-card);color:var(--ink);border:1px solid var(--hairline);border-radius:var(--radius-md);padding:6px 12px;height:34px;font-size:13px;font-weight:500;cursor:pointer}

.hero{text-align:center;padding:80px 24px 48px;background:var(--canvas);border-bottom:1px solid var(--hairline)}
.hero-eyebrow{display:inline-block;font-size:12px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);margin-bottom:12px}
.hero h1{font-size:clamp(36px,5vw,56px);margin-bottom:16px}
.hero .tagline{font-size:18px;color:var(--muted);max-width:600px;margin:0 auto 24px;line-height:1.5}
.hero-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:24px;font-size:14px;color:var(--muted)}
.hero-meta strong{color:var(--ink);font-weight:600}

.page-layout{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:220px 1fr;gap:48px;padding:32px 32px;align-items:start}
.sidebar{position:sticky;top:76px;border-right:1px solid var(--hairline);padding-right:24px}
.sidebar-title{font-size:12px;font-weight:500;letter-spacing:1.5px;color:var(--muted-soft);text-transform:uppercase;margin-bottom:16px}
.sidebar a{display:block;padding:5px 0 5px 12px;font-size:13px;color:var(--muted);text-decoration:none;border-left:2px solid transparent;line-height:1.4}
.sidebar a:hover{color:var(--body)}
.sidebar a.active{color:var(--primary);border-left-color:var(--primary);font-weight:500}
.content-area{min-width:0}

.func-section{margin-bottom:80px;scroll-margin-top:80px}
.func-section:last-child{margin-bottom:0}
.section-number{font-size:12px;font-weight:500;letter-spacing:1.5px;color:var(--muted-soft);text-transform:uppercase;margin-bottom:4px}
.section-title{font-size:36px;font-weight:400;line-height:1.15;letter-spacing:-0.5px;color:var(--ink);margin-bottom:24px}

.surface-white{background:var(--canvas)}
.surface-stone{background:var(--surface-soft)}

.concept-box{border-radius:12px;padding:24px;margin:24px 0;background:var(--surface-card);border:1px solid var(--hairline)}
.concept-box h5{font-size:16px;font-weight:600;margin-bottom:8px;color:var(--ink)}
.info-box{border-radius:12px;padding:24px;margin:32px 0;border-left:3px solid var(--primary);background:rgba(204,120,92,0.06)}
.info-box h5{font-size:16px;font-weight:600;margin-bottom:8px;color:var(--ink)}
.fun-fact{border-radius:12px;padding:24px;margin:32px 0;background:var(--surface-soft);border:1px solid var(--hairline)}
.quote-box{border-radius:12px;padding:48px;margin:32px 0;background:#181715;color:#faf9f5;text-align:center}
.quote-box blockquote{font-family:var(--font-display);font-size:22px;font-weight:400;line-height:1.45;font-style:italic;margin-bottom:12px;letter-spacing:-0.3px}
.quote-box cite{font-size:13px;color:#a09d96;font-style:normal}

.compare-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px}
.compare-table th{text-align:left;padding:12px 16px;font-size:12px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);border-bottom:2px solid var(--hairline)}
.compare-table td{padding:12px 16px;border-bottom:1px solid var(--hairline-soft);color:var(--body);line-height:1.55}
.compare-table tr:last-child td{border-bottom:none}

.diagram-container{margin:24px auto;padding:24px;background:var(--canvas);border-radius:12px;border:1px solid var(--hairline);overflow-x:auto;text-align:center}
.diagram-container .diagram-label{font-family:var(--font-mono);font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted-soft);margin-bottom:16px;text-align:left}
.diagram-container pre{text-align:left;display:inline-block;max-width:100%}
.diagram-container svg{max-width:100%;height:auto;margin:0 auto}
.diagram-caption{font-size:13px;color:var(--muted);text-align:center;margin-top:12px;font-style:italic}

.inline-img{display:block;max-width:100%;height:auto;margin:24px auto}
.img-caption{font-size:13px;color:var(--muted);text-align:center;margin-top:8px;font-style:italic}
.inline-svg{display:block;max-width:100%;margin:24px auto}

.step-list{list-style:none;counter-reset:step;margin:24px 0}
.step-list li{counter-increment:step;position:relative;padding-left:48px;margin-bottom:24px}
.step-list li::before{content:counter(step);position:absolute;left:0;top:0;width:32px;height:32px;background:var(--ink);color:var(--canvas);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500}
.step-list h5{font-size:16px;font-weight:600;margin-bottom:4px}
.step-list p{font-size:14px;color:var(--body);margin:0;line-height:1.6}

.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:24px 0}
.card{background:var(--surface-card);border:1px solid var(--hairline-soft);border-radius:12px;padding:24px}
.card h5{font-size:17px;font-weight:500;margin-bottom:8px;color:var(--ink)}
.card p{font-size:14px;line-height:1.55;color:var(--body);margin:0}
.tech-tag{font-family:var(--font-mono);font-size:13px;background:var(--surface-code);color:var(--primary);padding:2px 8px;border-radius:4px;font-weight:500}

code{font-family:var(--font-mono);font-size:13px;background:var(--code-bg);padding:2px 6px;border-radius:4px;color:var(--code-text)}
pre{background:var(--code-bg);border:1px solid var(--code-border);border-radius:8px;padding:16px;font-family:var(--font-mono);font-size:13px;line-height:1.6;color:var(--code-text);overflow-x:auto;margin-bottom:16px;white-space:pre-wrap}

ul,ol{margin:14px 0 14px 1.5em;color:var(--body);line-height:1.9}
li{margin-bottom:4px}

.footer{padding:48px 24px;border-top:1px solid var(--hairline);text-align:center}
.footer p{font-size:14px;color:var(--muted)}
.footer a{color:var(--primary)}

@media (max-width: 860px) {
  .page-layout{grid-template-columns:1fr}
  .sidebar{position:static;border-right:none;border-bottom:1px solid var(--hairline);padding-right:0;padding-bottom:12px;margin-bottom:24px}
  .sidebar a{display:inline-block;border-left:none;border-bottom:2px solid transparent;padding:4px 8px;margin-right:4px;font-size:12px}
  .sidebar a.active{border-left-color:transparent;border-bottom-color:var(--primary)}
}
</style>'''

content = content[:old_style_start] + new_css + content[old_style_end:]

# 6. Restructure: wrap sections in page-layout grid
first_section = content.find('<section class="section')
footer_pos = content.find('<footer')
section_closes = [m.end() for m in re.finditer(r'</section>', content)]
last_section = max(s for s in section_closes if s < footer_pos) if footer_pos > 0 else max(section_closes)

before = content[:first_section]
sections_block = content[first_section:last_section]
after = content[last_section:]

# Convert <section class="section X" id="Y">...<div class="section-inner">...eyebrow...h2
# to <section class="func-section X" id="Y">...section-number...section-title
def convert_section(m):
    classes = m.group(1)
    sec_id = m.group(2)
    eyebrow = m.group(3)
    title = m.group(4)
    return f'<section class="func-section {classes}" id="{sec_id}">\n        <div class="section-number">{eyebrow}</div>\n        <h2 class="section-title">{title}</h2>'

sections_block = re.sub(
    r'<section class="section ([^"]*)"\s+id="([^"]+)">\s*<div class="section-inner">\s*<div class="section-eyebrow">([^<]+)</div>\s*<h2[^>]*>([^<]+)</h2>',
    convert_section,
    sections_block
)

# Remove orphaned </div> from old section-inner wrappers (the closing </div></section> becomes just </section>)
sections_block = re.sub(r'\n\s*</div>\s*\n\s*</section>', '\n      </section>', sections_block)

# Handle sections with surface-stone class (they had section-inner too)
# Remove remaining stray </div> before </section>
sections_block = sections_block.replace('</div>\n\n    </section>', '</section>')
sections_block = sections_block.replace('</div>\n      </section>', '</section>')

# Assemble
final = before.strip() + '\n\n'
final += '<div class="page-layout">\n'
final += '      ' + sidebar_html.strip() + '\n'
final += '      <main class="content-area">\n\n'
final += sections_block.strip() + '\n\n'
final += '      </main>\n'
final += '    </div>\n\n'
final += after.strip()

# 7. Add theme toggle script
theme_script = '''
<script>
mermaid.initialize({startOnLoad:true,theme:'neutral',securityLevel:'loose'});
(function(){
  var saved = localStorage.getItem('fplayer-desktop-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme','dark');
})();
function toggleTheme(){
  var el = document.documentElement;
  var isDark = el.getAttribute('data-theme') === 'dark';
  el.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('fplayer-desktop-theme', isDark ? 'light' : 'dark');
}
// Active sidebar link tracking
var secs = document.querySelectorAll('.func-section');
var links = document.querySelectorAll('.sidebar a');
window.addEventListener('scroll', function(){
  var cur = '';
  secs.forEach(function(s){ if(window.scrollY >= s.offsetTop - 100) cur = s.getAttribute('id'); });
  links.forEach(function(l){ l.classList.toggle('active', l.getAttribute('href') === '#' + cur); });
});
</script>'''

# 8. Remove old theme script if exists and add new one
final = re.sub(r'<script>[\s\S]*?theme-toggle[\s\S]*?</script>', '', final)
final = final.replace('</body>', theme_script + '\n</body>')

with open('doc/FPlayer-Desktop-技术全景教程.html', 'w', encoding='utf-8') as f:
    f.write(final)

print(f"Done! {len(content)} -> {len(final)} chars")
print("Sections found:", [s[0] for s in sections])
