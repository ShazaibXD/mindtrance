/* Motion layer: Lenis smooth scroll, GSAP + ScrollTrigger reveals, Vanta NET hero, and small react-bits-style
 * effects (split-text reveal, spotlight cards, magnetic buttons, marquee, count-up) written in plain JS.
 * Rules: nothing here is required for the app to work, everything is off under prefers-reduced-motion,
 * and any failure (no WebGL, library missing) leaves the normal, fully visible page. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = (MT.ui = MT.ui || {});

  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: true, addEventListener() {} };
  const finePointer = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  const hasLibs = () => !!(g.gsap && g.ScrollTrigger);
  const enabled = () => !mq.matches && hasLibs();

  let lenis = null;
  let vantas = [];
  let tickerFn = null;
  let cleanups = [];
  let vantaCleanups = [];
  let vantaLoad = null;

  /* ---------- helpers that are safe to unit test ---------- */
  function formatCount(value, decimals) {
    const d = decimals || 0;
    return d ? value.toFixed(d) : String(Math.round(value));
  }

  function splitWords(el) {
    if (el.dataset.splitDone) return el.querySelectorAll('.w-in');
    const probe = el.cloneNode(true);
    probe.querySelectorAll('br').forEach((b) => b.replaceWith(' ')); // a line break is a word boundary for screen readers
    const label = probe.textContent.replace(/\s+/g, ' ').trim();
    const walk = (node) => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span'); outer.className = 'w-out'; outer.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span'); inner.className = 'w-in'; inner.textContent = part;
            outer.appendChild(inner); frag.appendChild(outer);
          });
        } else if (n.nodeName === 'BR') frag.appendChild(n.cloneNode());
        else { const c = n.cloneNode(false); c.appendChild(walk(n)); frag.appendChild(c); }
      });
      return frag;
    };
    const built = walk(el);
    el.textContent = '';
    el.appendChild(built);
    el.setAttribute('aria-label', label);
    el.dataset.splitDone = '1';
    return el.querySelectorAll('.w-in');
  }

  /* ---------- Lenis ---------- */
  function startLenis() {
    if (lenis || !enabled() || typeof g.Lenis !== 'function') return;
    try {
      lenis = new g.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, anchors: false });
      lenis.on('scroll', g.ScrollTrigger.update);
      tickerFn = (t) => lenis.raf(t * 1000);
      g.gsap.ticker.add(tickerFn);
      g.gsap.ticker.lagSmoothing(0);
    } catch (e) { lenis = null; }
  }
  function stopLenis() {
    if (!lenis) return;
    try { if (tickerFn) g.gsap.ticker.remove(tickerFn); lenis.destroy(); } catch (e) { /* ignore */ }
    lenis = null; tickerFn = null;
  }
  ui.scrollTo = (y, immediate) => {
    if (lenis) lenis.scrollTo(y, { immediate: immediate !== false, force: true });
    else g.scrollTo(0, y);
  };
  ui.scrollLock = (lock) => { if (lenis) { if (lock) lenis.stop(); else lenis.start(); } };

  /* ---------- Vanta ---------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('could not load ' + src));
      document.head.appendChild(s);
    });
  }
  function loadVanta() {
    if (g.VANTA && g.VANTA.NET) return Promise.resolve();
    if (!vantaLoad) vantaLoad = loadScript('vendor/three.min.js').then(() => loadScript('vendor/vanta.net.min.js')).catch((e) => { vantaLoad = null; throw e; });
    return vantaLoad;
  }
  let glProbe = null;
  const webglOk = () => {
    if (glProbe !== null) return glProbe;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      glProbe = !!gl;
      if (gl) { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } // do not leave the probe context alive
    } catch (e) { glProbe = false; }
    return glProbe;
  };

  function vantaOptions(el) {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const small = g.innerWidth < 700;
    return {
      el, mouseControls: finePointer, touchControls: false, gyroControls: false, minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
      color: light ? 0x4f6b22 : 0x9fb86c, backgroundColor: light ? 0xf6f6f1 : 0x080909,
      points: small ? 6 : 8, maxDistance: small ? 18 : 21, spacing: small ? 20 : 18, showDots: true,
    };
  }

  function mountVanta(el) {
    if (!enabled() || !webglOk()) return;
    loadVanta().then(() => {
      if (!document.body.contains(el)) return;
      let effect = null;
      const create = () => {
        if (effect || !document.body.contains(el)) return;
        try { effect = g.VANTA.NET(vantaOptions(el)); vantas.push({ el, destroy: () => { try { effect.destroy(); } catch (e) { /* ignore */ } effect = null; } }); el.classList.add('has-vanta'); } catch (e) { effect = null; }
      };
      const destroy = () => { const v = vantas.find((x) => x.el === el); if (v) { v.destroy(); vantas = vantas.filter((x) => x !== v); } };
      // Only render while on screen: a WebGL loop behind off-screen content is wasted battery.
      const io = new IntersectionObserver((entries) => { entries[0].isIntersecting ? create() : destroy(); }, { threshold: 0.01 });
      io.observe(el);
      vantaCleanups.push(() => { io.disconnect(); destroy(); });
    }).catch(() => { /* no WebGL or missing file: the CSS background stays */ });
  }

  /* ---------- effects ---------- */
  function reveals(root) {
    const { gsap } = g;
    root.querySelectorAll('[data-reveal]').forEach((el) => {
      gsap.from(el, { y: 26, opacity: 0, duration: 0.8, ease: 'power3.out', delay: Number(el.dataset.delay || 0), scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    root.querySelectorAll('[data-stagger]').forEach((group) => {
      gsap.from(group.children, { y: 22, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: group, start: 'top 88%', once: true } });
    });
    root.querySelectorAll('[data-split]').forEach((el) => {
      const words = splitWords(el);
      gsap.from(words, { yPercent: 115, opacity: 0, duration: 0.9, ease: 'power4.out', stagger: 0.045, delay: Number(el.dataset.delay || 0), scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });
  }

  function counters(root) {
    const { gsap } = g;
    root.querySelectorAll('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count);
      const dec = Number(el.dataset.decimals || 0);
      if (!Number.isFinite(end)) return;
      const o = { v: 0 };
      el.textContent = formatCount(0, dec);
      gsap.to(o, { v: end, duration: 1.4, ease: 'power2.out', onUpdate: () => { el.textContent = formatCount(o.v, dec); }, onComplete: () => { el.textContent = formatCount(end, dec); }, scrollTrigger: { trigger: el, start: 'top 95%', once: true } });
    });
  }

  function bars(root) {
    const { gsap } = g;
    root.querySelectorAll('.meter > span').forEach((s) => {
      gsap.from(s, { scaleX: 0, transformOrigin: 'left center', duration: 1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 98%', once: true } });
    });
  }

  function graphs(root) {
    const { gsap } = g;
    root.querySelectorAll('.gv').forEach((gv) => {
      const nodes = gv.querySelectorAll('.gv-node');
      const edges = gv.querySelectorAll('.gv-edge');
      const tl = gsap.timeline({ scrollTrigger: { trigger: gv, start: 'top 85%', once: true } });
      edges.forEach((p) => {
        let len = 0;
        try { len = p.getTotalLength(); } catch (e) { len = 0; }
        if (len) { const dash = p.classList.contains('broken') || p.classList.contains('uncertain'); if (!dash) { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; } }
      });
      tl.from(nodes, { opacity: 0, scale: 0.88, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(1.4)', stagger: 0.07 }, 0)
        .to(edges, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out', stagger: 0.05, onComplete() { edges.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }); } }, 0.25);
    });
  }

  function gauges(root) {
    const { gsap } = g;
    root.querySelectorAll('[data-gauge]').forEach((el) => {
      gsap.from(el, { scaleX: 0, transformOrigin: 'left center', duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });
  }

  function timelines(root) {
    const { gsap, ScrollTrigger } = g;
    root.querySelectorAll('[data-timeline]').forEach((tl) => {
      const line = tl.querySelector('.tl-fill');
      if (line) gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', transformOrigin: 'top center', scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 60%', scrub: 0.4 } });
      tl.querySelectorAll('.tl-step').forEach((step) => {
        ScrollTrigger.create({ trigger: step, start: 'top 65%', onEnter: () => step.classList.add('on'), onLeaveBack: () => step.classList.remove('on') });
      });
    });
  }

  function marquees(root) {
    const { gsap } = g;
    root.querySelectorAll('[data-marquee]').forEach((m) => {
      const track = m.querySelector('.marquee-track');
      if (!track || track.dataset.cloned) return;
      track.dataset.cloned = '1';
      const clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.after(clone);
      const both = m.querySelectorAll('.marquee-track');
      const tween = gsap.to(both, { xPercent: -100, duration: 38, ease: 'none', repeat: -1 });
      m.addEventListener('pointerenter', () => gsap.to(tween, { timeScale: 0.15, duration: 0.6 }));
      m.addEventListener('pointerleave', () => gsap.to(tween, { timeScale: 1, duration: 0.6 }));
    });
  }

  function magnets(root) {
    if (!finePointer) return;
    const { gsap } = g;
    root.querySelectorAll('[data-magnet]').forEach((el) => {
      const move = (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.22, y: (e.clientY - (r.top + r.height / 2)) * 0.3, duration: 0.4, ease: 'power3.out' });
      };
      const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    });
  }

  function navbar(root) {
    const nav = root.querySelector('.topnav');
    if (!nav) return;
    g.ScrollTrigger.create({ start: 24, end: 99999, onToggle: (self) => nav.classList.toggle('scrolled', self.isActive) });
  }

  /* ---------- public ---------- */
  function vantaTeardown() {
    vantaCleanups.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    vantaCleanups = []; vantas = [];
  }

  function teardown() {
    vantaTeardown();
    cleanups.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    cleanups = [];
    if (hasLibs()) { g.ScrollTrigger.getAll().forEach((t) => t.kill()); g.gsap.killTweensOf('*'); }
  }

  /* Called after every render. `entering` is true when a new page was opened (not a state change on the same page). */
  function enter(root, opts) {
    if (!enabled()) return;
    const entering = !opts || opts.entering !== false;
    try {
      if (entering) {
        reveals(root); counters(root); bars(root); gauges(root); graphs(root); timelines(root); marquees(root); magnets(root); navbar(root);
        const main = root.querySelector('.app-main');
        if (main) g.gsap.from(main.children, { y: 14, opacity: 0, duration: 0.55, ease: 'power2.out', stagger: 0.06, clearProps: 'opacity,transform' });
        root.querySelectorAll('[data-vanta]').forEach(mountVanta);
      } else {
        const stage = root.querySelector('#stage');
        if (stage) g.gsap.from(stage.children, { y: 10, opacity: 0, duration: 0.4, ease: 'power2.out', stagger: 0.05, clearProps: 'opacity,transform' });
      }
      g.ScrollTrigger.refresh();
    } catch (e) { /* any failure leaves a normal, visible page */ }
  }

  function init() {
    if (hasLibs()) g.gsap.registerPlugin(g.ScrollTrigger);
    if (enabled()) { document.documentElement.classList.add('fx'); startLenis(); }
    mq.addEventListener('change', () => {
      if (mq.matches) { teardown(); stopLenis(); document.documentElement.classList.remove('fx'); } else { document.documentElement.classList.add('fx'); startLenis(); if (ui.render) ui.render(); }
    });
    // Spotlight: cards follow the cursor with a soft highlight (cheap: two CSS variables, one delegated listener).
    if (finePointer && !mq.matches) {
      document.addEventListener('pointermove', (e) => {
        const c = e.target.closest && e.target.closest('.card, .domain, .tier');
        if (!c) return;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    }
    g.addEventListener('load', () => hasLibs() && g.ScrollTrigger.refresh());
  }

  ui.motion = { init, enter, teardown, enabled, retheme: () => { const els = document.querySelectorAll('[data-vanta]'); vantaTeardown(); els.forEach(mountVanta); }, formatCount, splitWords };
  if (typeof module !== 'undefined' && module.exports) module.exports = ui.motion;
})(typeof window !== 'undefined' ? window : globalThis);
