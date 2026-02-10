// ========= 基础引用 =========
const canvas = document.getElementById("space-canvas");
const ctx = canvas.getContext("2d");
const intro = document.getElementById("intro");
const enterBtn = document.getElementById("enter-btn");
const resetBtn = document.getElementById("reset-view");
const bgm = document.getElementById("bgm");
const compareLabels = document.getElementById("compare-labels");

// ========= 画布尺寸 =========
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

// ========= 相机参数（伪 3D） =========
let camYaw = 0.9; // 水平角
let camPitch = -0.4; // 俯仰角
let camDist = 900; // 视距
const baseDist = 900;
const minDist = 500;
const maxDist = 1500;
const fov = 800;

const center = { x: 0, y: 0, z: 0 };

// ========= 轨道 & 行星 =========
const tracks = [];
const baseTracks = []; // 存初始轨道，用于对比
const planets = [];

// 极轻微“时间演化” —— 用 localStorage 记录
const STORAGE_KEY = "orbit_evolve_step_v1";
let evolveStep = 0;
let pendingEvolve = 0;

// 对比模式
let compareMode = false;
let compareStartTime = 0;
const COMPARE_DURATION = 4000; // ms

// 从 localStorage 读历史步数
(function initEvolve() {
  const n = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  if (!Number.isNaN(n)) evolveStep = n;
})();

// 初始化轨道/行星
function initOrbits() {
  tracks.length = 0;
  baseTracks.length = 0;
  planets.length = 0;

  const baseRadii = [150, 230, 320, 420];
  const colors = ["#ffffff", "#ffd47f", "#9ec7ff", "#7fe8c9"];

  for (let i = 0; i < baseRadii.length; i++) {
    const radius = baseRadii[i];

    const track = {
      baseRadius: radius,
      radius,
      tiltX: 0.05 * i,
      tiltZ: 0.08 * (i + 1),
    };
    tracks.push(track);

    // 初始轨道克隆一份，用于对比绘制
    baseTracks.push({
      baseRadius: radius,
      radius,
      tiltX: track.tiltX,
      tiltZ: track.tiltZ,
    });

    planets.push({
      radius,
      angle: Math.random() * Math.PI * 2,
      speed: 0.0005 + i * 0.0003,
      size: 6 + i * 1.2,
      color: colors[i] || "#ffffff",
    });
  }
}
initOrbits();

// 背景星星
const stars = [];
function initStars() {
  stars.length = 0;
  const count = 900;
  for (let i = 0; i < count; i++) {
    const r = 900 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI * 0.9;
    const x = Math.cos(theta) * Math.cos(phi) * r;
    const y = Math.sin(phi) * r * 0.45;
    const z = Math.sin(theta) * Math.cos(phi) * r;
    stars.push({
      x,
      y,
      z,
      size: 1 + Math.random() * 1.2,
      alpha: 0.25 + Math.random() * 0.55,
    });
  }
}
initStars();

// 标记有交互（旋转 / 缩放）
function markInteraction() {
  pendingEvolve++;
}

// ========= 3D 投影 =========
function projectPoint(p) {
  const cw = canvas.width / (window.devicePixelRatio || 1);
  const ch = canvas.height / (window.devicePixelRatio || 1);
  const cx = cw / 2;
  const cy = ch / 2;

  // Y 轴旋转
  const cosy = Math.cos(camYaw);
  const siny = Math.sin(camYaw);
  let x1 = p.x * cosy - p.z * siny;
  let z1 = p.x * siny + p.z * cosy;
  let y1 = p.y;

  // X 轴旋转
  const cosp = Math.cos(camPitch);
  const sinp = Math.sin(camPitch);
  let y2 = y1 * cosp - z1 * sinp;
  let z2 = y1 * sinp + z1 * cosp;

  const dist = camDist;
  const scale = fov / (dist + z2);
  return {
    x: cx + x1 * scale,
    y: cy + y2 * scale,
    scale,
    depth: dist + z2,
  };
}

// ========= 时间演化：非常微弱 =========
function applyEvolve() {
  if (pendingEvolve > 0) {
    evolveStep += 1; // 每一大段交互只推进 1 步
    pendingEvolve = 0;
    localStorage.setItem(STORAGE_KEY, String(evolveStep));
  }

  const t = evolveStep * 0.0006; // 总体变化极慢

  tracks.forEach((track, idx) => {
    const k = (idx + 1) * 0.03;
    // 半径最多 ±3%
    track.radius = track.baseRadius * (1 + Math.sin(t * k) * 0.03);
    // 轻微倾角变化
    track.tiltX = 0.05 * idx + Math.sin(t * k * 0.7) * 0.06;
    track.tiltZ = 0.08 * (idx + 1) + Math.cos(t * k * 0.9) * 0.06;
  });
}

// ========= 绘制轨道工具 =========
function drawOrbitSet(trackArray, strokeStyle, alphaMultiplier = 1) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = strokeStyle;
  ctx.globalAlpha *= alphaMultiplier;

  trackArray.forEach((track) => {
    const points = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      let x = Math.cos(ang) * track.radius;
      let y = 0;
      let z = Math.sin(ang) * track.radius;

      const tx = track.tiltX;
      const tz = track.tiltZ;

      // 绕 X 轴
      const cosTx = Math.cos(tx);
      const sinTx = Math.sin(tx);
      let y1 = y * cosTx - z * sinTx;
      let z1 = y * sinTx + z * cosTx;

      // 绕 Z 轴
      const cosTz = Math.cos(tz);
      const sinTz = Math.sin(tz);
      let x2 = x * cosTz - y1 * sinTz;
      let y2 = x * sinTz + y1 * cosTz;

      points.push(projectPoint({ x: x2, y: y2, z: z1 }));
    }

    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  });

  ctx.restore();
}

