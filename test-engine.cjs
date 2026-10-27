const assert=require('assert');
const M=require('./build-test/mapEngine.js');
const E=require('./build-test/gameEngine.js');
let checks=0;const check=(cond,msg)=>{assert(cond,msg);checks++};
const originalRandom=Math.random;
// Explicit outcomes for every visible XXX pattern (bit i = stick i).
const expectedByMask=[4,1,1,2,1,2,2,3,1,2,2,3,2,3,3,5];
try{
 for(let mask=0;mask<16;mask++)for(const backdo of [false,true]){
  const faces=Array.from({length:4},(_,i)=>!!(mask&(1<<i)));
  let index=0;Math.random=()=>faces[index++]?0.25:0.75;
  const rolled=E.rollSticks(backdo);
  const expected=backdo&&mask===1?-1:expectedByMask[mask];
  check(rolled.faces.every((face,i)=>face===faces[i]),'Rendered XXX faces must match roll');
  check(rolled.value===expected,'Face combination '+mask+' backdo='+backdo);
  if(mask===15||mask===0){
   const bonus=E.throwResult(E.createGame({}),rolled,false);
   check(bonus.phase==='roll'&&bonus.rolls[0].value===(mask===15?5:4),'Mo and yut grant another throw');
  }
 }
}finally{Math.random=originalRandom;}
for(const type of ['A','B']){
 const graph=M.makeGraph(type);
 check(M.validateGraph(graph).length===0,'Map '+type+' graph has errors');
 const first=M.movePiece(graph,M.initialState(),1);
 const firstHistory=JSON.stringify(first.history);
 const reversed=M.movePiece(graph,first,-1);
 check(reversed.node==='O0'&&reversed.lane==='outer','Do then backdo reaches finish checkpoint on '+type);
 check(reversed.lastPath.join(' ')==='O1 O0','Backdo animates directly to checkpoint');
 check(JSON.stringify(first.history)===firstHistory,'Backdo preserves original piece state');
 check(M.movePiece(graph,M.movePiece(graph,reversed,-1),-1).node==='O22','Repeated backdo continues around outer finish approach');
 for(let pips=1;pips<=5;pips++)check(M.movePiece(graph,reversed,pips).node==='FIN','Forward roll completes from finish checkpoint');
 const finishGame=E.createGame({board:type,mode:'local'});
 finishGame.pieces[0]={...finishGame.pieces[0],...first};
 finishGame.pieces[1]={...finishGame.pieces[1],...first};
 finishGame.pieces[4]={...finishGame.pieces[4],...reversed};
 finishGame.phase='move';finishGame.rolls=[{id:'back-start',value:-1,faces:[true,false,false,false]}];
 const backOption=E.moveOptions(finishGame,'p0-0','back-start')[0];
 check(backOption.destination==='O0','Game offers finish checkpoint for backdo');
 check(!E.moveOptions(finishGame,'p0-2','back-start').length,'Waiting pieces cannot use backdo');
 const backResult=E.resolveMove(finishGame,backOption);
 check(backResult.meta.moved===2&&backResult.meta.captured===1,'Backdo carries stack and captures at finish checkpoint');
 check(backResult.game.pieces[0].node==='O0'&&backResult.game.pieces[4].node==='WAIT','Backdo keeps mover on board and captured opponent in reserve');
 const nearWin=backResult.game;
 nearWin.pieces[2]={...nearWin.pieces[2],node:'FIN'};nearWin.pieces[3]={...nearWin.pieces[3],node:'FIN'};
 nearWin.phase='move';nearWin.rolls=[{id:'finish-start',value:1,faces:[false,true,false,false]}];
 const completed=E.resolveMove(nearWin,E.moveOptions(nearWin,'p0-0','finish-start')[0]);
 check(completed.meta.moved===2&&completed.game.winner===0,'Forward move from checkpoint completes stack and wins');
 let p=M.initialState(),res=M.movePiece(graph,p,5,'normal');
 check(res.node==='O5','Five steps should reach O5');
 res=M.movePiece(graph,res,1,'normal');
 check(res.node==='O6','One more step should reach O6');
 const opts=M.getOptions(graph,res);
 check(opts.some(o=>o.value==='shortcut'),'Shortcut should be offered at O6');
 const a=M.movePiece(graph,res,2,'outer'),b=M.movePiece(graph,res,2,'shortcut');
 check(a.node!==b.node,'Shortcut must differ from outer');
 const back=M.movePiece(graph,b,-1,'normal');
 check(back.node===b.history[b.history.length-2].node,'Backdo should reverse actual edge');
 for(const node of ['O6','O12']){
  const junction={...M.initialState(),node};
  check(M.suggestedOption(M.getOptions(graph,junction))==='shortcut','Default junction route is shortcut');
  check(M.movePiece(graph,junction,1).node===(type==='A'?(node==='O6'?'NE1':'NW1'):(node==='O6'?'I0':'W0')),'Default move enters shortcut');
  check(M.movePiece(graph,junction,1,'outer').node===(node==='O6'?'O7':'O13'),'Explicit outer route stays available');
  const game=E.createGame({board:type,mode:'local'});
  game.pieces[0]={...game.pieces[0],...junction};game.phase='move';game.rolls=[{id:'junction',value:1,faces:[false,true,false,false]}];
  const options=E.moveOptions(game,'p0-0','junction');
  const preferred=M.suggestedOption(options.map(o=>({value:o.choice,label:o.label})));
  const chosen=options.find(o=>o.choice===preferred);
  check(chosen.choice==='shortcut','UI default selects legal shortcut');
  check(game.pieces[0].node===node,'Selecting route does not move human piece');
  check(E.resolveMove(game,chosen).game.pieces[0].node===chosen.destination,'Confirmed shortcut resolves');
 }
 check(M.movePiece(graph,{...M.initialState(),node:'O5'},2).node==='O7','Passing junction must not enter shortcut');
 for(const route of Object.values(graph.routes))
  check(route.nodes[0]==='O0'&&route.nodes.at(-1)==='O0','Route should return home');
}
const center={...M.initialState(),node:'C',lane:'ne'};
check(M.movePiece(M.makeGraph('A'),center,1).node==='SE1','Center stop defaults toward finish');
check(M.movePiece(M.makeGraph('A'),center,1,'straight').node==='SW1','Explicit straight center route remains available');
check(M.movePiece(M.makeGraph('A'),{...center,node:'NE2'},2).node==='SW1','Passing center continues straight');
let g=E.createGame({mode:'local',count:2,board:'A'});
g=E.throwResult(g,{value:1,faces:[true,false,false,false]},false);
check(g.phase==='move','Roll must enter move phase');
let moves=E.legalActions(g);
check(moves.length===4,'Four waiting pieces need legal actions');
let r=E.resolveMove(g,moves[0]);
check(r.meta.path.join(' ')==='WAIT O1','Manual start path');
g=r.game;check(g.pieces[0].node==='O1','Manual move to O1');
check(g.current===1,'Turn changes after result used');
g=E.throwResult(g,{value:1,faces:[true,false,false,false]},false);
r=E.resolveMove(g,E.legalActions(g)[0]);
check(r.meta.captured===1,'Enemy captured');
check(r.game.pieces[0].node==='WAIT','Captured piece returns to WAIT');
check(r.game.phase==='roll','Capture gives bonus throw');
let n=E.throwResult(r.game,{value:5,faces:[false,false,false,false]},true);
check(n.current===0,'Nak passes turn');
check(n.rolls.length===0,'Nak clears results');
// B1: AI and human throw with the same landing mode.
const appSrc=require('fs').readFileSync(__dirname+'/src-ts/App.tsx','utf8');
check(!/throwYut\('safe'/.test(appSrc)&&/throwYut\('random',true\)/.test(appSrc),'AI throws with same random landing mode as humans');
// B2: no force parameter; fixed baseline nak risk.
check(E.generateLanding.length===1&&!/power-row|\.force\b/.test(appSrc),'generateLanding takes only mode; no force slider');
let naks=0;for(let i=0;i<20000;i++)if(E.generateLanding('random').nak)naks++;
check(naks>40&&naks<400,'Random landing uses fixed baseline nak risk: '+naks);
// B3: nak on bonus throw voids only that throw.
let bonus=E.throwResult(E.createGame({mode:'local',count:2,board:'A'}),{value:4,faces:[false,false,false,false]},false);
bonus=E.throwResult(bonus,{value:1,faces:[true,false,false,false]},true);
check(bonus.current===0&&bonus.phase==='move'&&bonus.rolls.length===1&&bonus.rolls[0].value===4,'Nak keeps stored yut and enters move');
r=E.resolveMove(bonus,E.legalActions(bonus)[0]);
check(r.game.current===1&&r.game.phase==='roll','Turn passes after stored results used');
let stack=E.createGame({mode:'local',count:2,board:'B'});
const one=M.movePiece(M.makeGraph('B'),M.initialState(),1,'normal');
stack.pieces[0]={...stack.pieces[0],node:one.node,lane:one.lane,history:one.history};
stack.phase='move';stack.rolls=[{id:'r',value:1}];
r=E.resolveMove(stack,E.moveOptions(stack,'p0-1','r')[0]);
check(r.meta.joined===1,'Own pieces stack');
stack=r.game;stack.current=0;stack.phase='move';stack.rolls=[{id:'s',value:1}];
r=E.resolveMove(stack,E.moveOptions(stack,'p0-0','s')[0]);
check(r.meta.moved===2,'Stack travels together');
let games=0;
for(const board of ['A','B'])for(const count of [2,3,4])for(let seed=0;seed<25;seed++){
 let state=E.createGame({mode:'local',count,board}),steps=0;
 while(state.winner===null&&steps++<4500){
  if(state.phase==='roll')state=E.throwResult(state,E.rollSticks(true),false);
  else if(state.phase==='move'){
   const list=E.legalActions(state);
   if(!list.length){state=E.normalize(state);continue;}
   const choice=list[Math.floor(Math.random()*list.length)];
   const resolved=E.resolveMove(state,choice);
   check(!!resolved,'Every legal option resolves');
   state=resolved.game;
  }else throw Error('Unknown phase '+state.phase);
 }
 assert(state.winner!==null,'Game did not finish: '+board+'/'+count+'/'+seed+'/'+steps);
 games++;
}
console.log('OK: '+checks+' assertions across '+games+' completed games, maps A and B');
require('./test-ai.cjs');
