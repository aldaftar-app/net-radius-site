// hero3d.js — الافتتاح الحي: مدينة وشبكة يرسمهما جهاز الزائر نفسه بدقة شاشته (لا صور تُحمَّل)،
// والسكرول يحرّك الكاميرا ويروي: الشبكة تعمل ← كل برج يبثّ ← عطل يظهر فوراً ومن تأثر به ← الصورة كلها.
const touch = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
window.NR3D = { samples: touch ? 0 : 4 };          // تنعيم الحواف: على الحاسب فقط (على الجوال تكفي دقة الشاشة)
const w = await import('./world3d.js');
const { THREE, towers, tower, core, env, subs, fx, rig, post, bloom, camera, canvas, clamp, lerp, smooth, COL, hdr, scene } = w;

/* ---------- الدقة: بكسلات الشاشة الحقيقية، بحدّ أعلى يحفظ السلاسة ---------- */
let pr = Math.min(window.devicePixelRatio || 1, 2), maxPx = touch ? 1.9e6 : 3.6e6, aspect = 16 / 9, hpx = 1080;
function fit() {
  const r = canvas.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
  let k = pr; if (r.width * r.height * k * k > maxPx) k = Math.sqrt(maxPx / (r.width * r.height));
  w.setSize(r.width * k, r.height * k); aspect = r.width / r.height; hpx = r.height * k;
}

/* ---------- مواضع الكاميرا لكل مرحلة ---------- */
const POSE = {
  a: { px: 178, py: 74, pz: 212, lx: 40, ly: 6, lz: 12, fov: 36 },        // المدينة كلها والشبكة فوقها
  b: { px: 132, py: 31, pz: 50, lx: 67, ly: 13, lz: -11, fov: 34 },       // قرب برج يبثّ لمشتركيه
  c: { px: 214, py: 62, pz: 66, lx: 100, ly: 8, lz: -20, fov: 34 },       // البرج المعطوب وما خلفه
  d: { px: 6, py: 318, pz: 196, lx: 0, ly: 0, lz: 10, fov: 36 },          // من فوق: الشبكة كخريطة
};
const KEYS = ['px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov'];
const mix = (A, B, k, out) => { for (const q of KEYS) out[q] = lerp(A[q], B[q], k); return out; };
const cur = { ...POSE.a }, tmpPose = { ...POSE.a };
const ease3 = (x) => 1 - Math.pow(1 - clamp(x), 3);

