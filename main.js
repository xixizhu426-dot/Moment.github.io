// 「眨眼之间」星空粒子版
// 交互逻辑：
// - 初始黑屏，只显示「进入时间」按钮。
// - 点击后淡入星空 & 银河，并开始播放背景音乐（如果存在 music.mp3）。
// - 用户拖动（鼠标或触控）改变视角 yaw / pitch，产生环视星空的感觉。
// - 每次有效的视角拖动 / 离开页面再回来 / 长时间停留，都会推进一次 timeEpoch：
//   - 星星亮度、分布、银河带角度、背景深浅都会发生微妙变化。
// - timeEpoch 持久化在 localStorage，刷新或下次打开会延续之前的星空状态。

const skyEl = document.getElementById("sky");
const starsContainer = document.getElementById("stars");
const milkyWayEl = document.querySelector(".milky-way");
const glowEl = document.querySelector(".sky-glow");
const resetViewBtn = document.getElementById("reset-view-btn");
const introLayer = document.getElementById("intro-layer");
const enterBtn = document.getElementById("enter-time-btn");
const bgm = document.getElementById("bgm");

const STORAGE_KEY = "blink_particle_epoch_v1";
const STAR_COUNT = 260;
const EPOCH_STEPS = 80; // 一轮呼吸循环划分成的步数
const IDLE_THRESHOLD_MS = 20000; // 停留超过 20s 视为一次“时间流逝”

let epoch = 0;
let wasHidden = false;
let lastInteractionTime = Date.now();
let lastIdleStepTime = 0;

// 视角（虚拟相机角度，单位：度）
let yaw = 0; // 左右 -180 ~ 180
let pitch = 0; // 上下 -30 ~ 30

// 拖动状态
let isDragging = false;
let lastX = 0;
let lastY = 0;
let dragDistanceSinceStep = 0;

// 初始化星粒子
function initStars() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("div");
    star.className = "star";

    // 随机基础位置（0~1）
    const baseX = Math.random();
    const baseY = Math.random();

    // 深度：0 = 背景, 1 = 前景
    const depth = Math.random(); // 0~1

    // 一部分当作前景亮星
    const isForeground = depth > 0.7 && Math.random() < 0.65;

    const size = isForeground ? 2.5 + Math.random() * 1.8 : 1 + Math.random() * 1.5;

    // 初始摆放到屏幕内
    const px = baseX * vw;
    const py = baseY * vh;

    star.style.left = px + "px";
    star.style.top = py + "px";
    star.style.width = size + "px";
    star.style.height = size + "px";

    // 颜色：大部分接近白，有少数略偏蓝 / 紫
    let tint = Math.random();
    let color;
    if (tint < 0.75) {
      color = "rgba(255,255,255,1)";
    } else if (tint < 0.9) {
      color = "rgba(192,210,255,1)";
    } else {
      color = "rgba(220,200,255,1)";
    }
    star.style.background = `radial-gradient(circle, ${color} 0, rgba(255,255,255,0) 70%)`;

    // 亮度与闪烁相位
    const base = 0.45 + Math.random() * 0.55; // 0.45~1.0
    const phase = Math.random() * Math.PI * 2;

    star.dataset.baseX = baseX.toFixed(4);
    star.dataset.baseY = baseY.toFixed(4);
    star.dataset.depth = depth.toFixed(3);
    star.dataset.base = base.toFixed(2);
    star.dataset.phase = phase.toFixed(4);

    starsContainer.appendChild(star);
  }
}

// 从 localStorage 读 epoch
function loadEpoch() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, n);
}

