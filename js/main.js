// نت راديوس — الموقع. الافتتاح مشهد ثري دي حي (js/hero3d.js) يتحرك مع السكرول، والكلام يظهر على مراحل.
(() => {
  'use strict';
  const HERE = document.currentScript ? document.currentScript.src : location.href;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- الشريط العلوي ---------- */
  const nav = $('#nav'), hero = $('#hero'), toggle = $('#navToggle');
  toggle.addEventListener('click', () => { const open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
  $('#navLinks').addEventListener('click', (e) => { if (e.target.tagName === 'A') { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });

  /* ---------- مراحل الافتتاح ---------- */
  const stages = {
    a: { el: $('[data-stage="a"]'), from: -1, to: 0.15 },
    b: { el: $('[data-stage="b"]'), from: 0.22, to: 0.43 },
    c: { el: $('[data-stage="c"]'), from: 0.49, to: 0.70 },
    d: { el: $('[data-stage="d"]'), from: 0.76, to: 2 },
  };
  const win = $('.window'), cap = $('.window-cap'), bar = $('#heroBar'), hint = $('#scrollHint'), side = $('#heroSide'), dim = $('#heroDim');
  const FADE = 0.05;
  const stageAlpha = (s, p) => clamp((p - s.from) / FADE) * clamp((s.to - p) / FADE);

  let p = 0;
  function measure() {
    const r = hero.getBoundingClientRect(), span = r.height - window.innerHeight;
    p = span > 0 ? clamp(-r.top / span) : 0;
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
    side.style.opacity = (0.3 + 0.7 * stageAlpha(stages.a, p)).toFixed(3);    // بعد العنوان تنكشف المدينة
    const t = clamp((p - 0.76) / 0.14), e = 1 - Math.pow(1 - t, 3);           // النافذة ترتفع وتستوي
    dim.style.opacity = (e * 0.8).toFixed(3);
    win.style.transform = `translateY(${((1 - e) * 46).toFixed(2)}vh) rotateX(${((1 - e) * 38).toFixed(2)}deg) scale(${(0.86 + e * 0.14).toFixed(3)})`;
    cap.style.opacity = clamp((p - 0.86) / 0.06).toFixed(3);
    cap.style.transform = `translateY(${((1 - clamp((p - 0.86) / 0.06)) * 20).toFixed(1)}px)`;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    hint.style.opacity = p > 0.03 ? '0' : '1';
  }
  const onScroll = () => { measure(); paint(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- المشهد الحي. إن لم يدعم الجهاز WebGL تبقى الخلفية الهادئة والكلام كاملاً ---------- */
  const canGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch (e) { return false; } })();
  if (canGL) {
    import(new URL('hero3d.js', HERE).href)
      .then((m) => { window.NRHERO = m.start(() => p, { calm: reduced }); })
      .catch((e) => { console.warn('hero3d:', e && e.message); });
  }

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
