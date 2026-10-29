const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./build-test/gameEngine.js');
const {selectRollout,rolloutWinner}=require('./scripts/laya-rollout.cjs');
const {candidatesFor}=require('./scripts/laya-client.cjs');
test('parallel rollout produces the exact same labels and rates as serial rollout',()=>{
 const game=E.createGame({board:'S',mode:'local'});game.phase='move';
 game.rolls=[{id:'one',value:1,faces:[false,true,false,false]},{id:'two',value:2,faces:[true,true,false,false]}];
 const options=candidatesFor(game,'v2').options,previous=process.env.LAYA_ROLLOUT_THREADS;
 try{
  process.env.LAYA_ROLLOUT_THREADS='1';const serial=selectRollout(game,options,{samples:8,seed:17,validationSamples:8});
  process.env.LAYA_ROLLOUT_THREADS='4';const parallel=selectRollout(game,options,{samples:8,seed:17,validationSamples:8});
  assert.deepEqual(parallel,serial);
 }finally{if(previous===undefined)delete process.env.LAYA_ROLLOUT_THREADS;else process.env.LAYA_ROLLOUT_THREADS=previous;}
});
test('independent validation is deterministic and rejects invalid budgets',()=>{
 const game=E.createGame({board:'A',mode:'local'});game.phase='move';
 game.rolls=[{id:'one',value:1,faces:[false,true,false,false]},{id:'two',value:2,faces:[true,true,false,false]}];
 const options=candidatesFor(game,'v2').options;
 const before=JSON.stringify(game);
 const a=selectRollout(game,options,{samples:2,seed:107,validationSamples:2});
 assert.deepEqual(a,selectRollout(game,options,{samples:2,seed:107,validationSamples:2}));
 assert(E.resolveMove(game,a.action));
 assert.equal(JSON.stringify(game),before);
 assert.throws(()=>selectRollout(game,options,{validationSamples:-1}),/Invalid validation/);
});
test('rollout teacher chooses immediate victory, is deterministic, and preserves state/RNG',()=>{
 const game=E.createGame({board:'S',mode:'local'});game.phase='move';
 game.rolls=[{id:'one',value:1,faces:[false,true,false,false]}];
 const own=game.pieces.filter(p=>p.player===game.current);
 own.forEach((p,i)=>{p.node=i===0?'O0':'FIN';p.lane='outer';});
 const options=E.legalActions(game),before=JSON.stringify(game),random=Math.random;
 assert(options.length>0);
 const a=selectRollout(game,options,{samples:2,seed:42});
 assert.equal(E.resolveMove(game,a.action).game.winner,game.current);
 assert.deepEqual(a,selectRollout(game,options,{samples:2,seed:42}));
 assert.equal(JSON.stringify(game),before);assert.equal(Math.random,random);
 assert.throws(()=>rolloutWinner(E.createGame({}),1,0),/did not finish/);
 assert.throws(()=>selectRollout(game,options,{samples:0}),/Invalid/);
});
