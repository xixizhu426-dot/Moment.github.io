// === 画布基础设置 ===
const canvas = document.getElementById("space");
const ctx = canvas.getContext("2d");

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// === 相机参数（空间感明显一点，但不要过头） ===
let yaw = 0.4;
let pitch = 0.18;
let cameraDist = 5.2;

let targetYaw = yaw;
let targetPitch = pitch;
let targetCameraDist = cameraDist;

const MIN_PITCH = -0.7;
const MAX_PITCH = 0.7;
const MIN_DIST = 3.0;   // 最近视角
const MAX_DIST = 9.0;   // 最远视角

// === 交互状态 ===
let isDragging = false;
let lastX = 0;
let lastY = 0;
let hasMovedCamera = false;

// === 星空数据 ===
const STAR_COUNT = 900;
const stars = [];

(function initStars() {
  // 一整圈球壳上的星星，半径约 25-34，围绕中心行星系统
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 25 + Math.random() * 9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const baseBrightness = 0.4 + Math.random() * 0.6;
    stars.push({ x, y, z, baseBrightness });
  }
})();

// === 轨道与行星 ===
const baseOrbits = [
  { radius: 1.0, tiltX: 0.05, tiltZ: 0.02 },
  { radius: 1.6, tiltX: -0.08, tiltZ: 0.04 },
  { radius: 2.3, tiltX: 0.11, tiltZ: -0.07 },
  { radius: 3.1, tiltX: -0.18, tiltZ: 0.12 }
];

// 轨道最终“目标形态”的偏移量（非常轻微）
const orbitDeltas = [
  { tiltX: 0.22, tiltZ: -0.3, radius: 0.28 },
  { tiltX: -0.28, tiltZ: 0.26, radius: -0.2 },
  { tiltX: 0.32, tiltZ: 0.18, radius: 0.35 },
  { tiltX: -0.42, tiltZ: -0.16, radius: -0.32 }
];

const planets = [
  { orbitIndex: 0, phase: 0.1, color: "#ffd27b", size: 0.052 },
  { orbitIndex: 1, phase: 1.4, color: "#f6f2ff", size: 0.048 },
  { orbitIndex: 2, phase: 2.35, color: "#7fd4ff", size: 0.045 },
  { orbitIndex: 3, phase: 3.8, color: "#ff9fd0", size: 0.04 }
];

// === 时间流逝进度（0～1） ===
const PROGRESS_KEY = "blink_orbit_progress_v2";
let changeProgress = 0;
const MAX_PROGRESS = 1;

function loadProgress() {
  const v = parseFloat(localStorage.getItem(PROGRESS_KEY));
  if (!Number.isNaN(v)) {
    changeProgress = Math.min(Math.max(v, 0), MAX_PROGRESS);
  }
}
function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, String(changeProgress));
}
loadProgress();

// 每次交互/回来页面增加一点点（非常小）
function recordInteraction(step) {
  const before = changeProgress;
  changeProgress = Math.min(MAX_PROGRESS, changeProgress + step);
  if (changeProgress !== before) saveProgress();
}

// 上一代 progress，用来画对比轨道
let lastProgressForDelta = changeProgress;
let showDeltaOverlay = false;
let deltaEndTime = 0;

// === Before / Now 截图面板 ===
let appStarted = false;
let startTime = 0;
let baselineCaptured = false;
let baselineImageUrl = null;

const comparePanel = document.getElementById("compare-panel");
const imgBefore = document.getElementById("img-before");
const imgNow = document.getElementById("img-now");
const closeCompare = document.getElementById("close-compare");
let compareHideTimeout = null;

// === UI元素 ===
const enterBtn = document.getElementById("enter-btn");
const resetBtn = document.getElementById("reset-btn");
const hint = document.getElementById("hint");
const bgm = document.getElementById("bgm");

// 进入时间
enterBtn.addEventListener("click", () => {
  document.body.classList.add("started");
  enterBtn.classList.add("hidden");
  resetBtn.classList.remove("hidden");
  if (hint) hint.classList.remove("hidden");

  appStarted = true;
  startTime = performance.now();

  if (bgm) {
    bgm.volume = 0.45;
    bgm.play().catch(() => {});
  }
});

