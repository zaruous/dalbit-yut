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
for(const board of ['S','A','B','G'])for(const count of [2,3,4])for(let seed=0;seed<25;seed++){
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
const gGraph=M.makeGraph('G');
check(M.validateGraph(gGraph).length===0,'Spiral graph G validates cleanly');
check(gGraph.outerIds.length===25&&Object.keys(gGraph.xy).length===30,'Spiral graph has 25 outer, 4 gates, and 1 center');
let gPiece=M.initialState();
gPiece=M.movePiece(gGraph,gPiece,5);
check(gPiece.node==='O5','Five steps reach O5 on G');
check(M.movePiece(gGraph,gPiece,2,'shortcut').node==='O17','Shortcut from O5 passes G0 to O17');
check(M.movePiece(gGraph,gPiece,1,'outer').node==='O6','Outer choice from O5 goes to O6');
gPiece=M.movePiece(gGraph,gPiece,2,'shortcut');
gPiece=M.movePiece(gGraph,gPiece,3);
check(gPiece.node==='O20','Three steps from O17 reach O20');
gPiece=M.movePiece(gGraph,gPiece,2,'shortcut');
check(gPiece.node==='C','Shortcut from O20 passes G3 to center C');
check(M.movePiece(gGraph,gPiece,1).node==='FIN','One step from C finishes on G');
const gBack=M.movePiece(gGraph,M.movePiece(gGraph,M.initialState(),1),-1);
check(gBack.node==='C'&&M.movePiece(gGraph,gBack,-1).node==='O24','Backdo from O1 reaches C then O24 on G');
// Tactical Items verification (일반전 vs 아이템전 & 참가 인원별 중반 등장)
let normalGame=E.createGame({mode:'local',count:2,board:'G'});
check(!normalGame.config.itemMode&&!normalGame.itemsUnlocked&&normalGame.players[0].items.length===0&&Object.keys(normalGame.itemNodes).length===0,'Default normal mode has no items');
for(let t=0;t<6;t++)normalGame=E.nextTurn(normalGame);
check(!normalGame.itemsUnlocked&&normalGame.players[0].items.length===0,'Normal mode never unlocks items at mid-game');

check(E.itemUnlockTurn(2)===5&&E.itemUnlockTurn(3)===7&&E.itemUnlockTurn(4)===9,'Mid-game item unlock turn scales with player count');
let itemGame=E.createGame({mode:'local',count:2,board:'G',itemMode:true});
check(itemGame.config.itemMode&&!itemGame.itemsUnlocked&&itemGame.players[0].items.length===0&&Object.keys(itemGame.itemNodes).length===0,'Item mode starts empty before mid-game');
for(let t=1;t<itemGame.itemUnlockTurn;t++){
 check(!itemGame.itemsUnlocked,'Items remain locked before turn '+itemGame.itemUnlockTurn);
 itemGame=E.nextTurn(itemGame);
}
check(itemGame.itemsUnlocked&&itemGame.players.every(p=>p.items.length===1)&&Object.keys(itemGame.itemNodes).length===4,'Mid-game turn unlocks items and spawns count+2 pouches');
// 1. Geumjul saves nak
itemGame.players[0].items=[{id:'it-g',type:'geumjul'}];
itemGame=E.useItem(itemGame,'it-g');
check(itemGame.players[0].geumjulArmed&&itemGame.players[0].items.length===0,'Geumjul armed');
itemGame=E.throwResult(itemGame,{value:3,faces:[true,true,true,false]},true);
check(itemGame.phase==='move'&&itemGame.rolls.length===1&&!itemGame.players[0].geumjulArmed,'Geumjul saves nak throw');
// 2. Key allows pass-through shortcut on G (O4 + 2 steps passes O5 -> G0 -> O17)
let keyGame=E.unlockItemsNow(E.createGame({mode:'local',count:2,board:'G',itemMode:true}));
keyGame.pieces[0]={...keyGame.pieces[0],...M.movePiece(gGraph,M.initialState(),4)};
keyGame.phase='move';keyGame.rolls=[{id:'r-key',value:2,faces:[true,true,false,false]}];
keyGame.players[0].items=[{id:'it-k',type:'key'}];
keyGame=E.useItem(keyGame,'it-k');
const keyOpts=E.moveOptions(keyGame,'p0-0','r-key');
check(keyOpts.some(o=>o.choice==='shortcut'&&o.destination==='G0'),'Key enables pass-through shortcut at O5');
// 3. Moss stone adjusts roll by +1 or -1
let stoneGame=E.unlockItemsNow(E.createGame({mode:'local',count:2,board:'S',itemMode:true}));
stoneGame.phase='move';stoneGame.rolls=[{id:'r-st',value:2,faces:[true,true,false,false]}];
stoneGame.players[0].items=[{id:'it-s',type:'stone'}];
stoneGame=E.useItem(stoneGame,'it-st-bad')&&E.useItem(stoneGame,'it-s',{delta:1});
check(E.moveOptions(stoneGame,'p0-0','r-st')[0].destination==='O3','Stone +1 turns gae(2) into geol(3)');
// 4. Hopae shield blocks capture and stops attacker 1 step before
let shieldGame=E.unlockItemsNow(E.createGame({mode:'local',count:2,board:'S',itemMode:true}));
const sGraph=M.makeGraph('S');
shieldGame.pieces[4]={...shieldGame.pieces[4],...M.movePiece(sGraph,M.initialState(),3),shielded:true};
shieldGame.phase='move';shieldGame.rolls=[{id:'r-atk',value:3,faces:[true,true,true,false]}];
const atkRes=E.resolveMove(shieldGame,E.moveOptions(shieldGame,'p0-0','r-atk')[0]);
check(atkRes.meta.shieldBlocked&&atkRes.meta.captured===0,'Shield blocks capture');
check(atkRes.game.pieces[0].node==='O2'&&atkRes.game.pieces[4].node==='O3'&&!atkRes.game.pieces[4].shielded,'Attacker stops at O2 and shield is consumed');
// 5. Pouch positions are randomized and landing on an item node with <2 items picks it up
const seenPouchSets=new Set();
for(let i=0;i<10;i++){
 const gRand=E.unlockItemsNow(E.createGame({mode:'local',count:2,board:'S',itemMode:true}));
 seenPouchSets.add(Object.keys(gRand.itemNodes).sort().join(','));
}
check(seenPouchSets.size>1,'Item pouch positions are randomized across games');
let pouchGame=E.unlockItemsNow(E.createGame({mode:'local',count:2,board:'S',itemMode:true}));
pouchGame.itemNodes={...pouchGame.itemNodes,O3:'key'};
pouchGame.players[0].items=[];
pouchGame.phase='move';pouchGame.rolls=[{id:'r-pouch',value:3,faces:[true,true,true,false]}];
const pouchRes=E.resolveMove(pouchGame,E.moveOptions(pouchGame,'p0-0','r-pouch')[0]);
check(!!pouchRes.meta.pickedItem&&pouchRes.game.players[0].items.length===1&&!pouchRes.game.itemNodes.O3,'Landing on O3 picks up item pouch');
console.log('OK: '+checks+' assertions across '+games+' completed games, maps S, A, B and G');
require('./test-standard.cjs');
require('./test-ai.cjs');
