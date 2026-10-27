import * as E from './gameEngine.js';
import * as M from './mapEngine.js';
import type {GameState, GamePiece, MoveOption, MoveResolution} from './gameEngine.js';

const graphs={S:M.makeGraph('S'),A:M.makeGraph('A'),B:M.makeGraph('B')};
const distances=new Map<string,number>();

/** Shortest forward distance, including choices at future junction stops. */
function distance(board: M.BoardType,piece: M.PieceStep): number{
 const key=`${board}/${piece.node}/${piece.lane}`;
 const cached=distances.get(key);if(cached!==undefined)return cached;
 const graph=graphs[board],queue=[{...piece,steps:0}],seen=new Set<string>();
 for(let i=0;i<queue.length;i++){
  const pos=queue[i];if(pos.node==='FIN'){distances.set(key,pos.steps);return pos.steps;}
  const id=`${pos.node}/${pos.lane}`;if(seen.has(id))continue;seen.add(id);
  for(const choice of M.getOptions(graph,pos)){
   const next=M.movePiece(graph,{...pos,history:[],lastPath:[],lastResult:''},1,choice.value);
   queue.push({node:next.node,lane:next.lane,steps:pos.steps+1});
  }
 }
 return graph.outerSteps+2;
}

function pieceValue(g: GameState,piece: GamePiece): number{
 if(piece.node==='WAIT')return 0;
 if(piece.node==='FIN')return 100;
 return 8+2*(graphs[g.config.board].outerSteps+1-distance(g.config.board,piece));
}

/** Each of the 16 equally likely face patterns; no knowledge of future throws. */
function outcomes(backdo: boolean): [number,number][]{
 return [[-1,backdo?1/16:0],[1,backdo?3/16:4/16],[2,6/16],[3,4/16],[4,1/16],[5,1/16]];
}

/** Choose one legal move; search at most three stored results with bounded branching. */
export function chooseAIAction(g: GameState): MoveOption|null{
 const actor=g.current,graph=graphs[g.config.board];
 // One search owns its caches: back-do history and captures can change reachability.
 const threatCache=new Map<string,Map<string,number>>();
 function threats(state: GameState,opponent: number): Map<string,number>{
  const pieces=E.uniqueMovablePieces({...state,current:opponent});
  const key=JSON.stringify(pieces.map(p=>[p.node,p.lane,p.history]));
  const cached=threatCache.get(key);if(cached)return cached;
  const chances=new Map<string,number>();
  for(const [pips,probability] of outcomes(state.config.backdo)){
   if(!probability)continue;
   const targets=new Set<string>();
   for(const piece of pieces){
    if(pips<0&&piece.node==='WAIT')continue;
    const choices=pips<0?[{value:'normal' as const}]:M.getOptions(graph,piece);
    for(const choice of choices){
     const moved=M.movePiece(graph,piece,pips,choice.value);
     if(moved.lastPath.length>1&&moved.node!=='WAIT'&&moved.node!=='FIN')targets.add(moved.node);
    }
   }
   // Opponents choose a piece after rolling, so count each outcome once per node.
   for(const target of targets)chances.set(target,(chances.get(target)||0)+probability);
  }
  threatCache.set(key,chances);return chances;
 }
 function evaluate(state: GameState): number{
  if(state.winner!==null)return state.winner===actor?1_000_000:-1_000_000;
  let score=0;
  const opponents=state.players.filter(p=>p.id!==actor);
  const danger=opponents.map(p=>threats(state,p.id));
  for(const piece of state.pieces){
   const value=pieceValue(state,piece);
   if(piece.player!==actor){score-=value*.8/opponents.length;continue;}
   score+=value;
   if(piece.node==='WAIT'||piece.node==='FIN')continue;
   const risk=1-danger.reduce((safe,enemy)=>safe*(1-(enemy.get(piece.node)||0)),1);
   // A stack loses every carried piece when captured; value each piece at risk.
   score-=risk*(value+18)*.9;
  }
  const stacks=new Map<string,GamePiece[]>();
  for(const piece of state.pieces){
   if(piece.player!==actor||piece.node==='WAIT'||piece.node==='FIN')continue;
   stacks.set(piece.node,[...(stacks.get(piece.node)||[]),piece]);
  }
  for(const [node,stack] of stacks){
   if(stack.length<2)continue;
   const safe=danger.reduce((chance,enemy)=>chance*(1-(enemy.get(node)||0)),1);
   // Carrying saves future throws, especially when the group still has far to go.
   score+=Math.min(20,distance(state.config.board,stack[0])*1.4)*(stack.length-1)*safe;
  }
  return score;
 }
 interface Candidate {option: MoveOption; result: MoveResolution; bonus: number; score: number}
 function rank(state: GameState,bonus: number): Candidate[]{
  const seen=new Set<string>(),ranked: Candidate[]=[];
  for(const option of E.legalActions(state)){
   // Waiting pieces and duplicate equal results are strategically interchangeable.
   const roll=state.rolls.find(r=>r.id===option.rollId)!;
   const key=`${option.source==='WAIT'?'WAIT':option.pieceId}/${roll.value}/${option.choice}`;
   if(seen.has(key))continue;seen.add(key);
   const result=E.resolveMove(state,option);if(!result)continue;
   const nextBonus=bonus+(result.meta.captured?18:0);
   ranked.push({option,result,bonus:nextBonus,score:evaluate(result.game)+nextBonus});
  }
  return ranked.sort((a,b)=>b.score-a.score);
 }
 function search(candidate: Candidate,depth: number): number{
  const state=candidate.result.game;
  // A capture requires a new unknown throw. Stop instead of inventing its result.
  if(depth===0||state.current!==actor||state.phase!=='move')return candidate.score;
  const children=rank(state,candidate.bonus).slice(0,3);
  return children.length?Math.max(...children.map(child=>search(child,depth-1))):candidate.score;
 }
 const candidates=rank(g,0).slice(0,8);
 let best: MoveOption|null=null,bestScore=-Infinity;
 for(const candidate of candidates){
  const score=search(candidate,Math.min(2,g.rolls.length-1));
  if(score>bestScore){bestScore=score;best=candidate.option;}
 }
 return best;
}
