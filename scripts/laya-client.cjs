const {spawn}=require('node:child_process');
const readline=require('node:readline');
const path=require('node:path');
const E=require('../build-test/gameEngine.js');
const {chooseAIAction}=require('../build-test/aiEngine.js');

class LayaWorker{
 constructor({command=process.env.LAYA_PYTHON||'python3',args=[path.join(__dirname,'laya-worker.py')],startupMs=120000,decisionMs=5000}={}){
  this.pending=new Map();this.sequence=0;this.dead=false;this.decisionMs=decisionMs;
  this.child=spawn(command,args,{stdio:['pipe','pipe','ignore'],env:process.env});
  this.ready=new Promise((resolve,reject)=>{
   this.startTimer=setTimeout(()=>this.fail(new Error('Laya model startup timed out')),startupMs);
   this.resolveReady=resolve;this.rejectReady=reject;
  });
  this.lines=readline.createInterface({input:this.child.stdout});
  this.lines.on('line',line=>{
   let value;try{value=JSON.parse(line);}catch{return this.fail(new Error('Invalid Laya JSONL response'));}
   if(value.ready===true){clearTimeout(this.startTimer);this.resolveReady(value);return;}
   if(value.error&&!value.id){this.fail(new Error(`Laya startup failed: ${value.error} (${value.exception||'unknown'})`));return;}
   const pending=this.pending.get(value.id);if(!pending)return;
   clearTimeout(pending.timer);this.pending.delete(value.id);
   if(value.error)pending.reject(new Error(value.error));else pending.resolve(value);
  });
  this.child.on('error',error=>this.fail(error));
  this.child.on('exit',()=>this.fail(new Error('Laya worker stopped')));
  this.child.stdin.on('error',error=>this.fail(error));
 }
 fail(error){
  if(this.dead)return;this.dead=true;clearTimeout(this.startTimer);this.rejectReady(error);
  for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(error);}
  this.pending.clear();this.child.kill();this.lines.close();
 }
 async predict(payload){
  await this.ready;if(this.dead)throw Error('Laya worker unavailable');
  const id=String(++this.sequence);
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>this.fail(new Error('Laya decision timed out')),this.decisionMs);
   this.pending.set(id,{resolve,reject,timer});
   this.child.stdin.write(JSON.stringify({...payload,id})+'\n');
  });
 }
 close(){this.fail(new Error('Laya worker closed'));}
}

function candidatesFor(game){
 const fallback=chooseAIAction(game);if(!fallback)return {fallback,options:[],criteria:{},state:''};
 const same=(a,b)=>a.pieceId===b.pieceId&&a.rollId===b.rollId&&a.choice===b.choice;
 const unique=new Map();
 for(const option of E.legalActions(game)){
  const roll=game.rolls.find(r=>r.id===option.rollId);
  const key=`${option.source==='WAIT'?'WAIT':option.pieceId}/${roll.value}/${option.choice}`;
  if(unique.has(key))continue;
  const resolved=E.resolveMove(game,option);
  const meta=resolved.meta;
  const summary=`Move ${meta.moved} piece(s) ${roll.value} steps ${option.choice}, ${meta.from} to ${meta.to}; capture ${meta.captured}, join ${meta.joined}, finish ${meta.to==='FIN'?meta.moved:0}, win ${meta.winner===game.current}.`;
  const score=(meta.winner!==null?100000:0)+(meta.to==='FIN'?meta.moved*100:0)+meta.captured*60+meta.joined*10+(option.choice==='shortcut'||option.choice==='finish'?10:0);
  unique.set(key,{option,summary,score});
 }
 const others=[...unique.values()].filter(c=>!same(c.option,fallback)).sort((a,b)=>b.score-a.score);
 const base=[...unique.values()].find(c=>same(c.option,fallback));
 const chosen=[base,...others.slice(0,3)];
 // Do not always place the baseline first; rotate without touching the dice RNG.
 const rotation=(game.turn+game.current)%chosen.length;
 chosen.push(...chosen.splice(0,rotation));
 return {fallback,options:chosen.map(c=>c.option),criteria:Object.fromEntries(chosen.map((c,i)=>['a'+i,c.summary])),
  state:`Map ${game.config.board}, player ${game.current}. O0 is the finish checkpoint; FIN is completed, WAIT is reserve. A: O6->NE1->NE2->C; O12->NW1->NW2->C; center can exit via SE1->SE2->O0 when stopped. B: O6/O12 lead to inner ring. Pieces: ${game.pieces.map(p=>`P${p.player}:${p.node}`).join(' ')}. Stored results: ${game.rolls.map(r=>r.value).join(',')}. Choose among the supplied legal outcomes.`};
}

async function chooseLayaAction(game,worker){
 const input=candidatesFor(game);
 if(input.options.length<2)return {action:input.fallback,source:'forced',inferenceMs:0};
 try{
  const answer=await worker.predict({state:input.state,criteria:input.criteria});
  if(!Object.hasOwn(input.criteria,answer.choice))throw Error('Illegal candidate');
  return {action:input.options[Number(answer.choice.slice(1))],source:'laya',confidence:answer.confidence,inferenceMs:answer.elapsedMs};
 }catch(error){return {action:input.fallback,source:'fallback',reason:error.message,inferenceMs:0};}
}
module.exports={LayaWorker,candidatesFor,chooseLayaAction};
