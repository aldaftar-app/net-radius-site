// world3d.js — the 3D world of the site's opening, taken from film 1 (فيديو-إعلاني/build/film/world.js) and made to run live:
// one city, one network, drawn by the visitor's own device at its own resolution.
// Everything here is steered by plain numbers in `.s` objects (and `rig`), so chapters animate it with tl.to(obj.s, {...}).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// --- the site's own small engine (the film's engine.js needs gsap and a timeline; the site needs neither)
export const frame = [];
export const onFrame = (fn) => frame.push(fn);
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const Q = window.NR3D || {};                       // quality, decided by hero3d.js before this file is loaded
let W = 1920, H = 1080;

export { THREE };
export const COL = { brand: 0x3cc2a8, cyan: 0x45e6ff, ok: 0x5cf0a0, warn: 0xffb347, bad: 0xff4658, info: 0x86a8f0, violet: 0xa78bfa, white: 0xffffff, ink: 0x05070d };
export const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const R = rng(20261113);
const NT = 12;                                    // slots in the per-tower uniform arrays (0 = the core)

// ------------------------------------------------------------------ renderer
export const canvas = document.getElementById('heroCanvas');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
export const scene = new THREE.Scene();
const FOG = new THREE.Color().setRGB(0.010, 0.030, 0.040);
scene.background = FOG.clone();
export const camera = new THREE.PerspectiveCamera(38, W / H, 0.5, 3000);

// shared uniforms
export const U = {
  uTime: { value: 0 }, uFog: { value: 0.0022 }, uFogCol: { value: FOG.clone() },
  uReveal: { value: 0 },                           // radius (world units) inside which the city exists
  uHood: { value: new Array(NT).fill(0) },         // window light of each neighbourhood
  uOn: { value: new Array(NT).fill(0) }, uRed: { value: new Array(NT).fill(0) }, uBehind: { value: new Array(NT).fill(0) }, uHot: { value: new Array(NT).fill(0) },
};
const FOGFN = `
uniform float uFog; uniform vec3 uFogCol;
float fogK(vec3 wp){ float d = distance(wp, cameraPosition); return 1.0 - exp(-uFog*uFog*d*d); }`;
const HASH = `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }`;

// the whole world's steering wheel for the environment
export const env = { s: { reveal: 0, stars: 0.6, night: 0, ground: 1 } };
onFrame(() => { U.uReveal.value = env.s.reveal; });      // first thing every frame: everything below reads it

// ------------------------------------------------------------------ sky
{
  const g = new THREE.SphereGeometry(1500, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uNight: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; uniform float uNight;
      void main(){ float h = clamp(vD.y, -0.2, 1.0);
        vec3 zen = vec3(0.003,0.006,0.014), hor = mix(vec3(0.010,0.030,0.040), vec3(0.008,0.014,0.040), uNight);
        vec3 c = mix(hor, zen, pow(smoothstep(0.0, 0.5, h), 0.55)); c += vec3(0.010,0.045,0.05) * exp(-h*h*60.0) * (1.0 - uNight*0.5);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -10; scene.add(sky);
  const N = 1400, p = new Float32Array(N * 3), a = new Float32Array(N);
  for (let i = 0; i < N; i++) { const th = R() * Math.PI * 2, y = 0.04 + R() * 0.96, r = Math.sqrt(1 - y * y); p.set([Math.cos(th) * r * 1400, y * 1400, Math.sin(th) * r * 1400], i * 3); a[i] = R(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3)); sg.setAttribute('aR', new THREE.BufferAttribute(a, 1));
  const sm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uA: { value: 0.6 } },
    vertexShader: `attribute float aR; varying float vA; uniform float uTime; void main(){ vA = 0.35 + 0.65*abs(sin(uTime*0.6 + aR*40.0)); gl_PointSize = 1.2 + aR*2.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying float vA; uniform float uA; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(0.75,0.9,1.0)*1.4, (1.0 - smoothstep(0.0,0.5,d))*vA*uA); }`,
  });
  const stars = new THREE.Points(sg, sm); stars.renderOrder = -9; scene.add(stars);
  onFrame(() => { m.uniforms.uNight.value = env.s.night; sm.uniforms.uA.value = env.s.stars; sky.position.copy(camera.position); stars.position.copy(camera.position); });
}

