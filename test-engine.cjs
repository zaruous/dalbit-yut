const assert=require('assert');
const M=require('./build-test/mapEngine.js');
const E=require('./build-test/gameEngine.js');
let checks=0;const check=(cond,msg)=>{assert(cond,msg);checks++};
for(const type of ['A','B']){
 const graph=M.makeGraph(type);
 check(M.validateGraph(graph).length===0,'Map '+type+' graph has errors');
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
 for(const route of Object.values(graph.routes))
  check(route.nodes[0]==='O0'&&route.nodes.at(-1)==='O0','Route should return home');
}
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
