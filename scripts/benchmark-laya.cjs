// Optional experiment. Compile engines with npm test before running.
const E=require('../build-test/gameEngine.js');
const {chooseAIAction}=require('../build-test/aiEngine.js');
const {LayaWorker,chooseLayaAction}=require('./laya-client.cjs');
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function roll(random){const old=Math.random;Math.random=random;try{return E.rollSticks(true);}finally{Math.random=old;}}
(async()=>{
 const seeds=Number(process.argv[2]||2),offset=Number(process.argv[3]||0);
 if(!Number.isInteger(seeds)||seeds<1||seeds>100||!Number.isInteger(offset)||offset<0)throw Error('Expected 1..100 seeds and a nonnegative offset');
 const worker=new LayaWorker();
 try{
  const runtime=await worker.ready;
  const report={runtime,seedsPerMapAndSeat:seeds,seedOffset:offset,games:0,layaWins:0,baselineWins:0,decisions:{laya:0,forced:0,fallback:0},fallbackReasons:{},totalInferenceMs:0};
  for(const board of ['A','B'])for(let seed=offset+1;seed<=offset+seeds;seed++)for(const layaSeat of [0,1]){
   const dice=[rng(seed*7919+17),rng(seed*7919+31)];let game=E.createGame({board,mode:'local'}),steps=0;
   while(game.winner===null&&steps++<3000){
    if(game.phase==='roll'){game=E.throwResult(game,roll(dice[game.current]),false);continue;}
    let action;
    if(game.current===layaSeat){
     const result=await chooseLayaAction(game,worker);action=result.action;report.decisions[result.source]++;
     report.totalInferenceMs+=result.inferenceMs;
     if(result.reason)report.fallbackReasons[result.reason]=(report.fallbackReasons[result.reason]||0)+1;
    }else action=chooseAIAction(game);
    if(!action){game=E.normalize(game);continue;}
    const resolved=E.resolveMove(game,action);if(!resolved)throw Error('Illegal AI action');game=resolved.game;
   }
   if(game.winner===null)throw Error('Game did not finish');
   report.games++;if(game.winner===layaSeat)report.layaWins++;else report.baselineWins++;
   console.error(`Completed ${report.games}: map=${board}, seed=${seed}, Laya seat=${layaSeat}, winner=${game.winner}`);
  }
  report.meanInferenceMs=report.decisions.laya?report.totalInferenceMs/report.decisions.laya:null;
  report.layaWinRate=report.layaWins/report.games;
  console.log(JSON.stringify(report,null,2));
  if(!report.decisions.laya)throw Error('No model inference completed; this is not a Laya benchmark');
 }finally{worker.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