// ------------------------------------------------------------------ ground
{
  const g = new THREE.PlaneGeometry(3000, 3000); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uA: { value: 1 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime, uReveal, uA; ${FOGFN}
      float grid(vec2 p, float s, float w){ vec2 q = p/s; vec2 f = abs(fract(q-0.5)-0.5)/fwidth(q); return 1.0 - min(min(f.x,f.y)/w, 1.0); }
      void main(){ float r = length(vW.xz);
        float inside = (1.0 - smoothstep(uReveal-30.0, uReveal, r));
        float dr = (r-uReveal)/7.0; float front = exp(-dr*dr) * step(1.0, uReveal) * (1.0 - smoothstep(300.0, 900.0, uReveal));
        float g1 = grid(vW.xz, 7.0, 1.0), g2 = grid(vW.xz, 35.0, 1.6);
        vec3 base = vec3(0.006,0.011,0.02);
        vec3 c = base + vec3(0.03,0.16,0.15)*g1*0.55*inside + vec3(0.06,0.34,0.32)*g2*0.7*inside;
        c += vec3(0.05,0.45,0.4) * exp(-r*r/900.0) * 0.5 * inside;
        c += vec3(0.25,1.6,1.4) * front;
        c *= uA; float f = fogK(vW); gl_FragColor = vec4(mix(c, uFogCol, f), 1.0); }`,
  });
  const ground = new THREE.Mesh(g, m); ground.renderOrder = -5; scene.add(ground);
  onFrame(() => { m.uniforms.uA.value = env.s.ground; });
}

// ------------------------------------------------------------------ the network: where things are
export const core = { id: 0, name: 'المركز', pos: new THREE.Vector3(0, 0, 0), top: new THREE.Vector3(0, 12.5, 0), s: { power: 1, standby: 0, glow: 1 } };
const TW = [
  // id, name, x, z, height, parent
  [1, 'برج الشمال', -8, -62, 23, 0], [2, 'برج الشرق', 64, -10, 23, 0], [3, 'برج الجنوب', 10, 66, 23, 0], [4, 'برج الغرب', -66, 8, 23, 0],
  [5, 'برج التلّة', -72, -78, 18, 1], [6, 'برج المعمل', 56, -94, 18, 1], [7, 'برج الكورنيش', 128, 30, 18, 2], [8, 'برج المشفى', 118, -58, 18, 2],
  [9, 'برج البساتين', 42, 132, 18, 3], [10, 'برج السوق', -52, 120, 18, 3], [11, 'برج المحطة', -134, -30, 18, 4],
];
/** towers[i]: { id (1..11), name, pos, top, h, parent (id, 0 = core), kids [ids], s: { on, red, behind, root, pulse, fans, subs, link, hood, hot } } */
export const towers = TW.map(([id, name, x, z, h, parent]) => ({
  id, name, pos: new THREE.Vector3(x, 0, z), top: new THREE.Vector3(x, h, z), h, parent, kids: [],
  s: { on: 0, red: 0, behind: 0, root: 0, pulse: 0, fans: 0, subs: 0, link: 0, hood: 0, hot: 0 },
}));
export const tower = (id) => towers[id - 1];
towers.forEach((t) => { if (t.parent) tower(t.parent).kids.push(t.id); });
/** node(0) = core, node(1..11) = towers: anything with .pos and .top */
export const node = (id) => (id === 0 ? core : tower(id));

// ------------------------------------------------------------------ buildings
{
  const pts = [];
  for (let x = -182; x <= 182; x += 7) for (let z = -182; z <= 182; z += 7) {
    if (R() < 0.2) continue; if (Math.hypot(x, z) < 15) continue; if (Math.hypot(x, z) > 186) continue;
    let near = 1e9, hood = 0; for (const t of towers) { const d = Math.hypot(x - t.pos.x, z - t.pos.z); if (d < near) { near = d; hood = t.id; } }
    if (near < 5.5) continue; if (Math.hypot(x, z) < near * 0.8) hood = 0;
    const s = 3.2 + R() * 2.3, h = 1.6 + R() * R() * 8 + 9 * Math.exp(-(x * x + z * z) / 2600) * R();
    pts.push({ x: x + (R() - 0.5) * 1.4, z: z + (R() - 0.5) * 1.4, sx: s, sz: 3.2 + R() * 2.3, h, hood, seed: R() });
  }
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(pts.map((p) => p.seed)), 1));
  g.setAttribute('aHood', new THREE.InstancedBufferAttribute(new Float32Array(pts.map((p) => p.hood)), 1));
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute float aSeed, aHood; varying vec3 vL, vW, vN, vS; varying float vSeed, vHood, vK; uniform float uReveal;
      void main(){ vec3 c = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz; vS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        float k = smoothstep(0.0, 26.0, uReveal - length(c.xz)); k = k*k*(3.0-2.0*k); vK = k;
        vec3 p = position; p.y *= k; vL = position; vN = normal; vSeed = aSeed; vHood = aHood;
        vec4 w = modelMatrix * instanceMatrix * vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vL, vW, vN, vS; varying float vSeed, vHood, vK; uniform float uHood[${NT}]; uniform float uTime; ${FOGFN} ${HASH}
      void main(){ if (vK < 0.01) discard;
        vec3 c = mix(vec3(0.008,0.013,0.024), vec3(0.022,0.036,0.058), vL.y);
        float hood = uHood[int(vHood + 0.5)];
        if (vN.y > 0.5) { vec2 e = abs(vL.xz); float edge = smoothstep(0.42, 0.5, max(e.x, e.y)); c = vec3(0.03,0.05,0.075) + vec3(0.05,0.22,0.2)*edge*(0.5 + hood); }
        else { float u = abs(vN.x) > 0.5 ? vL.z*vS.z : vL.x*vS.x; vec2 q = vec2(u*1.05, vL.y*vS.y*1.25); vec2 cell = floor(q), f = fract(q);
          float lit = step(0.62, hash(cell + vSeed*91.0)); float tw = 0.75 + 0.25*sin(uTime*0.7 + hash(cell)*30.0);
          float w = step(0.2,f.x)*step(f.x,0.8)*step(0.28,f.y)*step(f.y,0.78);
          vec3 wc = mix(vec3(1.0,0.72,0.38), vec3(0.35,0.95,0.9), step(0.6, hash(cell*1.7 + vSeed)));
          c += wc * w * lit * tw * hood * 1.25; c += vec3(0.02,0.10,0.09) * (1.0 - vL.y) * 0.5; }
        float f = fogK(vW); gl_FragColor = vec4(mix(c, uFogCol, f), 1.0); }`,
  });
  const mesh = new THREE.InstancedMesh(g, m, pts.length); const d = new THREE.Object3D();
  pts.forEach((p, i) => { d.position.set(p.x, 0, p.z); d.scale.set(p.sx, p.h, p.sz); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); });
  mesh.frustumCulled = false; scene.add(mesh);
}

