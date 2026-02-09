const video = document.getElementById("sunsetVideo");
const text = document.getElementById("overlayText");

let lastAction = 0;

// Fade out the intro text
setTimeout(() => {
  text.style.opacity = "0";
}, 3000);

// Core trigger function
function requestAdvance() {
  const now = Date.now();
  if (now - lastAction < 600) return; // cooldown

  lastAction = now;

  // advance 0.3 seconds
  const newTime = video.currentTime + 0.3;

  if (newTime < video.duration) {
    video.currentTime = newTime;
  } else {
    // freeze at last frame
    video.currentTime = video.duration;
  }
}

// interactions
document.addEventListener("mousemove", requestAdvance);
document.addEventListener("wheel", requestAdvance);
document.addEventListener("touchstart", requestAdvance);

// visibility change
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) requestAdvance();
});
