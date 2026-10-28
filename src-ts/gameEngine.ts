import * as maps from './mapEngine.js';
import type {BoardType, PiecePath, MoveChoice, RouteChoice} from './mapEngine.js';

export type ItemType = 'geumjul' | 'key' | 'stone' | 'shield';
export interface ItemMeta { type: ItemType; name: string; icon: string; summary: string }
export interface PlayerItem { id: string; type: ItemType }
export interface PlayerVisual { name: string; color: string; light: string; avatar: string }
export interface Player extends PlayerVisual {
 id: number;
 label: string;
 ai: boolean;
 items: PlayerItem[];
 geumjulArmed: boolean;
 keyArmed: boolean;
 stoneDelta: -1 | 0 | 1;
}
export interface GamePiece extends PiecePath { id: string; player: number; index: number; shielded: boolean }
export interface GameConfig { mode: 'ai'|'local'|'spectate'; count: number; board: BoardType; backdo: boolean; itemMode: boolean }
export interface YutRollOutcome { faces: boolean[]; value: number }
export interface YutRoll extends YutRollOutcome { id: string }
export interface GameLog { id: string; type: string; text: string; player: number|null }
export interface GameState {
 config: GameConfig;
 players: Player[];
 pieces: GamePiece[];
 current: number;
 phase: 'roll'|'move'|'won';
 rolls: YutRoll[];
 lastRoll: YutRoll|null;
 winner: number|null;
 turn: number;
 logs: GameLog[];
 throwCount: number;
 itemsUnlocked: boolean;
 itemUnlockTurn: number;
 itemNodes: Record<string, ItemType>;
}
export interface MoveOption {
 choice: MoveChoice;
 label: string;
 source: string;
 destination: string;
 path: string[];
 updated: PiecePath;
 pieceId: string;
 rollId: string;
 groupIds: string[];
}
export interface MoveMeta {
 captured: number; joined: number; moved: number; winner: number|null;
 from: string; to: string; path: string[]; player: number; groupIds: string[];
 shieldBlocked?: boolean; pickedItem?: ItemType|null;
}
export interface MoveResolution { game: GameState; meta: MoveMeta }
export interface LandingStick { id: number; x: number; y: number; angle: number; front: boolean; nak: boolean; delay: number }
export interface LandingOutcome { sticks: LandingStick[]; nak: boolean }

export const ITEM_TYPES: ItemType[]=['geumjul','key','stone','shield'];
export const ITEMS: Record<ItemType, ItemMeta>={
 geumjul:{type:'geumjul',name:'금줄 부적',icon:'🌾',summary:'다음 윷 던지기에서 낙이 나와도 무효 처리하지 않고 구제합니다.'},
 key:{type:'key',name:'돌담 열쇠',icon:'🔑',summary:'갈림길·모 자리를 지나가는 중이어도 지름길로 진입합니다.'},
 stone:{type:'stone',name:'이끼 디딤돌',icon:'🪨',summary:'이번 이동에서 선택한 윷 결과의 칸 수를 +1 또는 -1 조절합니다.'},
 shield:{type:'shield',name:'호패 방패',icon:'🛡️',summary:'이번에 이동해 도착한 내 말(또는 업힌 그룹)에 1회 방어막을 씌웁니다.'}
};
const POUCH_SPOTS: Record<BoardType, string[]>={
 S:['O3','O8','O13','O18','C','O11'],
 A:['O3','O9','O15','O21','C','O13'],
 B:['O3','O9','O15','O21','I4','O13'],
 G:['O3','O8','O13','O18','O22','O11']
};
const COLORS: PlayerVisual[]=[
 {name:'황금',color:'#eca14d',light:'#ffe4ba',avatar:'🐕'},
 {name:'청월',color:'#6daefb',light:'#d7eaff',avatar:'🐰'},
 {name:'초록',color:'#55c77f',light:'#d1fae7',avatar:'🐯'},
 {name:'홍단',color:'#ee6468',light:'#ffdcdd',avatar:'🐧'}
];
const NAMES: Record<number, string>={'-1':'빽도','1':'도','2':'개','3':'걸','4':'윷','5':'모','6':'육'};
const SCORES: Record<number, string>={'-1':'↶','1':'Ⅰ','2':'Ⅱ','3':'Ⅲ','4':'Ⅳ','5':'Ⅴ','6':'Ⅵ'};
let idSeq=1;
function newId(){return String(idSeq++);}