// ------------------------------------------------------------------ towers
const beamGeo = (a, b, th) => { const d = new THREE.Vector3().subVectors(b, a), g = new THREE.BoxGeometry(th, d.length(), th); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g; };
const latticeGeo = (() => {                        // unit-height lattice tower (scaled per tower)
  const parts = [], B = 1.9, T = 0.42, L = 6; const at = (i, y) => { const k = lerp(B, T, y); return new THREE.Vector3([k, k, -k, -k][i], y, [k, -k, -k, k][i]); };
  for (let i = 0; i < 4; i++) parts.push(beamGeo(at(i, 0), at(i, 1), 0.2));
  for (let l = 1; l <= L; l++) { const y = l / L, y0 = (l - 1) / L; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; parts.push(beamGeo(at(i, y), at(j, y), 0.1)); parts.push(beamGeo(at(i, y0), at(j, y), 0.07)); parts.push(beamGeo(at(j, y0), at(i, y), 0.07)); } }
  return mergeGeometries(parts.map((g) => { g.scale(1, 1, 1); return g; }));
})();
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
/** A soft additive light dot that always faces the camera. */
export function glow(color = COL.brand, size = 6, k = 2) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: hdr(color, k), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(size); return s; }

const fanMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: U.uTime, uFog: U.uFog, uFogCol: U.uFogCol, uCol: { value: hdr(COL.brand) }, uA: { value: 0 }, uPhase: { value: 0 } },
  vertexShader: `varying vec2 vP; varying vec3 vW; void main(){ vP = position.xz; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying vec2 vP; varying vec3 vW; uniform float uTime, uA, uPhase; uniform vec3 uCol; ${FOGFN}
    void main(){ float r = length(vP); float a = pow(max(0.0, 1.0 - r), 1.6) * 0.5; float wv = pow(max(0.0, sin((r*5.0 - uTime*0.9 - uPhase)*6.2832)), 6.0) * max(0.0, 1.0 - r) * 0.9;
      float open = (1.0 - smoothstep(uA - 0.15, uA, r));       // the fan opens from the tower outwards
      gl_FragColor = vec4(uCol * (a + wv) * 1.5, 1.0) * open * step(0.001, uA) * (1.0 - fogK(vW)); }`,
});
const fanGeo = (r, a0, da) => { const g = new THREE.CircleGeometry(1, 40, a0, da); g.rotateX(-Math.PI / 2); g.scale(r, 1, r); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) / r); p.setZ(i, p.getZ(i) / r); } g.userData.r = r; return g; };

