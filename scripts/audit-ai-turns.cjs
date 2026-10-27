// AI-only diagnostic: independent throw credits, turn order and roll/move accounting.
// Build engines first: npm test. Usage: node scripts/audit-ai-turns.cjs [seeds per configuration]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const E=require('../build-test/gameEngine.js');
const {chooseAIAction}=require('../build-test/aiEngine.js');
const perConfig=Number(process.argv[2]||50),originalRandom=Math.random;
assert(Number.isInteger(perConfig)&&perConfig>0,'Seed count must be a positive integer');
const report={seedsPerConfiguration:perConfig,games:0,throws:0,moves:0,bonusYut:0,bonusMo:0,bonusCapture:0,nak:0,turns:0,violations:[],longestImmediateChain:null,longestTurn:null,configurations:[]};
function random(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
function check(value,message,context){if(!value){report.violations.push({message,...context});throw Error(message)}}
try{
 for(const board of ['A','B'])for(const count of [2,3,4]){
  const config={board,count,games:0,throws:0};
  for(let seed=1;seed<=perConfig;seed++){
   Math.random=random(800000+seed+count*1000+(board==='B'?10000:0));
   let game=E.createGame({board,count,mode:'ai'});
   game={...game,players:game.players.map(p=>({...p,ai:true,label:p.name+' AI'}))};
   let credits=1,steps=0,chain=[],turnThrows=0,turnEvents=[];
   const context=()=>({board,count,seed,turn:game.turn,player:game.current,phase:game.phase,credits});
   while(game.winner===null&&steps++<6000){
    const before=game,actor=game.current;
    if(game.phase==='roll'){
     check(credits===1,'Throw without exactly one earned throw credit',context());credits--;
     const rolled=E.rollSticks(game.config.backdo),landing=E.generateLanding('random');
     const faceCount=rolled.faces.filter(Boolean).length;
     const expected=faceCount===0?4:faceCount===4?5:faceCount===1&&rolled.faces[0]?-1:faceCount;
     check(rolled.value===expected,'Visible faces disagree with outcome',context());
     const name=landing.nak?'낙':E.NAMES[rolled.value];
     if(landing.nak)report.nak++;
     else if(rolled.value===4){credits++;report.bonusYut++}
     else if(rolled.value===5){credits++;report.bonusMo++}
     chain.push(name);turnEvents.push('던짐:'+name);turnThrows++;report.throws++;config.throws++;
     if(!report.longestImmediateChain||chain.length>report.longestImmediateChain.length)report.longestImmediateChain={...context(),length:chain.length,outcomes:[...chain]};
     game=E.throwResult(game,rolled,landing.nak);
     check(game.throwCount===before.throwCount+1,'One throw must increase throwCount exactly once',context());
     if(!landing.nak&&(rolled.value===4||rolled.value===5))check(game.current===actor&&game.phase==='roll','Yut/mo must grant exactly one immediate reroll',context());
     if(landing.nak&&before.rolls.length===0)check(game.current===(actor+1)%count,'Nak with no stored result must end the turn',context());
    }else{
     check(game.phase==='move','Unexpected phase before game end',context());
     check(credits===0,'A move starts while a throw credit is outstanding',context());
     const action=chooseAIAction(game);
     if(!action){
      check(E.legalActions(game).length===0,'AI skips executable moves',context());
      game=E.normalize(game);
      check(game.current!==actor,'Unplayable state does not advance the turn',context());
     }else{
      const capture=action.destination==='WAIT'||action.destination==='FIN'?0:game.pieces.filter(p=>p.player!==actor&&p.node===action.destination).length;
      const result=E.resolveMove(game,action);check(!!result,'AI selected an invalid move',context());
      check(result.meta.captured===capture,'Capture count differs from board occupancy',context());
      game=result.game;report.moves++;chain=[];
      turnEvents.push('이동:'+action.source+'→'+action.destination+(capture?' 잡기 '+capture:'') );
      if(capture&&game.winner===null){credits++;report.bonusCapture++;check(game.current===actor&&game.phase==='roll','Capture must grant one throw, regardless of captured piece count',context())}
      else if(game.winner===null&&game.current===actor)check(game.phase==='move','Non-capture move incorrectly grants a throw',context());
     }
    }
    if(game.current!==actor){
     check(game.current===(actor+1)%count&&game.turn===before.turn+1,'Wrong turn order or duplicate turn advance',context());
     check(credits===0,'A turn ends with unused throw credit',context());
     check(game.phase==='roll'&&game.rolls.length===0,'New player inherited prior results',context());
     if(!report.longestTurn||turnThrows>report.longestTurn.throws)report.longestTurn={board,count,seed,turn:before.turn,player:actor,throws:turnThrows,events:[...turnEvents]};
     report.turns++;credits=1;turnThrows=0;turnEvents=[];chain=[];
    }
    check((game.phase==='roll')===(credits===1)||game.winner!==null,'Phase and independent throw credit disagree',context());
   }
   check(game.winner!==null,'AI game failed to finish within action limit',context());
   check(game.pieces.filter(p=>p.player===game.winner&&p.node==='FIN').length===4,'Winner did not finish four pieces',context());
   report.games++;config.games++;
  }
  report.configurations.push(config);console.log(`Completed ${board}, ${count} AI: ${config.games} games, ${config.throws} throws`);
 }
}catch(error){report.error=String(error);process.exitCode=1}finally{
 Math.random=originalRandom;
 fs.mkdirSync(path.join(__dirname,'../preview-build'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'../preview-build/ai-turn-engine-audit.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
