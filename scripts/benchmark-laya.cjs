// Optional experiment. Compile engines with npm test before running.
const E=require('../build-test/gameEngine.js');
const {chooseAIAction}=require('../build-test/aiEngine.js');
const {LayaWorker,chooseLayaAction,candidatesFor}=require('./laya-client.cjs');
const {selectRollout}=require('./laya-rollout.cjs');
const fs=require('node:fs');
const crypto=require('node:crypto');
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function roll(random){const old=Math.random;Math.random=random;try{return E.rollSticks(true);}finally{Math.random=old;}}
(async()=>{
 const seeds=Number(process.argv[2]||2),offset=Number(process.argv[3]||0);
 if(!Number.isInteger(seeds)||seeds<1||seeds>100||!Number.isInteger(offset)||offset<0)throw Error('Expected 1..100 seeds and a nonnegative offset');
 const startupMs=Number(process.env.LAYA_STARTUP_MS||120000),decisionMs=Number(process.env.LAYA_DECISION_MS||5000);
 if(!Number.isFinite(startupMs)||startupMs<1||!Number.isFinite(decisionMs)||decisionMs<1)throw Error('LAYA_STARTUP_MS and LAYA_DECISION_MS must be positive numbers');
 const teacher=process.env.LAYA_POLICY==='rollout';
 const boards=(process.env.LAYA_BOARDS||'A,B').split(',');
 if(boards.some(b=>!['S','A','B'].includes(b)))throw Error('Invalid LAYA_BOARDS');
 const worker=teacher?null:new LayaWorker({startupMs,decisionMs});
 try{
  const runtime=teacher?{policy:'rollout',samples:Number(process.env.LAYA_ROLLOUT_SAMPLES||32),validationSamples:Number(process.env.LAYA_ROLLOUT_VALIDATION||0),threads:Number(process.env.LAYA_ROLLOUT_THREADS||1)}:await worker.ready;
  const report={policy:teacher?'rollout':'laya',runtime,inputVersion:teacher?'v2':process.env.LAYA_INPUT_VERSION||'v1',seedsPerMapAndSeat:seeds,seedOffset:offset,games:0,layaWins:0,baselineWins:0,decisions:{laya:0,forced:0,fallback:0},fallbackReasons:{},totalInferenceMs:0,byBoard:{},bySeat:{}};
  report.model=teacher?null:process.env.LAYA_MODEL||'convaiinnovations/laya';
  report.records=[];
  report.baselineAgreement={compared:0,matched:0};
  report.engineHashes=Object.fromEntries(['gameEngine','mapEngine','aiEngine'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(require.resolve(`../build-test/${name}.js`))).digest('hex')]));
  if(process.env.LAYA_RESUME==='1'){
   if(!teacher||!process.env.LAYA_REPORT)throw Error('Resume currently requires a rollout report');
   const prior=JSON.parse(fs.readFileSync(process.env.LAYA_REPORT,'utf8'));
   for(const key of ['policy','inputVersion','seedsPerMapAndSeat','seedOffset','engineHashes']){
    if(JSON.stringify(prior[key])!==JSON.stringify(report[key]))throw Error(`Resume mismatch: ${key}`);
   }
   if(prior.runtime.samples!==runtime.samples||prior.runtime.validationSamples!==runtime.validationSamples)throw Error('Resume budget mismatch');
   if(prior.records.length!==prior.games||prior.records.some(r=>!boards.includes(r.board)||r.seed<=offset||r.seed>offset+seeds))throw Error('Invalid resume records');
   Object.assign(report,prior,{runtime});
  }
  const finished=new Set(report.records.map(r=>`${r.board}/${r.seed}/${r.layaSeat}`));
  if(finished.size!==report.records.length)throw Error('Duplicate game records');
  function save(complete=false){
   report.complete=complete;
   report.layaWinRate=report.games?report.layaWins/report.games:null;
   if(process.env.LAYA_REPORT)fs.writeFileSync(process.env.LAYA_REPORT,JSON.stringify(report,null,2));
  }
  save();
  for(const board of boards)for(let seed=offset+1;seed<=offset+seeds;seed++)for(const layaSeat of [0,1]){
   if(finished.has(`${board}/${seed}/${layaSeat}`))continue;
   const dice=[rng(seed*7919+17),rng(seed*7919+31)];let game=E.createGame({board,mode:'local'}),steps=0;
   while(game.winner===null&&steps++<3000){
    if(game.phase==='roll'){game=E.throwResult(game,roll(dice[game.current]),false);continue;}
    let action;
    if(game.current===layaSeat){
     const input=teacher?candidatesFor(game,'v2'):null;
     const result=teacher?{action:input.options.length>=2?selectRollout(game,input.options,{samples:runtime.samples,seed:9000000+seed*100003+steps*257}).action:input.fallback,source:input.options.length>=2?'laya':'forced',inferenceMs:0}:await chooseLayaAction(game,worker);action=result.action;report.decisions[result.source]++;
     report.totalInferenceMs+=result.inferenceMs;
     if(result.reason)report.fallbackReasons[result.reason]=(report.fallbackReasons[result.reason]||0)+1;
    }else action=chooseAIAction(game);
    if(action&&game.current===layaSeat){
     const baseline=chooseAIAction(game);
     report.baselineAgreement.compared++;
     if(baseline&&action.pieceId===baseline.pieceId&&action.rollId===baseline.rollId&&action.choice===baseline.choice)report.baselineAgreement.matched++;
    }
    if(!action){game=E.normalize(game);continue;}
    const resolved=E.resolveMove(game,action);if(!resolved)throw Error('Illegal AI action');game=resolved.game;
   }
   if(game.winner===null)throw Error('Game did not finish');
   for(const [group,key] of [[report.byBoard,board],[report.bySeat,layaSeat]]){group[key]||={games:0,wins:0};group[key].games++;if(game.winner===layaSeat)group[key].wins++;}
   report.games++;if(game.winner===layaSeat)report.layaWins++;else report.baselineWins++;
   report.records.push({board,seed,layaSeat,winner:game.winner});save();
   console.error(`Completed ${report.games}: map=${board}, seed=${seed}, Laya seat=${layaSeat}, winner=${game.winner}`);
  }
  report.meanInferenceMs=report.decisions.laya?report.totalInferenceMs/report.decisions.laya:null;
  report.layaWinRate=report.layaWins/report.games;
  save(true);
  console.log(JSON.stringify(report,null,2));
  if(!report.decisions.laya)throw Error('No model inference completed; this is not a Laya benchmark');
 }finally{worker?.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
