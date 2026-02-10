const skyEl = document.getElementById("sky");
const clouds = Array.from(document.querySelectorAll(".cloud"));
const starsEl = document.getElementById("stars");
const enterBtn = document.getElementById("enter-btn");

const STORAGE_KEY = "blink_sky_change_count";
const STEPS = 120;
let changeCount = 0;
let wasHidden = false;
let timeActive = false; // 只有点了“走入时间”之后才开始计时

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, String(changeCount));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function rgb(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

function applyVisualState() {
  const n = changeCount % STEPS;
  const progress = n / STEPS; // 0~1
  // triangle wave 0->1->0
  const phase = progress < 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
  const ease = Math.pow(phase, 1.4);

  // 顶部：柔和奶油粉 -> 稍微冷一点的淡紫
  const topColor = rgb(
    Math.round(lerp(255, 230, ease)),
    Math.round(lerp(233, 210, ease)),
    Math.round(lerp(210, 230, ease))
  );
  // 中间：橙粉 -> 暮色紫
  const midColor = rgb(
    Math.round(lerp(255, 240, ease)),
    Math.round(lerp(193, 185, ease)),
    Math.round(lerp(179, 210, ease))
  );
  // 底部：紫蓝 -> 更深一点的蓝
  const bottomColor = rgb(
    Math.round(lerp(196, 68, ease)),
    Math.round(lerp(181, 91, ease)),
    Math.round(lerp(255, 138, ease))
  );

  skyEl.style.background = `linear-gradient(180deg, ${topColor}, ${midColor}, ${bottomColor})`;

  // 云整体轻微漂移 & 透明度
  const drift = 8 * ease;
  clouds.forEach((cloud, index) => {
    const dir = index === 1 ? -1 : 1;
    cloud.style.transform = `translateX(${dir * drift}px)`;
    cloud.style.opacity = (0.7 + 0.2 * (1 - ease)).toFixed(2);
  });

  // 星星：只在比较晚的时候出现
  const starOpacity = Math.max(0, (ease - 0.4) / 0.6);
  starsEl.style.opacity = starOpacity.toFixed(2);
}

// 监听页面可见性变化
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    wasHidden = true;
  } else if (
    document.visibilityState === "visible" &&
    wasHidden &&
    timeActive
  ) {
    // 只有已经“走入时间”后，离开->回来才生效
    wasHidden = false;
    changeCount += 1;
    saveState();
    applyVisualState();
  }
});

// 初次加载：渲染当前进度，但不启动时间推进
window.addEventListener("load", () => {
  changeCount = loadState();
  applyVisualState();
});

// 点击“走入时间”按钮：淡出 + 开启时间推进
if (enterBtn) {
  enterBtn.addEventListener("click", () => {
    if (timeActive) return;
    timeActive = true;
    enterBtn.classList.add("fade-out");
    // 动画结束后移除按钮
    enterBtn.addEventListener(
      "transitionend",
      () => {
        if (enterBtn && enterBtn.parentNode) {
          enterBtn.parentNode.removeChild(enterBtn);
        }
      },
      { once: true }
    );
  });
}