/* ---------- حلقة «عاد» عند إصلاح العطل ---------- */
const ringMat = new THREE.MeshBasicMaterial({ color: hdr(COL.brand, 2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6; ring.visible = false; ring.renderOrder = 8; scene.add(ring);
let ringT = -9, wasFault = false;

const FAULT = 2, BEHIND = [7, 8];                  // برج الشرق يتعطل، وبرجا الكورنيش والمشفى خلفه
const prev = new THREE.Vector3(), vel = new THREE.Vector3();
let calm = false, tx = 0, ty = 0, mx = 0, my = 0;

function apply(t, p, dt) {
  const portrait = clamp((1.25 - aspect) / 0.75);                         // 0 شاشة عريضة .. 1 جوال بالطول
  // 1) البداية: المدينة تنكشف من المركز، والأبراج ترتفع والوصلات تُرسم نحوها
  const ti = calm ? 99 : t;
  env.s.reveal = 340 * ease3(ti / 2.6) + 620 * smooth(2.2, 7.5, ti);      // حلقة الكشف تكمل طريقها خارج المدينة وتختفي
  core.s.power = 1; core.s.glow = 1;
  const kB = smooth(0.12, 0.30, p), kCcam = smooth(0.42, 0.56, p), kD = smooth(0.72, 0.90, p);
  const fault = smooth(0.47, 0.54, p) * (1 - smooth(0.66, 0.72, p));
  for (const T of towers) {
    const d0 = 0.35 + Math.hypot(T.pos.x, T.pos.z) / 186 * 1.5, s = T.s;
    s.on = ease3((ti - d0) / 0.9); s.link = clamp((ti - d0 + 0.25) / 1.0);
    const alive = smooth(d0 + 0.5, d0 + 1.9, ti);
    s.hood = alive; s.pulse = alive; s.subs = alive * (0.62 + 0.38 * Math.max(kB, kD * 0.6)); s.fans = alive * (0.42 + 0.58 * kB) * (1 - 0.35 * kD);
    s.red = 0; s.behind = 0; s.root = 0; s.hot = 0;
  }
  // 2) العطل: البرج يحمرّ، وما خلفه يخفت، وعمود ضوء يدلّ على أصل العطل
  const F = tower(FAULT); F.s.red = fault; F.s.root = fault * 0.9; F.s.fans *= 1 - 0.7 * fault;
  for (const id of BEHIND) { const B = tower(id); B.s.behind = smooth(0.2, 0.9, fault); B.s.fans *= 1 - 0.8 * fault; }
  post.s.red = 0.2 * fault; post.s.bloom = (touch ? 0.72 : 0.85);
  if (wasFault && fault < 0.5) ringT = t; wasFault = fault >= 0.5;
  const rk = (t - ringT) / 1.5; ring.visible = rk > 0 && rk < 1;
  if (ring.visible) { ring.position.set(F.pos.x, 0.6, F.pos.z); ring.scale.setScalar(2 + ease3(rk) * 78); ringMat.opacity = (1 - rk) * 0.9; }

  // 3) الكاميرا: من موضع إلى موضع حسب السكرول، مع دوران هادئ يُبقي المشهد حياً
  mix(POSE.a, POSE.b, kB, cur); mix(cur, POSE.c, kCcam, tmpPose); mix(tmpPose, POSE.d, kD, cur);
  const back = 1 + 0.42 * portrait * (1 - 0.5 * kD), orbit = calm ? 0 : (0.085 * Math.sin(t * 0.11) + 0.02 * Math.sin(t * 0.37)) * (1 - 0.7 * kD);
  const dx = (cur.px - cur.lx) * back, dz = (cur.pz - cur.lz) * back, co = Math.cos(orbit), si = Math.sin(orbit);
  rig.px = cur.lx + dx * co - dz * si; rig.pz = cur.lz + dx * si + dz * co; rig.py = cur.ly + (cur.py - cur.ly) * back;
  // على الحاسب: الكاميرا تميل قليلاً مع مؤشر الفأرة، فيشعر الزائر بالعمق
  mx += (tx - mx) * Math.min(1, dt * 3); my += (ty - my) * Math.min(1, dt * 3);
  const par = (1 - kD) * (calm ? 0 : 1);
  rig.px += -mx * 9 * par * co; rig.pz += -mx * 9 * par * si; rig.py += my * 5 * par;
  rig.lx = cur.lx; rig.ly = cur.ly + portrait * lerp(-64, 6, kB) * (1 - kD); rig.lz = cur.lz;   // جوال بالطول: المدينة فوق والعنوان تحتها
  rig.fov = lerp(cur.fov, 54, portrait); rig.drift = calm ? 0 : 1;
  camera.filmGauge = 35; camera.filmOffset = -7.5 * (1 - portrait) * (1 - kD);   // على الشاشة العريضة: المشهد يساراً والكلام يميناً

  // 4) غبار الضوء يتمدد خطوطاً حين تسافر الكاميرا
  vel.set(rig.px, rig.py, rig.pz).sub(prev); const sp = dt > 0 ? vel.length() / dt : 0; prev.set(rig.px, rig.py, rig.pz);
  if (sp > 1) fx.dir.copy(vel).normalize();
  fx.s.warp += (clamp((sp - 12) / 260) - fx.s.warp) * Math.min(1, dt * 6); fx.s.dust = 0.5;
  subs.s.size = (hpx / 1080) * (touch ? 1.3 : 1.05); subs.s.threads = 0.16 + 0.1 * kB;
  env.s.stars = 0.6; env.s.night = 0.25 * kD;
}

/* ---------- التشغيل ---------- */
let getP = () => 0, ps = 0, t = 0, last = 0, running = false, visible = true, raf = 0, started = false;
let n = 0, acc = 0, tier = 0;
function govern(dt) {                              // إن كان الجهاز أضعف من المشهد: نخفف الدقة ثم الوهج، ولا نترك الصورة تتقطع
  if (tier >= 2 || t < 1.2) return; n++; acc += dt;
  if (n < 70) return; const avg = acc / n; n = 0; acc = 0;
  if (avg > 0.026) { tier++; if (tier === 1) { pr = Math.max(1, pr * 0.72); maxPx *= 0.62; } else { pr = 1; maxPx *= 0.7; bloom.enabled = false; } fit(); }
}
function loop(now) {
  raf = 0; if (!running) return;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
  ps += (getP() - ps) * (calm ? 1 : 1 - Math.exp(-dt * 5.5));                 // قصور ذاتي: الكاميرا تلحق السكرول بنعومة
  apply(t, ps, dt); w.tick(t); govern(dt);
  if (!started) { started = true; canvas.classList.add('on'); }
  raf = requestAnimationFrame(loop);
}
function setRunning(on) {
  if (on === running) return; running = on;
  if (on) { last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); }
}
const sync = () => setRunning(visible && !document.hidden);

/** start(getProgress, { calm }) — getProgress() يعيد تقدّم السكرول في الافتتاح 0..1 */
export function start(getProgress, opt = {}) {
  getP = getProgress; calm = !!opt.calm; ps = getP();
  fit(); prev.set(POSE.a.px, POSE.a.py, POSE.a.pz);
  addEventListener('resize', fit);
  if (!touch) addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }, { threshold: 0 }).observe(canvas);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setRunning(false); canvas.classList.remove('on'); });
  sync();
  return { stats: () => ({ tier, pr, size: w.size(), bloom: bloom.enabled }) };
}
