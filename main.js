const root=document.documentElement;
const text=document.getElementById("overlayText");

let t=0;
let lastTime=performance.now();
const CYCLE_SECONDS=300;

setTimeout(()=>{text.style.opacity="0";},3000);

function updateScene(){
  const day=t;
  const visibleStart=0.08;
  const visibleEnd=0.92;
  let sunTop=72;
  let sunOpacity=0;

  if(day>visibleStart && day<visibleEnd){
    const norm=(day-visibleStart)/(visibleEnd-visibleStart);
    const elev=Math.sin(norm*Math.PI);
    sunTop=72-elev*40;
    sunOpacity=0.25+elev*0.75;
  }

  const sunElev=Math.max(0,Math.sin(day*Math.PI));
  let twilight=Math.sin(day*Math.PI*2); twilight=Math.max(0,twilight);

  const skyBright=0.4+sunElev*0.7;
  const skyWarm=0.5+twilight*0.7;
  const seaBright=0.45+sunElev*0.55;
  const starOpacity=1-sunElev;
  const birdOpacity=Math.max(0,Math.min(1,sunElev*1.4-0.05));

  root.style.setProperty("--sun-top",`${sunTop}vh`);
  root.style.setProperty("--sun-opacity",sunOpacity.toFixed(3));
  root.style.setProperty("--sky-bright",skyBright.toFixed(3));
  root.style.setProperty("--sky-warm",skyWarm.toFixed(3));
  root.style.setProperty("--sea-bright",seaBright.toFixed(3));
  root.style.setProperty("--star-opacity",starOpacity.toFixed(3));
  root.style.setProperty("--bird-opacity",birdOpacity.toFixed(3));
}

function animate(now){
  const dt=(now-lastTime)/1000;
  lastTime=now;
  t=(t+dt/CYCLE_SECONDS)%1;
  updateScene();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

let lastNudge=0;
function nudge(strong=false){
  const now=Date.now();
  const cooldown=strong?800:400;
  if(now-lastNudge<cooldown)return;
  lastNudge=now;

  const amount=strong?0.02:0.008;
  t=(t+amount)%1;
  updateScene();
}

document.addEventListener("click",()=>nudge(false));
document.addEventListener("wheel",()=>nudge(false),{passive:true});
document.addEventListener("touchstart",()=>nudge(false));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)nudge(true);});
