// نت راديوس — الموقع. مشهد المدينة يتحرك مع السكرول (صور متتالية على canvas)، والكلام يظهر على مراحل.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches;
  const conn = navigator.connection || {};
  // نت ضعيف أو «توفير البيانات»: تبقى صورة واحدة ثابتة، والكلام يعمل كما هو
  const lite = reduced || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');

  /* ---------- الشريط العلوي ---------- */
  const nav = $('#nav'), hero = $('#hero'), toggle = $('#navToggle');
  toggle.addEventListener('click', () => { const open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
  $('#navLinks').addEventListener('click', (e) => { if (e.target.tagName === 'A') { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });

  /* ---------- مشهد السكرول ---------- */
  const canvas = $('#heroCanvas'), ctx = canvas.getContext('2d', { alpha: false });
  const N = mobile ? 68 : 136, DIR = mobile ? 'm' : 'd';
  const frames = new Array(N).fill(null);
  let cw = 0, ch = 0, drawn = -1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.5);
    const r = canvas.getBoundingClientRect();
    cw = Math.round(r.width * dpr); ch = Math.round(r.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; drawn = -1; }
  }
  function nearest(i) {                       // أقرب صورة وصلت فعلاً
    if (frames[i]) return i;
    for (let d = 1; d < N; d++) { if (i - d >= 0 && frames[i - d]) return i - d; if (i + d < N && frames[i + d]) return i + d; }
    return -1;
  }
  function draw(i) {
    const k = nearest(i); if (k < 0 || k === drawn) return;
    const im = frames[k], s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    drawn = k; canvas.classList.add('on');
  }
  function loadOne(i) {
    return new Promise((res) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { frames[i] = im; res(); }; im.onerror = () => res();
      im.src = `assets/hero/${DIR}/${String(i).padStart(3, '0')}.webp`;
    });
  }
  async function loadAll() {
    // الترتيب: الأولى، ثم كل 16، ثم 8، 4، 2، ثم الباقي. فيتحرك المشهد من أول ثانية ويزداد نعومة.
    const order = [], seen = new Set();
    for (const step of [N, 16, 8, 4, 2, 1]) for (let i = 0; i < N; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    let at = 0;
    const worker = async () => { while (at < order.length) { const i = order[at++]; await loadOne(i); if (Math.abs(i - Math.round(cur)) <= 8) { drawn = -1; draw(Math.round(cur)); } } };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  /* ---------- المراحل ---------- */
  const stages = {
    a: { el: $('[data-stage="a"]'), from: -1, to: 0.15 },
    b: { el: $('[data-stage="b"]'), from: 0.22, to: 0.43 },
    c: { el: $('[data-stage="c"]'), from: 0.49, to: 0.70 },
    d: { el: $('[data-stage="d"]'), from: 0.76, to: 2 },
  };
  const win = $('.window'), cap = $('.window-cap'), bar = $('#heroBar'), hint = $('#scrollHint'), side = $('#heroSide'), dim = $('#heroDim');
  const FADE = 0.05;
  function stageAlpha(s, p) { return clamp((p - s.from) / FADE) * clamp((s.to - p) / FADE); }

  let target = 0, cur = 0, p = 0, ticking = false;
  function measure() {
    const r = hero.getBoundingClientRect(), span = r.height - window.innerHeight;
    p = span > 0 ? clamp(-r.top / span) : 0;
    target = Math.min(1, p / 0.9) * (N - 1);             // المشهد ينتهي عند 90%، والنافذة تبقى ثابتة في آخر 10%
    nav.classList.toggle('light', r.bottom < 90);
  }
  function paint() {
    for (const k in stages) {
      const s = stages[k], a = stageAlpha(s, p);
      s.el.style.opacity = a.toFixed(3);
      s.el.style.visibility = a > 0.01 ? 'visible' : 'hidden';
      if (k === 'a') s.el.style.setProperty('--shift', (p * 260).toFixed(1) + 'px');
      if (k === 'b' || k === 'c') s.el.style.transform = `translateY(${((1 - clamp((p - s.from) / FADE)) * 40 - clamp((p - s.to + FADE) / FADE) * 40).toFixed(1)}px)`;
    }
    side.style.opacity = (0.22 + 0.78 * stageAlpha(stages.a, p)).toFixed(3);   // بعد العنوان تنكشف المدينة
    const t = clamp((p - 0.76) / 0.14), e = 1 - Math.pow(1 - t, 3);           // النافذة ترتفع وتستوي
    dim.style.opacity = e.toFixed(3);
    win.style.transform = `translateY(${((1 - e) * 46).toFixed(2)}vh) rotateX(${((1 - e) * 38).toFixed(2)}deg) scale(${(0.86 + e * 0.14).toFixed(3)})`;
    cap.style.opacity = clamp((p - 0.86) / 0.06).toFixed(3);
    cap.style.transform = `translateY(${((1 - clamp((p - 0.86) / 0.06)) * 20).toFixed(1)}px)`;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    hint.style.opacity = p > 0.03 ? '0' : '1';
  }
  function loop() {
    cur += (target - cur) * (reduced ? 1 : 0.16);
    if (Math.abs(target - cur) < 0.02) cur = target;
    if (!lite) draw(Math.round(cur));
    if (cur !== target) requestAnimationFrame(loop); else ticking = false;
  }
  function onScroll() {
    measure(); paint();                                   // الكلام يتبع السكرول مباشرة
    if (document.hidden) { cur = target; if (!lite) draw(Math.round(cur)); return; }   // صفحة في الخلفية: لا تنعيم
    if (!ticking) { ticking = true; requestAnimationFrame(loop); }
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { resize(); drawn = -1; onScroll(); });
  resize(); measure(); paint();
  if (!lite) loadAll(); else canvas.style.display = 'none';

  /* ---------- الأسعار: اختيار حجم الشبكة ---------- */
  const sizes = $('#sizes');
  if (sizes) {
    const WA = 'https://wa.me/963994398849?text=';
    const pick = (b) => {
      sizes.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      const users = b.dataset.users, price = Number(b.dataset.price);
      $('#pUsers').textContent = users; $('#pPrice').textContent = price; $('#pMonth').textContent = Math.floor(price / 12) + 1;
      $('#pBtn').href = WA + encodeURIComponent(`مرحباً، أريد نت راديوس لشبكة حتى ${users} مشترك متصل (${price} $ في السنة)`);
    };
    sizes.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(b); });
    sizes.addEventListener('keydown', (e) => {                     // الأسهم تنقل الاختيار
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const all = [...sizes.querySelectorAll('button')], i = all.findIndex((x) => x.getAttribute('aria-checked') === 'true');
      const n = all[Math.min(all.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
      n.focus(); pick(n); e.preventDefault();
    });
    pick(sizes.querySelector('[aria-checked="true"]'));
  }

  /* ---------- الظهور مع السكرول ---------- */
  const items = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) items.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }
})();
