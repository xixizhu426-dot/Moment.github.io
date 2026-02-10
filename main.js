// 获取 canvas 和上下文
const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");

// 设置 canvas 尺寸
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// 星星数据
let stars = [];
const STAR_COUNT = 1800;

// 摄像机角度：偏航(左右转头)、俯仰(抬头低头)
let yaw = 0,
  pitch = 0;
let targetYaw = 0,
  targetPitch = 0;

// 时间累积：用来让星空随时间慢慢改变
let epoch = parseInt(localStorage.getItem("epoch") || "0", 10);
let lastActivity = Date.now();

// 生成星星（在一个立方体中随机分布）
function createStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random() * 2 - 1,
      b: Math.random() * 0.8 + 0.2, // 基础亮度
    });
  }
}
createStars();

// 把 3D 星星投影到 2D 屏幕
function projectStar(s) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  // 先绕 Y 轴（左右转头）
  let x = s.x * cosY - s.z * sinY;
  let z = s.x * sinY + s.z * cosY;

  // 再绕 X 轴（抬头低头）
  let y = s.y * cosP - z * sinP;
  z = s.y * sinP + z * cosP;

  // 简单透视
  const f = 0.6 / (z + 1.6); // z ∈ [-1,1]，+1.6 避免除零
  return {
    sx: x * f * canvas.width + canvas.width / 2,
    sy: y * f * canvas.height + canvas.height / 2,
    b: s.b * f * 3, // 随远近改变亮度
  };
}

// 绘制循环
function draw() {
  // 背景略带一点蓝，不是纯黑
  ctx.fillStyle = "#02040a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制星星
  for (const s of stars) {
    const p = projectStar(s);
    // 做一点点随机闪烁
    const flicker = 0.8 + Math.random() * 0.4;
    const alpha = Math.min(1, p.b * flicker);

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(p.sx, p.sy, 1.2, 1.2);
  }

  // epoch 让星空整体有一个极慢的自转
  yaw += 0.0001 * epoch;
  pitch += 0.00005 * epoch;

  // 相机缓动到目标角度
  yaw += (targetYaw - yaw) * 0.06;
  pitch += (targetPitch - pitch) * 0.06;

  requestAnimationFrame(draw);
}

// 交互：鼠标拖动
let dragging = false;
let lastX = 0,
  lastY = 0;

canvas.addEventListener("mousedown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener("mouseup", () => {
  dragging = false;
});

window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  // 调整目标视角
  targetYaw += dx * 0.002;
  targetPitch += dy * 0.002;

  // 记录一次活动
  lastActivity = Date.now();
});

// 交互：触摸拖动（手机 / 触控板）
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  dragging = true;
  lastX = t.clientX;
  lastY = t.clientY;
});

canvas.addEventListener("touchmove", (e) => {
  if (!dragging || e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - lastX;
  const dy = t.clientY - lastY;
  lastX = t.clientX;
  lastY = t.clientY;

  targetYaw += dx * 0.002;
  targetPitch += dy * 0.002;

  lastActivity = Date.now();
});

canvas.addEventListener("touchend", () => {
  dragging = false;
});

// 长时间停留：没操作 15 秒，epoch +1（表示时间悄悄过去了一点）
setInterval(() => {
  const now = Date.now();
  if (now - lastActivity > 15000) {
    epoch++;
    saveEpoch();
    lastActivity = now; // 防止一路狂加
  }
}, 5000);

// 离开页面再回来：再 +1
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    epoch++;
    saveEpoch();
  }
});

// 保存 epoch
function saveEpoch() {
  localStorage.setItem("epoch", String(epoch));
}

// 回到初始视角按钮
document.getElementById("resetView").addEventListener("click", () => {
  targetYaw = 0;
  targetPitch = 0;
});

// 进入时间按钮：淡出按钮，显现星空 & 播放 bgm
document.getElementById("enter-btn").addEventListener("click", () => {
  const enterBtn = document.getElementById("enter-btn");
  const resetBtn = document.getElementById("resetView");
  const bgm = document.getElementById("bgm");

  enterBtn.classList.add("hidden");
  resetBtn.classList.remove("hidden");

  // 尝试播放背景音乐（有些浏览器需要用户交互后才允许）
  if (bgm) {
    bgm.volume = 0.4;
    bgm.play().catch(() => {
      // 如果被浏览器拦截，就算了，不报错
    });
  }
});

// 启动动画循环
draw();
