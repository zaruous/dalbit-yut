const assert=require('node:assert/strict');
const E=require('./build-test/gameEngine.js');
const M=require('./build-test/mapEngine.js');
const {chooseAIAction}=require('./build-test/aiEngine.js');
let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
function scenario(own,enemy,rolls,board='A'){
 const game=E.createGame({mode:'local',board}),graph=M.makeGraph(board);
 function position(node){
  if(node==='FIN')return {...M.initialState(),node:'FIN',lane:'complete'};
  let piece=M.initialState();if(node==='WAIT')return piece;
  const steps=node==='O0'?24:Number(node.slice(1));
  for(let i=0;i<steps;i++)piece=M.movePiece(graph,piece,1,M.getOptions(graph,piece).find(o=>o.value==='outer')?.value);
  return piece;
 }
 own.forEach((node,i)=>game.pieces[i]={...game.pieces[i],...position(node)});
 enemy.forEach((node,i)=>game.pieces[4+i]={...game.pieces[4+i],...position(node)});
 game.phase='move';game.rolls=rolls.map((value,i)=>({id:'test-'+i,value,faces:[]}));return game;
}
for(const board of ['A','B']){
 let game=scenario(['O0','O6','FIN','FIN'],[],[1],board);
 check(chooseAIAction(game).destination==='FIN','Prefer finishing to deploying or shortcutting');
 game=scenario(['O8','WAIT','FIN','FIN'],['O10'],[2],board);
 check(chooseAIAction(game).destination==='O10','Capture opponent and earn bonus throw');
 game=scenario(['O8','O16','FIN','FIN'],['O17'],[2],board);
 check(chooseAIAction(game).pieceId==='p0-0','Prefer safer equal-progress move over a likely recapture');
 game=scenario(['O1','O10','FIN','FIN'],[],[-1],board);
 check(chooseAIAction(game).destination==='O0','Recognize backdo shortcut to finish checkpoint');
 game=scenario(['O0','FIN','FIN','FIN'],[],[1,3],board);
 check(E.resolveMove(game,chooseAIAction(game)).game.winner===0,'Take an immediate win');
}
for(const rolls of [[1,3],[3,1]]){
 const game=scenario(['O6','FIN','FIN','FIN'],[],rolls);
 const action=chooseAIAction(game);
 check(game.rolls.find(r=>r.id===action.rollId).value===3,'Plan stored result order: stop at center first');
 const after=E.resolveMove(game,action).game;
 check(action.destination==='C','Set up the center junction');
 check(chooseAIAction(after).choice==='finish','Then choose the shorter finish route');
}
const unchanged=scenario(['O6','O8','WAIT','WAIT'],['O10'],[1,3]);
const before=JSON.stringify(unchanged);
const originalRandom=Math.random;
let first,second;
Math.random=()=>{throw Error('AI must not consume or inspect future random throws');};
try{first=chooseAIAction(unchanged);second=chooseAIAction(unchanged);}finally{Math.random=originalRandom;}
assert.deepEqual(first,second);checks++;
check(JSON.stringify(unchanged)===before,'Search must not change pieces, history, rolls, turns or logs');
check(chooseAIAction(E.createGame({}))===null,'Do not move during roll phase');
check(chooseAIAction(scenario(['WAIT','WAIT','WAIT','WAIT'],[],[-1]))===null,'Return no action if all pieces wait on backdo');

// Finish games with the new decision maker at every seat, including 3/4 players.
for(const count of [2,3,4]){
 const watch=E.createGame({mode:'spectate',count,board:'B'});
 check(watch.config.mode==='spectate'&&watch.players.length===count&&watch.players.every(p=>p.ai),'Spectator mode must have only AI seats');
 check(watch.players.every(p=>watch.pieces.filter(piece=>piece.player===p.id).length===4),'Every spectator AI must own four pieces');
 check(new Set(watch.players.map(p=>p.label)).size===count,'Spectator AI labels must be distinct');
 const versus=E.createGame({mode:'ai',count});
 check(!versus.players[0].ai&&versus.players.slice(1).every(p=>p.ai),'Human versus AI retains exactly one human');
 check(E.createGame({mode:'local',count}).players.every(p=>!p.ai),'Local mode retains all human seats');
}
let games=0,randomState=1234567;
Math.random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
try{
 for(const board of ['S','A','B'])for(const count of [2,3,4])for(let seed=0;seed<4;seed++){
  let game=E.createGame({board,count,mode:'spectate'}),steps=0;
  while(game.winner===null&&steps++<3000){
   if(game.phase==='roll'){game=E.throwResult(game,E.rollSticks(true),false);continue;}
   const action=chooseAIAction(game);
   if(!action){check(E.legalActions(game).length===0,'Null action only when no legal moves');game=E.normalize(game);continue;}
   const result=E.resolveMove(game,action);check(!!result,'AI returns an executable legal action');game=result.game;
  }
  check(game.winner!==null,'AI game must finish');games++;
 }
}finally{Math.random=originalRandom;}
console.log(`OK: AI ${checks} assertions, tactics and ${games} completed 2–4 player games`);