towers.forEach((t, k) => {
  const g = new THREE.Group(); g.position.copy(t.pos); scene.add(g); t.group = g;
  t.mat = new THREE.MeshBasicMaterial({ color: hdr(COL.brand, 0.9) });
  t.mesh = new THREE.Mesh(latticeGeo, t.mat); t.mesh.scale.set(1, t.h, 1); g.add(t.mesh);
  t.beacon = glow(COL.brand, 7, 3); t.beacon.position.y = t.h + 0.6; g.add(t.beacon);
  t.cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: hdr(COL.white, 3) })); t.cap.position.y = t.h + 0.6; g.add(t.cap);
  t.fan = fanMat(); t.fan.uniforms.uPhase.value = R();
  const rot = R() * 2; t.fanR = 30;
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(fanGeo(1, rot + i * 2.094 + 0.17, 1.75), t.fan); m.scale.set(t.fanR, 1, t.fanR); m.position.y = 0.25 + k * 0.01; m.renderOrder = 2; g.add(m); }
  // the pulse of the device: a ring that leaves the foot of the tower, again and again
  t.ringMat = new THREE.MeshBasicMaterial({ color: hdr(COL.brand, 2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  t.ring = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 72), t.ringMat); t.ring.rotation.x = -Math.PI / 2; t.ring.position.y = 0.4; t.ring.renderOrder = 3; g.add(t.ring);
  t.ph = R();
  // root-cause pillar
  t.pillarMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0 }, uTime: U.uTime, uCol: { value: hdr(COL.bad, 2.4) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uA, uTime; uniform vec3 uCol; void main(){ float a = pow(max(0.0, 1.0 - vUv.y), 1.3) * (0.55 + 0.45*sin(vUv.y*40.0 - uTime*6.0)); gl_FragColor = vec4(uCol * a * uA, 1.0); }`,
  });
  t.pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 150, 24, 1, true), t.pillarMat); t.pillar.position.y = 75; g.add(t.pillar);
});

// ------------------------------------------------------------------ links (tower to its parent)
export const links = [];
const linkMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: U.uTime, uFog: U.uFog, uFogCol: U.uFogCol, uCol: { value: hdr(COL.brand) }, uDraw: { value: 0 }, uCut: { value: 0 }, uFlow: { value: 1 } },
  vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime, uDraw, uCut, uFlow; uniform vec3 uCol; ${FOGFN}
    void main(){ float u = vUv.x; if (u > uDraw) discard;
      float pk = pow(max(0.0, sin((u*7.0 - uTime*1.6*uFlow)*6.2832)), 14.0);
      float dash = mix(1.0, step(0.5, fract(u*26.0)) * (0.55 + 0.45*sin(uTime*23.0 + u*40.0)), uCut);
      float du = (u-uDraw)/0.03; float head = exp(-du*du) * step(uDraw, 0.995) * 3.0;
      gl_FragColor = vec4(uCol * (0.55 + pk*3.2*(1.0-uCut) + head) * dash, 1.0) * (1.0 - fogK(vW)); }`,
});
towers.forEach((t) => {
  const a = node(t.parent).top.clone(), b = t.top.clone().setY(t.h + 0.6), mid = a.clone().lerp(b, 0.5); mid.y += 7 + a.distanceTo(b) * 0.07;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const m = linkMat(); const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.2, 6), m); mesh.renderOrder = 4; mesh.frustumCulled = false; scene.add(mesh);
  t.linkMat = m; t.curve = curve; links.push({ from: t.parent, to: t.id, curve, mat: m });
});

