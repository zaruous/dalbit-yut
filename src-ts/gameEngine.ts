import * as maps from './mapEngine.js';
import type {BoardType, PiecePath, MoveChoice, RouteChoice} from './mapEngine.js';

export interface PlayerVisual { name: string; color: string; light: string; avatar: string }
export interface Player extends PlayerVisual { id: number; label: string; ai: boolean }
export interface GamePiece extends PiecePath { id: string; player: number; index: number }
export interface GameConfig { mode: 'ai'|'local'; count: number; board: BoardType; backdo: boolean }
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
}
export interface MoveResolution { game: GameState; meta: MoveMeta }
export interface LandingStick { id: number; x: number; y: number; angle: number; front: boolean; nak: boolean; delay: number }
export interface LandingOutcome { sticks: LandingStick[]; nak: boolean }

const COLORS: PlayerVisual[]=[
 {name:'황금',color:'#eca14d',light:'#ffe4ba',avatar:'🐕'},
 {name:'청월',color:'#6daefb',light:'#d7eaff',avatar:'🐰'},
 {name:'초록',color:'#55c77f',light:'#d1fae7',avatar:'🐯'},
 {name:'홍단',color:'#ee6468',light:'#ffdcdd',avatar:'🐧'}
];
const NAMES: Record<number, string>={'-1':'빽도','1':'도','2':'개','3':'걸','4':'윷','5':'모'};
const SCORES: Record<number, string>={'-1':'↶','1':'Ⅰ','2':'Ⅱ','3':'Ⅲ','4':'Ⅳ','5':'Ⅴ'};
let idSeq=1;
function newId(){return String(idSeq++);}
function createGame(opts: Partial<GameConfig>): GameState{
 const config: GameConfig={mode:opts.mode==='local'?'local':'ai',count:Math.min(4,Math.max(2,Number(opts.count ?? 2))),board:opts.board==='B'?'B':'A',backdo:opts.backdo!==false};
 const players: Player[]=Array.from({length:config.count},(_,i)=>({id:i,...COLORS[i],label:config.mode==='ai'?(i===0?'나':`${COLORS[i].name} AI`):`플레이어 ${i+1}`,ai:config.mode==='ai'&&i>0}));
 const pieces: GamePiece[]=players.flatMap(p=>Array.from({length:4},(_,i)=>({...maps.initialState(),id:`p${p.id}-${i}`,player:p.id,index:i})));
 return {config,players,pieces,current:0,phase:'roll',rolls:[],lastRoll:null,winner:null,turn:1,
 logs:[{id:newId(),type:'system',text:`${config.board==='A'?'팔각 순환형':'이중 링형'} 윷놀이가 시작되었습니다.`,player:null}],throwCount:0};
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
function moveOptions(g: GameState,pieceId: string,rollId: string): MoveOption[]{
 const piece=g.pieces.find(p=>p.id===pieceId),roll=g.rolls.find(r=>r.id===rollId);
 if(!piece||!roll||piece.player!==g.current||piece.node==='FIN')return [];
 if(piece.node==='WAIT'&&roll.value<0)return [];
 const graph=maps.makeGraph(g.config.board);
 const sourceChoices: RouteChoice[]=roll.value<0?[{value:'back',label:'한 칸 뒤로'}]:maps.getOptions(graph,piece);
 return sourceChoices.map((opt)=>{
  const choice=opt.value==='back'?'normal':opt.value;
  try{
   const result=maps.movePiece(graph,piece,roll.value,choice);
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
 let result: GameState={...g,current:next,phase:'roll',turn:g.turn+1,rolls:[],lastRoll:null};
 result=appendLog(result,'turn',why||`${g.players[old].label} 차례 종료 → ${g.players[next].label} 차례`,next);
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
 const count=faces.filter(Boolean).length;
 const value=count===0?5:(count===1&&faces[0]&&backdo?-1:count);
 return {faces,value};
}
function generateLanding(force: number,mode: 'nak'|'safe'|'random'): LandingOutcome{
 const sticks: LandingStick[]=[];let anyNak=false;
 for(let i=0;i<4;i++){
  const theta=-105+Math.random()*210;
  let x=205+i*68+(Math.random()-.5)*42,y=76+(Math.random()-.5)*35;
  const forceRisk=Math.max(0,(force-60)/600);const randRisk=.002+forceRisk;
  const makeNak=mode==='nak'&&i===3 || mode!=='safe'&&Math.random()<randRisk;
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
 if(nak){
  let lost=appendLog(g,'nak','낙! 윷가락이 멍석 밖으로 완전히 벗어났습니다. 이동 없이 차례 교대.');
  return nextTurn({...lost,rolls:[],throwCount:g.throwCount+1},'낙으로 차례가 넘어갔습니다.');
 }
 const result: YutRoll={id:newId(),value:rolled.value,faces:rolled.faces};
 let next: GameState={...g,rolls:[...g.rolls,result],phase:rolled.value===4||rolled.value===5?'roll':'move',lastRoll:result,throwCount:g.throwCount+1};
 next=appendLog(next,'roll',`${NAMES[rolled.value]}! ${rolled.value===4||rolled.value===5?'윷을 한 번 더 던집니다.':'이동할 말을 골라주세요.'}`);
 return normalize(next);
}
function resolveMove(g: GameState,option: MoveOption): MoveResolution|null{
 if(g.phase!=='move')return null;
 const matched=moveOptions(g,option.pieceId,option.rollId).find(o=>o.choice===option.choice);
 if(!matched)return null;
 const actor=currentPlayer(g);
 const group=new Set(matched.groupIds);
 const dest=matched.destination;
 const captureIds=new Set(dest==='WAIT'||dest==='FIN'?[]:g.pieces.filter(p=>p.player!==g.current&&p.node===dest).map(p=>p.id));
 const joinedIds=new Set(dest==='WAIT'||dest==='FIN'?[]:g.pieces.filter(p=>p.player===g.current&&p.node===dest&&!group.has(p.id)).map(p=>p.id));
 const updatedPieces=g.pieces.map(p=>{
  if(group.has(p.id)||joinedIds.has(p.id))return {...p,node:matched.updated.node,lane:matched.updated.lane,history:matched.updated.history.map(h=>({...h})),lastPath:matched.updated.lastPath.slice(),lastResult:matched.updated.lastResult};
  if(captureIds.has(p.id))return {...p,...maps.initialState()};
  return p;
 });
 const rolls=g.rolls.filter(r=>r.id!==matched.rollId);
 const winner=updatedPieces.filter(p=>p.player===g.current&&p.node==='FIN').length===4?g.current:null;
 const captured=captureIds.size,joined=joinedIds.size,moved=group.size;
 let state: GameState={...g,pieces:updatedPieces,rolls,phase:winner!==null?'won':captured?'roll':'move',winner};
 const note=winner!==null?`${actor.label} 승리! 말 4개 모두 완주했습니다.`:
  captured?`${actor.label}이(가) 상대 말 ${captured}개를 잡았습니다. 추가 던지기!`:
  dest==='FIN'?`${actor.label}의 말 ${moved}개 완주!`:
  joined?`${actor.label}이(가) 말 ${joined}개를 업었습니다.`:
  `${actor.label} · ${NAMES[g.rolls.find(r=>r.id===matched.rollId)!.value]} · ${matched.label} 이동`;
 state=appendLog(state,winner!==null?'win':captured?'capture':dest==='FIN'?'finish':'move',note);
 if(winner===null)state=normalize(state);
 return {game:state,meta:{captured,joined,moved,winner,from:matched.source,to:dest,path:matched.path,player:g.current,groupIds:matched.groupIds}};
}
function scoreOption(g: GameState,opt: MoveOption): number{
 const dest=opt.destination;
 const enemy=g.pieces.filter(p=>p.player!==g.current&&p.node===dest).length;
 const friend=g.pieces.filter(p=>p.player===g.current&&p.node===dest).length;
 const piece=g.pieces.find(p=>p.id===opt.pieceId)!;
 return (dest==='FIN'?200:0)+enemy*115+friend*18+(opt.choice==='shortcut'?60:opt.choice==='finish'?60:0)+
 (piece.node==='WAIT'?22:0)+(opt.path.length*2)+Math.random()*18;
}
export {COLORS,NAMES,SCORES,createGame,currentPlayer,sameStack,uniqueMovablePieces,moveOptions,legalActions,rollSticks,generateLanding,throwResult,resolveMove,scoreOption,nextTurn,normalize};
