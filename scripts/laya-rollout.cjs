// Experimental teacher: compare the same shortlist Laya receives, with paired dice.
const E=require('../build-test/gameEngine.js');
const {chooseAIAction}=require('../build-test/aiEngine.js');
const {Worker}=require('node:worker_threads');
const path=require('node:path');
let pool=[];
function simulate(states,actor,samples,seed){
 const threads=Number(process.env.LAYA_ROLLOUT_THREADS||1);
 if(!Number.isInteger(threads)||threads<1||threads>8)throw Error('Expected 1..8 rollout threads');
 if(threads===1){
  return Array.from({length:samples},(_,trial)=>states.map(state=>Number(rolloutWinner(state,seed+trial)===actor)));
 }
 if(pool.length&&pool.length!==threads)throw Error('Cannot change thread count inside a rollout process');
 if(!pool.length)pool=Array.from({length:threads},()=>{const worker=new Worker(path.join(__dirname,'laya-rollout-thread.cjs'));worker.unref();return worker;});
 const buffer=new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT*(2+samples*states.length));
 const result=new Int32Array(buffer);
 pool.forEach((worker,slot)=>worker.postMessage({states,actor,samples,seed,slot,threads,buffer}));
 while(Atomics.load(result,0)<threads){
  const completed=Atomics.load(result,0);
  if(completed>=threads)break;
  if(Atomics.wait(result,0,completed,120000)==='timed-out'){
   pool.forEach(worker=>worker.terminate());pool=[];throw Error('Rollout threads timed out');
  }
 }
 if(Atomics.load(result,1))throw Error('Rollout thread failed');
 return Array.from({length:samples},(_,trial)=>Array.from(result.slice(2+trial*states.length,2+(trial+1)*states.length)));
}
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function roll(random){const old=Math.random;Math.random=random;try{return E.rollSticks(true);}finally{Math.random=old;}}
function rolloutWinner(state,seed,maxSteps=3000){
 const dice=[rng(seed*7919+17),rng(seed*7919+31)];let game=state;
 for(let step=0;game.winner===null&&step<maxSteps;step++){
  if(game.phase==='roll'){game=E.throwResult(game,roll(dice[game.current]),false);continue;}
  const action=chooseAIAction(game);
  game=action?E.resolveMove(game,action).game:E.normalize(game);
 }
 if(game.winner===null)throw Error('Rollout did not finish; no fabricated win label');
 return game.winner;
}
function selectRollout(game,options,{samples=32,seed=1,validationSamples=Number(process.env.LAYA_ROLLOUT_VALIDATION||0)}={}){
 if(!Number.isInteger(samples)||samples<1||!options.length)throw Error('Invalid rollout budget or candidates');
 if(!Number.isInteger(validationSamples)||validationSamples<0)throw Error('Invalid validation budget');
 const wins=options.map(()=>0),after=options.map(option=>{
  const result=E.resolveMove(game,option);if(!result)throw Error('Illegal rollout candidate');return result.game;
 });
 for(const trial of simulate(after,game.current,samples,seed))trial.forEach((win,i)=>{wins[i]+=win;});
 const baseline=chooseAIAction(game);
 const baselineIndex=options.findIndex(o=>baseline&&o.pieceId===baseline.pieceId&&o.rollId===baseline.rollId&&o.choice===baseline.choice);
 const highest=Math.max(...wins);
 // Preserve the baseline on empirical ties instead of trusting shortlist order.
 let best=baselineIndex>=0&&wins[baselineIndex]===highest?baselineIndex:wins.indexOf(highest);
 let validation=null;
 // Confirm a selected challenger on fresh dice to reduce winner-selection noise.
 if(validationSamples&&baselineIndex>=0&&best!==baselineIndex&&after[best].winner!==game.current){
  let sum=0,squares=0;
  for(const trial of simulate([after[best],after[baselineIndex]],game.current,validationSamples,(seed+1000000007)>>>0)){
   const delta=trial[0]-trial[1];
   sum+=delta;squares+=delta*delta;
  }
  const advantage=sum/validationSamples;
  const variance=validationSamples>1?(squares-validationSamples*advantage*advantage)/(validationSamples-1):Infinity;
  const lowerBound=advantage-1.96*Math.sqrt(Math.max(0,variance)/validationSamples);
  validation={samples:validationSamples,advantage,lowerBound,accepted:lowerBound>0};
  if(!validation.accepted)best=baselineIndex;
 }
 return {action:options[best],index:best,winRates:wins.map(n=>n/samples),samples,validation};
}
module.exports={rng,roll,rolloutWinner,selectRollout};