// ------------------------------------------------------------------ subscribers: a point on a roof and a thread to its tower
export const SUBS = [];
{
  const per = 136, N = towers.length * per; const pos = new Float32Array(N * 3), aT = new Float32Array(N), aR = new Float32Array(N), lp = new Float32Array(N * 6), lT = new Float32Array(N * 2), lR = new Float32Array(N * 2), lE = new Float32Array(N * 2);
  let i = 0;
  for (const t of towers) for (let k = 0; k < per; k++, i++) {
    const a = R() * Math.PI * 2, r = 5 + Math.sqrt(R()) * 26, x = t.pos.x + Math.cos(a) * r, z = t.pos.z + Math.sin(a) * r, y = 1.2 + R() * 5.5, rr = R();
    pos.set([x, y, z], i * 3); aT[i] = t.id; aR[i] = rr; SUBS.push({ tower: t.id, x, y, z });
    lp.set([x, y, z, t.pos.x, t.h + 0.4, t.pos.z], i * 6); lT[i * 2] = lT[i * 2 + 1] = t.id; lR[i * 2] = lR[i * 2 + 1] = rr; lE[i * 2] = 0; lE[i * 2 + 1] = 1;
  }
  const COLFN = `uniform float uOn[${NT}], uRed[${NT}], uBehind[${NT}]; uniform float uTime;
    vec3 subCol(float T, float r, out float on){ int i = int(T + 0.5); on = smoothstep(r - 0.04, r + 0.04, uOn[i]*1.08);
      vec3 c = vec3(0.25, 1.0, 0.82); c = mix(c, vec3(1.0, 0.22, 0.28), clamp(uRed[i]*1.2 - r*0.2, 0.0, 1.0)); c = mix(c, vec3(0.42, 0.2, 0.26), uBehind[i]); return c; }`;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); g.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, uSize: { value: 1 } },
    vertexShader: `attribute float aT, aR; varying vec3 vC; varying float vA; uniform float uSize; ${COLFN} ${FOGFN}
      void main(){ float on; vC = subCol(aT, aR, on); vec4 mv = modelViewMatrix * vec4(position,1.0);
        float tw = 0.7 + 0.3*sin(uTime*2.0 + aR*60.0); vA = on * tw * (1.0 - fogK(position));
        gl_PointSize = uSize * (2.0 + aR*2.0) * 210.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = 1.0 - smoothstep(0.05, 0.5, d); gl_FragColor = vec4(vC*2.6*a*vA, 1.0); }`,
  });
  const points = new THREE.Points(g, pm); points.frustumCulled = false; points.renderOrder = 6; scene.add(points);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aT', new THREE.BufferAttribute(lT, 1)); lg.setAttribute('aR', new THREE.BufferAttribute(lR, 1)); lg.setAttribute('aE', new THREE.BufferAttribute(lE, 1));
  const lm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, uA: { value: 0.16 } },
    vertexShader: `attribute float aT, aR, aE; varying vec3 vC; varying float vA; ${COLFN} ${FOGFN}
      void main(){ float on; vC = subCol(aT, aR, on); vA = on * (0.25 + 0.75*aE) * (1.0 - fogK(position)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vC; varying float vA; uniform float uA; void main(){ gl_FragColor = vec4(vC * vA * uA, 1.0); }`,
  });
  const lines = new THREE.LineSegments(lg, lm); lines.frustumCulled = false; lines.renderOrder = 5; scene.add(lines);
  /** subs.s.size: dot size, subs.s.threads: brightness of the threads to the towers */
  env.subs = { s: { size: 1, threads: 0.16 } };
  onFrame(() => { pm.uniforms.uSize.value = env.subs.s.size; lm.uniforms.uA.value = env.subs.s.threads; });
}
export const subs = env.subs;

