const skyEl=document.getElementById("sky");
const sunEl=document.getElementById("sun");
const clouds=[...document.querySelectorAll(".cloud")];
const starsEl=document.getElementById("stars");
const seaGlowEl=document.querySelector(".sea-glow");

const STORAGE_KEY="blink_change_count_v2";
const STEPS=200;
let changeCount=0,wasHidden=false;

function loadState(){
  let n=parseInt(localStorage.getItem(STORAGE_KEY));
  return isNaN(n)?0:n;
}
function saveState(){
  localStorage.setItem(STORAGE_KEY,String(changeCount));
}
function toHex(v){
  return v.toString(16).padStart(2,"0");
}

function applyVisualState(){
  const n=changeCount%STEPS;
  const progress=n/STEPS;
  const nightPhase=progress<0.5?progress/0.5:(1-progress)/0.5;
  const nightEase=Math.pow(nightPhase,1.4);

  const r=Math.round(255+(26-255)*nightEase);
  const g=Math.round(126+(42-126)*nightEase);
  const b=Math.round(95+(58-95)*nightEase);
  const topColor=`#${toHex(r)}${toHex(g)}${toHex(b)}`;

  const br=Math.round(254+(40-254)*nightEase);
  const bg=Math.round(180+(70-180)*nightEase);
  const bb=Math.round(123+(90-123)*nightEase);
  const bottomColor=`#${toHex(br)}${toHex(bg)}${toHex(bb)}`;

  const angle=180+nightEase*10;
  skyEl.style.background=`linear-gradient(${angle}deg,${topColor},${bottomColor})`;

  const size=80-(80-45)*nightEase;
  const sunOpacity=1-0.7*nightEase;
  sunEl.style.width=`${size}px`;
  sunEl.style.height=`${size}px`;
  sunEl.style.opacity=sunOpacity<0.05?0:sunOpacity.toFixed(2);

  const base=[30,60,80];
  const maxShift=18;
  const cloudOpacity=0.8-0.7*nightEase;
  clouds.forEach((c,i)=>{
    c.style.opacity=cloudOpacity<0.02?0:cloudOpacity.toFixed(2);
    c.style.left=`${base[i]-maxShift*nightEase}%`;
  });

  const starOpacity=Math.max(0,(nightEase-0.25)/0.75);
  starsEl.style.opacity=starOpacity.toFixed(2);

  const seaOpacity=0.9-0.4*nightEase;
  seaGlowEl.style.opacity=seaOpacity.toFixed(2);
}

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden")wasHidden=true;
  else if(document.visibilityState==="visible"&&wasHidden){
    wasHidden=false;
    changeCount+=1;
    saveState();
    applyVisualState();
  }
});

window.addEventListener("load",()=>{
  changeCount=loadState();
  applyVisualState();
});
