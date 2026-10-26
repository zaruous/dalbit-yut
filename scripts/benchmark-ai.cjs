// Run after npm test compiles the canonical TypeScript engines.
const E=require('../build-test/gameEngine.js');
const {chooseAIAction}=require('../build-test/aiEngine.js');
const {performance}=require('node:perf_hooks');
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function withRandom(random,fn){const old=Math.random;Math.random=random;try{return fn();}finally{Math.random=old;}}
const seeds=Number(process.argv[2]||20);
const offset=Number(process.argv[3]||0);
if(!Number.isInteger(seeds)||seeds<1||seeds>1000)throw Error('Expected 1..1000 seeds per map and seat');
if(!Number.isInteger(offset)||offset<0)throw Error('Expected a nonnegative seed offset');
const report={seedsPerMapAndSeat:seeds,seedOffset:offset,games:0,newWins:0,oldWins:0,byMap:{A:{newWins:0,games:0},B:{newWins:0,games:0}},decisions:0,totalDecisionMs:0,maxDecisionMs:0};
const times=[];
for(const board of ['A','B'])for(let seed=offset+1;seed<=offset+seeds;seed++)for(const newSeat of [0,1]){
 const dice=[rng(seed*7919+17),rng(seed*7919+31)],noise=rng(seed*7919+43);
 let g=E.createGame({board,mode:'local'}),steps=0;
 while(g.winner===null&&steps++<3000){
  if(g.phase==='roll')g=E.throwResult(g,withRandom(dice[g.current],()=>E.rollSticks(true)),false);
  else if(g.phase==='move'){
   let action;
   if(g.current===newSeat){
    const t=performance.now();action=chooseAIAction(g);const elapsed=performance.now()-t;
    times.push(elapsed);report.decisions++;report.totalDecisionMs+=elapsed;report.maxDecisionMs=Math.max(report.maxDecisionMs,elapsed);
   }else action=withRandom(noise,()=>E.legalActions(g).sort((a,b)=>E.scoreOption(g,b)-E.scoreOption(g,a))[0]);
   if(!action){g=E.normalize(g);continue;}
   const moved=E.resolveMove(g,action);if(!moved)throw Error('Illegal AI action');g=moved.game;
  }else throw Error('Unexpected phase');
 }
 if(g.winner===null)throw Error(`Unfinished game: ${board}/${seed}/${newSeat}`);
 report.games++;report.byMap[board].games++;
 if(g.winner===newSeat){report.newWins++;report.byMap[board].newWins++;}else report.oldWins++;
}
times.sort((a,b)=>a-b);
report.winRate=report.newWins/report.games;
report.meanDecisionMs=report.totalDecisionMs/report.decisions;
report.p95DecisionMs=times[Math.floor((times.length-1)*.95)];
console.log(JSON.stringify(report,null,2));
