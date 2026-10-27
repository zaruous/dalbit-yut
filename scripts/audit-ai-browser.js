// Diagnostic page only: run the real React App AI lifecycle using a virtual timer queue.
// All delays retain their original relative ordering. Visual animation timing is NOT tested.
import '/src-ts/App.tsx';
const app=window.__DALBIT_INSTANCE__;
const panel=document.createElement('section');panel.id='audit-panel';
panel.innerHTML='<button id="audit-start">실제 App AI 전용 6판 검증</button> <button id="audit-live">정상 속도 AI 4인 · 20회 던지기</button> <span id="audit-status">준비</span><pre id="audit-output"></pre>';
document.body.append(panel);
const output=panel.querySelector('pre'),status=panel.querySelector('span'),button=panel.querySelector('button');
function generator(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const yieldTask=()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve()};channel.port2.postMessage(0)});
async function runAudit(realTime=false){
 button.disabled=true;
 panel.querySelector('#audit-live').disabled=true;
 document.querySelector('#audit-motion-style').sheet.disabled=realTime;
 const started=performance.now();
 const original={setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,random:Math.random,throwYut:app.throwYut,commitMove:app.commitMove,update:app.componentDidUpdate};
 const report={method:realTime?'Real mounted App, all seats AI, native timers at normal speed and original CSS animations':'Real mounted App.checkAI/throwYut/commitMove/moveTick/componentDidUpdate, all seats AI, virtual timers preserving delays/order; CSS animation disabled',realTime,games:0,throws:0,moves:0,bonusYut:0,bonusMo:0,bonusCapture:0,nak:0,violations:[],configurations:[],maxImmediateThrows:0,...realTime?{trace:[]}: {}};
 let active=false,lastGame,pending=null,credits=1,clock=0,nextId=1,queue=new Map(),context={},chain=0;
 const check=(value,message)=>{if(!value){report.violations.push({message,...context,clock,credits});throw Error(message)}};
 function observe(){
  if(!active||app.state.game===lastGame)return;
  const game=app.state.game,before=lastGame,actor=before.current;
  let outcome;
  check(!!pending,'Game state changed without a throw or a move');
  if(pending.kind==='roll'){
   const faces=app.state.sticks.map(s=>s.front),count=faces.filter(Boolean).length;
   const value=count===0?4:count===4?5:count===1&&faces[0]?-1:count;
   const nak=app.state.sticks.some(s=>s.nak);
   outcome=nak?'낙':({'-1':'빽도',1:'도',2:'개',3:'걸',4:'윷',5:'모'})[value];
   check(game.throwCount===before.throwCount+1,'Throw settled more than once or throwCount skipped');
   if(nak)report.nak++;
   else if(value===4){credits++;report.bonusYut++}
   else if(value===5){credits++;report.bonusMo++}
   else check(game.phase!=='roll'||game.current!==actor,'Ordinary roll granted another throw');
   chain++;report.maxImmediateThrows=Math.max(report.maxImmediateThrows,chain);
   if(!nak&&(value===4||value===5))check(game.current===actor&&game.phase==='roll','Yut/mo did not retain the turn');
   if(nak&&before.rolls.length===0)check(game.current===(actor+1)%game.players.length,'Nak incorrectly retained the turn');
   report.throws++;
  }else{
   check(game.throwCount===before.throwCount,'Movement unexpectedly changed throwCount');
   if(pending.capture&&game.winner===null){credits++;report.bonusCapture++;check(game.phase==='roll'&&game.current===actor,'Capture failed to grant one bonus throw')}
   else if(game.winner===null&&game.current===actor)check(game.phase==='move','Non-capture move granted another throw');
   report.moves++;chain=0;
  }
  if(game.current!==actor){
   check(game.current===(actor+1)%game.players.length&&game.turn===before.turn+1,'Skipped, duplicated, or reordered player turn');
   check(credits===0&&game.rolls.length===0,'Next player inherited throw credits or stored results');
   credits=1;chain=0;
  }
  check((game.phase==='roll')===(credits===1)||game.winner!==null,'Phase differs from independently earned throw credits');
  if(realTime)report.trace.push({elapsedMs:Math.round(performance.now()-started),turn:before.turn,player:actor,action:pending.kind,outcome,captured:pending.capture||0,nextPlayer:game.current,nextPhase:game.phase,storedResults:game.rolls.map(r=>r.value)});
  pending=null;lastGame=game;
 }
 app.componentDidUpdate=function(...args){observe();return original.update.apply(this,args)};
 app.throwYut=function(mode,ai){
  if(active){check(!pending,'AI scheduled a second action before the first settled');check(this.state.game.phase==='roll'&&this.state.stage!=='throwing'&&!this.state.moving,'AI scheduled throw during an unavailable phase');check(ai&&this.state.game.players[this.state.game.current].ai,'Non-AI action in AI-only audit');check(credits===1,'AI threw without earned throw credit');credits--;pending={kind:'roll'}}
  return original.throwYut.call(this,mode,ai);
 };
 app.commitMove=function(option,ai){
  if(active){check(!pending&&credits===0,'Duplicate or premature move timer');check(this.state.game.phase==='move'&&!this.state.moving,'AI scheduled move during an unavailable phase');
   const game=this.state.game,capture=option.destination==='FIN'||option.destination==='WAIT'?0:game.pieces.filter(p=>p.player!==game.current&&p.node===option.destination).length;
   pending={kind:'move',capture};
  }
  return original.commitMove.call(this,option,ai);
 };
 try{
  app.startGame({mode:'ai',count:2,board:'A',backdo:true});
  app.setState({sound:false});
  if(!realTime){
   window.setTimeout=(fn,ms=0,...args)=>{const id=nextId++;queue.set(id,{due:clock+Number(ms),fn:()=>fn(...args)});return id};
   window.clearTimeout=id=>{if(!queue.delete(id))original.clearTimeout.call(window,id)};
  }
  for(const [board,count] of (realTime?[['B',4]]:[['A',2],['A',3],['A',4],['B',2],['B',3],['B',4]])){
   active=false;queue.clear();app.aiTimer=null;app.timers=[];credits=1;chain=0;pending=null;clock=0;
   context={board,count,seed:910000+count+(board==='B'?100:0)};
   Math.random=generator(context.seed);
   app.startGame({mode:'ai',count,board,backdo:true});
   const bots={...app.state.game,players:app.state.game.players.map(p=>({...p,ai:true,label:p.name+' AI'}))};
   lastGame=bots;active=true;
   const throwsBefore=report.throws,movesBefore=report.moves;
   app.setState({game:bots});
   let jobs=0;
   while(app.state.game.winner===null&&jobs++<40000){
    if(realTime){
     if(report.throws>=20)break;
     status.textContent=`실시간 B · AI 4명 · ${app.state.game.turn}턴 / ${report.throws}/20회 던짐`;
     await new Promise(resolve=>original.setTimeout.call(window,resolve,50));continue;
    }
    check(queue.size>0,'AI scheduler stalled with no pending callback');
    let chosenId,chosen;
    for(const [id,job] of queue)if(!chosen||job.due<chosen.due||(job.due===chosen.due&&id<chosenId)){chosenId=id;chosen=job}
    queue.delete(chosenId);clock=chosen.due;chosen.fn();
    if(jobs%40===0){status.textContent=`${board} · AI ${count}명 · ${app.state.game.turn}턴 / ${report.throws}회 던짐`;await yieldTask()}
   }
   check(realTime?report.throws>=20:app.state.game.winner!==null,realTime?'Real-time sample stopped early':'AI-only browser game did not finish');
   if(app.state.game.winner!==null){check(app.state.game.pieces.filter(p=>p.player===app.state.game.winner&&p.node==='FIN').length===4,'Winner lacks four finished pieces');report.games++}
   report.configurations.push({...context,throws:report.throws-throwsBefore,moves:report.moves-movesBefore,turns:app.state.game.turn,winner:app.state.game.winner,completed:app.state.game.winner!==null,...realTime?{polls:jobs}:{virtualCallbacks:jobs}});
  }
  status.textContent='완료';
 }catch(error){report.error=String(error);status.textContent='오류 발견'}finally{
  if(realTime){if(app.aiTimer!==null)original.clearTimeout.call(window,app.aiTimer);app.timers.forEach(id=>original.clearTimeout.call(window,id))}
  active=false;queue.clear();app.aiTimer=null;app.timers=[];
  window.setTimeout=original.setTimeout;window.clearTimeout=original.clearTimeout;Math.random=original.random;
  app.throwYut=original.throwYut;app.commitMove=original.commitMove;app.componentDidUpdate=original.update;
  output.textContent=JSON.stringify(report,null,2);button.disabled=false;panel.querySelector('#audit-live').disabled=false;
  try{await fetch('http://127.0.0.1:4178/results',{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify({profile:realTime?'ai-turn-live':'ai-turn-browser',date:new Date().toISOString(),...report})})}catch(error){status.textContent+=' (저장 서버 미연결)'}
 }
}
button.onclick=()=>runAudit(false);
panel.querySelector('#audit-live').onclick=()=>runAudit(true);
