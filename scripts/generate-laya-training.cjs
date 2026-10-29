// Generate game-level-separated imitation data for Laya fine-tuning.
const fs=require('node:fs');
const path=require('node:path');
const E=require('../build-test/gameEngine.js');
const {candidatesFor}=require('./laya-client.cjs');
const {selectRollout}=require('./laya-rollout.cjs');
const teacher=process.env.LAYA_TEACHER||'baseline';
if(!['baseline','rollout'].includes(teacher))throw Error('Invalid LAYA_TEACHER');
const samples=Number(process.env.LAYA_ROLLOUT_SAMPLES||32);
const labelMode=process.env.LAYA_LABEL_MODE||'expected';
const temperature=Number(process.env.LAYA_TARGET_TEMPERATURE||0.1);
if(!['expected','distribution'].includes(labelMode)||!Number.isFinite(temperature)||temperature<=0)throw Error('Invalid label mode or temperature');
if(labelMode==='distribution'&&(teacher!=='rollout'||Number(process.env.LAYA_ROLLOUT_VALIDATION||0)!==0))throw Error('Distribution labels require unfiltered rollout estimates');
const excluded=new Set();

function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function roll(random){const old=Math.random;Math.random=random;try{return E.rollSticks(true);}finally{Math.random=old;}}
function same(a,b){return a.pieceId===b.pieceId&&a.rollId===b.rollId&&a.choice===b.choice;}

function collect(target,seedOffset){
 const rows=[],evidence=[],seen=new Set(),byBoard={S:0,A:0,B:0};let games=0,disagreements=0;
 for(let seed=seedOffset+1;rows.length<target;seed++){
  const board=['S','A','B'][seed%3],dice=[rng(seed*7919+17),rng(seed*7919+31)];
  let game=E.createGame({board,mode:'local'}),steps=0;
  while(game.winner===null&&steps++<3000){
   if(game.phase==='roll'){game=E.throwResult(game,roll(dice[game.current]),false);continue;}
   const input=candidatesFor(game,'v2');let action=input.fallback,search=null;
   if(action&&teacher==='rollout'&&input.options.length>=2){
    search=selectRollout(game,input.options,{samples,seed:seed*100003+steps*257});action=search.action;
    if(!same(action,input.fallback))disagreements++;
   }
   if(!action){game=E.normalize(game);continue;}
   if(input.options.length>=2&&rows.length<target){
    const answer=input.options.findIndex(option=>same(option,action));
    if(answer<0)throw Error('Teacher action missing from candidates');
    const row={state:input.state,questions:{move:{type:'choice',instructions:'Choose the legal Yutnori move with the highest long-term probability of winning.',criteria:input.criteria}},expected:{move:`a${answer}`}};
    if(labelMode==='distribution'){
     const highest=Math.max(...search.winRates),mass=search.winRates.map(rate=>Math.exp((rate-highest)/temperature)),total=mass.reduce((a,b)=>a+b,0);
     row.gold={move:{probabilities:Object.fromEntries(mass.map((value,i)=>[`a${i}`,value/total]))}};
    }
    const key=JSON.stringify(row);
    if(!seen.has(key)&&!excluded.has(JSON.stringify([row.state,row.questions]))){
     seen.add(key);rows.push(row);
     evidence.push({row:rows.length-1,board,seed,step:steps,answer,baseline:input.options.findIndex(option=>same(option,input.fallback)),samples:search?.samples||0,winRates:search?.winRates||null,validation:search?.validation||null});
     byBoard[board]++;
     if(rows.length%100===0)console.error(`Collected ${rows.length}/${target}: teacher=${teacher}, seed=${seed}, board=${board}`);
    }
   }
   const resolved=E.resolveMove(game,action);if(!resolved)throw Error('Teacher produced an illegal action');game=resolved.game;
  }
  if(game.winner===null)throw Error(`Game ${seed} did not finish`);games++;
 }
 return {rows,evidence,games,disagreements,byBoard};
}

const trainTarget=Number(process.argv[2]||6000),evalTarget=Number(process.argv[3]||1200);
const output=path.resolve(process.argv[4]||'laya-data');
if(!Number.isInteger(trainTarget)||trainTarget<100||!Number.isInteger(evalTarget)||evalTarget<100)throw Error('Expected train/eval row targets of at least 100');
fs.mkdirSync(output,{recursive:true});
const train=collect(trainTarget,10000);
for(const row of train.rows)excluded.add(JSON.stringify([row.state,row.questions]));
const evaluation=collect(evalTarget,50000);
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({teacher,samples,labelMode,temperature,validationSamples:Number(process.env.LAYA_ROLLOUT_VALIDATION||0),threads:Number(process.env.LAYA_ROLLOUT_THREADS||1),boards:['S','A','B'],trainByBoard:train.byBoard,evalByBoard:evaluation.byBoard,trainGames:train.games,evalGames:evaluation.games,disagreements:train.disagreements,seedOffsets:[10000,50000]},null,2));
for(const [name,data] of [['train',train],['eval',evaluation]]){
 const file=path.join(output,`${name}.jsonl`);
 fs.writeFileSync(file,data.rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 fs.writeFileSync(path.join(output,`${name}-evidence.jsonl`),data.evidence.map(row=>JSON.stringify(row)).join('\n')+'\n');
 console.log(`${name}: ${data.rows.length} decisions from ${data.games} games -> ${file}`);
}
