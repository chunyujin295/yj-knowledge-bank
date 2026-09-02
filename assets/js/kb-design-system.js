/* YJ Knowledge Bank shared shell. See /FRONTEND_DESIGN_SYSTEM.md. */
(function () {
  'use strict';

  var html = document.documentElement;
  var script = document.currentScript;
  var scriptUrl = script && script.src ? new URL(script.src, window.location.href) : null;
  var siteRoot = scriptUrl ? new URL('../../', scriptUrl) : new URL('../../', window.location.href);
  var isEmbedded = window.self !== window.top;
  var isComparison = /\/thread\/cpp-threading-comparison\.html$/i.test(window.location.pathname);

  html.classList.add('kb-system');

  function icon(name) {
    if (name === 'sun') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    }
    if (name === 'github') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7A11.3 11.3 0 0 0 8.4 22.8c.6.1.8-.2.8-.5v-2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.3-3.2c-.2-.3-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.7 11.7 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.3 2.9.1 3.2A4.7 4.7 0 0 1 20 11c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.1v3.2c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z"/></svg>';
    }
    if (name === 'arrow-up') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>';
  }

  function preferredTheme() {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    html.setAttribute('data-theme', theme);
    if (persist) localStorage.setItem('theme', theme);

    var button = document.querySelector('.kb-theme-toggle');
    if (button) {
      var dark = theme === 'dark';
      button.innerHTML = dark ? icon('sun') : icon('moon');
      button.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
      button.setAttribute('title', dark ? '切换浅色模式' : '切换深色模式');
    }

    if (isComparison) {
      var frames = document.querySelectorAll('iframe');
      frames.forEach(function (frame) {
        try { frame.contentWindow.postMessage({ type: 'setTheme', value: theme }, '*'); } catch (error) { /* same-origin frame may still be loading */ }
      });
    }
  }

  function pageContext() {
    var title = (document.title || '').split(/\s+[—|-]\s+/)[0].trim();
    var heading = document.querySelector('h1');
    if (!title && heading) title = heading.textContent.trim();
    return title || '技术指南';
  }

  function classifyPage() {
    var body = document.body;
    if (isEmbedded) {
      body.classList.add('kb-embedded');
      return;
    }
    if (isComparison) {
      body.classList.add('kb-comparison');
      return;
    }

    body.classList.add('kb-has-sitebar');
    if (body.querySelector(':scope > .site-nav') && body.querySelector(':scope > .top-nav .nav-tabs')) {
      body.classList.add('kb-tabbed');
    } else if (body.querySelector(':scope > .topbar .topnav')) {
      body.classList.add('kb-anchor-nav');
    } else if (body.querySelector(':scope > .nav, :scope > .top-nav, :scope > .site-nav')) {
      body.classList.add('kb-basic-nav');
    }
  }

  function createSitebar() {
    if (isEmbedded || isComparison) return null;

    var header = document.createElement('header');
    header.className = 'kb-sitebar';
    header.setAttribute('data-kb-shell', 'true');
    header.innerHTML =
      '<div class="kb-sitebar__inner">' +
        '<a class="kb-sitebar__brand" href="' + new URL('index.html', siteRoot).href + '">' +
          '<img src="' + new URL('img/icons/icon1.png', siteRoot).href + '" alt="">' +
          '<span>YJ Knowledge Bank</span>' +
        '</a>' +
        '<div class="kb-sitebar__context" title="' + pageContext().replace(/"/g, '&quot;') + '">' + pageContext() + '</div>' +
        '<nav class="kb-sitebar__actions" aria-label="全站工具">' +
          '<button class="kb-sitebar__button kb-theme-toggle" type="button"></button>' +
          '<a class="kb-sitebar__button kb-github" href="https://github.com/chunyujin295/yj-knowledge-bank" target="_blank" rel="noopener" aria-label="在 GitHub 查看" title="在 GitHub 查看">' + icon('github') + '</a>' +
        '</nav>' +
      '</div>' +
      '<i class="kb-reading-progress" aria-hidden="true"></i>';

    document.body.insertBefore(header, document.body.firstChild);
    return header;
  }

  function createBackTop() {
    if (isEmbedded || isComparison || document.querySelector('.back-top')) return null;
    var button = document.createElement('button');
    button.className = 'kb-backtop';
    button.type = 'button';
    button.setAttribute('aria-label', '返回顶部');
    button.setAttribute('title', '返回顶部');
    button.innerHTML = icon('arrow-up');
    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(button);
    return button;
  }

  function bindReadingProgress(progress, backTop) {
    if (!progress && !backTop) return;
    var scheduled = false;

    function update() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (progress) progress.style.width = Math.min(100, Math.max(0, scrollTop / max * 100)) + '%';
      if (backTop) backTop.classList.toggle('is-visible', scrollTop > 560);
      scheduled = false;
    }

    window.addEventListener('scroll', function () {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function bindEmbeddedTheme() {
    if (!isEmbedded) return;
    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'setTheme') applyTheme(event.data.value === 'dark' ? 'dark' : 'light', false);
    });
  }

  function init() {
    classifyPage();
    var sitebar = createSitebar();
    var backTop = createBackTop();
    var progress = sitebar && sitebar.querySelector('.kb-reading-progress');
    var toggle = sitebar && sitebar.querySelector('.kb-theme-toggle');

    if (toggle) {
      toggle.addEventListener('click', function () {
        applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
      });
    }

    bindReadingProgress(progress, backTop);
    bindEmbeddedTheme();
    applyTheme(preferredTheme(), false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
