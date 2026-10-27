import * as E from './gameEngine.js';
import * as M from './mapEngine.js';
import {chooseAIAction} from './aiEngine.js';
import type { GameState, GameConfig, MoveOption, MoveMeta, LandingStick, YutRoll, GamePiece } from './gameEngine.js';
import type { MoveChoice } from './mapEngine.js';

// React/ReactDOM UMD vendors load before this ES module. The game uses React
// createElement for its richly layered SVG board and throw animations.
declare global { namespace JSX { interface Element {} interface IntrinsicElements { [name: string]: any } } }
const React: any = (window as any).React;
const ReactDOM: any = (window as any).ReactDOM;
const h: any = React.createElement;

const FRAG=(children)=>h('div',null,children);
const cx=(...names)=>names.filter(Boolean).join(' ');
function coords(g: M.BoardGraph,id: string): M.Point{
 if(id==='WAIT')return g.xy.O0;
 if(id==='FIN')return {x:432,y:406};
 return g.xy[id]||g.xy.O0;
}
function poly(g: M.BoardGraph,nodes: string[]): string{return nodes.map((id,i)=>{const p=coords(g,id);return `${i===0?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`}).join(' ');}
function PieceShape(props: any){
 const {x,y,color,number,selected,available,animated,onClick}=props;
 return h('g',{className:cx('piece-handle',selected&&'selected',available&&'available',animated&&'animated'),transform:`translate(${x} ${y})`,onClick,role:onClick?'button':undefined,tabIndex:onClick?0:undefined,'aria-label':onClick?'말 선택':undefined,onKeyDown:onClick?(ev)=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();onClick();}}:undefined},
   h('ellipse',{className:'piece-floor-shadow',cx:0,cy:16,rx:17,ry:6,fill:'#2d1a10',opacity:'.34'}),
   h('circle',{className:'piece-halo',cx:0,cy:0,r:23,fill:'none',stroke:selected?'#ffe4a1':available?'#f8cb69':'#604129',strokeWidth:selected?4:available?3:1.5,strokeDasharray:selected?'7 4':undefined}),
   h('rect',{x:-13,y:-1,width:26,height:17,rx:8,fill:'#43281c',stroke:'#2b180e',strokeWidth:1.2}),
   h('rect',{x:-12,y:-4,width:24,height:17,rx:8,fill:color,stroke:'#fff4dd',strokeWidth:1.2}),
   h('ellipse',{cx:0,cy:7,rx:13,ry:7.5,fill:color,stroke:'#4b2b20',strokeWidth:1.3}),
   h('ellipse',{cx:0,cy:-8,rx:11,ry:10,fill:color,stroke:'#fff0d1',strokeWidth:2}),
   h('ellipse',{cx:-3.3,cy:-10,rx:4.8,ry:3,fill:'#fff9df',opacity:'.65'}),
   h('circle',{cx:0,cy:-8,r:2.5,fill:'#fff1cf',opacity:'.6'}),
   number>1?h('g',null,h('circle',{cx:15,cy:-14,r:10.5,fill:'#33251d',stroke:'#ffdd94',strokeWidth:1.8}),h('text',{x:15,y:-10,textAnchor:'middle',fontSize:11,fontWeight:900,fill:'#ffe7b9'},number)):null,
   selected?h('g',{className:'selected-piece-label'},h('rect',{x:-27,y:-40,width:54,height:19,rx:8,fill:'#55301c',stroke:'#ffdc8f',strokeWidth:1.4}),h('text',{x:0,y:-27,textAnchor:'middle',fontSize:11},'선택한 말')):null,
   onClick?h('circle',{className:'piece-hit-area',cx:0,cy:0,r:35,fill:'transparent',stroke:'none'}):null
 );
}
function Board({game,chosenRoll,chosenPiece,chosenChoice,onPiece,onTarget,moving,burst}: any){
 const graph=M.makeGraph(game.config.board),xy=graph.xy;
 const outer=[...graph.outerIds,'O0'];
 const routes=game.config.board==='A' ?
  [['O6','NE1','NE2','C','SW1','SW2','O18'],['O12','NW1','NW2','C','SE1','SE2','O0']]:
  [['O6',...Array.from({length:9},(_,i)=>`I${i}`),'R1','O0'],['O12','W0','I4']];
 const isHuman=!game.players[game.current].ai;
 const availableIds=new Set(game.phase==='move'&&chosenRoll&&isHuman?E.legalActions(game,chosenRoll.id).map(a=>a.pieceId):[]);
 const groups: {player:number;node:string;items:GamePiece[]}[]=[];const index=new Map<string,number>();
 for(const p of game.pieces){
  if(p.node==='WAIT'||p.node==='FIN')continue;
  const key=`${p.player}-${p.node}`;
  if(!index.has(key)){index.set(key,groups.length);groups.push({player:p.player,node:p.node,items:[p]});}
  else groups[index.get(key)!].items.push(p);
 }
 const options=chosenPiece&&chosenRoll?E.moveOptions(game,chosenPiece.id,chosenRoll.id):[];
 const chosenOption=options.find(x=>x.choice===chosenChoice)||options[0];
 const highlight=chosenOption&&chosenOption.path.length>1?chosenOption.path:null;
 let staticPath=highlight?highlight.map(id=>coords(graph,id)):[];
 let movedGroups=new Set(moving?moving.meta.groupIds:[]);
 const nodes=Object.entries(xy).map(([id,pos])=>{
  const kind=id==='O0'?'goal':id==='O6'||id==='O12'?'fork':id==='C'?'center':id.startsWith('I')?'inner':'normal';
  const big=kind==='goal'?14:kind==='fork'||kind==='center'?13:8;
  return h('g',{key:id},
    kind==='goal'||kind==='center'?h('circle',{cx:pos.x,cy:pos.y,r:big+6,fill:'none',stroke:kind==='goal'?'#7fb9a1':'#b38a51',strokeWidth:1,strokeDasharray:'3 4'}):null,
    h('circle',{className:cx('node-circle',kind),cx:pos.x,cy:pos.y,r:big}),
    kind==='fork'?h('circle',{cx:pos.x,cy:pos.y,r:3.5,fill:'#ba7142'}):null,
    kind==='center'?h('text',{x:pos.x,y:pos.y+3.5,textAnchor:'middle',fontSize:10,fontWeight:900,fill:'#8f603c'},'✦'):null,
    kind==='goal'?h('text',{x:pos.x,y:pos.y+4,textAnchor:'middle',fontSize:11,fontWeight:900,fill:'#397d67'},'집'):null
  );
 });
 const tokenViews=groups.map((gr,i)=>{
  if(gr.items.some(p=>movedGroups.has(p.id)))return null;
  const p=game.players[gr.player],c=coords(graph,gr.node),head=gr.items[0];
  const canPick=isHuman&&gr.player===game.current&&gr.items.some(v=>availableIds.has(v.id));
  return h(PieceShape,{key:'piece-'+i,x:c.x,y:c.y,color:p.color,number:gr.items.length,
   selected:!!chosenPiece&&gr.items.some(v=>v.id===chosenPiece.id),available:canPick,onClick:canPick?()=>onPiece(head.id):null});
 });
 const movingToken=moving&&moving.meta.player===game.current?(()=>{
  const movingPlayer=game.players[moving.meta.player],node=moving.meta.path[Math.min(moving.step,moving.meta.path.length-1)],p=coords(graph,node);
  return h(PieceShape,{key:'animated-piece',x:p.x,y:p.y-4,color:movingPlayer.color,number:moving.meta.groupIds.length,animated:true});
 })():null;
 const target=chosenOption&&isHuman&&game.phase==='move'?(()=>{
  const to=coords(graph,chosenOption.destination);
  return h('g',{className:'board-target',onClick:()=>onTarget(chosenOption),key:'target',role:'button',tabIndex:0,'aria-label':'강조 표시된 목적지로 이동',onKeyDown:ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();onTarget(chosenOption);}}},
     h('circle',{className:'target-waves',cx:to.x,cy:to.y,r:30,fill:'#ffe4a3',opacity:'.2'}),
     h('circle',{className:'target-outer',cx:to.x,cy:to.y,r:23,fill:'#f8d58f',stroke:'#fff4cc',strokeWidth:2.7,strokeDasharray:'5 4'}),
     h('circle',{cx:to.x,cy:to.y,r:17,fill:'#5c3c27',stroke:'#ffc864',strokeWidth:2.2}),
     h('text',{x:to.x,y:to.y+4.5,textAnchor:'middle',fontSize:10.5,fontWeight:900,fill:'#fff1c8'},chosenOption.destination==='FIN'?'완주':chosenOption.destination==='WAIT'?'대기':'이동'),
     h('circle',{className:'invisible-hit',cx:to.x,cy:to.y,r:37})
  );
 })():null;
 const decor=h('g',{className:'board-ink-scenes','aria-hidden':true},
   h('g',{fill:'none',stroke:'#7d6955',opacity:.32,strokeWidth:2.1,strokeLinejoin:'round'},
      h('path',{d:'M56 217q38-62 66-17 30-57 69-11 27-50 64-11M294 190q23-48 55-17 33-64 78-8',strokeWidth:2.3}),
      h('path',{d:'M80 225q70-23 122-3 M298 223q80-26 134-9',strokeWidth:.9,opacity:.6}),
      h('path',{d:'M168 320l27-36 26 28 16-17 32 27 21-17 34 20',strokeWidth:1.4}),
      h('path',{d:'M183 337q-3-18 12-22 9 9 22-4 7 8 14 11M312 332q8-24 31-32',strokeWidth:1.1})
   ),
   h('g',{opacity:.35,fill:'#8b7253'},
     h('path',{d:'M348 315l24-16 24 16zm4 1h40v24h-40zm9-2v25m17-25v25m-33-28h51',stroke:'#8b7253',fill:'none',strokeWidth:2}),
     h('path',{d:'M114 334q-7-32 4-58l9-23m-14 41-16-18m24-21 14-14m-18 35 20 10',stroke:'#6b6254',fill:'none',strokeWidth:3}),
     h('path',{d:'M94 271q-12-13-22 0 14 7 22 0m44-31q-5-17-24-12 8 17 24 12',stroke:'#6b6254',fill:'none',strokeWidth:1}),
     h('path',{d:'M328 152q8-8 19 0 8-10 18-5',stroke:'#9a8569',fill:'none',strokeWidth:2})
   ),
   h('g',{stroke:'#c3ad8d',strokeWidth:1.3,fill:'none',opacity:.4},
     h('path',{d:'M40 117q16-23 35 0 10-16 27-7M395 114q17-23 34 2 10-14 31-4'}),
     h('path',{d:'M65 360q8-20 29 0 9-11 19-6M402 359q10-12 21-3 11-13 24-2'})
   )
 );
 const landmarks=[{id:'O0',color:'#3f7053'},{id:'O6',color:'#395987'},{id:'O12',color:'#b7833c'},{id:'O18',color:'#a33c3d'}].map(land=>{
   const pt=xy[land.id];return h('g',{key:'landmark'+land.id,className:'board-landmark'},
    h('circle',{cx:pt.x,cy:pt.y,r:23,fill:'#2a2021',stroke:'#d4a65c',strokeWidth:3}),
    h('circle',{cx:pt.x,cy:pt.y,r:18,fill:land.color,stroke:'#f5dca6',strokeWidth:1.2}),
    h('text',{x:pt.x,y:pt.y+6,textAnchor:'middle',fontSize:20,fill:'#f6d89b',opacity:.88},'✿')
   );
 });
 return h('svg',{className:'board-svg',viewBox:'0 0 500 470',role:'img','aria-label':game.config.board==='A'?'팔각 순환형 윷판':'이중 링형 윷판'},
  h('defs',null,
   h('radialGradient',{id:'paperFill',cx:'.5',cy:'.4',r:'.9'},h('stop',{offset:'0%',stopColor:'#fff7e5'}),h('stop',{offset:'100%',stopColor:'#dbc69e'})),
   h('pattern',{id:'grain',width:15,height:15,patternUnits:'userSpaceOnUse'},h('circle',{cx:2,cy:2,r:'.5',fill:'#8c6c44',opacity:'.12'}),h('path',{d:'M10 10l3-2',stroke:'#775939',strokeWidth:.3,opacity:'.13'}))
  ),
  h('rect',{x:4,y:4,width:492,height:462,rx:8,fill:'url(#paperFill)'}),h('rect',{x:4,y:4,width:492,height:462,rx:8,fill:'url(#grain)'}),
  h('rect',{x:15,y:15,width:470,height:440,rx:4,fill:'none',stroke:'#aa8b65',strokeWidth:1,opacity:.6}),
  h('path',{d:'M28 48V28h24 M448 28h24v20 M28 422v20h24 M448 442h24v-20',fill:'none',stroke:'#926f49',strokeWidth:5,strokeLinecap:'square'}),
  decor,
  ...landmarks,
  h('path',{d:poly(graph,outer),className:'route-line'}),
  ...routes.map((r,i)=>h('path',{d:poly(graph,r),key:'route'+i,className:'route-inner'})),
  ...nodes,
  h('g',{className:'board-label'},
   h('text',{x:396,y:398,className:'board-label'},'출발 · 완주'),
   h('text',{x:393,y:86,className:'board-label'},'갈림길 ①'),
   h('text',{x:76,y:87,className:'board-label'},'갈림길 ②'),
   game.config.board==='A'?h('text',{x:264,y:221,className:'board-label'},'중앙'):h('text',{x:214,y:222,className:'board-label'},'내선')
  ),
  highlight?h('path',{d:poly(graph,highlight),className:'movement-trail'}):null,
  ...(highlight?highlight.slice(1,-1).map((id,i)=>{const pt=coords(graph,id);return h('g',{className:'target-waypoint',key:`waypoint-${i}`},h('circle',{cx:pt.x,cy:pt.y,r:9.5,fill:'#644124',stroke:'#ffe1a0',strokeWidth:1.5}),h('text',{x:pt.x,y:pt.y+3.4,textAnchor:'middle',fontWeight:900,fontSize:10,fill:'#fff2c7'},i+1));}):[]),
  ...(moving?[h('path',{d:poly(graph,moving.meta.path.slice(0,moving.step+1)),className:'movement-trail',key:'animTrail'})]:[]),
  ...tokenViews,
  movingToken,
  moving?(()=>{const node=moving.meta.path[Math.min(moving.step,moving.meta.path.length-1)];const pt=coords(graph,node);return h('circle',{key:'moving-impact',className:'step-impact',cx:pt.x,cy:pt.y,r:22,fill:'none',stroke:'#ffe1a0',strokeWidth:4});})():null,
  burst?(()=>{const pos=coords(graph,burst.node);return h('g',{className:'arrival-burst',key:'burst'},
   h('circle',{cx:pos.x,cy:pos.y,r:24,fill:'none',stroke:burst.capture?'#da6256':'#ffcf7e',strokeWidth:6}),
   h('circle',{cx:pos.x,cy:pos.y,r:37,fill:'none',stroke:burst.capture?'#e55c55':'#ffe2aa',strokeWidth:2,strokeDasharray:'5 5'}),
   h('text',{x:pos.x,y:pos.y-30,textAnchor:'middle',fontSize:14,fontWeight:900,fill:burst.capture?'#c5524c':'#b16c3e',paintOrder:'stroke',stroke:'#fff6e0',strokeWidth:4},burst.capture?'잡았다!':burst.joined?'업기!':burst.node==='FIN'?'완주!':'착지')
  );})():null,
  target
 );
}
function ThrowMat({sticks,stage,result}: {sticks: LandingStick[],stage: GameUIState['stage'], result: string|null}){
 const rendered=sticks.map((st,i)=>{
  const fx=st.front;
  const marks=[-23,-7,9,25];
  // Outer: landing spot. Shadow stays on the mat; flight = launch-to-landing drift + spin, arc = height + bounce.
  const delay={'--delay':`${i*70}ms`};
  return h('g',{key:i,transform:`translate(${st.x} ${st.y})`,className:cx('yutstick',st.nak&&'is-nak')},
   h('g',{transform:`rotate(${st.angle})`},h('ellipse',{className:'stick-shadow',style:delay,cx:3,cy:14,rx:43,ry:9,fill:'#24130d',opacity:.36})),
   h('g',{className:'stick-flight',style:{...delay,'--fx':`${330-st.x}px`,'--fy':`${150-st.y}px`}},h('g',{className:'stick-arc',style:delay},h('g',{transform:`rotate(${st.angle})`},
    h('rect',{x:-44,y:-12,width:88,height:27,rx:10,fill:'#3e1b13',stroke:'#ffe5a2',strokeWidth:1.5}),
    h('path',{d:'M-41 -8L-37 -14H33L41 -8H-41Z',fill:'#f5c985',stroke:'#ffe5b3',strokeWidth:1}),
    h('rect',{x:-41,y:-10,width:82,height:23,rx:8,fill:fx?'url(#yutWoodFace)':'url(#yutWoodBack)',stroke:'#fce2a5',strokeWidth:1.2}),
    h('path',{d:'M-36 -5Q-9 -7 37 -4M-36 5Q0 3 34 6M-20 -9Q-24 2 -18 12M13 -9Q17 -1 13 12',stroke:'#7a3b20',opacity:.22,strokeWidth:1.3,fill:'none'}),
    fx?h('g',{stroke:'#502b21',strokeWidth:2.7,strokeLinecap:'round'},...marks.slice(0,3).map(z=>h('path',{key:z,d:`M${z-4} -5l8 10 M${z+4} -5l-8 10`}))):
      h('path',{d:'M-24 0H23',stroke:'#8b532e',strokeWidth:2.7,strokeLinecap:'round'}),
    h('path',{d:'M-31 -7L23 -7',fill:'none',stroke:'#fff8d7',strokeWidth:1.3,opacity:.56}),
    i===0?h('circle',{cx:33,cy:0,r:3.6,fill:'#b64b39',stroke:'#f8e2a8',strokeWidth:1}):null,
    st.nak?h('circle',{className:'nak-warning-ring',cx:0,cy:0,r:39,stroke:'#ff7c63',strokeWidth:3,strokeDasharray:'4 5',fill:'none'}):null
   )))
  );
 });
 return h('div',{className:cx('throw-sandbox','cinematic-throw',stage==='throwing'&&'is-throwing',result==='낙'&&'is-invalid')},
   h('div',{className:'throw-etched-cloud throw-etched-cloud-left','aria-hidden':true},'☁'),
   h('div',{className:'throw-etched-cloud throw-etched-cloud-right','aria-hidden':true},'☁'),
   h('div',{className:cx('throw-ripple',stage==='throwing'&&'playing')}),
   h('div',{className:cx('sparkles',stage==='throwing'&&'throwing')},...Array.from({length:20},(_,i)=>h('i',{className:'spark',key:i,style:{'--spark-x':`${10+(i*37)%81}%`,'--spark-y':`${12+(i*19)%67}%`,'--spark-delay':`${(i%9)*100}ms`}}))),
   h('svg',{className:cx('mat-svg','mat-sticks',stage==='throwing'&&'throwing'),viewBox:'0 0 690 160',preserveAspectRatio:'xMidYMid meet','aria-label':'멍석 위의 윷가락 네 개'},
      h('defs',null,
       h('radialGradient',{id:'matGlow',cx:'50%',cy:'55%',r:'60%'},h('stop',{offset:0,stopColor:'#a27649',stopOpacity:.55}),h('stop',{offset:.7,stopColor:'#5b3522',stopOpacity:.53}),h('stop',{offset:1,stopColor:'#211710',stopOpacity:.24})),
       h('linearGradient',{id:'yutWoodFace',x1:'0',x2:'0',y1:'0',y2:'1'},h('stop',{offset:0,stopColor:'#fff2bc'}),h('stop',{offset:.27,stopColor:'#eaba77'}),h('stop',{offset:.65,stopColor:'#bc7d44'}),h('stop',{offset:1,stopColor:'#8e512b'})),
       h('linearGradient',{id:'yutWoodBack',x1:'0',x2:'0',y1:'0',y2:'1'},h('stop',{offset:0,stopColor:'#ffe6ac'}),h('stop',{offset:.4,stopColor:'#eec48a'}),h('stop',{offset:1,stopColor:'#b67f4c'})),
       h('filter',{id:'yutGoldGlow',x:'-80%',y:'-80%',width:'260%',height:'260%'},h('feGaussianBlur',{stdDeviation:4}))
      ),
      h('ellipse',{cx:329,cy:85,rx:268,ry:60,fill:'#261510',opacity:.38}),
      h('rect',{x:65,y:7,width:520,height:136,rx:56,className:'throw-mat-boundary',fill:'url(#matGlow)',stroke:'#d2a86b',strokeWidth:3.3,strokeDasharray:'4 4'}),
      h('rect',{x:73,y:15,width:504,height:120,rx:50,fill:'none',stroke:'#ffe0aa',strokeWidth:1.1,opacity:.65}),
      h('ellipse',{cx:325,cy:75,rx:194,ry:54,fill:'none',stroke:'#f6cb79',strokeWidth:1.3,strokeDasharray:'4 11',opacity:.58}),
      h('ellipse',{cx:325,cy:75,rx:164,ry:44,fill:'none',stroke:'#f5c66b',strokeWidth:1.7,opacity:.48,className:'throw-energy-circle'}),
      h('ellipse',{cx:325,cy:76,rx:133,ry:39,fill:'none',stroke:'#ffe1a0',strokeWidth:1.3,strokeDasharray:'7 7',opacity:.43}),
      h('text',{x:108,y:78,className:'mat-label'},'DALBIT'),
      h('text',{x:546,y:78,textAnchor:'end',className:'mat-label'},'YUT'),
      h('g',{className:'sticks-shadow'},...rendered)
   ),
   h('div',{className:'throw-stage-caption','aria-hidden':true},h('span',null,'✦'),h('span',null,stage==='throwing'?'회전 · 낙하 · 착지 중…':result==='낙'?'낙 · 이번 던지기 무효':result?'윷 결과를 확인하고 내 말을 선택하세요':'한옥 마루의 금빛 멍석 · 윷 네 가락'),h('span',null,'✦')),
   result?h('div',{className:cx('result-orb','visible',result==='낙'&&'nak'),'aria-live':'polite'},
     h('span',{className:'result-small'},result==='낙'?'이번 던지기 무효':'윷 결과'),
     h('strong',null,result),
     h('span',{className:'result-small'},result==='낙'?'멍석 밖':'말을 이동하세요')
   ):null
 );
}
function initialSticks(): LandingStick[]{return [0,1,2,3].map((i)=>({id:i,x:226+i*73,y:78+(i%2)*10,angle:-20+i*19,front:i%2===0,nak:false,delay:0}));}