function saveEpoch() {
  localStorage.setItem(STORAGE_KEY, String(epoch));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rgb(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

// 根据 epoch + yaw/pitch 更新视觉状态
function applyVisualState() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const step = epoch % EPOCH_STEPS;
  const progress = step / EPOCH_STEPS; // 0~1
  // 三角波，让深浅来回呼吸：0 -> 1 -> 0
  const phase =
    progress < 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
  const ease = Math.pow(phase, 1.6);

  // 背景颜色在“深蓝夜空”和“更深宇宙”之间
  const topColor = rgb(
    Math.round(lerp(40, 18, ease)),
    Math.round(lerp(62, 28, ease)),
    Math.round(lerp(118, 60, ease))
  );
  const midColor = rgb(
    Math.round(lerp(10, 3, ease)),
    Math.round(lerp(18, 6, ease)),
    Math.round(lerp(40, 20, ease))
  );
  const bottomColor = rgb(
    Math.round(lerp(4, 2, ease)),
    Math.round(lerp(6, 2, ease)),
    Math.round(lerp(16, 6, ease))
  );

  skyEl.style.background = `radial-gradient(circle at 50% 15%, ${topColor} 0, ${midColor} 45%, ${bottomColor} 100%)`;

  // 银河带：随 epoch 缓慢旋转一点点角度
  if (milkyWayEl) {
    const baseAngle = -18; // 初始倾斜角度
    const extraAngle = (epoch * 0.15) % 12; // 累积变化范围不大
    milkyWayEl.style.transform = `rotate(${baseAngle + extraAngle}deg)`;
    const blur = 5 + 3 * ease;
    const opacity = 0.45 + 0.2 * (1 - ease);
    milkyWayEl.style.filter = `blur(${blur}px)`;
    milkyWayEl.style.opacity = opacity.toFixed(2);
  }

  if (glowEl) {
    const glowOpacity = 0.75 + 0.2 * (1 - ease);
    const blur = 4 + 3 * ease;
    glowEl.style.opacity = glowOpacity.toFixed(2);
    glowEl.style.filter = `blur(${blur}px)`;
  }

  const stars = starsContainer.querySelectorAll(".star");
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;

  stars.forEach((star) => {
    const baseX = parseFloat(star.dataset.baseX || "0.5");
    const baseY = parseFloat(star.dataset.baseY || "0.5");
    const depth = parseFloat(star.dataset.depth || "0.5");
    const base = parseFloat(star.dataset.base || "0.7");
    const phaseOffset = parseFloat(star.dataset.phase || "0");

    // 亮度：基础值附近 twinkle 再叠加 epoch 影响
    const twinkle =
      0.28 *
      Math.sin(epoch * 0.35 + phaseOffset + baseX * 5 + baseY * 7);
    const op = clamp(base + twinkle, 0.18, 1.0);
    star.style.opacity = op.toFixed(2);

    // 视差：根据 yaw/pitch 和深度，决定星点在屏幕上的偏移
    const parallaxStrength = 90; // 数值越大视差越明显
    const offsetX =
      Math.sin(yawRad) * parallaxStrength * (0.3 + depth) +
      (baseX - 0.5) * 20;
    const offsetY =
      Math.sin(pitchRad) * parallaxStrength * (0.2 + depth) +
      (baseY - 0.5) * 20;

    const px = baseX * vw + offsetX;
    const py = baseY * vh + offsetY;

    star.style.transform = `translate3d(${px - baseX * vw}px, ${
      py - baseY * vh
    }px, 0)`;
  });
}

// 统一处理“时间推进”+“最近交互时间”
function stepTime(reason) {
  epoch += 1;
  saveEpoch();
  applyVisualState();
  lastInteractionTime = Date.now();
}

// 处理拖动开始
function handlePointerDown(e) {
  isDragging = true;
  lastInteractionTime = Date.now();
  dragDistanceSinceStep = 0;
  lastX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
  lastY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
}

// 处理拖动移动
function handlePointerMove(e) {
  if (!isDragging) return;

  const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
  const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

  const dx = clientX - lastX;
  const dy = clientY - lastY;

  lastX = clientX;
  lastY = clientY;

  // 调整视角：dx -> yaw, dy -> pitch
  const yawSpeed = 0.12;
  const pitchSpeed = 0.09;

  yaw += dx * yawSpeed;
  if (yaw > 180) yaw -= 360;
  if (yaw < -180) yaw += 360;

  pitch = clamp(pitch - dy * pitchSpeed, -30, 30);

  dragDistanceSinceStep += Math.sqrt(dx * dx + dy * dy);

  // 旋转一定距离才记为一次"时间流逝"
  if (dragDistanceSinceStep > 28) {
    stepTime("drag");
    dragDistanceSinceStep = 0;
  } else {
    lastInteractionTime = Date.now();
    applyVisualState();
  }
}

// 处理拖动结束
function handlePointerUp() {
  isDragging = false;
}

// 监听页面可见性变化：离开→回来
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    wasHidden = true;
  } else if (document.visibilityState === "visible" && wasHidden) {
    wasHidden = false;
    stepTime("visibility");
  }
});

// 定时检查“长时间停留”
setInterval(() => {
  const now = Date.now();
  const sinceLastInteraction = now - lastInteractionTime;
  const sinceLastIdleStep = now - lastIdleStepTime;

  if (
    sinceLastInteraction >= IDLE_THRESHOLD_MS &&
    sinceLastIdleStep >= IDLE_THRESHOLD_MS
  ) {
    stepTime("idle");
    lastIdleStepTime = now;
  }
}, 4000); // 每 4 秒检查一次

// 回到最初视角按钮
resetViewBtn.addEventListener("click", () => {
  yaw = 0;
  pitch = 0;
  lastInteractionTime = Date.now();
  applyVisualState();
});

// 初始黑屏「进入时间」
enterBtn.addEventListener("click", () => {
  // 淡出 intro 层
  introLayer.classList.add("hidden");

  // 尝试播放背景音乐（有些浏览器需要用户交互后才允许播放，这里正好是点击事件）
  if (bgm && typeof bgm.play === "function") {
    bgm.volume = 0;
    bgm
      .play()
      .then(() => {
        // 渐入音量
        let v = 0;
        const target = 0.45;
        const step = 0.02;
        const fade = setInterval(() => {
          v += step;
          if (v >= target) {
            v = target;
            clearInterval(fade);
          }
          bgm.volume = v;
        }, 120);
      })
      .catch(() => {
        // 如果播放失败（浏览器限制），静默忽略
      });
  }
});

// 初始化
window.addEventListener("load", () => {
  initStars();
  epoch = loadEpoch();
  applyVisualState();

  // 绑定鼠标事件
  skyEl.addEventListener("mousedown", handlePointerDown);
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);

  // 绑定触摸事件（移动端）
  skyEl.addEventListener("touchstart", handlePointerDown, { passive: true });
  skyEl.addEventListener("touchmove", handlePointerMove, { passive: true });
  window.addEventListener("touchend", handlePointerUp);

  lastInteractionTime = Date.now();
});
