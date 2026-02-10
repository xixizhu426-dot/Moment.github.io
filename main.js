// === 基本元素 & 画布设置 ===
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

// === 相机参数 ===
let yaw = 0.4;
let pitch = 0.18;
let cameraDist = 4.2;

let targetYaw = yaw;
let targetPitch = pitch;
let targetCameraDist = cameraDist;

// 限制 pitch 与距离
const MIN_PITCH = -0.7;
const MAX_PITCH = 0.7;
const MIN_DIST = 2.6;
const MAX_DIST = 7.5;

// === 交互状态 ===
let isDragging = false;
let lastX = 0;
let lastY = 0;
let hasMovedCamera = false;

// === 星空 & 轨道数据 ===
const STAR_COUNT = 900;
const stars = [];

// 生成 3D 星空（一个大球壳）
(function initStars() {
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 22 + Math.random() * 9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const baseBrightness = 0.4 + Math.random() * 0.6;
    stars.push({ x, y, z, baseBrightness });
  }
})();

// 行星轨道基础参数
const baseOrbits = [
  { radius: 0.8, tiltX: 0.05, tiltZ: 0.02 },
  { radius: 1.3, tiltX: -0.08, tiltZ: 0.04 },
  { radius: 1.8, tiltX: 0.11, tiltZ: -0.07 },
  { radius: 2.45, tiltX: -0.18, tiltZ: 0.12 }
];

// 每条轨道对应的「目标演化方向」
const orbitDeltas = [
  { tiltX: 0.28, tiltZ: -0.4, radius: 0.25 },
  { tiltX: -0.36, tiltZ: 0.3, radius: -0.18 },
  { tiltX: 0.42, tiltZ: 0.22, radius: 0.34 },
  { tiltX: -0.52, tiltZ: -0.18, radius: -0.3 }
];

// 行星
const planets = [
  { orbitIndex: 0, phase: 0.1, color: "#ffd27b", size: 0.045 },
  { orbitIndex: 1, phase: 1.4, color: "#f6f2ff", size: 0.04 },
  { orbitIndex: 2, phase: 2.35, color: "#7fd4ff", size: 0.038 },
  { orbitIndex: 3, phase: 3.8, color: "#ff9fd0", size: 0.032 }
];

// === 变化状态（时间流逝） ===
const PROGRESS_KEY = "blink_orbit_progress_v1";
let changeProgress = 0; // 0～1
const MIN_STEP = 0.00045; // 每次交互增加量
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

// 上一版本的 progress，用于画对比轨迹
let lastProgressForDelta = changeProgress;
let showDeltaOverlay = false;
let deltaEndTime = 0;

// === Before / Now 对比截图状态 ===
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

// ---- 交互：进入时间 ----
enterBtn.addEventListener("click", () => {
  document.body.classList.add("started");
  enterBtn.classList.add("hidden");
  resetBtn.classList.remove("hidden");
  if (hint) hint.classList.remove("hidden");

  appStarted = true;
  startTime = performance.now();

  if (bgm) {
    bgm.volume = 0.5;
    bgm.play().catch(() => {});
  }
});

// ---- 交互：相机旋转与缩放 ----
function recordInteraction(amount = MIN_STEP) {
  const before = changeProgress;
  changeProgress = Math.min(MAX_PROGRESS, changeProgress + amount);
  if (changeProgress !== before) {
    saveProgress();
  }
}

// 鼠标或触控拖拽旋转
function onPointerDown(e) {
  if (!appStarted) return;
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  document.body.classList.add("dragging");
}
function onPointerMove(e) {
  if (!appStarted) return;
  if (!isDragging) return;
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

// 触摸支持
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

// 滚轮缩放
canvas.addEventListener(
  "wheel",
  e => {
    if (!appStarted) return;
    e.preventDefault();
    const delta = e.deltaY;
    const zoomSpeed = 0.0015;
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

// 页面可见性变化也算一次“时间流逝”
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && appStarted) {
    recordInteraction(0.0015);
  }
});

