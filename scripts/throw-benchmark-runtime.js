// Top-level measurement avoids hidden/subframe throttling. Test page only.
(async()=>{
 const params=new URLSearchParams(location.search),version=location.pathname.split('/')[2],blur=params.get('blur')!=='off',profile=params.get('measure')||'desktop';
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),raf=()=>new Promise(r=>requestAnimationFrame(r));
 const panel=document.createElement('div');panel.style.cssText='position:fixed;top:0;left:0;z-index:99999;background:#15121af2;color:white;padding:8px;font:13px system-ui;max-width:95vw';
 panel.innerHTML='<button id="measure-start">6회 실측 시작</button> <button id="timing-start">착지 시점 정합성 검사</button> <span id="measure-status">준비</span><pre id="measure-output" style="margin:4px 0;white-space:pre-wrap"></pre>';
 document.body.append(panel);
 const status=panel.querySelector('#measure-status'),button=panel.querySelector('button'),out=panel.querySelector('pre');
 const pct=(a,p)=>{const s=[...a].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.ceil(s.length*p)-1)]||0};
 function geometry(){return [...document.querySelectorAll('.yutstick')].map(st=>{const el=st.querySelector('.stick-arc rect')||st.querySelector('rect'),m=el.getScreenCTM();return [[-44,-12],[44,-12],[44,15],[-44,15]].map(([x,y])=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f])})}
 function distance(a,b){return Math.max(...a.flatMap((s,i)=>s.map((p,j)=>Math.hypot(p[0]-b[i][j][0],p[1]-b[i][j][1]))))}
 function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
 panel.querySelector('#timing-start').onclick=async()=>{try{
  const app=window.__DALBIT_INSTANCE__,checks=[];
  for(const seed of [400,401,402,403,404,405]){
   app.startGame({mode:'local',count:2,board:'A',backdo:true});
   const oldRandom=Math.random;Math.random=random(seed);app.throwYut(seed===405?'nak':'safe',false);Math.random=oldRandom;
   app.timers.forEach(clearTimeout);app.timers=[];
   const animations=document.getAnimations().filter(a=>a.effect?.target?.closest('.yutstick'));
   for(const a of animations){a.pause();a.currentTime=1450}
   const before=geometry(),unfinished=animations.filter(a=>a.effect.getComputedTiming().endTime>1450).map(a=>({name:a.animationName,endMs:a.effect.getComputedTiming().endTime}));
   await new Promise(resolve=>app.setState({stage:'settled'},resolve));
   checks.push({seed,snapPx:distance(before,geometry()),unfinished});
  }
  const data={profile:'timing-'+profile,version,date:new Date().toISOString(),width:innerWidth,height:innerHeight,method:'WAAPI seek to exactly 1450ms, compare four corners before/after settled; not a performance measurement',checks};
  await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  status.textContent='착지 정합성 검사 완료';out.textContent=JSON.stringify(data,null,2);out.style.maxHeight='180px';out.style.overflow='auto';
 }catch(e){status.textContent=String(e)}};
 async function idle(){const ticks=[];let start,last;await new Promise(resolve=>{function tick(t){if(!start)start=t;if(last)ticks.push(t-last);last=t;if(t-start>=1800)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)});return {fps:1000*ticks.length/ticks.reduce((a,b)=>a+b,0),p95Ms:pct(ticks,.95)}}
 async function sample(app,seed,mode){
  app.startGame({mode:'local',count:2,board:'A',backdo:true});await raf();const oldRandom=Math.random;Math.random=random(seed);
  let start,last,settledAt,pre,post,intervals=[],activeAtSettle=[],landings=[],sounds=[];
  const oldSound=app.playSound;app.playSound=function(kind){sounds.push({kind,ms:performance.now()-start});return oldSound.call(app,kind)};
  const observer=new MutationObserver(()=>{if(app.state.stage==='settled'&&!settledAt){settledAt=performance.now();post=geometry();activeAtSettle=document.getAnimations().filter(a=>a.effect?.target?.closest('.yutstick')&&a.playState==='running').map(a=>({name:a.animationName,progress:a.effect.getComputedTiming().progress}))}});
  observer.observe(document.querySelector('.cinematic-throw'),{attributes:true,subtree:true});
  const mat=document.querySelector('.mat-sticks'),onEnd=e=>{if(e.target.closest('.yutstick'))landings.push({name:e.animationName,ms:performance.now()-start})};mat.addEventListener('animationend',onEnd);
  start=performance.now();app.throwYut(mode,false);
  await new Promise(resolve=>{function tick(t){if(last&&!settledAt)intervals.push(t-last);last=t;if(t-start>1350&&!settledAt)pre=geometry();if(settledAt&&t-settledAt>=100)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)});
  observer.disconnect();mat.removeEventListener('animationend',onEnd);Math.random=oldRandom;app.playSound=oldSound;
  return {seed,mode,result:app.state.result,frames:intervals.length,fps:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),p95Ms:pct(intervals,.95),maxMs:Math.max(...intervals),over33:intervals.filter(t=>t>33.34).length,over50:intervals.filter(t=>t>50).length,settleMs:settledAt-start,snapPx:pre&&post?distance(pre,post):null,activeAtSettle,landings,sounds};
 }
 button.onclick=async()=>{button.disabled=true;try{
  for(let i=0;i<100&&!window.__DALBIT_INSTANCE__;i++)await wait(50);const app=window.__DALBIT_INSTANCE__;if(!app)throw Error('App not loaded');
  if(!blur){const style=document.createElement('style');style.textContent='*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';document.head.append(style)}
  app.startGame({mode:'local',count:2,board:'A',backdo:true});await raf();
  if(profile==='mobile')document.querySelector('.cinematic-throw').scrollIntoView({block:'center'});
  await wait(500);status.textContent='대기 프레임 측정';const baseline=await idle();
  if(baseline.fps<10)throw Error(`프레임 제한 ${baseline.fps.toFixed(1)}fps`);
  await sample(app,999,'safe');const samples=[];
  for(let i=0;i<6;i++){status.textContent=`${version} blur=${blur}: ${i+1}/6`;samples.push(await sample(app,400+i,i===5?'nak':'safe'))}
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
  const data={profile,date:new Date().toISOString(),userAgent:navigator.userAgent,dpr:devicePixelRatio,width:innerWidth,height:innerHeight,visibility:document.visibilityState,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,topLevel:true,results:[{version,blur,idle:baseline,samples}]};
  await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  status.textContent='완료·저장됨';out.textContent=JSON.stringify(data,null,2);out.style.maxHeight='150px';out.style.overflow='auto';
 }catch(e){status.textContent=String(e)}finally{button.disabled=false}};
})();
