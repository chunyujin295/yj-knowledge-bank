#!/usr/bin/env python3
"""Refactor FPlayer Mobile HTML: add sidebar ToC, clean layout, center diagrams."""

import re

with open('doc/FPlayer-FF-Mobile-技术全景教程.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract section info - find all <section> with id and their h2
sections = []
# Mobile HTML uses <section class="section" id="..."> with <h2> inside
for m in re.finditer(r'<section\s+class="([^"]*)"\s+id="([^"]+)"', content):
    sec_id = m.group(2)
    sec_start = m.start()
    chunk = content[sec_start:sec_start+3000]
    h2_m = re.search(r'<h2[^>]*>([^<]+)</h2>', chunk)
    title = h2_m.group(1) if h2_m else sec_id
    # Get module number from the nav-modules link if available
    num_m = re.search(rf'href="#{sec_id}"[^>]*>(\d+)', content)
    num = num_m.group(1) if num_m else ''
    sections.append((sec_id, num, title))

print(f"Found {len(sections)} module sections")

# 2. Build sidebar HTML
sidebar_items = []
for sec_id, num, title in sections:
    label = f"{num}. {title}" if num else title
    sidebar_items.append(f'            <a href="#{sec_id}">{label}</a>')

sidebar_html = '<nav class="sidebar" id="sidebar">\n'
sidebar_html += '          <div class="sidebar-title">功能模块</div>\n'
sidebar_html += '\n'.join(sidebar_items)
sidebar_html += '\n        </nav>'

# 3. Transform top-nav: replace horizontal module links with just brand + theme toggle
old_nav_match = re.search(r'<nav class="top-nav".*?</nav>', content, re.DOTALL)
if old_nav_match:
    new_nav = '''<nav class="top-nav">
    <div class="nav-inner">
      <a class="nav-brand" href="../index.html">&#8592; YJ Knowledge Bank</a>
      <span style="font-family:var(--font-display);font-size:16px;color:var(--ink);letter-spacing:-0.3px">fplayer-ff-mobile 技术全解</span>
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="切换主题">🌓</button>
    </div>
  </nav>'''
    content = content[:old_nav_match.start()] + new_nav + content[old_nav_match.end():]

# 4. Replace CSS with clean sidebar-layout version
old_style_start = content.find('<style>')
old_style_end = content.find('</style>') + len('</style>')

new_css = '''<style>
:root {
  --primary: #cc785c; --primary-active: #a9583e;
  --accent-teal: #5db8a6; --accent-amber: #e8a55a;
  --canvas: #faf9f5; --surface-soft: #f5f0e8; --surface-card: #efe9de;
  --hairline: #e6dfd8; --hairline-soft: #ebe6df;
  --ink: #141413; --body-strong: #252523; --body: #3d3d3a;
  --muted: #6c6a64; --muted-soft: #8e8b82;
  --code-bg: #f4f0e8; --code-text: #3d3d3a; --code-border: #e6dfd8;
  --font-display: "Tiempos Headline","Cormorant Garamond","EB Garamond","Garamond","Times New Roman",serif;
  --font-body: "Inter",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC","PingFang SC",sans-serif;
  --font-mono: "JetBrains Mono","Cascadia Code","Consolas",ui-monospace,monospace;
  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-pill: 9999px;
  --space-xs: 8px; --space-sm: 12px; --space-md: 16px; --space-lg: 24px; --space-xl: 32px; --space-xxl: 48px; --space-section: 80px;
}
[data-theme="dark"] {
  --canvas: #1a1916; --surface-soft: #201f1c; --surface-card: #252320;
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
h3{font-size:clamp(17px,2.5vw,22px);line-height:1.3;letter-spacing:-0.3px;margin-top:36px;margin-bottom:12px}
h4{font-size:18px;font-weight:500;line-height:1.4;color:var(--ink);margin:32px 0 8px}
p{margin-bottom:14px;color:var(--body);line-height:1.7}
a{color:var(--primary);text-decoration:none}

.top-nav{position:sticky;top:0;z-index:100;background:var(--canvas);height:60px;border-bottom:1px solid var(--hairline);backdrop-filter:saturate(180%) blur(16px)}
.nav-inner{max-width:1200px;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between;height:100%;gap:16px}
.nav-brand{font-size:14px;font-weight:500;color:var(--muted);display:flex;align-items:center;gap:6px;white-space:nowrap}
.nav-brand:hover{color:var(--ink)}
.theme-toggle{flex-shrink:0;background:var(--surface-card);color:var(--ink);border:1px solid var(--hairline);border-radius:var(--radius-md);padding:6px 12px;height:34px;font-size:13px;font-weight:500;cursor:pointer}

.hero{text-align:center;padding:80px 24px 48px;background:var(--canvas);border-bottom:1px solid var(--hairline)}
.hero-badge{display:inline-block;padding:4px 14px;background:var(--primary);color:#fff;font-size:12px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;border-radius:9999px;margin-bottom:24px}
.hero h1{margin-bottom:16px}
.hero .lead{font-size:18px;color:var(--muted);max-width:640px;margin:0 auto 32px;line-height:1.5}

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

.section{scroll-margin-top:80px}

/* Module index grid -> keep for backward compat but reposition */
.module-index{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:24px 0}
.module-index-item{padding:18px;border-radius:12px;background:var(--surface-card);border:1px solid var(--hairline);text-decoration:none;display:block}
.module-index-item:hover{border-color:var(--muted)}
.module-index-item .idx-num{font-size:12px;font-weight:500;color:var(--primary);letter-spacing:1.5px;margin-bottom:6px}
.module-index-item .idx-title{font-size:16px;font-weight:500;color:var(--ink);margin-bottom:4px}
.module-index-item .idx-desc{font-size:13px;color:var(--muted);line-height:1.5}

/* Know boxes, panels */
.know-box{border-radius:12px;padding:20px;margin:24px 0;background:var(--surface-soft);border:1px solid var(--hairline)}
.know-box-head{font-size:15px;font-weight:600;color:var(--ink);margin-bottom:8px}
.code-block{background:var(--code-bg);border:1px solid var(--code-border);border-radius:8px;padding:16px;font-family:var(--font-mono);font-size:13px;line-height:1.6;color:var(--code-text);overflow-x:auto;margin:16px 0;white-space:pre-wrap}
.cmt{color:var(--muted-soft)}

/* Tables */
.compare-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px}
.compare-table th{text-align:left;padding:12px 16px;font-size:12px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);border-bottom:2px solid var(--hairline)}
.compare-table td{padding:12px 16px;border-bottom:1px solid var(--hairline-soft);color:var(--body);line-height:1.55}

/* Diagrams */
.diagram-container{margin:24px auto;padding:24px;background:var(--canvas);border-radius:12px;border:1px solid var(--hairline);overflow-x:auto;text-align:center}
.diagram-container .diagram-label{font-family:var(--font-mono);font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted-soft);margin-bottom:16px;text-align:left}
.diagram-container svg{max-width:100%;height:auto;margin:0 auto}
.diagram-caption{font-size:13px;color:var(--muted);text-align:center;margin-top:12px;font-style:italic}

code{font-family:var(--font-mono);font-size:13px;background:var(--code-bg);padding:2px 6px;border-radius:4px;color:var(--code-text)}
pre{background:var(--code-bg);border:1px solid var(--code-border);border-radius:8px;padding:16px;font-family:var(--font-mono);font-size:13px;line-height:1.6;color:var(--code-text);overflow-x:auto;margin-bottom:16px;white-space:pre-wrap}

ul,ol{margin:14px 0 14px 1.5em;color:var(--body);line-height:1.9}
li{margin-bottom:4px}
.pill{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;background:var(--surface-card);color:var(--ink)}

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

# 5. Restructure: wrap sections in page-layout grid
# Find where the main sections start (after hero and module-index)
first_section = content.find('<section class="section"')
if first_section == -1:
    first_section = content.find('<section class="section ')

footer_pos = content.find('<footer')
section_closes = [m.end() for m in re.finditer(r'</section>', content)]
last_section = max(s for s in section_closes if s < footer_pos) if footer_pos > 0 else max(section_closes)

before = content[:first_section]
sections_block = content[first_section:last_section]
after = content[last_section:]

# Convert <section class="section" id="X"> to <section class="func-section" id="X">
# and extract h2 -> section-title
def convert_mobile_section(m):
    sec_id = m.group(1)
    return f'<section class="func-section" id="{sec_id}">'

sections_block = re.sub(
    r'<section class="section[^"]*"\s+id="([^"]+)"[^>]*>',
    convert_mobile_section,
    sections_block
)

# Also convert <section class="section section-alt" id="X">
sections_block = re.sub(
    r'<section class="section section-alt[^"]*"\s+id="([^"]+)"[^>]*>',
    lambda m: f'<section class="func-section" id="{m.group(1)}" style="background:var(--surface-soft)">',
    sections_block
)

# Remove the closing </div> for .container wrappers inside sections
# Mobile has: <section...><div class="container">...content...</div></section>
# Simplify by removing .container divs (page-layout handles width now)
sections_block = sections_block.replace('<div class="container">\n', '')
sections_block = sections_block.replace('\n    </div>\n  </section>', '\n  </section>')
sections_block = sections_block.replace('</div>\n  </section>', '</section>')

# Assemble
final = before.strip() + '\n\n'
final += '<div class="page-layout">\n'
final += '      ' + sidebar_html.strip() + '\n'
final += '      <main class="content-area">\n\n'
final += sections_block.strip() + '\n\n'
final += '      </main>\n'
final += '    </div>\n\n'
final += after.strip()

# 6. Clean up old JS and add new theme + sidebar script
final = re.sub(r'<script>[\s\S]*?</script>', '', final)

clean_script = '''
<script>
(function(){
  var saved = localStorage.getItem('fplayer-mobile-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme','dark');
})();
function toggleTheme(){
  var el = document.documentElement;
  var isDark = el.getAttribute('data-theme') === 'dark';
  el.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('fplayer-mobile-theme', isDark ? 'light' : 'dark');
}
// Sidebar active tracking
var secs = document.querySelectorAll('.func-section');
var links = document.querySelectorAll('.sidebar a');
window.addEventListener('scroll', function(){
  var cur = '';
  secs.forEach(function(s){ if(window.scrollY >= s.offsetTop - 100) cur = s.getAttribute('id'); });
  links.forEach(function(l){ l.classList.toggle('active', l.getAttribute('href') === '#' + cur); });
});
// Sidebar smooth scroll
document.querySelectorAll('.sidebar a').forEach(function(a){
  a.addEventListener('click', function(e){
    e.preventDefault();
    var target = document.querySelector(this.getAttribute('href'));
    if (target) window.scrollTo({top: target.offsetTop - 80, behavior: 'smooth'});
  });
});
</script>
'''

final = final.replace('</body>', clean_script + '\n</body>')

with open('doc/FPlayer-FF-Mobile-技术全景教程.html', 'w', encoding='utf-8') as f:
    f.write(final)

print(f"Done! {len(content)} -> {len(final)} chars")
print("Sections:", [s[0] for s in sections])
