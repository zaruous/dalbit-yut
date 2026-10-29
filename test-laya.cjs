const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./build-test/gameEngine.js');
const {chooseAIAction}=require('./build-test/aiEngine.js');
const {LayaWorker,candidatesFor,chooseLayaAction}=require('./scripts/laya-client.cjs');
const browserCandidates=require('./build-test/layaCandidates.js').candidatesFor;

function game(){
 const state=E.createGame({mode:'local'});state.phase='move';
 state.rolls=[{id:'one',value:1,faces:[false,true,false,false]},{id:'two',value:2,faces:[true,true,false,false]}];
 return state;
}
test('browser and local Laya receive identical legal candidate representations',()=>{
 for(const board of ['S','A','B']){
  const state=E.createGame({mode:'local',board});state.phase='move';
  state.rolls=[{id:'one',value:1,faces:[false,true,false,false]},{id:'two',value:2,faces:[true,true,false,false]}];
  assert.deepEqual(browserCandidates(state,'v2'),candidatesFor(state,'v2'));
 }
});
test('shortlist contains the existing AI move and only legal moves without changing state',()=>{
 const state=game(),before=JSON.stringify(state),input=candidatesFor(state),baseline=chooseAIAction(state);
 assert(input.options.length>=2&&input.options.length<=4);
 assert(input.options.some(o=>o.pieceId===baseline.pieceId&&o.rollId===baseline.rollId&&o.choice===baseline.choice));
 for(const option of input.options)assert(E.resolveMove(state,option));
 assert.equal(JSON.stringify(state),before);
});
test('v2 input includes complete rules, path state, and post-move consequences',()=>{
 const state=game(),before=JSON.stringify(state),input=candidatesFor(state,'v2');
 assert.match(input.state,/Roll odds/);assert.match(input.state,/shortcut is available only/);
 assert.match(input.state,/node\/lane and recent route history/);
 for(const value of Object.values(input.criteria)){
  assert.match(value,/After:/);assert.match(value,/distance to FIN/);assert.match(value,/one-roll reach/);
 }
 assert.equal(JSON.stringify(state),before);
});
test('standard board input uses the 20-node square and correct corner IDs',()=>{
 const state=game(),input=candidatesFor(state,'v2');
 assert.equal(state.config.board,'S');
 assert.match(input.state,/O5 or O10/);assert.match(input.state,/O19>O0>FIN/);
 assert.match(input.state,/standard square/);
});
test('accepts a model selection exclusively from supplied legal candidates',async()=>{
 const state=game();let request;
 const result=await chooseLayaAction(state,{predict:async input=>{request=input;return {choice:'a1',elapsedMs:5};}});
 assert.equal(result.source,'laya');assert(E.resolveMove(state,result.action));
 assert.equal(Object.keys(request.criteria).length,candidatesFor(state).options.length);
});
test('invalid, failed, and truncated decisions fall back to the baseline',async()=>{
 const state=game(),baseline=chooseAIAction(state);
 for(const predict of [async()=>({choice:'FIN'}),async()=>{throw Error('model unavailable');},async()=>{throw Error('truncated_model_input');}]){
  const result=await chooseLayaAction(state,{predict});
  assert.equal(result.source,'fallback');assert.deepEqual(result.action,baseline);
 }
});
test('no candidate during roll phase does not invoke the model',async()=>{
 const result=await chooseLayaAction(E.createGame({}),{predict:async()=>{throw Error('must not run');}});
 assert.equal(result.action,null);assert.equal(result.source,'forced');
});
// Windows process startup can exceed 3s under antivirus/load. Only the test
// fixture gets extra startup allowance; production and inference deadlines stay unchanged.
const fake=(body,options={})=>new LayaWorker({command:process.execPath,args:['-e',body],startupMs:process.platform==='win32'?15000:3000,decisionMs:1000,...options});
test('real process JSONL transport handles readiness and request IDs',async()=>{
 const worker=fake(`console.log(JSON.stringify({ready:true}));require('readline').createInterface({input:process.stdin}).on('line',line=>{const x=JSON.parse(line);console.log(JSON.stringify({id:x.id,choice:'a1',elapsedMs:4}));});`);
 try{await worker.ready;const [a,b]=await Promise.all([worker.predict({}),worker.predict({})]);assert.equal(a.choice,'a1');assert.notEqual(a.id,b.id);}finally{worker.close();}
});
test('missing or malformed worker startup rejects instead of claiming model readiness',async()=>{
 for(const body of [`console.log(JSON.stringify({error:'model_load_failed',exception:'HTTPError'}));`, `console.log('bad json');`, `process.exit(1);`]){
  const worker=fake(body);try{await assert.rejects(worker.ready);}finally{worker.close();}
 }
});
test('a stalled inference terminates the worker and returns the baseline',async()=>{
 const worker=fake(`console.log(JSON.stringify({ready:true}));process.stdin.resume();`,{decisionMs:30});
 try{
  await worker.ready;const result=await chooseLayaAction(game(),worker);
  assert.equal(result.source,'fallback');assert.match(result.reason,/timed out/);assert.equal(worker.dead,true);
 }finally{worker.close();}
});
