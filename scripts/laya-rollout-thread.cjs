const {parentPort}=require('node:worker_threads');
const {rolloutWinner}=require('./laya-rollout.cjs');
parentPort.on('message',({states,actor,samples,seed,slot,threads,buffer})=>{
 const result=new Int32Array(buffer);
 try{
  for(let trial=slot;trial<samples;trial+=threads)for(let i=0;i<states.length;i++){
   result[2+trial*states.length+i]=Number(rolloutWinner(states[i],seed+trial)===actor);
  }
 }catch{Atomics.store(result,1,1);}
 finally{Atomics.add(result,0,1);Atomics.notify(result,0);}
});
