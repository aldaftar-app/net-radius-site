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

  // على شاشات اللمس: السكرول يقف عند كل عبارة، لا قبلها ولا بعدها. بعد الافتتاح يعود حرّاً.
  const snapping = matchMedia('(pointer: coarse)').matches && !reduced && window.CSS && CSS.supports('scroll-snap-stop', 'always');
  let p = 0;
  function measure() {
    const r = hero.getBoundingClientRect(), span = r.height - window.innerHeight;
    p = span > 0 ? clamp(-r.top / span) : 0;
    nav.classList.toggle('light', r.bottom < 90);
    if (snapping) document.documentElement.classList.toggle('hero-snap', r.bottom > 6);
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
  // الحارس: سحبة واحدة = عبارة واحدة. إن حاول الاندفاع أن يتجاوز العبارة التالية (سحبة عنيفة) نوقفه عندها.
  // (الوقوف نفسه يقوم به المتصفح بـ scroll-snap؛ هذا للحالة التي يتجاوز فيها المتصفح نقطة وقوف.)
  let gateLo = -1, gateHi = Infinity, armed = false, touching = false;
  if (snapping) {
    const marks = [...hero.querySelectorAll('.snap')];
    const stops = () => marks.map((m) => Math.round(m.getBoundingClientRect().top + scrollY)).concat([hero.offsetHeight]).sort((x, y) => x - y);
    let y0 = 0;
    addEventListener('touchstart', () => {
      touching = true; goId++; const y = y0 = scrollY, s = stops(), below = s.filter((v) => v < y - 12);
      gateHi = s.find((v) => v > y + 12) ?? Infinity; gateLo = below.length ? below[below.length - 1] : -1;
      armed = y < hero.offsetHeight + 4;
    }, { passive: true });
    // سحبة هادئة قصيرة تكفي: الاتجاه يقرر. تتقدم إلى العبارة التالية بدل أن ترتد إلى مكانها.
    const up = () => {
      touching = false; if (!armed) return;
      const dy = scrollY - y0, to = dy > 36 ? gateHi : (dy < -36 ? gateLo : null);
      if (to != null && to >= 0 && isFinite(to)) go(to);
    };
    // المتصفح قد يختار بنفسه أقرب نقطة وقوف (فيرتد)؛ نعيد الطلب مرة بعد لحظة، ونتأكد عند السكون
    let goId = 0;
    const go = (to) => {
      const id = ++goId, send = () => { if (id === goId && !touching) window.scrollTo({ top: to, behavior: 'smooth' }); };
      send(); setTimeout(send, 90);
      setTimeout(() => { if (id === goId && !touching && Math.abs(scrollY - to) > 3) window.scrollTo({ top: to, behavior: 'smooth' }); }, 900);
    };
    addEventListener('touchend', up, { passive: true }); addEventListener('touchcancel', up, { passive: true });
  }
  // على الحاسوب أيضاً (طلب المالك 26 تشرين الثاني: «يوقف عند كل عبارة متل يلي عملناها بالموبايل»): دحرجة واحدة
  // بالعجلة أو بلوحة اللمس = عبارة واحدة، تنزلق إليها الصفحة وتقف عندها. ما يبقى من اندفاع لوحة اللمس بعد الدحرجة
  // لا يتجاوزها: الخطوة التالية تنتظر أن تسكن اليد. والأسهم وPage Down والمسافة مثلها. بعد الافتتاح يعود السكرول حرّاً.
  const stepping = !snapping && !reduced && matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (stepping) {
    const marks = [...hero.querySelectorAll('.snap')];
    const stops = () => marks.map((m) => Math.round(m.getBoundingClientRect().top + scrollY)).concat([hero.offsetHeight]).sort((x, y) => x - y);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let busy = false, last = 0, ended = 0, hist = [];
    const glide = (to) => {
      const from = scrollY, d = to - from, ms = Math.min(950, 480 + Math.abs(d) * 0.28), t0 = performance.now();
      busy = true;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        window.scrollTo({ top: from + d * ease(t), behavior: 'instant' });
        if (t < 1) requestAnimationFrame(step); else { busy = false; ended = performance.now(); }
      };
      requestAnimationFrame(step);
    };
    // عجلة الفأرة تأتي بنقرات، ولوحة اللمس بسيل يتباطأ وحده بعد أن ترفع إصبعك. نقرة العجلة بعد انتهاء الانزلاق
    // تكفي للعبارة التالية؛ وفي لوحة اللمس نفرّق سحبة جديدة (يكبر سيلها) عمّا بقي من اندفاع السابقة (يصغر)
    // (كان شرط «سكون 170 ms» وحده يُضيع دحرجة العجلة المتصلة والسحبة الثانية قبل أن يهدأ اندفاع الأولى)
    const notch = (e) => e.deltaMode === 1 || (!!e.wheelDeltaY && e.wheelDeltaY % 120 === 0 && e.wheelDeltaY !== -3 * e.deltaY);
    let pgap = Infinity;
    const allow = (e, now) => {
      const a = Math.abs(e.deltaY), prev = hist.slice(-2), gap = now - last, quiet = gap > 170, sparse = gap >= 45 && pgap >= 45;
      hist.push(a); if (hist.length > 6) hist.shift(); pgap = gap;
      if (busy || now - ended < 120) return false;
      if (notch(e) || quiet) return true;
      // نقرة عجلة لم يسمّها المتصفح: نقرات متفرقة كل واحدة بعد فاصل، ولوحة اللمس سيلها كل 16 ms تقريباً
      // (فاصل واحد في وسط اندفاع لوحة اللمس لا يكفي)
      if (sparse && a >= 4 && (!prev.length || a >= prev[prev.length - 1])) return true;   // (اندفاع يصغر لا يُحسب)
      return a >= 6 && prev.length === 2 && a > 1.4 * Math.max(...prev);       // سحبة جديدة: سيل يكبر
    };
    // أين يقف: العبارة التالية في اتجاه الدحرجة (ونهاية الافتتاح بعد آخرها). خارج الافتتاح لا شيء
    const target = (down) => {
      const y = scrollY, s = stops(), end = s[s.length - 1];
      if (!(y < end - 2 || (!down && y <= end + 2))) return undefined;
      return (down ? s.find((v) => v > y + 12) : [...s].reverse().find((v) => v < y - 12)) ?? null;
    };
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX) || !e.deltaY) return;
      const to = target(e.deltaY > 0);
      if (to === undefined) return;
      e.preventDefault();
      const now = performance.now(), ok = allow(e, now); last = now;
      if (ok && to !== null) glide(to);
    }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest('input, textarea, select, button, a, [contenteditable]'))) return;
      const k = e.key, down = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey), up = k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey);
      if (!down && !up) return;
      const to = target(down);
      if (to === undefined) return;
      e.preventDefault();
      if (!busy && to !== null) glide(to);
    });
  }
  function gate() {
    if (!armed || touching) return;
    const y = scrollY, to = y > gateHi + 2 ? gateHi : (y < gateLo - 2 ? gateLo : null);
    if (to == null) return;
    armed = false; const root = document.documentElement;
    root.style.overflow = 'hidden'; window.scrollTo({ top: to, behavior: 'instant' });       // يوقف الاندفاع فوراً عند العبارة
    requestAnimationFrame(() => requestAnimationFrame(() => { root.style.overflow = ''; }));
  }
  const onScroll = () => { if (snapping) gate(); measure(); paint(); };
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

  /* ---------- الأسعار: حجم الشبكة ومكان اللوحة ---------- */
  // السعر السنوي في الزر نفسه: data-online على سيرفرنا، وdata-local على جهاز الزبون (أرخص من حجم 1000 وفوق، بأرقام المالك)
  const sizes = $('#sizes'), place = $('#place');
  if (sizes && place) {
    const WA = 'https://wa.me/963994398849?text=';
    const PLAN = { start: 'انطلاق', grow: 'نمو', pro: 'احتراف' };
    let size = sizes.querySelector('[aria-checked="true"]'), at = 'online';
    const show = () => {
      const users = size.dataset.users, plan = size.dataset.plan, online = Number(size.dataset.online), price = Number(size.dataset[at]);
      $('#pUsers').textContent = users; $('#pPlan').textContent = PLAN[plan]; $('#pPrice').textContent = price;
      $('#pSub').innerHTML = `أي أقل من <b class="ltr">${Math.floor(price / 12) + 1} $</b> في الشهر`
        + (at === 'local' ? (price < online ? `، وأقل بـ<b class="ltr">${online - price} $</b> من سعر سيرفرنا` : '، والسعر نفسه على سيرفرنا') : '');
      document.querySelectorAll('.pricing [data-plan]').forEach((el) => { if (!el.matches('#sizes button')) el.classList.toggle('on', el.dataset.plan === plan); });
      document.querySelectorAll('.pricing li[data-place]').forEach((el) => el.classList.toggle('on', el.dataset.place === at));
      $('#pBtn').href = WA + encodeURIComponent(`مرحباً، أريد نت راديوس لشبكة حتى ${users} مشترك متصل، خطة «${PLAN[plan]}» ${at === 'local' ? 'على جهاز عندي' : 'على سيرفركم'} (${price} $ في السنة)`);
    };
    const group = (box, onPick) => {                                // مجموعة أزرار يُختار منها واحد
      const pick = (b) => { box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); onPick(b); show(); };
      box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(b); });
      box.addEventListener('keydown', (e) => {                     // الأسهم تنقل الاختيار
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const all = [...box.querySelectorAll('button')], i = all.findIndex((x) => x.getAttribute('aria-checked') === 'true');
        const step = (e.key === 'ArrowRight' ? 1 : -1) * (getComputedStyle(box).direction === 'rtl' ? -1 : 1);
        const n = all[Math.min(all.length - 1, Math.max(0, i + step))];
        n.focus(); pick(n); e.preventDefault();
      });
    };
    group(sizes, (b) => { size = b; });
    group(place, (b) => { at = b.dataset.place; });
    show();
  }

  /* ---------- الظهور مع السكرول ---------- */
  const items = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) items.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }
})();
