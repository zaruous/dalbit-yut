const {spawn}=require('node:child_process');
const readline=require('node:readline');
const path=require('node:path');
const E=require('../build-test/gameEngine.js');
const M=require('../build-test/mapEngine.js');
const {chooseAIAction}=require('../build-test/aiEngine.js');

const graphs={S:M.makeGraph('S'),A:M.makeGraph('A'),B:M.makeGraph('B')};
const rollNames={'-1':'back-do','1':'do','2':'gae','3':'geol','4':'yut','5':'mo'};
const rollChances=[[-1,1/16],[1,3/16],[2,6/16],[3,4/16],[4,1/16],[5,1/16]];
const distances=new Map();

function distance(board,piece){
 const key=`${board}/${piece.node}/${piece.lane}`;if(distances.has(key))return distances.get(key);
 const graph=graphs[board],queue=[{node:piece.node,lane:piece.lane,steps:0}],seen=new Set();
 for(let i=0;i<queue.length;i++){
  const pos=queue[i];if(pos.node==='FIN'){distances.set(key,pos.steps);return pos.steps;}
  const id=`${pos.node}/${pos.lane}`;if(seen.has(id))continue;seen.add(id);
  for(const choice of M.getOptions(graph,pos)){
   const next=M.movePiece(graph,{...pos,history:[],lastPath:[],lastResult:''},1,choice.value);
   queue.push({node:next.node,lane:next.lane,steps:pos.steps+1});
  }
 }
 return graph.outerSteps+2;
}

function reachChance(game,player,target){
 if(target==='WAIT'||target==='FIN')return 0;
 const graph=graphs[game.config.board],pieces=E.uniqueMovablePieces({...game,current:player});let chance=0;
 for(const [value,probability] of rollChances){
  if(value<0&&!game.config.backdo)continue;
  let reaches=false;
  for(const piece of pieces){
   if(value<0&&piece.node==='WAIT')continue;
   const choices=value<0?[{value:'normal'}]:M.getOptions(graph,piece);
   for(const choice of choices){
    const moved=M.movePiece(graph,piece,value,choice.value);
    if(moved.lastPath.length>1&&moved.node===target){reaches=true;break;}
   }
   if(reaches)break;
  }
  if(reaches)chance+=probability;
 }
 return chance;
}

function positions(game,history=false){
 return game.players.map(player=>{
  const pieces=game.pieces.filter(piece=>piece.player===player.id).map(piece=>{
   const trail=history&&piece.node!=='WAIT'&&piece.node!=='FIN'?`, recent=${piece.history.slice(-6).map(step=>`${step.node}/${step.lane}`).join('>')}`:'';
   return `${piece.id}=${piece.node}/${piece.lane}${trail}`;
  });
  return `P${player.id}[${pieces.join('; ')}]`;
 }).join(' ');
}

function rulesFor(board){
 const common=`House rules: each player has 4 pieces; first to put all 4 in FIN wins. Roll odds are back-do -1:1/16, do +1:3/16, gae +2:6/16, geol +3:4/16, yut +4:1/16, mo +5:1/16. Yut, mo, and capturing grant another throw. Stored rolls may be used in any order. Friendly pieces on one node form a stack which moves together; an enemy landing there captures the whole stack and sends it to WAIT. A shortcut is available only when a move starts exactly on ${graphs[board].cornerIds[1]} or ${graphs[board].cornerIds[2]}. WAIT cannot use back-do. O1 back-do goes to the on-board O0 finish checkpoint; a later forward step from O0 reaches FIN. Landing on O0 is not yet FIN.`;
 const map=board==='S'?'Map S (standard square) routes: outer O0>O1>...>O19>O0>FIN. From O5 choose outer or O5>NE1>NE2>C>SW1>SW2>O15. If a move starts at C after the NE route, choose SW continuation or C>SE1>SE2>O0. From O10 choose outer or O10>NW1>NW2>C>SE1>SE2>O0.':board==='A'?'Map A routes: outer O0>O1>...>O23>O0>FIN. From O6 choose outer or O6>NE1>NE2>C>SW1>SW2>O18. If a move starts at C after the NE route, choose SW continuation or C>SE1>SE2>O0. From O12 choose outer or O12>NW1>NW2>C>SE1>SE2>O0.'
  :'Map B routes: outer O0>O1>...>O23>O0>FIN. From O6 choose outer or O6>I0>I1>I2>I3>I4>I5>I6>I7>I8>R1>O0. From O12 choose outer or O12>W0>I4>I5>I6>I7>I8>R1>O0.';
 return `${common} ${map}`;
}