// ========= 绘制 =========
function draw(now) {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  // 背景渐变（深蓝）
  const g = ctx.createRadialGradient(
    w / 2,
    h * 0.2,
    0,
    w / 2,
    h / 2,
    Math.max(w, h)
  );
  g.addColorStop(0, "#141c32");
  g.addColorStop(0.55, "#050813");
  g.addColorStop(1, "#02030a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 星星
  ctx.save();
  ctx.fillStyle = "#ffffff";
  stars.forEach((s) => {
    const p = projectPoint(s);
    if (p.depth < 0) return;
    const alpha = s.alpha * (0.8 + Math.random() * 0.04); // 轻微闪烁
    ctx.globalAlpha = alpha;
    const size = s.size * p.scale;
    ctx.fillRect(p.x, p.y, size, size);
  });
  ctx.restore();

  // 对比模式：绘制 BEFORE 轨道（初始轨道）
  let compareAlpha = 0;
  if (compareMode) {
    const elapsed = now - compareStartTime;
    if (elapsed >= COMPARE_DURATION) {
      compareMode = false;
      compareLabels.classList.remove("show");
    } else {
      // 前 500ms 淡入，最后 700ms 淡出，中间保持 1
      const fadeIn = 500;
      const fadeOut = 700;
      const hold = COMPARE_DURATION - fadeIn - fadeOut;
      if (elapsed < fadeIn) {
        compareAlpha = elapsed / fadeIn;
      } else if (elapsed < fadeIn + hold) {
        compareAlpha = 1;
      } else {
        compareAlpha = 1 - (elapsed - fadeIn - hold) / fadeOut;
      }
    }
  }

  if (compareAlpha > 0) {
    ctx.globalAlpha = compareAlpha;
    drawOrbitSet(baseTracks, "var(--track-before)", 1);
    ctx.globalAlpha = 1.0;
  }

  // 当前轨道（NOW）
  ctx.globalAlpha = 1.0;
  drawOrbitSet(tracks, "var(--track-color)", 1);

  // 中心恒星
  const centerScreen = projectPoint(center);
  ctx.save();
  const gradStar = ctx.createRadialGradient(
    centerScreen.x,
    centerScreen.y,
    0,
    centerScreen.x,
    centerScreen.y,
    40
  );
  gradStar.addColorStop(0, "rgba(255,255,255,1)");
  gradStar.addColorStop(0.3, "rgba(255,255,255,0.8)");
  gradStar.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradStar;
  ctx.beginPath();
  ctx.arc(centerScreen.x, centerScreen.y, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(250,250,255,0.95)";
  ctx.beginPath();
  ctx.arc(centerScreen.x, centerScreen.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 行星
  ctx.save();
  planets.forEach((pl, idx) => {
    pl.angle += pl.speed; // 小幅自转

    let x = Math.cos(pl.angle) * pl.radius;
    let y = 0;
    let z = Math.sin(pl.angle) * pl.radius;

    const track = tracks[idx];
    const tx = track.tiltX;
    const tz = track.tiltZ;

    const cosTx = Math.cos(tx);
    const sinTx = Math.sin(tx);
    let y1 = y * cosTx - z * sinTx;
    let z1 = y * sinTx + z * cosTx;

    const cosTz = Math.cos(tz);
    const sinTz = Math.sin(tz);
    let x2 = x * cosTz - y1 * sinTz;
    let y2 = x * sinTz + y1 * cosTz;

    const p = projectPoint({ x: x2, y: y2, z: z1 });
    if (p.depth < 0) return;

    const size = pl.size * (0.8 + p.scale * 0.7);
    ctx.fillStyle = pl.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ========= 动画循环 =========
function animate(now) {
  applyEvolve();
  draw(now);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ========= 交互：拖动旋转 / 滚轮缩放 =========
let isDragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  camYaw += dx * 0.003;
  camPitch += dy * 0.003;
  const limit = Math.PI / 2 - 0.1;
  camPitch = Math.max(-limit, Math.min(limit, camPitch));

  markInteraction();
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    camDist += delta * 0.5;
    camDist = Math.max(minDist, Math.min(maxDist, camDist));
    markInteraction();
  },
  { passive: false }
);

// ========= 回到初始视角 =========
resetBtn.addEventListener("click", () => {
  camYaw = 0.9;
  camPitch = -0.4;
  camDist = baseDist;

  // 回到初始视角本身也算“时间过去了一小步”
  pendingEvolve += 2;

  // 启用对比模式
  compareMode = true;
  compareStartTime = performance.now();
  compareLabels.classList.add("show");
});

// ========= 页面可见性：离开再回来 =========
let wasHidden = false;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    wasHidden = true;
  } else if (document.visibilityState === "visible" && wasHidden) {
    wasHidden = false;
    pendingEvolve += 1;
  }
});

// ========= 进入时间按钮 =========
enterBtn.addEventListener("click", () => {
  intro.classList.add("hidden");
  markInteraction();

  // 尝试播放背景音乐（如果你之后加了音频）
  if (bgm && bgm.play) {
    bgm.play().catch(() => {
      // 部分浏览器可能需要再点一次，这里忽略错误就好
    });
  }
});