// ------------------------------------------------------------------ the core: server, router, standby server
{
  const g = new THREE.Group(); scene.add(g); core.group = g;
  const box = (w, h, d, x, z) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0x070b13 })); body.position.y = h / 2; grp.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: hdr(COL.brand, 1.6) })); edges.position.y = h / 2; grp.add(edges);
    const led = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uP: { value: 1 }, uCol: { value: hdr(COL.brand, 2.2) }, uRows: { value: Math.round(h * 1.6) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime, uP, uRows; uniform vec3 uCol; ${HASH}
        void main(){ float row = floor(vUv.y*uRows); float fy = fract(vUv.y*uRows); float slit = step(0.3, fy)*step(fy, 0.62) * step(0.1, vUv.x)*step(vUv.x, 0.9);
          float cell = floor(vUv.x*14.0); float blink = step(0.35, hash(vec2(cell, row) + floor(uTime*(2.0+hash(vec2(row,1.0))*5.0))));
          float dot = step(0.25, fract(vUv.x*14.0))*step(fract(vUv.x*14.0), 0.7);
          gl_FragColor = vec4(uCol * slit * dot * (0.25 + 0.75*blink) * uP, 1.0); }`,
    });
    const f1 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.9), led); f1.position.set(0, h / 2, d / 2 + 0.03); grp.add(f1);
    const f2 = f1.clone(); f2.rotation.y = Math.PI / 2; f2.position.set(w / 2 + 0.03, h / 2, 0); f2.scale.x = d / w; grp.add(f2);
    const f3 = f1.clone(); f3.rotation.y = -Math.PI / 2; f3.position.set(-w / 2 - 0.03, h / 2, 0); f3.scale.x = d / w; grp.add(f3);
    const f4 = f1.clone(); f4.rotation.y = Math.PI; f4.position.set(0, h / 2, -d / 2 - 0.03); grp.add(f4);
    const halo = glow(COL.brand, h * 2.6, 1.1); halo.position.y = h * 0.6; grp.add(halo);
    g.add(grp); return { grp, led, edges, halo, body };
  };
  core.server = box(6, 12, 6, 0, 0);
  core.router = box(7, 1.8, 4.4, 10.5, 5);
  core.standbyBox = box(5, 10, 5, -11.5, 4.5);
  const pad = new THREE.Mesh(new THREE.RingGeometry(11.5, 12, 96), new THREE.MeshBasicMaterial({ color: hdr(COL.brand, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.3; g.add(pad); core.pad = pad;
  onFrame(() => {
    const p = core.s.power, k = smooth(0, 40, U.uReveal.value) * core.s.glow; g.visible = U.uReveal.value > 4; g.scale.set(1, Math.max(0.001, smooth(4, 70, U.uReveal.value)), 1);
    core.server.led.uniforms.uP.value = p * k; core.server.edges.material.color.copy(hdr(COL.brand, 0.25 + 1.5 * p * k)); core.server.halo.material.opacity = 0.9 * p * k;
    core.router.led.uniforms.uP.value = k; core.router.edges.material.color.copy(hdr(COL.brand, 1.6 * k)); core.router.halo.material.opacity = 0.5 * k;
    const sb = core.s.standby; core.standbyBox.grp.visible = sb > 0.001; core.standbyBox.grp.scale.set(1, Math.max(0.001, sb), 1);
    core.standbyBox.led.uniforms.uP.value = sb; core.standbyBox.led.uniforms.uCol.value.copy(hdr(COL.ok, 2.2)); core.standbyBox.edges.material.color.copy(hdr(COL.ok, 1.6 * sb)); core.standbyBox.halo.material.color.copy(hdr(COL.ok, 1.1)); core.standbyBox.halo.material.opacity = 0.9 * sb;
    pad.material.opacity = 0.8 * k; U.uHood.value[0] = k;
  });
}

// ------------------------------------------------------------------ towers follow their numbers
const cBrand = new THREE.Color(COL.brand), cBad = new THREE.Color(COL.bad), cDim = new THREE.Color(0x5a2630), cHot = new THREE.Color(COL.warn), tmp = new THREE.Color();
onFrame((t) => {
  U.uReveal.value = env.s.reveal;
  for (const T of towers) {
    const s = T.s, on = clamp(s.on);
    T.group.visible = on > 0.001;
    const e = on < 1 ? 1 - Math.pow(1 - on, 3) : 1;                              // rises
    T.mesh.scale.set(0.6 + 0.4 * e, Math.max(0.001, T.h * e), 0.6 + 0.4 * e); T.beacon.position.y = T.cap.position.y = T.h * e + 0.6;
    tmp.copy(cBrand).lerp(cHot, clamp(s.hot)).lerp(cBad, clamp(s.red)).lerp(cDim, clamp(s.behind));
    const live = 1 - 0.55 * clamp(s.behind);
    T.mat.color.copy(tmp).multiplyScalar(0.95 * live);
    const blink = s.red > 0.5 ? 0.55 + 0.45 * Math.sin(t * 9) : 1;
    T.beacon.material.color.copy(tmp).multiplyScalar(3.2 * live * blink); T.beacon.scale.setScalar(on * (7 + 1.2 * Math.sin(t * 2.4 + T.ph * 9)));
    T.cap.material.color.copy(tmp).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(3 * live * blink); T.cap.scale.setScalar(on);
    T.fan.uniforms.uCol.value.copy(tmp).multiplyScalar(live); T.fan.uniforms.uA.value = clamp(s.fans) * 1.15;
    const ph = (t / 2.4 + T.ph) % 1; T.ring.scale.setScalar(2 + ph * 34); T.ringMat.opacity = clamp(s.pulse) * (1 - ph) * 0.75 * live; T.ringMat.color.copy(tmp).multiplyScalar(2.2);
    T.pillarMat.uniforms.uA.value = clamp(s.root);
    T.linkMat.uniforms.uDraw.value = clamp(s.link) * 1.001; T.linkMat.uniforms.uCol.value.copy(tmp).multiplyScalar(1.5 * live); T.linkMat.uniforms.uCut.value = clamp(Math.max(s.red, s.behind));
    U.uOn.value[T.id] = clamp(s.subs); U.uRed.value[T.id] = clamp(s.red); U.uBehind.value[T.id] = clamp(s.behind); U.uHood.value[T.id] = clamp(s.hood) * (1 - 0.6 * env.s.night);
  }
});

// ------------------------------------------------------------------ dust: a field of light specks; it stretches into streaks when the camera travels
export const fx = { s: { warp: 0, dust: 0.5 }, dir: new THREE.Vector3(0, 0, -1) };
{
  const N = 1100, p = new Float32Array(N * 6), sd = new Float32Array(N * 2), rr = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { const x = R() * 400, y = R() * 120, z = R() * 400, r = R(); p.set([x, y, z, x, y, z], i * 6); sd[i * 2] = 0; sd[i * 2 + 1] = 1; rr[i * 2] = rr[i * 2 + 1] = r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sd, 1)); g.setAttribute('aR', new THREE.BufferAttribute(rr, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCam: { value: new THREE.Vector3() }, uDir: { value: fx.dir }, uWarp: { value: 0 }, uA: { value: 0.5 } },
    vertexShader: `attribute float aS, aR; uniform vec3 uCam, uDir; uniform float uWarp; varying float vA;
      void main(){ vec3 sz = vec3(400.0, 120.0, 400.0); vec3 q = mod(position - uCam + sz*0.5, sz) - sz*0.5 + uCam; q.y = mod(position.y, 120.0) + 1.0;
        q += uDir * aS * (0.35 + uWarp * (10.0 + aR*26.0)); vA = (0.3 + 0.7*aR) * (1.0 - aS*0.7); gl_Position = projectionMatrix * viewMatrix * vec4(q,1.0); }`,
    fragmentShader: `varying float vA; uniform float uA, uWarp; void main(){ gl_FragColor = vec4(vec3(0.5,1.0,0.95) * vA * uA * (0.5 + uWarp*1.6), 1.0); }`,
  });
  const dust = new THREE.LineSegments(g, m); dust.frustumCulled = false; dust.renderOrder = 7; scene.add(dust);
  onFrame(() => { m.uniforms.uCam.value.copy(camera.position); m.uniforms.uWarp.value = fx.s.warp; m.uniforms.uA.value = fx.s.dust; });
}

// ------------------------------------------------------------------ one-off rings: burst(t0, position, {...}) — declared once, computed from the clock
const bursts = [];
/** A ring of light that opens on the ground (or facing the camera with flat:false) at time t0. */
export function burst(t0, pos, { color = COL.brand, r = 40, dur = 1.2, k = 2.5, y = 0.5, width = 0.04 } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: hdr(color, k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 96), m); mesh.rotation.x = -Math.PI / 2; mesh.position.set(pos.x, y, pos.z); mesh.visible = false; mesh.renderOrder = 8; scene.add(mesh);
  bursts.push({ t0, dur, r, mesh, m }); return mesh;
}
onFrame((t) => { for (const b of bursts) { const k = (t - b.t0) / b.dur; b.mesh.visible = k > 0 && k < 1; if (b.mesh.visible) { const e = 1 - Math.pow(1 - k, 3); b.mesh.scale.setScalar(1 + e * b.r); b.m.opacity = (1 - k) * 0.9; } } });

// ------------------------------------------------------------------ camera rig
/** rig: the camera. p* = where it is, l* = what it looks at, fov, roll (radians), drift (hand-held life, 0..1) */
export const rig = { px: 0, py: 420, pz: 30, lx: 0, ly: 0, lz: 0, fov: 38, roll: 0, drift: 1 };
const look = new THREE.Vector3();
onFrame((t) => {
  const d = rig.drift; camera.fov = rig.fov; camera.updateProjectionMatrix();
  camera.position.set(rig.px + d * 0.9 * Math.sin(t * 0.37), rig.py + d * 0.6 * Math.sin(t * 0.29 + 1.3), rig.pz + d * 0.9 * Math.cos(t * 0.33));
  look.set(rig.lx + d * 0.4 * Math.sin(t * 0.41 + 2), rig.ly, rig.lz + d * 0.4 * Math.cos(t * 0.31)); camera.up.set(0, 1, 0); camera.lookAt(look); camera.rotateZ(rig.roll); camera.updateMatrixWorld();
});
/** Where a point of the world lands on the 1920x1080 picture: { x, y, z (depth: > 1 is behind the camera), vis } */
const pv = new THREE.Vector3();
export function project(v) { pv.copy(v).project(camera); return { x: (pv.x * 0.5 + 0.5) * W, y: (-pv.y * 0.5 + 0.5) * H, z: pv.z, vis: pv.z < 1 && pv.x > -1.2 && pv.x < 1.2 && pv.y > -1.2 && pv.y < 1.2 }; }

// ------------------------------------------------------------------ post: bloom, then the look
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: Q.samples ?? 4 });
export const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.85, 0.7, 0.92); composer.addPass(bloom);
/** post.s: flash (white, 0..1), red (alarm tint), dark (0..1 towards black), aber (colour fringe), vig (vignette) */
export const post = { s: { flash: 0, red: 0, dark: 0, aber: 0.6, vig: 1, bloom: 0.85 } };
const look2 = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uRed: { value: 0 }, uDark: { value: 0 }, uAber: { value: 0.6 }, uVig: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime, uFlash, uRed, uDark, uAber, uVig; ${HASH}
    void main(){ vec2 c = vUv - 0.5; float r2 = dot(c, c); vec2 off = c * r2 * 0.012 * uAber;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1.0, (1.0 - smoothstep(0.15, 0.95, r2*1.9)), 0.75*uVig);
      col = mix(col, col*vec3(1.35,0.5,0.55) + vec3(0.10,0.0,0.01)*(0.6+0.4*sin(uTime*7.0)), uRed);
      col *= 1.0 - uDark; col += vec3(0.72, 1.0, 0.94) * uFlash * exp(-r2*14.0) * 1.1;      // a flash is a bloom from the middle of the picture, never a flat white page
      col += (hash(gl_FragCoord.xy + fract(uTime)*91.7) - 0.5) * 0.012;
      gl_FragColor = vec4(col, 1.0); }`,
});
composer.addPass(look2); composer.addPass(new OutputPass());
export function render(t) {
  U.uTime.value = t; const u = look2.uniforms, s = post.s; u.uTime.value = t; u.uFlash.value = s.flash; u.uRed.value = s.red; u.uDark.value = s.dark; u.uAber.value = s.aber; u.uVig.value = s.vig; bloom.strength = s.bloom;
  composer.render();
}

/** The picture's size in real pixels (width, height already multiplied by the pixel ratio). */
export function setSize(w, h) {
  W = Math.max(2, Math.round(w)); H = Math.max(2, Math.round(h));
  renderer.setSize(W, H, false); composer.setSize(W, H);
  camera.aspect = W / H; camera.updateProjectionMatrix();
}
export const size = () => ({ W, H });
/** One frame at time t (seconds): every onFrame function, then the picture. */
export function tick(t) { for (const f of frame) f(t); render(t); }
