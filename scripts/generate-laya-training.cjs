// Generate game-level-separated imitation data for Laya fine-tuning.
const fs=require('node:fs');
const path=require('node:path');
const E=require('../build-test/gameEngine.js');
const {candidatesFor}=require('./laya-client.cjs');

function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function roll(random){const old=Math.random;Math.random=random;try{return E.rollSticks(true);}finally{Math.random=old;}}
function same(a,b){return a.pieceId===b.pieceId&&a.rollId===b.rollId&&a.choice===b.choice;}

function collect(target,seedOffset){
 const rows=[],seen=new Set();let games=0;
 for(let seed=seedOffset+1;rows.length<target;seed++){
  const board=seed%2?'A':'B',dice=[rng(seed*7919+17),rng(seed*7919+31)];
  let game=E.createGame({board,mode:'local'}),steps=0;
  while(game.winner===null&&steps++<3000){
   if(game.phase==='roll'){game=E.throwResult(game,roll(dice[game.current]),false);continue;}
   const input=candidatesFor(game,'v2'),action=input.fallback;
   if(!action){game=E.normalize(game);continue;}
   if(input.options.length>=2&&rows.length<target){
    const answer=input.options.findIndex(option=>same(option,action));
    if(answer<0)throw Error('Teacher action missing from candidates');
    const row={state:input.state,questions:{move:{type:'choice',instructions:'Choose the legal Yutnori move with the highest long-term probability of winning.',criteria:input.criteria}},expected:{move:`a${answer}`}};
    const key=JSON.stringify(row);
    if(!seen.has(key)){seen.add(key);rows.push(row);}
   }
   const resolved=E.resolveMove(game,action);if(!resolved)throw Error('Teacher produced an illegal action');game=resolved.game;
  }
  if(game.winner===null)throw Error(`Game ${seed} did not finish`);games++;
 }
 return {rows,games};
}

const trainTarget=Number(process.argv[2]||6000),evalTarget=Number(process.argv[3]||1200);
const output=path.resolve(process.argv[4]||'laya-data');
if(!Number.isInteger(trainTarget)||trainTarget<100||!Number.isInteger(evalTarget)||evalTarget<100)throw Error('Expected train/eval row targets of at least 100');
fs.mkdirSync(output,{recursive:true});
const train=collect(trainTarget,10000),evaluation=collect(evalTarget,50000);
for(const [name,data] of [['train',train],['eval',evaluation]]){
 const file=path.join(output,`${name}.jsonl`);
 fs.writeFileSync(file,data.rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 console.log(`${name}: ${data.rows.length} decisions from ${data.games} games -> ${file}`);
}