// === 相机交互 ===
function onPointerDown(e) {
  if (!appStarted) return;
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  document.body.classList.add("dragging");
}
function onPointerMove(e) {
  if (!appStarted || !isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  const speed = 0.0035;
  targetYaw += dx * speed;
  targetPitch += dy * speed;
  targetPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, targetPitch));
  hasMovedCamera = true;

  recordInteraction(0.0007);
}
function onPointerUp() {
  isDragging = false;
  document.body.classList.remove("dragging");
}

canvas.addEventListener("mousedown", onPointerDown);
window.addEventListener("mousemove", onPointerMove);
window.addEventListener("mouseup", onPointerUp);

canvas.addEventListener(
  "touchstart",
  e => {
    if (!appStarted) return;
    const t = e.touches[0];
    onPointerDown({ clientX: t.clientX, clientY: t.clientY });
  },
  { passive: true }
);
window.addEventListener(
  "touchmove",
  e => {
    if (!appStarted || !isDragging) return;
    const t = e.touches[0];
    onPointerMove({ clientX: t.clientX, clientY: t.clientY });
  },
  { passive: true }
);
window.addEventListener(
  "touchend",
  () => {
    onPointerUp();
  },
  { passive: true }
);

// 滚轮缩放（空间感更明显）
canvas.addEventListener(
  "wheel",
  e => {
    if (!appStarted) return;
    e.preventDefault();
    const delta = e.deltaY;
    const zoomSpeed = 0.0018;
    targetCameraDist += delta * zoomSpeed;
    targetCameraDist = Math.max(
      MIN_DIST,
      Math.min(MAX_DIST, targetCameraDist)
    );
    hasMovedCamera = true;
    recordInteraction(0.0009);
  },
  { passive: false }
);

// 页面回来也偷偷前进一步
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && appStarted) {
    recordInteraction(0.0015);
  }
});

// === 截图：只在进入后的一小段时间里截一次 baseline ===
function captureBaselineOnce() {
  if (!appStarted || baselineCaptured) return;
  baselineImageUrl = canvas.toDataURL("image/jpeg", 0.9);
  if (imgBefore && !imgBefore.src) imgBefore.src = baselineImageUrl;
  baselineCaptured = true;
}

// 回到初始视角 + 对比
resetBtn.addEventListener("click", () => {
  if (!appStarted) return;

  // 相机重置
  targetYaw = 0.4;
  targetPitch = 0.18;
  targetCameraDist = 5.2;

  // 记录当前 progress，显示上一代轨道
  lastProgressForDelta = changeProgress;
  showDeltaOverlay = true;
  deltaEndTime = performance.now() + 5000;

  // 更新 Now 图
  if (!baselineCaptured) captureBaselineOnce();
  if (imgBefore && baselineImageUrl && !imgBefore.src) {
    imgBefore.src = baselineImageUrl;
  }
  if (imgNow) {
    imgNow.src = canvas.toDataURL("image/jpeg", 0.9);
  }

  if (comparePanel) {
    comparePanel.classList.remove("hidden");
    if (compareHideTimeout) clearTimeout(compareHideTimeout);
    compareHideTimeout = setTimeout(() => {
      comparePanel.classList.add("hidden");
    }, 6000);
  }
});

// 关闭对比面板
if (closeCompare) {
  closeCompare.addEventListener("click", () => {
    comparePanel.classList.add("hidden");
    if (compareHideTimeout) clearTimeout(compareHideTimeout);
  });
}