// ---- 截图：只在刚进入时截一张 Before ----
function captureBaselineOnce() {
  if (!appStarted || baselineCaptured) return;
  const url = canvas.toDataURL("image/jpeg", 0.9);
  baselineImageUrl = url;
  if (imgBefore && !imgBefore.src) imgBefore.src = url;
  baselineCaptured = true;
}

// ---- 回到初始视角 & Before/Now 对比 ----
resetBtn.addEventListener("click", () => {
  if (!appStarted) return;

  // 相机回到初始视角（稍微远一点，更像观测者）
  targetYaw = 0.4;
  targetPitch = 0.18;
  targetCameraDist = 4.2;

  // 记录当前 progress，并启用“上一代轨迹”叠加
  lastProgressForDelta = changeProgress;
  showDeltaOverlay = true;
  deltaEndTime = performance.now() + 5000;

  // 截 Now，并显示 Before/Now 面板
  if (baselineImageUrl && imgBefore && !imgBefore.src) {
    imgBefore.src = baselineImageUrl;
  }
  if (imgNow) {
    const nowUrl = canvas.toDataURL("image/jpeg", 0.9);
    imgNow.src = nowUrl;
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

// === 3D 工具函数 ===
function rotateY(v, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.z * sin,
    y: v.y,
    z: v.x * sin + v.z * cos
  };
}
function rotateX(v, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x,
    y: v.y * cos - v.z * sin,
    z: v.y * sin + v.z * cos
  };
}

// 将世界坐标投影到屏幕
function project(x, y, z) {
  const cx = 0;
  const cy = 0;
  const cz = cameraDist;

  // 先移到以相机为原点
  let vx = x - cx;
  let vy = y - cy;
  let vz = z - cz;

  // 旋转（与其说旋转相机，不如说反向旋转世界）
  let v = { x: vx, y: vy, z: vz };
  v = rotateX(v, -pitch);
  v = rotateY(v, -yaw);

  const perspective = 1.8; // 越大越近感更强
  const scale = perspective / (perspective + v.z);
  const sx = v.x * scale;
  const sy = v.y * scale;

  return { x: sx, y: sy, scale, behind: v.z < -perspective + 0.05 };
}

// === 基于 progress 计算轨道参数 ===
function getOrbitParams(index, progress) {
  const base = baseOrbits[index];
  const delta = orbitDeltas[index];

  // 使用缓动曲线，让变化前期更轻微，后期才明显
  const eased = Math.pow(progress, 1.4);
  return {
    radius: base.radius + delta.radius * eased,
    tiltX: base.tiltX + delta.tiltX * eased,
    tiltZ: base.tiltZ + delta.tiltZ * eased
  };
}

// === 绘制 ===
function draw() {
  requestAnimationFrame(draw);

  const now = performance.now();

  // 拖拽后，把提示慢慢淡出
  if (hasMovedCamera && hint && !hint.classList.contains("hidden")) {
    hint.classList.add("hidden");
  }

  // 刚进入之后延迟 1.5 秒截一张堪称“初始画面”的截图
  if (appStarted && !baselineCaptured) {
    if (now - startTime > 1500) {
      captureBaselineOnce();
    }
  }

  // Delta overlay 到期自动关闭
  if (showDeltaOverlay && now > deltaEndTime) {
    showDeltaOverlay = false;
  }

  // 相机插值
  const lerp = 0.06;
  yaw += (targetYaw - yaw) * lerp;
  pitch += (targetPitch - pitch) * lerp;
  cameraDist += (targetCameraDist - cameraDist) * lerp;

  // 清屏
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // 背景渐变（轻微随 progress 变冷一点）
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.18,
    0,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.75
  );
  const colorShift = changeProgress * 0.14;
  g.addColorStop(0, `rgba(${12 + colorShift * 80}, ${18 + colorShift * 50}, 45, 1)`);
  g.addColorStop(0.5, "rgba(5, 7, 20, 1)");
  g.addColorStop(1, "rgba(0, 0, 0, 1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w / 2, h / 2);

  // 画星空
  ctx.save();
  for (const s of stars) {
    const p = project(s.x, s.y, s.z);
    if (p.behind) continue;
    const size = 0.7 + p.scale * 1.1;
    const alpha =
      s.baseBrightness * (0.35 + p.scale * 0.9) * (0.7 + changeProgress * 0.3);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(p.x, p.y, size, size);
  }
  ctx.restore();

  // 时间参数：行星运动
  const t = now * 0.00006;

  // 中心恒星
  const starProj = project(0, 0, 0);
  if (!starProj.behind) {
    const coreR = 13 * starProj.scale;
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
    gradient.addColorStop(0.35, "rgba(255,240,210,0.85)");
    gradient.addColorStop(1, "rgba(255,180,120,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(starProj.x, starProj.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(starProj.x, starProj.y, coreR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 工具：画一套轨道
  function drawOrbitSet(progress, color, lineWidth, dashed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (dashed) {
      ctx.setLineDash([3, 4]);
    }

    for (let i = 0; i < baseOrbits.length; i++) {
      const p = getOrbitParams(i, progress);
      const radius = p.radius;

      // 在轨道平面内采样一圈
      const steps = 120;
      ctx.beginPath();
      for (let j = 0; j <= steps; j++) {
        const ang = (j / steps) * Math.PI * 2;
        // 初始为 XY 平面上的圆
        let vx = radius * Math.cos(ang);
        let vy = radius * Math.sin(ang);
        let vz = 0;

        // 对圆施加倾角旋转
        let v = { x: vx, y: vy, z: vz };
        v = rotateX(v, p.tiltX);
        v = rotateY(v, p.tiltZ);

        const proj = project(v.x, v.y, v.z);
        if (proj.behind) continue;
        if (j === 0) ctx.moveTo(proj.x, proj.y);
        else ctx.lineTo(proj.x, proj.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // 如果需要，先画“上一代”的幽灵轨道
  if (showDeltaOverlay) {
    const fade =
      deltaEndTime > now
        ? Math.max(0, Math.min(1, (deltaEndTime - now) / 5000))
        : 0;
    if (fade > 0) {
      const alpha = 0.6 * fade;
      drawOrbitSet(
        lastProgressForDelta,
        `rgba(160,200,255,${alpha})`,
        0.7,
        true
      );
    }
  }

  // 再画当前轨道
  drawOrbitSet(
    changeProgress,
    "rgba(255,255,255,0.2)",
    0.8,
    false
  );

  // 画行星
  for (const pl of planets) {
    const orbitParams = getOrbitParams(pl.orbitIndex, changeProgress);
    const orbitRadius = orbitParams.radius;
    const orbitalSpeed = 0.2 + pl.orbitIndex * 0.06;
    const angle = pl.phase + t * orbitalSpeed;

    // 轨道平面内的位置
    let vx = orbitRadius * Math.cos(angle);
    let vy = orbitRadius * Math.sin(angle) * 0.98;
    let vz = 0;

    // 应用倾角到行星位置
    let v = { x: vx, y: vy, z: vz };
    v = rotateX(v, orbitParams.tiltX);
    v = rotateY(v, orbitParams.tiltZ);

    const proj = project(v.x, v.y, v.z);
    if (proj.behind) continue;

    const radius = pl.size * (20 + 40 * proj.scale);
    const haloR = radius * 2.6;
    const gPlanet = ctx.createRadialGradient(
      proj.x,
      proj.y,
      0,
      proj.x,
      proj.y,
      haloR
    );
    gPlanet.addColorStop(0, "rgba(255,255,255,0.95)");
    gPlanet.addColorStop(0.3, pl.color + "ee");
    gPlanet.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gPlanet;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pl.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

draw();