function richSummary(game,candidate){
 const {option,resolved}=candidate,roll=game.rolls.find(item=>item.id===option.rollId),after=resolved.game,meta=resolved.meta;
 const moved=after.pieces.find(piece=>piece.id===option.pieceId);
 const threats=after.players.filter(player=>player.id!==game.current).map(player=>`P${player.id}=${(reachChance(after,player,moved.node)*100).toFixed(1)}%`).join(',');
 const remaining=after.rolls.length?after.rolls.map(item=>`${rollNames[item.value]}(${item.value})`).join(','):'none';
 return `Use ${rollNames[roll.value]} (${roll.value}) on ${option.pieceId}, stack ${meta.moved}, route ${option.choice}, path ${meta.path.join('>')}. Immediate: capture ${meta.captured}, join ${meta.joined}, finish ${meta.to==='FIN'?meta.moved:0}, win ${meta.winner===game.current}. After: ${positions(after)} Remaining rolls: ${remaining}; phase ${after.phase}, current P${after.current}. Moved stack distance to FIN ${distance(game.config.board,moved)}; opponent one-roll reach to ${moved.node}: ${threats||'none'}.`;
}

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

function candidatesFor(game,inputVersion=process.env.LAYA_INPUT_VERSION||'v1'){
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
  unique.set(key,{option,summary,score,resolved});
 }
 const others=[...unique.values()].filter(c=>!same(c.option,fallback)).sort((a,b)=>b.score-a.score);
 const base=[...unique.values()].find(c=>same(c.option,fallback));
 const chosen=[base,...others.slice(0,3)];
 // Do not always place the baseline first; rotate without touching the dice RNG.
 const rotation=(game.turn+game.current)%chosen.length;
 chosen.push(...chosen.splice(0,rotation));
 if(inputVersion==='v2')return {fallback,options:chosen.map(c=>c.option),criteria:Object.fromEntries(chosen.map((c,i)=>['a'+i,richSummary(game,c)])),
  state:`${rulesFor(game.config.board)} Current turn: P${game.current}, phase ${game.phase}, turn ${game.turn}. Full piece state (node/lane and recent route history): ${positions(game,true)} Stored results: ${game.rolls.map(r=>`${rollNames[r.value]}(${r.value})`).join(',')}. All supplied outcomes are legal; compare their resulting states and long-term winning prospects.`};
 if(inputVersion!=='v1')throw Error(`Unknown LAYA_INPUT_VERSION ${inputVersion}`);
 return {fallback,options:chosen.map(c=>c.option),criteria:Object.fromEntries(chosen.map((c,i)=>['a'+i,c.summary])),
  state:`Map ${game.config.board}, player ${game.current}. O0 is the finish checkpoint; FIN is completed, WAIT is reserve. ${game.config.board==='S'?'S: 20-node square outer track; O5->NE1->NE2->C; O10->NW1->NW2->C; stop at C to exit via SE1->SE2->O0.':'A: O6->NE1->NE2->C; O12->NW1->NW2->C; center can exit via SE1->SE2->O0 when stopped. B: O6/O12 lead to inner ring.'} Pieces: ${game.pieces.map(p=>`P${p.player}:${p.node}`).join(' ')}. Stored results: ${game.rolls.map(r=>r.value).join(',')}. Choose among the supplied legal outcomes.`};
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