// === 3D 工具 ===
function rotateY(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
}
function rotateX(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function project(x, y, z) {
  const cx = 0;
  const cy = 0;
  const cz = cameraDist;

  let vx = x - cx;
  let vy = y - cy;
  let vz = z - cz;

  let v = { x: vx, y: vy, z: vz };
  v = rotateX(v, -pitch);
  v = rotateY(v, -yaw);

  const perspective = 1.2; // 比之前稍小：更有远近感
  const scale = perspective / (perspective + v.z);
  const sx = v.x * scale;
  const sy = v.y * scale;

  return { x: sx, y: sy, scale, behind: v.z < -perspective + 0.05 };
}

// 当前 progress 下的轨道参数
function getOrbitParams(index, progress) {
  const base = baseOrbits[index];
  const delta = orbitDeltas[index];
  const eased = Math.pow(progress, 1.4);
  return {
    radius: base.radius + delta.radius * eased,
    tiltX: base.tiltX + delta.tiltX * eased,
    tiltZ: base.tiltZ + delta.tiltZ * eased
  };
}

// === 主绘制循环 ===
const enterBtnEl = document.getElementById("enter-btn");

function draw() {
  requestAnimationFrame(draw);
  const now = performance.now();

  if (hasMovedCamera && hint && !hint.classList.contains("hidden")) {
    hint.classList.add("hidden");
  }

  if (appStarted && !baselineCaptured && now - startTime > 1500) {
    captureBaselineOnce();
  }

  if (showDeltaOverlay && now > deltaEndTime) {
    showDeltaOverlay = false;
  }

  // 相机缓动
  const lerp = 0.07;
  yaw += (targetYaw - yaw) * lerp;
  pitch += (targetPitch - pitch) * lerp;
  cameraDist += (targetCameraDist - cameraDist) * lerp;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // 背景渐变：深蓝宇宙
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.18,
    0,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.85
  );
  const shift = changeProgress * 0.15;
  g.addColorStop(0, `rgba(${10 + shift * 60}, ${18 + shift * 40}, 60, 1)`);
  g.addColorStop(0.55, "rgba(3, 6, 20, 1)");
  g.addColorStop(1, "rgba(0, 0, 0, 1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w / 2, h / 2);

  // 星空：小圆点，绝不大方块
  ctx.save();
  for (const s of stars) {
    const p = project(s.x, s.y, s.z);
    if (p.behind) continue;
    const r = Math.min(1.4, 0.35 + p.scale * 0.5);
    const alpha =
      s.baseBrightness * (0.3 + p.scale * 0.8) * (0.7 + changeProgress * 0.3);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 中心恒星
  const starProj = project(0, 0, 0);
  if (!starProj.behind) {
    const coreR = 11 * starProj.scale;
    const haloR = coreR * 2.6;
    const gradient = ctx.createRadialGradient(
      starProj.x,
      starProj.y,
      0,
      starProj.x,
      starProj.y,
      haloR
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,240,210,0.9)");
    gradient.addColorStop(1, "rgba(255,180,120,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(starProj.x, starProj.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(starProj.x, starProj.y, coreR, 0, Math.PI * 2);
    ctx.fill();
  }

  const t = now * 0.00006;

  // 工具：画一套轨道
  function drawOrbitSet(progress, color, lineWidth, dashed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (dashed) ctx.setLineDash([4, 5]);

    for (let i = 0; i < baseOrbits.length; i++) {
      const op = getOrbitParams(i, progress);
      const radius = op.radius;
      const steps = 140;

      ctx.beginPath();
      for (let j = 0; j <= steps; j++) {
        const ang = (j / steps) * Math.PI * 2;
        let vx = radius * Math.cos(ang);
        let vy = radius * Math.sin(ang);
        let vz = 0;

        let v = { x: vx, y: vy, z: vz };
        v = rotateX(v, op.tiltX);
        v = rotateY(v, op.tiltZ);

        const p = project(v.x, v.y, v.z);
        if (p.behind) continue;
        if (j === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // 上一代轨道（淡蓝虚线）
  if (showDeltaOverlay) {
    const fade =
      deltaEndTime > now
        ? Math.max(0, Math.min(1, (deltaEndTime - now) / 5000))
        : 0;
    if (fade > 0) {
      const alpha = 0.65 * fade;
      drawOrbitSet(
        lastProgressForDelta,
        `rgba(160,200,255,${alpha})`,
        0.9,
        true
      );
    }
  }

  // 当前轨道（实线）
  drawOrbitSet(changeProgress, "rgba(255,255,255,0.34)", 1, false);

  // 行星
  for (const pl of planets) {
    const op = getOrbitParams(pl.orbitIndex, changeProgress);
    const radius = op.radius;
    const speed = 0.24 + pl.orbitIndex * 0.07;
    const angle = pl.phase + t * speed;

    let vx = radius * Math.cos(angle);
    let vy = radius * Math.sin(angle) * 0.98;
    let vz = 0;

    let v = { x: vx, y: vy, z: vz };
    v = rotateX(v, op.tiltX);
    v = rotateY(v, op.tiltZ);

    const p = project(v.x, v.y, v.z);
    if (p.behind) continue;

    const baseR = pl.size * (22 + 34 * p.scale);
    const haloR = baseR * 2.2;

    const gp = ctx.createRadialGradient(
      p.x,
      p.y,
      0,
      p.x,
      p.y,
      haloR
    );
    gp.addColorStop(0, "rgba(255,255,255,0.98)");
    gp.addColorStop(0.3, pl.color + "ee");
    gp.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gp;
    ctx.beginPath();
    ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pl.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

draw();