export function itemUnlockTurn(count: number): number{
 const c=Math.min(4,Math.max(2,Number(count ?? 2)));
 return c*2+1;
}

function makeItemNodes(board: BoardType,count=3): Record<string, ItemType>{
 const spots=(POUCH_SPOTS[board]||POUCH_SPOTS.S).slice(0,Math.min(6,Math.max(4,count+2)));
 return Object.fromEntries(spots.map((node,i)=>[node,ITEM_TYPES[i%ITEM_TYPES.length]]));
}

export function unlockItemsNow(g: GameState): GameState{
 if(!g.config.itemMode||g.itemsUnlocked)return g;
 const starter: ItemType[]=['key','stone','geumjul','shield'];
 const players=g.players.map((p,i)=>({
  ...p,
  items:p.items.length<2?[...p.items,{id:newId(),type:starter[i%starter.length]}]:p.items
 }));
 const itemNodes=makeItemNodes(g.config.board,g.config.count);
 return appendLog({...g,players,itemsUnlocked:true,itemNodes},'item',`🎁 중반전 돌입! 참가자 전원에게 전술 패물 1개가 보급되고 윷판에 복주머니 ${Object.keys(itemNodes).length}개가 나타났습니다.`,null);
}

function createGame(opts: Partial<GameConfig>): GameState{
 const count=Math.min(4,Math.max(2,Number(opts.count ?? 2)));
 const config: GameConfig={
  mode:opts.mode==='spectate'?'spectate':opts.mode==='local'?'local':'ai',
  count,
  board:opts.board==='A'||opts.board==='B'||opts.board==='G'?opts.board:'S',
  backdo:opts.backdo!==false,
  itemMode:Boolean(opts.itemMode)
 };
 const unlockTurn=itemUnlockTurn(count);
 const players: Player[]=Array.from({length:config.count},(_,i)=>({
  id:i,...COLORS[i],
  label:config.mode==='local'?`플레이어 ${i+1}`:config.mode==='ai'&&i===0?'나':`${COLORS[i].name} AI`,
  ai:config.mode==='spectate'||config.mode==='ai'&&i>0,
  items:[],
  geumjulArmed:false,keyArmed:false,stoneDelta:0
 }));
 const pieces: GamePiece[]=players.flatMap(p=>Array.from({length:4},(_,i)=>({...maps.initialState(),id:`p${p.id}-${i}`,player:p.id,index:i,shielded:false})));
 const modeLabel=config.itemMode?`아이템전(제 ${unlockTurn}턴 중반부터 패물 등장)`:'일반전';
 return {config,players,pieces,current:0,phase:'roll',rolls:[],lastRoll:null,winner:null,turn:1,
 logs:[{id:newId(),type:'system',text:`${maps.boardMeta(config.board).title} · ${modeLabel} 윷놀이가 시작되었습니다.`,player:null}],throwCount:0,itemsUnlocked:false,itemUnlockTurn:unlockTurn,itemNodes:{}};
}
function currentPlayer(g: GameState): Player{return g.players[g.current];}
function occupied(piece: GamePiece): boolean{return piece.node!=='WAIT'&&piece.node!=='FIN';}
function sameStack(g: GameState,piece: GamePiece): GamePiece[]{return !occupied(piece)?[piece]:g.pieces.filter(p=>p.player===piece.player&&p.node===piece.node&&occupied(p));}
function uniqueMovablePieces(g: GameState): GamePiece[]{
 const seen=new Set();return g.pieces.filter(p=>{
   if(p.player!==g.current||p.node==='FIN')return false;
   const key=p.node==='WAIT'?p.id:`${p.player}/${p.node}`;
   if(seen.has(key))return false;seen.add(key);return true;
 });
}
function effectivePips(rollValue: number,delta: -1|0|1): number{
 if(!delta)return rollValue;
 if(rollValue<0)return delta>0?1:-1;
 return Math.max(1,Math.min(6,rollValue+delta));
}
function moveOptions(g: GameState,pieceId: string,rollId: string): MoveOption[]{
 const piece=g.pieces.find(p=>p.id===pieceId),roll=g.rolls.find(r=>r.id===rollId);
 if(!piece||!roll||piece.player!==g.current||piece.node==='FIN')return [];
 const actor=g.players[piece.player];
 const pips=effectivePips(roll.value,actor?.stoneDelta||0);
 if(piece.node==='WAIT'&&pips<0)return [];
 const graph=maps.makeGraph(g.config.board);
 const passThrough=!!actor?.keyArmed&&pips>1;
 const sourceChoices: RouteChoice[]=pips<0?[{value:'back',label:'한 칸 뒤로'}]:maps.getOptions(graph,piece,passThrough,pips);
 return sourceChoices.map((opt)=>{
  const choice=opt.value==='back'?'normal':opt.value;
  try{
   const result=maps.movePiece(graph,piece,pips,choice,passThrough);
   if(!result.lastPath.length || result.lastPath.length===1) return null;
   return {choice:choice as MoveChoice,label:opt.label,source:piece.node,destination:result.node,path:result.lastPath,updated:result,pieceId,rollId,
    groupIds:sameStack(g,piece).map(p=>p.id)};
  }catch(e){return null;}
 }).filter((x): x is MoveOption=>x!==null);
}
function legalActions(g: GameState,rollId?: string): MoveOption[]{
 if(g.phase!=='move')return [];
 const results: MoveOption[]=[];
 for(const roll of g.rolls){
  if(rollId&&roll.id!==rollId)continue;
  for(const p of uniqueMovablePieces(g))results.push(...moveOptions(g,p.id,roll.id));
 }
 return results;
}
function appendLog(g: GameState,type: string,text: string,player: number|null=null): GameState{
 return {...g,logs:[{id:newId(),type,text,player:player==null?g.current:player},...g.logs].slice(0,24)};
}
function nextTurn(g: GameState,why?: string): GameState{
 const old=g.current, next=(old+1)%g.players.length;
 const clearedPlayers=g.players.map((p,i)=>i===old?{...p,keyArmed:false,stoneDelta:0 as const}:p);
 const nextTurnNum=g.turn+1;
 let result: GameState={...g,players:clearedPlayers,current:next,phase:'roll',turn:nextTurnNum,rolls:[],lastRoll:null};
 result=appendLog(result,'turn',why||`${g.players[old].label} 차례 종료 → ${g.players[next].label} 차례`,next);
 if(result.config.itemMode&&!result.itemsUnlocked&&nextTurnNum>=result.itemUnlockTurn){
  result=unlockItemsNow(result);
 }else if(result.config.itemMode&&result.itemsUnlocked&&Object.keys(result.itemNodes).length===0&&(nextTurnNum-1)%result.config.count===0){
  const refilled=makeItemNodes(result.config.board,result.config.count);
  result=appendLog({...result,itemNodes:refilled},'item','🎁 새 라운드를 맞아 윷판 위에 복주머니가 다시 채워졌습니다.',null);
 }
 return result;
}
function normalize(g: GameState): GameState{
 if(g.phase!=='move')return g;
 if(g.rolls.length===0)return nextTurn(g);
 if(!legalActions(g).length)return nextTurn(g,'이동 가능한 말이 없어 남은 결과를 건너뛰었습니다.');
 return g;
}
function rollSticks(backdo: boolean): YutRollOutcome{
 const faces=Array.from({length:4},()=>Math.random()<.5);
 // Count the visible XXX faces: 0 = yut, 1..3 = do/gae/geol, 4 = mo.
 const count=faces.filter(Boolean).length;
 const value=count===0?4:count===4?5:(count===1&&faces[0]&&backdo?-1:count);
 return {faces,value};
}
function generateLanding(mode: 'nak'|'safe'|'random'): LandingOutcome{
 const sticks: LandingStick[]=[];let anyNak=false;
 for(let i=0;i<4;i++){
  const theta=-105+Math.random()*210;
  let x=205+i*68+(Math.random()-.5)*42,y=76+(Math.random()-.5)*35;
  const makeNak=mode==='nak'&&i===3 || mode!=='safe'&&Math.random()<.002;
  if(makeNak){const side=Math.floor(Math.random()*2);x=side===0?17:675;y=60+(Math.random()-.5)*22;}
  const c=Math.abs(Math.cos(theta*Math.PI/180)),s=Math.abs(Math.sin(theta*Math.PI/180));
  const dx=c*38+s*10,dy=s*38+c*10;
  const outside=(x+dx<65)||(x-dx>585)||(y+dy<7)||(y-dy>143);
  anyNak=anyNak||outside;
  sticks.push({id:i,x,y,angle:theta,front:false,nak:outside,delay:i*76});
 }
 return {sticks,nak:anyNak};
}
function throwResult(g: GameState,rolled: YutRollOutcome,nak: boolean): GameState{
 if(g.phase!=='roll')return g;
 const actor=g.players[g.current];
 if(nak&&actor?.geumjulArmed){
  const players=g.players.map((p,i)=>i===g.current?{...p,geumjulArmed:false}:p);
  const result: YutRoll={id:newId(),value:rolled.value,faces:rolled.faces};
  let saved: GameState={...g,players,rolls:[...g.rolls,result],phase:rolled.value===4||rolled.value===5?'roll':'move',lastRoll:result,throwCount:g.throwCount+1};
  saved=appendLog(saved,'item',`🌾 금줄 부적이 발동해 낙을 막았습니다! (${NAMES[rolled.value]} 인정)`);
  return normalize(saved);
 }
 if(nak){
  if(g.rolls.length)return normalize(appendLog({...g,phase:'move',throwCount:g.throwCount+1},'nak','낙! 이번 던지기는 무효입니다. 모아 둔 결과로 이동하세요.'));
  let lost=appendLog(g,'nak','낙! 윷가락이 멍석 밖으로 완전히 벗어났습니다. 이동 없이 차례 교대.');
  return nextTurn({...lost,rolls:[],throwCount:g.throwCount+1},'낙으로 차례가 넘어갔습니다.');
 }
 const result: YutRoll={id:newId(),value:rolled.value,faces:rolled.faces};
 let next: GameState={...g,rolls:[...g.rolls,result],phase:rolled.value===4||rolled.value===5?'roll':'move',lastRoll:result,throwCount:g.throwCount+1};
 next=appendLog(next,'roll',`${NAMES[rolled.value]}! ${rolled.value===4||rolled.value===5?'윷을 한 번 더 던집니다.':'이동할 말을 골라주세요.'}`);
 return normalize(next);
}
function useItem(g: GameState,itemId: string,arg?: {delta?: -1|1; pieceId?: string}): GameState{
 if(!g.config.itemMode)return g;
 const actor=g.players[g.current];
 if(!actor||g.winner!==null)return g;
 const item=actor.items.find(it=>it.id===itemId);
 if(!item)return g;
 const remaining=actor.items.filter(it=>it.id!==itemId);
 if(item.type==='geumjul'){
  if(actor.geumjulArmed)return g;
  const players=g.players.map((p,i)=>i===g.current?{...p,items:remaining,geumjulArmed:true}:p);
  return appendLog({...g,players},'item',`${actor.label} · 🌾 금줄 부적 준비! 다음 낙을 1회 방어합니다.`);
 }
 if(item.type==='key'){
  if(g.phase!=='move'||actor.keyArmed)return g;
  const players=g.players.map((p,i)=>i===g.current?{...p,items:remaining,keyArmed:true}:p);
  return appendLog({...g,players},'item',`${actor.label} · 🔑 돌담 열쇠 사용! 이번 이동에서 갈림길을 지나쳐도 지름길로 진입할 수 있습니다.`);
 }
 if(item.type==='stone'){
  if(g.phase!=='move'||actor.stoneDelta!==0)return g;
  const delta: -1|1=arg?.delta===-1?-1:1;
  const players=g.players.map((p,i)=>i===g.current?{...p,items:remaining,stoneDelta:delta}:p);
  return appendLog({...g,players},'item',`${actor.label} · 🪨 이끼 디딤돌(${delta>0?'+1칸':'-1칸'}) 적용!`);
 }
 if(item.type==='shield'){
  const candidates=g.pieces.filter(p=>p.player===g.current&&occupied(p)&&!p.shielded);
  const target=arg?.pieceId?candidates.find(p=>p.id===arg.pieceId):candidates[0];
  if(!target)return g;
  const stackIds=new Set(sameStack(g,target).map(p=>p.id));
  const pieces=g.pieces.map(p=>stackIds.has(p.id)?{...p,shielded:true}:p);
  const players=g.players.map((p,i)=>i===g.current?{...p,items:remaining}:p);
  return appendLog({...g,players,pieces},'item',`${actor.label} · 🛡️ 호패 방패로 ${target.node}의 말을 보호합니다!`);
 }
 return g;
}
function resolveMove(g: GameState,option: MoveOption): MoveResolution|null{
 if(g.phase!=='move')return null;
 const matched=moveOptions(g,option.pieceId,option.rollId).find(o=>o.choice===option.choice);
 if(!matched)return null;
 const actor=currentPlayer(g);
 const group=new Set(matched.groupIds);
 const dest=matched.destination;
 const enemiesAtDest=dest==='WAIT'||dest==='FIN'?[]:g.pieces.filter(p=>p.player!==g.current&&p.node===dest);
 const shieldBlocked=enemiesAtDest.some(p=>p.shielded);
 let finalUpdated=matched.updated;
 let finalDest=dest;
 if(shieldBlocked&&matched.updated.history.length>=2){
  const fallbackHistory=matched.updated.history.slice(0,-1);
  const prevStep=fallbackHistory.at(-1)!;
  const fallbackPath=matched.path.slice(0,-1);
  finalUpdated={...matched.updated,node:prevStep.node,lane:prevStep.lane,history:fallbackHistory,lastPath:fallbackPath};
  finalDest=prevStep.node;
 }
 const captureIds=new Set(shieldBlocked||finalDest==='WAIT'||finalDest==='FIN'?[]:g.pieces.filter(p=>p.player!==g.current&&p.node===finalDest).map(p=>p.id));
 const joinedIds=new Set(finalDest==='WAIT'||finalDest==='FIN'?[]:g.pieces.filter(p=>p.player===g.current&&p.node===finalDest&&!group.has(p.id)).map(p=>p.id));
 const groupShielded=g.pieces.some(p=>(group.has(p.id)||joinedIds.has(p.id))&&p.shielded);
 const updatedPieces=g.pieces.map(p=>{
  if(shieldBlocked&&p.player!==g.current&&p.node===dest)return {...p,shielded:false};
  if(group.has(p.id)||joinedIds.has(p.id))return {...p,node:finalUpdated.node,lane:finalUpdated.lane,history:finalUpdated.history.map(h=>({...h})),lastPath:finalUpdated.lastPath.slice(),lastResult:finalUpdated.lastResult,shielded:finalDest==='FIN'?false:groupShielded};
  if(captureIds.has(p.id))return {...p,...maps.initialState(),shielded:false};
  return p;
 });
 let itemNodes={...g.itemNodes};
 let pickedItem: ItemType|null=null;
 const pouchAtDest=g.config.itemMode&&g.itemsUnlocked&&finalDest!=='WAIT'&&finalDest!=='FIN'?itemNodes[finalDest]:undefined;
 const cleanedActorItems=actor.items;
 let nextActorItems=cleanedActorItems;
 if(pouchAtDest&&cleanedActorItems.length<2){
  pickedItem=pouchAtDest;
  nextActorItems=[...cleanedActorItems,{id:newId(),type:pouchAtDest}];
  delete itemNodes[finalDest];
 }
 const updatedPlayers=g.players.map((p,i)=>i===g.current?{...p,items:nextActorItems,keyArmed:false,stoneDelta:0 as const}:p);
 const rolls=g.rolls.filter(r=>r.id!==matched.rollId);
 const winner=updatedPieces.filter(p=>p.player===g.current&&p.node==='FIN').length===4?g.current:null;
 const captured=captureIds.size,joined=joinedIds.size,moved=group.size;
 let state: GameState={...g,players:updatedPlayers,pieces:updatedPieces,rolls,itemNodes,phase:winner!==null?'won':captured?'roll':'move',winner};
 const rollVal=g.rolls.find(r=>r.id===matched.rollId)!.value;
 const note=winner!==null?`${actor.label} 승리! 말 4개 모두 완주했습니다.`:
  shieldBlocked?`🛡️ 상대의 호패 방패가 발동해 ${dest} 직전 칸(${finalDest})에 멈추었습니다!`:
  captured?`${actor.label}이(가) 상대 말 ${captured}개를 잡았습니다. 추가 던지기!`:
  finalDest==='FIN'?`${actor.label}의 말 ${moved}개 완주!`:
  joined?`${actor.label}이(가) 말 ${joined}개를 업었습니다.`:
  `${actor.label} · ${NAMES[rollVal]} · ${matched.label} 이동`;
 state=appendLog(state,winner!==null?'win':shieldBlocked?'item':captured?'capture':finalDest==='FIN'?'finish':'move',note);
 if(pickedItem)state=appendLog(state,'item',`🎁 ${actor.label}이(가) 복주머니에서 [${ITEMS[pickedItem].icon} ${ITEMS[pickedItem].name}]을(를) 획득했습니다!`);
 const progressedPieces=updatedPieces.filter(p=>p.node!=='WAIT').length;
 const anyPlayerMidFinish=g.players.some(pl=>updatedPieces.filter(p=>p.player===pl.id&&p.node==='FIN').length>=2);
 if(winner===null&&state.config.itemMode&&!state.itemsUnlocked&&(anyPlayerMidFinish||progressedPieces>=state.config.count*3)){
  state=unlockItemsNow(state);
 }
 if(winner===null)state=normalize(state);
 return {game:state,meta:{captured,joined,moved,winner,from:matched.source,to:finalDest,path:finalUpdated.lastPath,player:g.current,groupIds:matched.groupIds,shieldBlocked,pickedItem}};
}
function scoreOption(g: GameState,opt: MoveOption): number{
 const dest=opt.destination;
 const enemy=g.pieces.filter(p=>p.player!==g.current&&p.node===dest&&!p.shielded).length;
 const shieldedEnemy=g.pieces.filter(p=>p.player!==g.current&&p.node===dest&&p.shielded).length;
 const friend=g.pieces.filter(p=>p.player===g.current&&p.node===dest).length;
 const piece=g.pieces.find(p=>p.id===opt.pieceId)!;
 const pouch=g.config.itemMode&&g.itemsUnlocked&&g.itemNodes[dest]&&g.players[g.current].items.length<2?45:0;
 return (dest==='FIN'?200:0)+enemy*115-shieldedEnemy*40+friend*18+pouch+(opt.choice==='shortcut'?60:opt.choice==='finish'?60:0)+
 (piece.node==='WAIT'?22:0)+(opt.path.length*2)+Math.random()*18;
}
export {COLORS,NAMES,SCORES,createGame,currentPlayer,sameStack,uniqueMovablePieces,effectivePips,moveOptions,legalActions,rollSticks,generateLanding,throwResult,useItem,resolveMove,scoreOption,nextTurn,normalize};