interface GameUIState {
 game: GameState;
 setup: GameConfig;
 selectedRoll: string|null;
 selectedPiece: string|null;
 selectedChoice: MoveChoice|null;
 settingsOpen: boolean;
 sound: boolean;
 stage: 'idle'|'throwing'|'settled';
 sticks: LandingStick[];
 result: string|null;
 moving: {meta: MoveMeta; resolution: GameState; step: number}|null;
 burst: {node: string; capture: boolean; joined: boolean}|null;
 toast: string|null;
}
class App extends React.Component {
  destroyed = false;
  aiTimer: ReturnType<typeof setTimeout>|null = null;
  toastTimer: ReturnType<typeof setTimeout>|null = null;
  audioCtx: AudioContext|null = null;
  timers: ReturnType<typeof setTimeout>[] = [];

componentDidMount(){this.checkAI();};
componentDidUpdate(){this.checkAI();};
componentWillUnmount(){this.destroyed=true;this.timers.forEach(clearTimeout);if(this.aiTimer!==null)clearTimeout(this.aiTimer);};
defer(fn: ()=>void,ms: number){const t=setTimeout(()=>{this.timers=this.timers.filter(x=>x!==t);if(!this.destroyed)fn();},ms);this.timers.push(t);return t;};
notify(text: string){this.setState({toast:text});if(this.toastTimer!==null)clearTimeout(this.toastTimer);this.toastTimer=this.defer(()=>this.setState({toast:null}),2400);};
playSound(kind: 'throw'|'nak'|'land'){
 if(!this.state.sound)return;
 try{const C=(window as any).AudioContext||(window as any).webkitAudioContext;if(!C)return;const ctx=this.audioCtx||(this.audioCtx=new C());const os=ctx.createOscillator(),gain=ctx.createGain();os.connect(gain);gain.connect(ctx.destination);const t=ctx.currentTime;os.type=kind==='nak'?'sawtooth':'sine';os.frequency.setValueAtTime(kind==='nak'?240:520,t);os.frequency.exponentialRampToValueAtTime(kind==='nak'?135:680,t+.18);gain.gain.setValueAtTime(.045,t);gain.gain.exponentialRampToValueAtTime(.001,t+.22);os.start(t);os.stop(t+.23);}catch(e){}
};
checkAI(){
 const s=this.state,g=s.game;
 if(!g||!g.players[g.current].ai||g.winner!==null||s.settingsOpen||s.moving||s.stage==='throwing'||this.aiTimer)return;
 if(g.phase!=='roll'&&g.phase!=='move')return;
 this.aiTimer=setTimeout(()=>{this.aiTimer=null;if(this.destroyed)return;const current=this.state.game;if(!current.players[current.current].ai||this.state.moving||this.state.stage==='throwing'||this.state.settingsOpen)return;
  if(current.phase==='roll')this.throwYut('random',true);else if(current.phase==='move'){
   const action=chooseAIAction(current);if(!action){this.setState({game:E.normalize(current)});return;}
   this.commitMove(action,true);
  }
 },g.phase==='roll'?850:620);
};
throwYut(mode: 'safe'|'nak'|'random',ai: boolean){
 const g=this.state.game;
 if(g.phase!=='roll'||this.state.stage==='throwing'||this.state.moving)return;
 if(!ai&&g.players[g.current].ai)return;
 const rolled=E.rollSticks(g.config.backdo),landing=E.generateLanding(mode);
 const sticks=landing.sticks.map((st,i)=>({...st,front:rolled.faces[i]}));
 this.setState({stage:'throwing',sticks,result:null,selectedPiece:null,selectedChoice:null});this.playSound('throw');
 this.defer(()=>this.playSound(landing.nak?'nak':'land'),830);
 this.defer(()=>{
  const nak=landing.nak,next=E.throwResult(this.state.game,rolled,nak);
  this.setState({game:next,stage:'settled',result:nak?'낙':E.NAMES[rolled.value],selectedRoll:null});
  if(nak)this.notify(next.phase==='move'?'낙! 이번 던지기는 무효입니다. 모아 둔 결과로 이동하세요.':'낙! 윷이 멍석 경계를 완전히 벗어나 차례가 넘어갑니다.');
 },1450);
};
startGame(opts?: Partial<GameConfig>){
 this.timers.forEach(clearTimeout);this.timers=[];if(this.aiTimer!==null)clearTimeout(this.aiTimer);this.aiTimer=null;
 const game=E.createGame(opts||this.state.setup);
 this.setState({game,setup:{...game.config},settingsOpen:false,selectedRoll:null,selectedPiece:null,selectedChoice:null,
  stage:'idle',result:null,moving:null,burst:null,toast:null,sticks:initialSticks()});
};
selectPiece(id: string){
 const g=this.state.game,roll=this.activeRoll();if(!roll||g.phase!=='move'||g.players[g.current].ai||this.state.moving)return;
 const opts=E.moveOptions(g,id,roll.id);if(!opts.length)return;
 if(this.state.selectedPiece===id){this.setState({selectedPiece:null,selectedChoice:null});return;}
 this.setState({selectedPiece:id,selectedChoice:M.suggestedOption(opts.map(o=>({value:o.choice,label:o.label})))});
};
activeRoll(): YutRoll|null{const g=this.state.game;return g.rolls.find(x=>x.id===this.state.selectedRoll)||g.rolls[0]||null;};
commitMove(option: MoveOption,ai: boolean){
 const g=this.state.game;if(g.phase!=='move'||this.state.moving||(!ai&&g.players[g.current].ai))return;
 const result=E.resolveMove(g,option);if(!result)return;
 const meta=result.meta;
 this.setState({moving:{meta,resolution:result.game,step:0},selectedPiece:null,selectedRoll:null,selectedChoice:null},()=>this.defer(()=>this.moveTick(),220));
};
moveTick(){
 const moving=this.state.moving;if(!moving)return;
 if(moving.step+1<moving.meta.path.length){this.setState({moving:{...moving,step:moving.step+1}},()=>this.defer(()=>this.moveTick(),235));return;}
 const note=moving.meta.captured?'말 잡기! 추가 던지기':moving.meta.joined?'말 업기 성공!':moving.meta.to==='FIN'?'완주했습니다!':'말 이동 완료';
 this.setState({game:moving.resolution,moving:null,stage:'idle',result:null,burst:{node:moving.meta.to,capture:!!moving.meta.captured,joined:!!moving.meta.joined}},()=>{
  this.defer(()=>this.setState({burst:null}),850);
  this.playSound(moving.meta.captured?'nak':'land');
  if(moving.meta.captured||moving.meta.joined||moving.meta.to==='FIN')this.notify(note);
 });
};
render(){
 const s=this.state,g=s.game,owner=E.currentPlayer(g),graph=M.makeGraph(g.config.board),human=!owner.ai;
 const roll=this.activeRoll(),opts=s.selectedPiece&&roll?E.moveOptions(g,s.selectedPiece,roll.id):[];
 const defaultChoice=M.suggestedOption(opts.map(o=>({value:o.choice,label:o.label})));
 const selectedOpt=opts.find(o=>o.choice===s.selectedChoice)||opts.find(o=>o.choice===defaultChoice);
 const groups=E.uniqueMovablePieces(g),allowed=roll?new Set(E.legalActions(g,roll.id).map(o=>o.pieceId)):new Set();
 const turnTitle=g.winner!==null?'게임 종료':s.moving?'말이 이동하고 있어요':g.phase==='roll'?(owner.ai?'AI가 윷을 던지는 중':'윷을 던져주세요'):(owner.ai?'AI가 말 선택 중':s.selectedPiece?'이동 경로를 선택하세요':'움직일 말을 선택하세요');
 const statusDesc=g.phase==='roll'?'멍석 안에 윷가락이 모두 떨어져야 유효해요.':g.phase==='move'?'결과 선택 → 말 선택 → 목적지 클릭':`승리: ${g.players[g.winner ?? 0]?.label||''}`;
 const players=g.players.map(p=>{
  const pcs=g.pieces.filter(x=>x.player===p.id),ready=pcs.filter(x=>x.node==='WAIT').length,done=pcs.filter(x=>x.node==='FIN').length;
  return h('div',{className:cx('player-card',p.id===g.current&&'active',`player-${p.id}`),key:p.id,style:{'--player-accent':p.color}},
    h('div',{className:'player-hanji-pattern','aria-hidden':true},'✿'),
    h('div',{className:'player-main'},
      h('div',{className:'avatar-coin'},h('div',{className:'avatar'},p.avatar)),
      h('div',{className:'player-identity'},
        h('div',{className:'player-name'},p.label),
        h('div',{className:'player-role'},p.ai?'인공지능 상대':p.id===0&&g.config.mode==='ai'?'내 플레이어':'참가자'),
        h('div',{className:'pawns'},...pcs.map((pc,i)=>h('span',{key:i,className:cx('pawn-mini',pc.node==='FIN'&&'done'),style:{'--piece':p.color},title:pc.node==='FIN'?'완주':pc.node==='WAIT'?'대기':'이동 중'}))),
        h('div',{className:'player-progress','aria-label':`${done}개 완주`},h('div',{className:'player-progress-fill',style:{width:`${done*25}%`}}))
      ),
      h('div',{className:'player-right'},
        p.id===g.current?h('span',{className:'on-turn'},'● 내 차례'):h('span',{className:'player-tag'},p.ai?'AI':'대기'),
        h('div',{className:'player-status'},done>0?`${done}/4 완주`:`대기 ${ready}개`)
      )
    )
  );
 });
 const readyPieces=g.pieces.filter(p=>p.player===g.current&&p.node==='WAIT');
 const rack=readyPieces.map((p,i)=>h('button',{key:p.id,className:cx('rack-piece',allowed.has(p.id)&&human&&'pickable',s.selectedPiece===p.id&&'selected'),disabled:!human||g.phase!=='move'||!allowed.has(p.id)||!!s.moving,onClick:()=>this.selectPiece(p.id),'aria-label':`대기 말 ${p.index+1} 선택`},h('span',{className:'rack-token',style:{'--piece':owner.color}},'♟'),h('small',null,`${p.index+1}번 말`)));
 const logViews=g.logs.slice(0,9).map(l=>h('div',{className:'log-line',key:l.id},h('div',{className:'log-icon'},l.player==null?'✦':g.players[l.player]?.avatar||'◈'),h('div',{className:'log-content'},h('b',null,l.player==null?'알림':g.players[l.player]?.label),h('span',null,l.text))));
 const rollViews=g.rolls.length?g.rolls.map(r=>h('button',{key:r.id,className:cx('roll-pill',roll&&roll.id===r.id&&'active'),disabled:!human||g.phase!=='move'||!!s.moving,onClick:()=>this.setState({selectedRoll:r.id,selectedPiece:null,selectedChoice:null})},E.NAMES[r.value],h('small',null,r.value===-1?'↶':`${r.value}칸`))):h('div',{className:'no-rolls'},g.phase==='roll'?'아직 던진 결과가 없어요.':'윷 던지기 버튼으로 시작하세요.');
 return h('div',{className:'app-shell'},
  h('div',{className:'lantern-decor lantern-decor-left','aria-hidden':true}),h('div',{className:'lantern-decor lantern-decor-right','aria-hidden':true}),
  h('div',{className:'ambient-leaves','aria-hidden':true},...Array.from({length:12},(_,i)=>h('i',{className:'ambient-leaf',key:i,style:{'--left':`${6+i*8}%`,'--delay':`${i*-1.6}s`,'--duration':`${14+i%5*2}s`}}))),
  h('div',{className:'app-wrap'},
  h('header',{className:'header'},
   h('div',{className:'brand'},h('div',{className:'brand-mark'},h('strong',null,'달빛 윷마당'),h('span',{className:'brand-seal'},'전통')),h('div',{className:'brand-sub'},'한옥 마루에서 즐기는 우리들의 한 판')),
   h('div',{className:'header-right'},h('span',{className:'head-chip'},`제 ${String(g.turn)} 턴`),
    h('button',{className:'header-btn icon-button','aria-label':s.sound?'소리 끄기':'소리 켜기',title:s.sound?'소리 끄기':'소리 켜기',onClick:()=>this.setState({sound:!s.sound})},s.sound?'♫':'♬'),
    h('button',{className:'header-btn icon-button','aria-label':'새 게임 설정',title:'새 게임 설정',onClick:()=>this.setState({settingsOpen:true})},'⚙'))
  ),
  h('main',{className:'layout'},
   h('aside',{className:'panel side player-panel'},
    h('div',{className:'side-section-title'},'지금은 누구 차례?',h('span',null,`${g.config.mode==='ai'?'AI 대전':'함께하기'} · ${g.players.length}인`)),
    h('div',{className:'turn-hero'},h('div',{className:'eyebrow'},'CURRENT TURN'),h('div',{className:'turn-name'},h('span',{className:'turn-dot',style:{background:owner.color}}),owner.label),h('div',{className:'turn-sub'},s.moving?'선택한 말이 윷판 위를 이동 중입니다.':owner.ai?'AI가 다음 행동을 결정하고 있습니다.':g.phase==='move'?'말을 직접 눌러 이동해보세요.':'아래 멍석에서 윷을 던져주세요.')),
    h('div',{className:'side-section-title'},'참가자',h('span',null,'각 4개의 말')),
    h('div',{className:'players-list'},...players),
    h('div',{className:'subpanel'},h('div',{className:'rack-title'},h('b',null,'출발 대기 말'),h('span',null,`${readyPieces.length}개`)),h('div',{className:'rack'},rack.length?rack:h('div',{style:{gridColumn:'1/-1',fontSize:11,color:'#c4d1d9'}},'출발 대기 중인 말이 없습니다.'))),
    h('div',{className:'subpanel tips-block'},h('div',{className:'side-section-title'},'이동하는 방법'),
      ...[['1','윷을 던져 결과를 얻습니다.'],['2','결과와 움직일 말을 직접 누릅니다.'],['3','경로를 고르고 빛나는 목적지를 누릅니다.']].map(([num,text])=>h('div',{key:num,className:'tiny-guide'},h('b',null,num),h('p',{className:'tips'},text))))
   ),
   h('section',{className:'panel board-panel'},
    h('div',{className:'board-top'},h('div',{className:'board-heading'},h('strong',null,`✿ ${g.config.board==='A'?'팔각 순환형':'이중 링형'}`),h('small',null,g.config.board==='A'?'전통의 길에서 새로운 승부를':'안쪽 길로 빠르게 역전하기')),
     h('div',{className:'board-switch'},...(['A','B'] as const).map(key=>h('button',{key,className:cx('board-choice',g.config.board===key&&'active'),onClick:()=>{if(g.config.board!==key)this.startGame({...g.config,board:key});}},key==='A'?'팔각형':'이중 링')))),
    h('div',{className:'board-shadow'},h('div',{className:'board-cloth'},h('div',{className:'frame-charm frame-charm-left','aria-hidden':true},'❖'),h('div',{className:'frame-charm frame-charm-right','aria-hidden':true},'❖'),h(Board,{game:g,chosenRoll:roll,chosenPiece:g.pieces.find(p=>p.id===s.selectedPiece),chosenChoice:selectedOpt?.choice,onPiece:id=>this.selectPiece(id),onTarget:opt=>this.commitMove(opt,false),moving:s.moving,burst:s.burst}))),
    h('div',{className:'board-cap'},h('span',null,'✦ 갈림길에 정확히 정차하면 지름길'),h('span',null,'말 선택 → 황금색 목적지 클릭')),
    h('div',{className:'map-sep'}),
    h('div',{className:'throw-top'},h('div',null,h('div',{className:'throw-title'},'✦ 달빛 멍석 · 윷 던지기'),h('div',{className:'throw-desc'},'네 가락이 멍석 경계 안에 걸쳐야 유효 · 완전히 밖이면 낙')),h('div',{style:{fontSize:11,color:'#eac78f',fontWeight:850}},g.phase==='move'?'말 이동 중':`${g.players[g.current].label} 차례`)),
    h(ThrowMat,{sticks:s.sticks,stage:s.stage,result:s.result}),
    h('div',{className:'throw-actions'},
     h('button',{className:'primary-action throw-main-button',disabled:!human||g.phase!=='roll'||s.stage==='throwing'||!!s.moving,onClick:()=>this.throwYut('random',false)},h('span',{className:'throw-icon'},'♢'),s.stage==='throwing'?'윷가락이 날아갑니다…':g.phase==='move'?'말을 이동해 주세요':g.lastRoll&&(g.lastRoll.value===4||g.lastRoll.value===5)?'보너스 윷 던지기':'윷 던지기',h('span',{className:'button-ornament'},'❖')),
     h('button',{className:'sub-action',disabled:!human||g.phase!=='roll'||s.stage==='throwing'||!!s.moving,onClick:()=>this.throwYut('nak',false)},'낙 시연'))
   ),
   h('aside',{className:'panel right-panel'},
    h('div',{className:'action-section'},h('div',{className:'phase-badge'},g.phase==='move'?'✦ 직접 말 이동':g.phase==='won'?'♛ 승리':'✦ 윷 던지기'),
     h('h2',{className:'step-title'},turnTitle),h('p',{className:'step-desc'},statusDesc),
     h('div',{className:'move-steps'},...['윷 결과','말 선택','도착점'].map((name,i)=>h('div',{className:cx('move-step',((i===0&&g.phase==='roll')||(i===1&&g.phase==='move'&&!s.selectedPiece)||(i===2&&!!s.selectedPiece))&&'is-current',i===0&&g.phase==='move'&&'is-done'),key:i},h('small',null,`0${i+1}`),h('b',null,name)))),
     h('div',{className:'results-caption'},h('span',null,'사용할 윷 결과'),h('span',null,`${g.rolls.length}개 남음`)),
     h('div',{className:'results'},...Array.isArray(rollViews)?rollViews:[rollViews]),
     s.selectedPiece&&selectedOpt?h('div',{className:'manual-block is-ready'},h('div',{className:'manual-title'},'✦ 이동 경로를 선택하세요'),
       h('div',{className:'route-buttons'},...opts.map(o=>h('button',{className:cx('route-btn',selectedOpt.choice===o.choice&&'active'),key:o.choice,onClick:()=>this.setState({selectedChoice:o.choice})},o.label))),
       h('p',{className:'target-help'},'윷판에서 금빛으로 빛나는 도착점을 누르거나 아래 버튼으로 이동하세요.'),
       h('button',{className:'primary-action',style:{width:'100%',minHeight:44,fontSize:13,marginTop:11},disabled:!!s.moving,onClick:()=>this.commitMove(selectedOpt,false)},`✦ ${E.NAMES[roll?.value ?? 0]||''} · 선택한 말 이동 확정`)):
       h('div',{className:'manual-block'},h('div',{className:'manual-title'},'✦ 조작 안내'),h('p',{className:'target-help'},g.phase==='move'?'윷 결과 선택 → 윷판의 내 말이나 왼쪽 대기 말을 클릭하세요.':g.phase==='roll'?'윷을 던져 도·개·걸·윷·모·빽도 결과를 확인하세요.':'말 4개를 모두 완주시켜 승리하세요.')),
    ),
    h('div',{className:'log-section'},h('div',{className:'side-section-title'},'게임 기록',h('span',null,'LIVE')),h('div',{className:'log-list'},...logViews)),
   )
  ),
  h('div',{className:'footer-copy'},'DALBIT YUT · 한옥의 노을과 함께하는 윷놀이 · 1인 AI / 2~4인 로컬 대전'),
  s.toast?h('div',{className:'toast',role:'status'},s.toast):null,
  s.settingsOpen?h('div',{className:'modal-backdrop',role:'presentation',onMouseDown:(ev)=>{if(ev.target===ev.currentTarget)this.setState({settingsOpen:false});}},
   h('div',{className:'modal',role:'dialog','aria-modal':true,'aria-label':'게임 설정'},h('div',{style:{color:'#e5c17d',fontSize:12,fontWeight:900}},'새로운 한 판'),h('h2',null,'달빛 아래 윷놀이'),h('p',null,'모드와 참가 인원을 선택하세요. 1인 모드는 나머지 참가자가 AI입니다.'),
    h('label',{className:'form-label'},'게임 모드'),h('div',{className:'setting-options'},...[['ai','1인 · AI 대전'],['local','2~4인 · 함께하기']].map(([value,text])=>h('button',{key:value,className:cx('setting-btn',s.setup.mode===value&&'active'),onClick:()=>this.setState({setup:{...s.setup,mode:value}})},text))),
    h('label',{className:'form-label'},'총 참가 인원'),h('div',{className:'setting-options',style:{gridTemplateColumns:'repeat(3,1fr)'}},...[2,3,4].map(n=>h('button',{key:n,className:cx('setting-btn',s.setup.count===n&&'active'),onClick:()=>this.setState({setup:{...s.setup,count:n}})},`${n}명`))),
    h('label',{className:'form-label'},'윷놀이판'),h('div',{className:'setting-options'},...[['A','팔각 순환형'],['B','이중 링형']].map(([value,text])=>h('button',{key:value,className:cx('setting-btn',s.setup.board===value&&'active'),onClick:()=>this.setState({setup:{...s.setup,board:value}})},text))),
    h('p',{className:'modal-note'},'규칙: 갈림길 정차 시 지름길, 빽도는 지나온 경로로 후진, 낙은 그 던지기만 무효. 직접 말 선택과 목적지 확정이 기본입니다.'),
    h('button',{className:'primary-action',onClick:()=>this.startGame(s.setup)},'이 설정으로 게임 시작')
   )):null,
  g.winner!==null?h('div',{className:'modal-backdrop'},h('div',{className:'modal victory'},h('div',{style:{color:'#f2d098',fontSize:12,textAlign:'center'}},'승부 결정'),h('div',{className:'prize'},'🏆'),h('h2',{style:{textAlign:'center'}},`${g.players[g.winner].label} 승리!`),h('p',{style:{textAlign:'center'}},'네 개의 말을 모두 완주했습니다.'),h('button',{className:'primary-action',onClick:()=>this.startGame(g.config)},'다시 한 판'))):null
 ));
};

state: GameUIState={game:E.createGame({mode:'ai',count:2,board:'A'}),setup:{mode:'ai',count:2,board:'A',backdo:true},selectedRoll:null,selectedPiece:null,selectedChoice:null,settingsOpen:false,sound:true,stage:'idle',sticks:initialSticks(),result:null,moving:null,burst:null,toast:null};

}
const mount=document.getElementById('root');
if(!mount) throw new Error('Game root element was not found');
// The TSX entry is compiled by Vite for production and by tsc for offline QA.
// Expose the mounted component for visual regression and movement QA.
(window as any).__DALBIT_INSTANCE__=ReactDOM.render(h(App),mount);
(window as any).__DALBIT_APP__={version:'3.0.0-ts',engine:E,maps:M};
