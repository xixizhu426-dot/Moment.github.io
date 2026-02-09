const root = document.documentElement;
const text = document.getElementById("overlayText");

let t = 0; // 0 ~ 1 一圈
let lastTime = performance.now();
const CYCLE_SECONDS = 260; // 一天在网页里的时长（秒）

// 开场文字淡出
setTimeout(() => {
  text.style.opacity = "0";
}, 3500);

// 根据 t 更新画面状态
function updateScene() {
  const day = t;

  // 白天程度：中间高，两头低
  const sunElev = Math.max(0, Math.sin(day * Math.PI)); // 0~1~0
  // 黄昏/黎明：在 0, 0.5, 1 附近更高
  let twilight = Math.sin(day * Math.PI * 2);
  twilight = Math.max(0, twilight);

  const bgBright = 0.35 + sunElev * 0.75;       // 夜 0.35 → 正午 1.1
  const bgContrast = 0.9 + sunElev * 0.3;       // 夜更柔，白天更硬一点
  const bgSat = 0.8 + (sunElev + twilight) * 0.6; // 日出日落颜色更饱和
  const bgHue = (twilight * 12 - 6);            // 微小色温偏移

  // 暖色覆盖更多在日出/日落
  const overlayWarm = 0.1 + twilight * 0.9;
  // 夜晚偏冷
  const overlayCool = 1 - sunElev;

  const starOpacity = Math.max(0, 1.3 - sunElev * 2.0); // 太阳越高星星越淡

  root.style.setProperty("--bg-bright", bgBright.toFixed(3));
  root.style.setProperty("--bg-contrast", bgContrast.toFixed(3));
  root.style.setProperty("--bg-sat", bgSat.toFixed(3));
  root.style.setProperty("--bg-hue", bgHue.toFixed(3) + "deg");
  root.style.setProperty("--overlay-warm", overlayWarm.toFixed(3));
  root.style.setProperty("--overlay-cool", overlayCool.toFixed(3));
  root.style.setProperty("--star-opacity", starOpacity.toFixed(3));
}

// 自动时间推进
function animate(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  t = (t + dt / CYCLE_SECONDS) % 1;
  updateScene();

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// 交互：轻轻推一下时间
let lastNudge = 0;
function nudge(strong = false) {
  const now = Date.now();
  const cooldown = strong ? 900 : 450;
  if (now - lastNudge < cooldown) return;
  lastNudge = now;

  const amount = strong ? 0.03 : 0.01;
  t = (t + amount) % 1;
  updateScene();
}

document.addEventListener("click", () => nudge(false));
document.addEventListener("wheel", () => nudge(false), { passive: true });
document.addEventListener("touchstart", () => nudge(false));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) nudge(true);
});
