/* Portfolio runtime — dependency-free, progressive enhancement only.
   The page is fully readable without it. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cfg = {};
  try { cfg = JSON.parse((doc.getElementById('pos-config') || {}).textContent || '{}'); } catch (e) { cfg = {}; }
  var motion = cfg.animations !== false && !reduce;
  var cleanups = [];

  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); cleanups.push(function () { el.removeEventListener(ev, fn, opts); }); }

  /* ------------------------------ Theme ------------------------------ */
  function initScheme() {
    var stored = null;
    try { stored = localStorage.getItem('pos-scheme'); } catch (e) { stored = null; }
    if (stored === 'light' || stored === 'dark') root.setAttribute('data-scheme', stored);
    $$('[data-theme-toggle]').forEach(function (btn) {
      on(btn, 'click', function () {
        var current = root.getAttribute('data-scheme');
        if (!current) current = window.matchMedia('(prefers-color-scheme: dark)').matches && cfg.scheme === 'system' ? 'dark' : (cfg.defaultScheme || 'light');
        var next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-scheme', next);
        try { localStorage.setItem('pos-scheme', next); } catch (e) { /* storage unavailable */ }
      });
    });
  }

  /* ---------------------------- Animations --------------------------- */
  function initAnimations() {
    var targets = $$('[data-anim]');
    if (!motion) { root.classList.add('no-motion'); targets.forEach(function (t) { t.classList.add('is-in'); }); return; }
    root.classList.remove('no-motion');
    root.classList.add('pos-anim-ready');
    targets.forEach(function (t) {
      $$('[data-anim-child]', t).forEach(function (c, i) { c.style.setProperty('--i', String(Math.min(i, 12))); });
    });
    var load = targets.filter(function (t) { return t.getAttribute('data-trigger') === 'load'; });
    requestAnimationFrame(function () { load.forEach(function (t) { t.classList.add('is-in'); }); });
    var scroll = targets.filter(function (t) { return t.getAttribute('data-trigger') !== 'load'; });
    if (!('IntersectionObserver' in window)) { scroll.forEach(function (t) { t.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    scroll.forEach(function (t) { io.observe(t); });
    cleanups.push(function () { io.disconnect(); });
  }

  /* ------------------------------ Typing ----------------------------- */
  function initTyping() {
    $$('[data-typing]').forEach(function (el) {
      var phrases;
      try { phrases = JSON.parse(el.getAttribute('data-typing') || '[]'); } catch (e) { phrases = []; }
      if (!phrases.length) return;
      if (!motion) { el.textContent = phrases[0]; return; }
      var p = 0, i = 0, deleting = false, timer = 0;
      function tick() {
        var word = String(phrases[p % phrases.length]);
        i += deleting ? -1 : 1;
        el.textContent = word.slice(0, i);
        var wait = deleting ? 38 : 80;
        if (!deleting && i >= word.length) { deleting = true; wait = 1600; }
        else if (deleting && i <= 0) { deleting = false; p++; wait = 350; }
        timer = window.setTimeout(tick, wait);
      }
      tick();
      cleanups.push(function () { clearTimeout(timer); });
    });
  }

  /* ----------------------------- Particles --------------------------- */
  function initParticles() {
    $$('canvas[data-particles]').forEach(function (canvas) {
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = 0, h = 0, pts = [], raf = 0, visible = true;
      var color = getComputedStyle(root).getPropertyValue('--c-primary').trim() || '#6366f1';
      function resize() {
        var r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
        canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var count = Math.min(90, Math.round((w * h) / 16000));
        pts = [];
        for (var k = 0; k < count; k++) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.6 + .6 });
      }
      function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = color; ctx.strokeStyle = color;
        for (var a = 0; a < pts.length; a++) {
          var q = pts[a];
          if (motion) { q.x += q.vx; q.y += q.vy; if (q.x < 0 || q.x > w) q.vx *= -1; if (q.y < 0 || q.y > h) q.vy *= -1; }
          ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
          for (var b = a + 1; b < pts.length; b++) {
            var o = pts[b], dx = q.x - o.x, dy = q.y - o.y, d = dx * dx + dy * dy;
            if (d < 12000) { ctx.globalAlpha = (1 - d / 12000) * .22; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(o.x, o.y); ctx.stroke(); }
          }
        }
        if (motion && visible) raf = requestAnimationFrame(draw);
      }
      resize(); draw();
      on(window, 'resize', function () { resize(); if (!motion) draw(); });
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (e) { visible = e[0] && e[0].isIntersecting; if (visible && motion) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });
        io.observe(canvas); cleanups.push(function () { io.disconnect(); });
      }
      cleanups.push(function () { cancelAnimationFrame(raf); });
    });
  }

  /* ---------------------- Spotlight / parallax / magnetic --------------------- */
  function initPointerEffects() {
    $$('[data-spotlight]').forEach(function (el) {
      var host = el.closest('.hero') || el.parentElement;
      if (!host) return;
      on(host, 'pointermove', function (e) {
        var r = host.getBoundingClientRect();
        el.style.setProperty('--sx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--sy', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
    if (!motion) return;
    var para = $$('[data-parallax]');
    if (para.length) {
      var ticking = false;
      var update = function () {
        para.forEach(function (el) {
          var speed = parseFloat(el.getAttribute('data-parallax') || '0.2');
          var host = el.parentElement || el;
          var r = host.getBoundingClientRect();
          el.style.transform = 'translate3d(0,' + (-r.top * speed).toFixed(1) + 'px,0)';
        });
        ticking = false;
      };
      on(window, 'scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    }
    var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    $$('[data-magnetic], [data-anim="magnetic"] .card').forEach(function (el) {
      var strength = el.hasAttribute('data-magnetic') ? 0.3 : 0.06;
      on(el, 'pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength, y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      on(el, 'pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ------------------------------ Counters ----------------------------- */
  function initCounters() {
    var els = $$('[data-count]');
    if (!els.length || !motion || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, target = parseFloat(el.getAttribute('data-count') || '0');
        var decimals = (String(target).split('.')[1] || '').length, start = performance.now(), dur = 1400;
        (function step(now) {
          var t = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - t, 3);
          el.textContent = (target * eased).toFixed(decimals);
          if (t < 1) requestAnimationFrame(step);
        })(start);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
    cleanups.push(function () { io.disconnect(); });
  }

  /* --------------------------------- Nav -------------------------------- */
  function initNav() {
    var toggle = doc.querySelector('[data-nav-toggle]');
    var links = doc.querySelector('.nav-links');
    if (toggle && links) {
      on(toggle, 'click', function () {
        var open = links.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      $$('a', links).forEach(function (a) { on(a, 'click', function () { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }); });
      on(doc, 'keydown', function (e) { if (e.key === 'Escape' && links.classList.contains('is-open')) { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
    }
    var navLinks = $$('.nav-links a[href^="#"]');
    if (navLinks.length && 'IntersectionObserver' in window) {
      var map = {};
      navLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var a = map[e.target.id];
          if (a && e.isIntersecting) { navLinks.forEach(function (l) { l.removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'true'); }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) { var s = doc.getElementById(id); if (s) io.observe(s); });
      cleanups.push(function () { io.disconnect(); });
    }
    var top = doc.querySelector('[data-back-to-top]');
    if (top) {
      on(window, 'scroll', function () { top.classList.toggle('is-visible', window.scrollY > 700); }, { passive: true });
      on(top, 'click', function () { window.scrollTo({ top: 0, behavior: motion ? 'smooth' : 'auto' }); });
    }
  }

  /* ---------------------------- Mailto form ---------------------------- */
  function initForms() {
    $$('form[data-mailto]').forEach(function (form) {
      on(form, 'submit', function (e) {
        e.preventDefault();
        var ok = true;
        $$('input, textarea', form).forEach(function (f) {
          var valid = f.value.trim() !== '' && (f.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
          f.setAttribute('aria-invalid', valid ? 'false' : 'true');
          if (!valid && ok) { f.focus(); ok = false; }
        });
        if (!ok) return;
        var name = form.elements.namedItem('name').value.trim();
        var from = form.elements.namedItem('email').value.trim();
        var msg = form.elements.namedItem('message').value.trim();
        var subject = encodeURIComponent('Hello from ' + name);
        var body = encodeURIComponent(msg + '\n\n— ' + name + ' (' + from + ')');
        window.location.href = 'mailto:' + form.getAttribute('data-mailto') + '?subject=' + subject + '&body=' + body;
      });
    });
  }

  /* ------------------------------ Lightbox ----------------------------- */
  function initLightbox() {
    $$('[data-lightbox]').forEach(function (btn) {
      on(btn, 'click', function () {
        var img = btn.querySelector('img');
        if (!img) return;
        var dlg = doc.createElement('dialog');
        dlg.className = 'pos-lightbox';
        dlg.setAttribute('aria-label', img.alt || 'Image');
        var big = doc.createElement('img'); big.src = img.currentSrc || img.src; big.alt = img.alt;
        var close = doc.createElement('button'); close.type = 'button'; close.className = 'icon-btn'; close.setAttribute('aria-label', 'Close'); close.textContent = '×';
        dlg.appendChild(big); dlg.appendChild(close); doc.body.appendChild(dlg);
        function done() { dlg.remove(); btn.focus(); }
        close.addEventListener('click', function () { dlg.close(); });
        dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('close', done);
        if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
        close.focus();
      });
    });
  }

  /* ----------------------------- Presentation ---------------------------- */
  var presentHud = null;
  function setPresent(onOff) {
    root.classList.toggle('pos-present', onOff);
    if (onOff && !presentHud) {
      presentHud = doc.createElement('div');
      presentHud.className = 'pos-present-hud';
      presentHud.setAttribute('aria-live', 'polite');
      doc.body.appendChild(presentHud);
      updateHud();
    } else if (!onOff && presentHud) { presentHud.remove(); presentHud = null; }
  }
  function slides() { return $$('.pos-section'); }
  function currentSlide() {
    var list = slides(), mid = window.innerHeight / 2, idx = 0;
    list.forEach(function (s, i) { var r = s.getBoundingClientRect(); if (r.top <= mid) idx = i; });
    return idx;
  }
  function updateHud() { if (presentHud) presentHud.textContent = (currentSlide() + 1) + ' / ' + slides().length + '  ·  ← → to navigate  ·  Esc to exit'; }
  function goSlide(delta) {
    var list = slides(), next = Math.max(0, Math.min(list.length - 1, currentSlide() + delta));
    if (list[next]) list[next].scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'start' });
    setTimeout(updateHud, 450);
  }
  doc.addEventListener('keydown', function (e) {
    if (!root.classList.contains('pos-present')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].indexOf(e.key) >= 0) { e.preventDefault(); goSlide(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].indexOf(e.key) >= 0) { e.preventDefault(); goSlide(-1); }
    else if (e.key === 'Escape') { setPresent(false); if (window.parent !== window) window.parent.postMessage({ type: 'pos:present-exit' }, '*'); }
  });
  window.addEventListener('scroll', function () { if (presentHud) updateHud(); }, { passive: true });

  /* -------------------------------- Print -------------------------------- */
  window.addEventListener('beforeprint', function () {
    $$('details').forEach(function (d) { if (!d.open) { d.setAttribute('data-print-opened', ''); d.open = true; } });
    $$('[data-anim]').forEach(function (t) { t.classList.add('is-in'); });
  });
  window.addEventListener('afterprint', function () {
    $$('details[data-print-opened]').forEach(function (d) { d.open = false; d.removeAttribute('data-print-opened'); });
  });

  function init() {
    initScheme(); initAnimations(); initTyping(); initParticles(); initPointerEffects(); initCounters(); initNav(); initForms(); initLightbox();
    if (/[?&]present\b/.test(location.search)) setPresent(true);
    if (/[?&]print\b/.test(location.search)) setTimeout(function () { window.print(); }, 400);
  }
  function destroy() { while (cleanups.length) { try { cleanups.pop()(); } catch (e) { /* ignore */ } } }

  /* ----------------------- Builder preview bridge ------------------------ *
   * Only active inside the Portfolio OS editor (sandboxed iframe). It accepts
   * pre-rendered, sanitised markup from the parent and reports clicks. */
  if (cfg.preview) {
    var assetUrls = {};
    var selected = null;
    var hydrateAssets = function (scope) {
      $$('[data-pos-asset]', scope).forEach(function (img) { var u = assetUrls[img.getAttribute('data-pos-asset')]; if (u) img.src = u; });
      $$('[data-pos-bg-asset]', scope).forEach(function (el) { var u = assetUrls[el.getAttribute('data-pos-bg-asset')]; if (u) el.style.backgroundImage = 'url("' + u + '")'; });
    };
    var markSelected = function () {
      $$('.pos-selected').forEach(function (el) { el.classList.remove('pos-selected'); });
      if (!selected) return;
      var el = doc.querySelector('[data-section-id="' + selected.replace(/"/g, '') + '"]');
      if (el) el.classList.add('pos-selected');
    };
    root.classList.add('pos-editing');
    doc.addEventListener('click', function (e) {
      if (!root.classList.contains('pos-editing')) return;
      var a = e.target.closest && e.target.closest('a');
      if (a) {
        var href = a.getAttribute('href') || '';
        e.preventDefault();
        if (href.charAt(0) === '#' && href.length > 1) { var t = doc.getElementById(href.slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
      }
      if (e.target.closest && e.target.closest('form')) e.preventDefault();
      var sec = e.target.closest && e.target.closest('[data-section-id]');
      if (sec) window.parent.postMessage({ type: 'pos:select', id: sec.getAttribute('data-section-id') }, '*');
    }, true);
    window.addEventListener('message', function (e) {
      if (e.source !== window.parent) return;
      var m = e.data || {};
      if (m.type === 'pos:render') {
        var y = window.scrollY;
        var style = doc.getElementById('pos-style');
        if (style && typeof m.css === 'string') style.textContent = m.css;
        var body = doc.getElementById('pos-root');
        if (body && typeof m.body === 'string') { destroy(); body.innerHTML = m.body; }
        if (typeof m.rootClass === 'string') root.className = m.rootClass + ' pos-editing' + (root.classList.contains('pos-present') ? ' pos-present' : '');
        if (m.scheme) root.setAttribute('data-scheme', m.scheme); else root.removeAttribute('data-scheme');
        if (m.config) cfg = m.config;
        motion = cfg.animations !== false && !reduce;
        hydrateAssets(doc);
        init();
        if (!m.editing) root.classList.remove('pos-editing');
        markSelected();
        window.scrollTo(0, y);
      } else if (m.type === 'pos:assets') {
        Object.keys(m.assets || {}).forEach(function (id) {
          var v = m.assets[id];
          if (assetUrls[id] && assetUrls[id].indexOf('blob:') === 0) URL.revokeObjectURL(assetUrls[id]);
          assetUrls[id] = (typeof Blob !== 'undefined' && v instanceof Blob) ? URL.createObjectURL(v) : String(v);
        });
        hydrateAssets(doc);
      } else if (m.type === 'pos:select') {
        selected = m.id || null; markSelected();
        if (m.scroll && selected) { var el = doc.querySelector('[data-section-id="' + String(selected).replace(/"/g, '') + '"]'); if (el) el.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'start' }); }
      } else if (m.type === 'pos:present') {
        setPresent(!!m.on);
      } else if (m.type === 'pos:print') {
        window.print();
      } else if (m.type === 'pos:editing') {
        root.classList.toggle('pos-editing', !!m.on);
      }
    });
    window.parent.postMessage({ type: 'pos:ready' }, '*');
  }

  init();
})();
