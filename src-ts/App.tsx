import * as E from './gameEngine.js';
import * as M from './mapEngine.js';
import {chooseAIAction, chooseAIItem} from './aiEngine.js';
import type { GameState, GameConfig, MoveOption, MoveMeta, LandingStick, YutRoll, GamePiece, PlayerItem } from './gameEngine.js';
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
 if(id==='FIN')return g.type==='G'?g.xy.C:{x:432,y:406};
 return g.xy[id]||g.xy.O0;
}
function poly(g: M.BoardGraph,nodes: string[]): string{return nodes.map((id,i)=>{const p=coords(g,id);return `${i===0?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`}).join(' ');}
function ptsD(pts: ([number,number]|M.Point)[]): string{return pts.map((p,i)=>{const x=Array.isArray(p)?p[0]:p.x,y=Array.isArray(p)?p[1]:p.y;return `${i===0?'M':'L'}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(' ');}
function wallGroup(d: string,key: string){
 return h('g',{key,fill:'none',strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},
  h('path',{d,stroke:'#7e7262',strokeWidth:13,opacity:.42}),
  h('path',{d,stroke:'#cbbd9f',strokeWidth:9,strokeDasharray:'11 3',opacity:.75}),
  h('path',{d,stroke:'#8f826d',strokeWidth:9,strokeDasharray:'1 13',strokeDashoffset:-6,opacity:.55})
 );
}
function gateArch(pt: M.Point,horizontal: boolean,key: string){
 const [dx,dy]=horizontal?[16,0]:[0,16];
 const pillar=(px: number,py: number,k: string)=>h('g',{key:k},h('rect',{x:px-5,y:py-5,width:10,height:10,rx:1.5,fill:'#8a7a63',stroke:'#4d3f2f',strokeWidth:.8}),h('path',{d:`M${px-6.5} ${py-4}h13`,stroke:'#3f4a46',strokeWidth:3,strokeLinecap:'round'}));
 return h('g',{key,'aria-hidden':true},
  h('rect',{x:pt.x-(horizontal?13:8),y:pt.y-(horizontal?8:13),width:horizontal?26:16,height:horizontal?16:26,fill:'#f2e3c3'}),
  pillar(pt.x-dx,pt.y-dy,'a'),pillar(pt.x+dx,pt.y+dy,'b')
 );
}
function PieceShape(props: any){
 const {x,y,color,number,shielded,selected,available,animated,onClick}=props;
 return h('g',{className:cx('piece-handle',selected&&'selected',available&&'available',animated&&'animated',shielded&&'shielded'),transform:`translate(${x} ${y})`,onClick,role:onClick?'button':undefined,tabIndex:onClick?0:undefined,'aria-label':onClick?'말 선택':undefined,onKeyDown:onClick?(ev)=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();onClick();}}:undefined},
   h('ellipse',{className:'piece-floor-shadow',cx:0,cy:16,rx:17,ry:6,fill:'#2d1a10',opacity:'.34'}),
   shielded?h('circle',{className:'piece-shield-ring',cx:0,cy:0,r:26,fill:'none',stroke:'#7ee8fa',strokeWidth:2.6,strokeDasharray:'5 3'}):null,
   h('circle',{className:'piece-halo',cx:0,cy:0,r:23,fill:'none',stroke:selected?'#ffe4a1':available?'#f8cb69':'#604129',strokeWidth:selected?4:available?3:1.5,strokeDasharray:selected?'7 4':undefined}),
   h('rect',{x:-13,y:-1,width:26,height:17,rx:8,fill:'#43281c',stroke:'#2b180e',strokeWidth:1.2}),
   h('rect',{x:-12,y:-4,width:24,height:17,rx:8,fill:color,stroke:'#fff4dd',strokeWidth:1.2}),
   h('ellipse',{cx:0,cy:7,rx:13,ry:7.5,fill:color,stroke:'#4b2b20',strokeWidth:1.3}),
   h('ellipse',{cx:0,cy:-8,rx:11,ry:10,fill:color,stroke:'#fff0d1',strokeWidth:2}),
   h('ellipse',{cx:0,cy:-8,rx:10,ry:9,fill:'url(#tokenEnamel)',pointerEvents:'none'}),
   h('ellipse',{cx:-3.3,cy:-10,rx:4.8,ry:3,fill:'#fff9df',opacity:'.65'}),
   h('circle',{cx:0,cy:-8,r:2.5,fill:'#fff1cf',opacity:'.6'}),
   number>1?h('g',null,h('circle',{cx:15,cy:-14,r:10.5,fill:'#33251d',stroke:'#ffdd94',strokeWidth:1.8}),h('text',{x:15,y:-10,textAnchor:'middle',fontSize:11,fontWeight:900,fill:'#ffe7b9'},number)):null,
   shielded?h('g',{pointerEvents:'none'},h('circle',{cx:-15,cy:-14,r:9.5,fill:'#1c3b47',stroke:'#9bf6ff',strokeWidth:1.5}),h('text',{x:-15,y:-10.5,textAnchor:'middle',fontSize:10},'🛡️')):null,
   selected?h('g',{className:'selected-piece-label'},h('rect',{x:-27,y:-40,width:54,height:19,rx:8,fill:'#55301c',stroke:'#ffdc8f',strokeWidth:1.4}),h('text',{x:0,y:-27,textAnchor:'middle',fontSize:11},'선택한 말')):null,
   onClick?h('circle',{className:'piece-hit-area',cx:0,cy:0,r:35,fill:'transparent',stroke:'none'}):null
 );
}
function Board({game,chosenRoll,chosenPiece,chosenChoice,onPiece,onTarget,moving,burst}: any){
 const graph=M.makeGraph(game.config.board),xy=graph.xy,isSpiral=game.config.board==='G';
 const [home,ne,nw,sw]=graph.cornerIds;
 const outer=isSpiral?[...graph.outerIds,'C']:[...graph.outerIds,'O0'];
 const spiralTrackD=isSpiral?ptsD(M.roundedPolyline(M.SPIRAL_LAP,24)):poly(graph,outer);
 const routes=isSpiral?M.SPIRAL_GATES.map(g=>[g.from,g.id,g.to]):game.config.board!=='B' ?
  [[ne,'NE1','NE2','C','SW1','SW2',sw],[nw,'NW1','NW2','C','SE1','SE2',home]]:
  [[ne,...Array.from({length:9},(_,i)=>`I${i}`),'R1',home],[nw,'W0','I4']];
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
 const spiralForkSet=new Set<string>(M.SPIRAL_GATES.map(g=>g.from));
 const nodes=Object.entries(xy).map(([id,pos])=>{
  if(isSpiral&&id==='C'){
   return h('g',{key:id,className:'board-landmark'},
    h('circle',{cx:pos.x,cy:pos.y,r:31,fill:'none',stroke:'#b38a51',strokeWidth:1,strokeDasharray:'3 4'}),
    h('circle',{cx:pos.x,cy:pos.y,r:26,fill:'url(#boardBrass)',stroke:'#73502e'}),
    h('circle',{cx:pos.x,cy:pos.y,r:23,fill:'url(#nodeObsidian)',stroke:'#deb66f',strokeWidth:1.6}),
    h('g',{transform:`translate(${pos.x} ${pos.y-4}) scale(.62)`,fill:'none',strokeLinecap:'round',strokeLinejoin:'round'},
     h('path',{d:'M-26 21h52',stroke:'#e8c98a',strokeWidth:3}),
     h('path',{d:'M-17 18v-22M17 18v-22',stroke:'#e8c98a',strokeWidth:3.4}),
     h('path',{d:'M-31 -6Q-15 -12 0 -24q15 12 31 18L22 -2H-22Z',fill:'#f2d79a',stroke:'#fff3cc',strokeWidth:1.4})
    )
   );
  }
  const kind=isSpiral?(id==='O0'?'goal':spiralForkSet.has(id)?'fork':id.startsWith('G')?'inner':'normal'):(id===home?'goal':id===ne||id===nw?'fork':id==='C'?'center':id.startsWith('I')?'inner':'normal');
  const big=kind==='goal'?14:kind==='fork'||kind==='center'?13:isSpiral?(id.startsWith('G')?7.5:9):game.config.board==='S'?9:8;
  const pouchType=game.config.itemMode&&game.itemsUnlocked?game.itemNodes?.[id]:undefined;
  return h('g',{key:id},
    kind==='goal'||kind==='center'?h('circle',{cx:pos.x,cy:pos.y,r:big+6,fill:'none',stroke:kind==='goal'?'#7fb9a1':'#b38a51',strokeWidth:1,strokeDasharray:'3 4'}):null,
    h('ellipse',{cx:pos.x,cy:pos.y+2,rx:big+1.8,ry:big+1,fill:'#593c21',opacity:.2,pointerEvents:'none'}),
    h('circle',{cx:pos.x,cy:pos.y,r:big+1.5,fill:'url(#boardBrass)',stroke:'#9d7845',strokeWidth:.6,pointerEvents:'none'}),
    h('circle',{className:cx('node-circle',kind),cx:pos.x,cy:pos.y,r:big}),
    h('circle',{className:'node-engraving',cx:pos.x,cy:pos.y,r:big-2}),
    kind==='fork'?h('circle',{cx:pos.x,cy:pos.y,r:3.5,fill:'#ba7142'}):null,
    kind==='center'?h('text',{x:pos.x,y:pos.y+3.5,textAnchor:'middle',fontSize:10,fontWeight:900,fill:'#f5d99d'},'✦'):null,
    kind==='goal'?h('text',{x:pos.x,y:pos.y+4,textAnchor:'middle',fontSize:10,fontWeight:900,fill:'#f4f3cf'},isSpiral?'출':'집'):null,
    pouchType?h('g',{className:'item-pouch-marker',transform:`translate(${pos.x} ${pos.y-13})`,pointerEvents:'none'},
     h('circle',{cx:0,cy:0,r:8.5,fill:'#5a231b',stroke:'#ffdc8e',strokeWidth:1.3}),
     h('text',{x:0,y:3.5,textAnchor:'middle',fontSize:9.5},E.ITEMS[pouchType].icon)
    ):null
  );
 });
 const tokenViews=groups.map((gr,i)=>{
  if(gr.items.some(p=>movedGroups.has(p.id)))return null;
  const p=game.players[gr.player],c=coords(graph,gr.node),head=gr.items[0];
  const canPick=isHuman&&gr.player===game.current&&gr.items.some(v=>availableIds.has(v.id));
  return h(PieceShape,{key:'piece-'+i,x:c.x,y:c.y,color:p.color,number:gr.items.length,shielded:gr.items.some(v=>v.shielded),
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
 const decor=isSpiral?h('g',{className:'board-ink-scenes','aria-hidden':true},
   h('ellipse',{cx:250,cy:236,rx:78,ry:62,fill:'url(#mossCourt)'}),
   h('g',{fill:'none',stroke:'#7d6955',strokeWidth:1.2,opacity:.3},
    h('path',{d:'M196 386q14-10 28 0 12-8 24 0M300 388q12-9 24 0 10-7 20 0'}),
    h('path',{d:'M118 108q10-14 24-4 9-12 23-2M322 106q12-12 25-2 11-10 22 0'})
   ),
   wallGroup(ptsD(M.SPIRAL_OUTER_WALL),'outer-wall'),
   wallGroup(ptsD(M.SPIRAL_WALL),'inner-wall'),
   ...M.SPIRAL_GATES.map(g=>gateArch(g.via,g.horizontal,`arch-${g.id}`))
 ):h('g',{className:'board-ink-scenes','aria-hidden':true},
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
 const landmarkDefs=isSpiral?[{id:'O0',color:'#3f7053',r:23},...M.SPIRAL_GATES.map(g=>({id:g.from,color:g.color,r:24}))]:[{id:home,color:'#3f7053',r:24},{id:ne,color:'#395987',r:24},{id:nw,color:'#b7833c',r:24},{id:sw,color:'#a33c3d',r:24}];
 const landmarks=landmarkDefs.map(land=>{
   const pt=xy[land.id],r=land.r;return h('g',{key:'landmark'+land.id,className:'board-landmark'},
    h('ellipse',{cx:pt.x,cy:pt.y+3,rx:r+1,ry:r,fill:'#593c21',opacity:.22}),
    h('circle',{cx:pt.x,cy:pt.y,r,fill:'url(#boardBrass)',stroke:'#73502e',strokeWidth:1}),
    h('circle',{cx:pt.x,cy:pt.y,r:r-2.5,fill:'#3a2c23',stroke:'#fff0bc',strokeWidth:.8}),
    h('circle',{cx:pt.x,cy:pt.y,r:r-5.5,fill:land.color,stroke:'#e1bd7a',strokeWidth:1}),
    h('circle',{cx:pt.x,cy:pt.y,r:r-6,fill:'url(#tokenEnamel)'}),
    ...Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return h('circle',{key:i,cx:pt.x+(r-4)*Math.cos(a),cy:pt.y+(r-4)*Math.sin(a),r:.55,fill:'#efd599'});})
   );
 });
 const spiralArrows=isSpiral?[2,7,12,19,22].map(i=>{const a=xy[`O${i}`],b=xy[`O${i+1}`],ang=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;return h('path',{key:`arr-${i}`,d:'M-4-4L1 0-4 4',fill:'none',stroke:'#7a5c3c',strokeWidth:2,opacity:.6,transform:`translate(${(a.x+b.x)/2} ${(a.y+b.y)/2}) rotate(${ang})`});}):[];
 return h('svg',{className:'board-svg',viewBox:'0 0 500 470',shapeRendering:'geometricPrecision',role:'img','aria-label':game.config.board==='S'?'기본 사각형 윷판':`${graph.title} 윷판`},
  h('defs',null,
   h('radialGradient',{id:'paperFill',cx:'.36',cy:'.26',r:'.85'},h('stop',{offset:0,stopColor:'#fff9e9'}),h('stop',{offset:.6,stopColor:'#f1e2c2'}),h('stop',{offset:1,stopColor:'#d6bd92'})),
   h('linearGradient',{id:'boardWood',x1:0,y1:0,x2:1,y2:1},h('stop',{offset:0,stopColor:'#6c4930'}),h('stop',{offset:.35,stopColor:'#38251a'}),h('stop',{offset:.7,stopColor:'#583b27'}),h('stop',{offset:1,stopColor:'#261c15'})),
   h('linearGradient',{id:'boardBrass',x1:0,y1:0,x2:.7,y2:1},h('stop',{offset:0,stopColor:'#fff0bd'}),h('stop',{offset:.25,stopColor:'#d1a35b'}),h('stop',{offset:.5,stopColor:'#9a7039'}),h('stop',{offset:.73,stopColor:'#e9cc8e'}),h('stop',{offset:1,stopColor:'#8a5d2e'})),
   h('radialGradient',{id:'nodeIvory',cx:'.32',cy:'.24',r:'.85'},h('stop',{offset:0,stopColor:'#fffcf0'}),h('stop',{offset:.65,stopColor:'#f4e5c5'}),h('stop',{offset:1,stopColor:'#c6aa77'})),
   h('radialGradient',{id:'nodeAmber',cx:'.3',cy:'.22',r:'.9'},h('stop',{offset:0,stopColor:'#fff0b9'}),h('stop',{offset:.6,stopColor:'#e2b464'}),h('stop',{offset:1,stopColor:'#986630'})),
   h('radialGradient',{id:'nodeJade',cx:'.3',cy:'.2',r:'.9'},h('stop',{offset:0,stopColor:'#a4c6a2'}),h('stop',{offset:.55,stopColor:'#58816a'}),h('stop',{offset:1,stopColor:'#2d5042'})),
   h('radialGradient',{id:'nodeObsidian',cx:'.32',cy:'.22',r:'.85'},h('stop',{offset:0,stopColor:'#73543e'}),h('stop',{offset:.55,stopColor:'#443326'}),h('stop',{offset:1,stopColor:'#2b231e'})),
   h('radialGradient',{id:'tokenEnamel',cx:'.28',cy:'.18',r:'.9'},h('stop',{offset:0,stopColor:'#ffffff',stopOpacity:.55}),h('stop',{offset:.48,stopColor:'#ffffff',stopOpacity:0}),h('stop',{offset:1,stopColor:'#23170c',stopOpacity:.35})),
   h('radialGradient',{id:'mossCourt',cx:'.5',cy:'.5',r:'.5'},h('stop',{offset:0,stopColor:'#9fb58f',stopOpacity:.55}),h('stop',{offset:1,stopColor:'#9fb58f',stopOpacity:0})),
   h('pattern',{id:'grain',width:37,height:31,patternUnits:'userSpaceOnUse'},
    h('path',{d:'M2 7l5-1m11 17 7-2M29 5l3 1M8 28l4-1',stroke:'#94764b',strokeWidth:.4,opacity:.16}),
    h('path',{d:'M3 8l5-1m11 17 7-2M7 17l9-1',stroke:'#fffef0',strokeWidth:.65,opacity:.6}),
    h('circle',{cx:31,cy:18,r:.45,fill:'#856842',opacity:.16})),
   h('pattern',{id:'boardEdgeGrain',width:80,height:12,patternUnits:'userSpaceOnUse'},h('path',{d:'M0 3Q20 0 40 3T80 3M0 9Q20 6 40 9T80 9',fill:'none',stroke:'#d5aa6a',strokeWidth:.45,opacity:.17}))
  ),
  h('rect',{x:2,y:2,width:496,height:466,rx:7,fill:'url(#boardWood)'}),
  h('rect',{className:'board-edge-grain',x:2,y:2,width:496,height:466,rx:7,fill:'url(#boardEdgeGrain)'}),
  h('rect',{x:7,y:7,width:486,height:456,rx:5,fill:'none',stroke:'#edcd8c',strokeWidth:.65,opacity:.7}),
  h('rect',{x:16,y:16,width:468,height:438,rx:3,fill:'url(#boardBrass)',stroke:'#241c13',strokeWidth:1.2}),
  h('rect',{className:'board-paper',x:21,y:21,width:458,height:428,rx:2,fill:'url(#paperFill)',stroke:'#fff2ca',strokeWidth:1}),
  h('rect',{className:'board-paper-grain',x:21,y:21,width:458,height:428,rx:2,fill:'url(#grain)'}),
  !isSpiral?h('rect',{x:28,y:28,width:444,height:414,rx:1,fill:'none',stroke:'#aa8b5c',strokeWidth:.65,opacity:.65}):null,
  h('g',{className:'board-craft-detail','aria-hidden':true},
   ...[{x:16,y:16,r:0},{x:484,y:16,r:90},{x:484,y:454,r:180},{x:16,y:454,r:270}].map((c,i)=>h('g',{key:i,transform:`translate(${c.x} ${c.y}) rotate(${c.r})`},
    h('path',{d:'M0 29V0h29v5H5v24Z',fill:'url(#boardBrass)',stroke:'#624522',strokeWidth:.6}),
    h('path',{d:'M9 27V9h18M13 23V13h10',fill:'none',stroke:'#a17b43',strokeWidth:.7}),
    h('circle',{cx:2.5,cy:2.5,r:1,fill:'#fff3c6'}))),
   !isSpiral?h('text',{className:'board-signature',x:250,y:39},'月 · 光'):null,
   !isSpiral?h('text',{className:'board-signature',x:250,y:435},'DALBIT · YUT'):null
  ),
  decor,
  ...landmarks,
  h('path',{d:spiralTrackD,className:'route-inlay'}),
  ...routes.map((r,i)=>h('path',{d:poly(graph,r),key:'inlay'+i,className:'route-inlay'})),
  h('path',{d:spiralTrackD,className:'route-line'}),
  ...routes.map((r,i)=>h('path',{d:poly(graph,r),key:'route'+i,className:'route-inner',strokeDasharray:isSpiral?'5 4':undefined})),
  ...spiralArrows,
  ...nodes,
  isSpiral?h('g',{className:'board-label'},
   h('text',{x:xy.O0.x,y:xy.O0.y-34,textAnchor:'middle',className:'board-label'},'출발 어귀'),
   h('text',{x:xy.O5.x+30,y:xy.O5.y+4,textAnchor:'start',className:'board-label'},'첫모 ①'),
   h('text',{x:xy.O10.x+4,y:xy.O10.y+38,textAnchor:'start',className:'board-label'},'뒷모 ②'),
   h('text',{x:xy.O15.x+29,y:xy.O15.y+4,textAnchor:'start',className:'board-label'},'찌모 ③'),
   h('text',{x:xy.O20.x,y:xy.O20.y-30,textAnchor:'middle',className:'board-label'},'넷모 ④'),
   h('text',{x:250,y:281,textAnchor:'middle',className:'board-label'},'달빛정자 · 완주')
  ):h('g',{className:'board-label'},
   h('text',{x:xy[home].x,y:xy[home].y+35,textAnchor:'middle',className:'board-label'},'출발 · 완주'),
   h('text',{x:xy[ne].x,y:xy[ne].y-30,textAnchor:'middle',className:'board-label'},'갈림길 ①'),
   h('text',{x:xy[nw].x,y:xy[nw].y-30,textAnchor:'middle',className:'board-label'},'갈림길 ②'),
   game.config.board!=='B'?h('text',{x:264,y:221,className:'board-label'},'중앙'):h('text',{x:214,y:222,className:'board-label'},'내선')
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
function ThrowMat({sticks,stage,result,watching=false}: {sticks: LandingStick[],stage: GameUIState['stage'], result: string|null,watching?: boolean}){
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
   h('div',{className:'throw-stage-caption','aria-hidden':true},h('span',null,'✦'),h('span',null,stage==='throwing'?'회전 · 낙하 · 착지 중…':result==='낙'?'낙 · 이번 던지기 무효':result?watching?'AI가 다음 행동을 결정합니다':'윷 결과를 확인하고 내 말을 선택하세요':'한옥 마루의 금빛 멍석 · 윷 네 가락'),h('span',null,'✦')),
   result?h('div',{className:cx('result-orb','visible',result==='낙'&&'nak'),'aria-live':'polite'},
     h('span',{className:'result-small'},result==='낙'?'이번 던지기 무효':'윷 결과'),
     h('strong',null,result),
     h('span',{className:'result-small'},result==='낙'?'멍석 밖':watching?'AI 자동 진행':'말을 이동하세요')
   ):null
 );
}
function initialSticks(): LandingStick[]{return [0,1,2,3].map((i)=>({id:i,x:226+i*73,y:78+(i%2)*10,angle:-20+i*19,front:i%2===0,nak:false,delay:0}));}
function initialConfig(): GameConfig{
 const query=new URLSearchParams(window.location.search);
 const boardParam=query.get('board');
 const board: M.BoardType=boardParam==='A'||boardParam==='B'||boardParam==='G'?boardParam:'S';
 const itemMode=query.get('items')==='1';
 return query.get('watch')==='1'
  ?{mode:'spectate',count:[2,3,4].includes(Number(query.get('players')))?Number(query.get('players')):4,board,backdo:true,itemMode}
  :{mode:'ai',count:2,board,backdo:true,itemMode};
}
const INITIAL_CONFIG=initialConfig();

interface GameUIState {
 layaConnected?: boolean;
 layaModelName?: string;
 game: GameState;
 setup: GameConfig;
 selectedRoll: string|null;
 selectedPiece: string|null;
 selectedChoice: MoveChoice|null;
 settingsOpen: boolean;
 sound: boolean;
 musicVolume: number;
 aiPaused: boolean;
 stage: 'idle'|'throwing'|'settled';
 sticks: LandingStick[];
 result: string|null;
 moving: {meta: MoveMeta; resolution: GameState; step: number}|null;
 burst: {node: string; capture: boolean; joined: boolean}|null;
 toast: string|null;
}
class App extends React.Component {
  destroyed = false;
  matchId = 'match_' + Date.now();
  matchStartedAt = new Date().toISOString();
  aiTimer: ReturnType<typeof setTimeout>|null = null;
  toastTimer: ReturnType<typeof setTimeout>|null = null;
  audioCtx: AudioContext|null = null;
  music: HTMLAudioElement|null = null;
  audioUnlocked = false;
  timers: ReturnType<typeof setTimeout>[] = [];

componentDidMount(){
 fetch('/api/laya/status')
  .then(r=>r.ok?r.json():null)
  .then(d=>{
   if(d&&d.ready){
    this.setState({layaConnected:true,layaModelName:d.model||'1500'});
    this.notify(`🤖 달빛 Laya AI (${d.model||'1500'}) 연결됨`);
   }
  })
  .catch(()=>{});
 this.music=document.getElementById('dalbit-bgm') as HTMLAudioElement|null;
 document.addEventListener('pointerdown',this.unlockAudio,true);
 document.addEventListener('keydown',this.unlockAudio,true);
 document.addEventListener('visibilitychange',this.syncMusic);
 this.checkAI();
};
componentDidUpdate(){this.syncMusic();this.checkAI();};
componentWillUnmount(){
 this.destroyed=true;this.timers.forEach(clearTimeout);if(this.aiTimer!==null)clearTimeout(this.aiTimer);
 document.removeEventListener('pointerdown',this.unlockAudio,true);
 document.removeEventListener('keydown',this.unlockAudio,true);
 document.removeEventListener('visibilitychange',this.syncMusic);
 this.music?.pause();
 if(this.audioCtx)void this.audioCtx.close().catch(()=>{});
};
unlockAudio=()=>{
 this.audioUnlocked=true;this.syncMusic();
 if(this.state.sound&&this.audioCtx?.state==='suspended')void this.audioCtx.resume().catch(()=>{});
};
syncMusic=()=>{
 const music=this.music;if(!music)return;
 music.volume=this.state.musicVolume;
 if(!this.state.sound||!this.audioUnlocked||document.hidden||this.state.musicVolume===0){music.pause();return;}
 if(music.paused)void music.play().catch(()=>{});
};
defer(fn: ()=>void,ms: number){const t=setTimeout(()=>{this.timers=this.timers.filter(x=>x!==t);if(!this.destroyed)fn();},ms);this.timers.push(t);return t;};
notify(text: string){this.setState({toast:text});if(this.toastTimer!==null)clearTimeout(this.toastTimer);this.toastTimer=this.defer(()=>this.setState({toast:null}),2400);};
playSound(kind: 'throw'|'nak'|'land'){
 if(!this.state.sound)return;
 try{const C=(window as any).AudioContext||(window as any).webkitAudioContext;if(!C)return;const ctx=this.audioCtx||(this.audioCtx=new C());const os=ctx.createOscillator(),gain=ctx.createGain();os.connect(gain);gain.connect(ctx.destination);const t=ctx.currentTime;os.type=kind==='nak'?'sawtooth':'sine';os.frequency.setValueAtTime(kind==='nak'?240:520,t);os.frequency.exponentialRampToValueAtTime(kind==='nak'?135:680,t+.18);gain.gain.setValueAtTime(.045,t);gain.gain.exponentialRampToValueAtTime(.001,t+.22);os.start(t);os.stop(t+.23);}catch(e){}
};
checkAI(){
 const s=this.state,g=s.game;
 if(!g||!g.players[g.current].ai||g.winner!==null||s.aiPaused||s.settingsOpen||s.moving||s.stage==='throwing'||this.aiTimer)return;
 if(g.phase!=='roll'&&g.phase!=='move')return;
 this.aiTimer=setTimeout(()=>{this.aiTimer=null;if(this.destroyed)return;
  let current=this.state.game;
  if(!current.players[current.current].ai||this.state.aiPaused||this.state.moving||this.state.stage==='throwing'||this.state.settingsOpen)return;
  const withItem=chooseAIItem(current);
  if(withItem!==current){
   this.setState({game:withItem});
   return;
  }
  if(current.phase==='roll')this.throwYut('random',true);else if(current.phase==='move'){
   void (async()=>{
    let action: MoveOption|null=null;
    try{
     const ctrl=new AbortController();
     const timer=setTimeout(()=>ctrl.abort(),2000);
     const res=await fetch('/api/laya/action',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({game:current,matchId:this.matchId}),
      signal:ctrl.signal,
     });
     clearTimeout(timer);
     if(res.ok){
      const data=await res.json();
      if(data&&data.action)action=data.action;
     }
    }catch(e){}
    if(!action)action=chooseAIAction(current);
    if(this.destroyed||this.state.game!==current)return;
    if(!action){this.setState({game:E.normalize(current)});return;}
    this.commitMove(action,true);
   })();
  }
 },g.phase==='roll'?850:620);
};
recordMatchEnd(game: GameState){
 if(!this.state.layaConnected)return;
 fetch('/api/laya/match-end',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   matchId:this.matchId,
   board:game.config.board,
   mode:game.config.mode,
   winner:game.winner,
   totalTurns:game.turn,
   startedAt:this.matchStartedAt,
   logs:game.logs,
  }),
 }).catch(()=>{});
};
toggleSpectatorPause(){
 if(this.state.game.config.mode!=='spectate'||this.state.game.winner!==null)return;
 if(this.aiTimer!==null)clearTimeout(this.aiTimer);this.aiTimer=null;
 this.setState((state: GameUIState)=>({aiPaused:!state.aiPaused}));
};
throwYut(mode: 'safe'|'nak'|'random',ai: boolean){
 const g=this.state.game;
 if(g.phase!=='roll'||this.state.stage==='throwing'||this.state.moving||ai&&this.state.aiPaused)return;
 if(!ai&&g.players[g.current].ai)return;
 const rolled=E.rollSticks(g.config.backdo),landing=E.generateLanding(mode);
 const sticks=landing.sticks.map((st,i)=>({...st,front:rolled.faces[i]}));
 this.setState({stage:'throwing',sticks,result:null,selectedPiece:null,selectedChoice:null});this.playSound('throw');
 this.defer(()=>this.playSound(landing.nak?'nak':'land'),830);
 this.defer(()=>{
  const cur=this.state.game,geumjulSaved=landing.nak&&cur.players[cur.current]?.geumjulArmed;
  const nak=landing.nak&&!geumjulSaved,next=E.throwResult(cur,rolled,landing.nak);
  this.setState({game:next,stage:'settled',result:nak?'낙':E.NAMES[rolled.value],selectedRoll:null});
  if(geumjulSaved)this.notify(`🌾 금줄 부적이 발동해 낙을 막았습니다! (${E.NAMES[rolled.value]})`);
  else if(nak)this.notify(next.phase==='move'?'낙! 이번 던지기는 무효입니다. 모아 둔 결과로 이동하세요.':'낙! 윷이 멍석 경계를 완전히 벗어나 차례가 넘어갑니다.');
 },1450);
};
activateItem(item: PlayerItem,delta?: -1|1){
 const g=this.state.game,actor=g.players[g.current];
 if(!g.config.itemMode||!g.itemsUnlocked||!actor||actor.ai||this.state.moving||this.state.stage==='throwing')return;
 if(item.type==='geumjul'){
  if(actor.geumjulArmed){this.notify('이미 금줄 부적이 준비되어 있습니다.');return;}
  const next=E.useItem(g,item.id);
  this.setState({game:next});
  this.notify('🌾 금줄 부적 준비! 다음 낙을 1회 구제합니다.');
  return;
 }
 if(item.type==='key'){
  if(g.phase!=='move'){this.notify('돌담 열쇠는 윷을 던진 뒤 말 이동 단계에서 사용하세요.');return;}
  const next=E.useItem(g,item.id);
  this.setState({game:next,selectedChoice:null});
  this.notify('🔑 돌담 열쇠 활성화! 갈림길을 지나쳐도 지름길로 진입할 수 있습니다.');
  return;
 }
 if(item.type==='stone'){
  if(g.phase!=='move'){this.notify('이끼 디딤돌은 윷을 던진 뒤 말 이동 단계에서 사용하세요.');return;}
  const d: -1|1=delta||1;
  const next=E.useItem(g,item.id,{delta:d});
  this.setState({game:next,selectedChoice:null});
  this.notify(`🪨 이끼 디딤돌(${d>0?'+1칸':'-1칸'})이 적용되었습니다!`);
  return;
 }
 if(item.type==='shield'){
  const targetId=this.state.selectedPiece||g.pieces.find(p=>p.player===g.current&&p.node!=='WAIT'&&p.node!=='FIN'&&!p.shielded)?.id;
  if(!targetId){this.notify('호패 방패를 씌울 판 위의 내 말이 없습니다.');return;}
  const next=E.useItem(g,item.id,{pieceId:targetId});
  if(next===g){this.notify('판 위에 있는 내 말을 먼저 선택해 주세요.');return;}
  this.setState({game:next});
  this.notify('🛡️ 호패 방패 발동! 선택한 내 말이 상대 잡기를 1회 막아냅니다.');
 }
};
startGame(opts?: Partial<GameConfig>){
 this.matchId='match_'+Date.now();this.matchStartedAt=new Date().toISOString();
 this.timers.forEach(clearTimeout);this.timers=[];if(this.aiTimer!==null)clearTimeout(this.aiTimer);this.aiTimer=null;
 const game=E.createGame(opts||this.state.setup);
 this.setState({game,setup:{...game.config},settingsOpen:false,aiPaused:false,selectedRoll:null,selectedPiece:null,selectedChoice:null,
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
 const g=this.state.game;if(g.phase!=='move'||this.state.moving||ai&&this.state.aiPaused||(!ai&&g.players[g.current].ai))return;
 const result=E.resolveMove(g,option);if(!result)return;
 const meta=result.meta;
 this.setState({moving:{meta,resolution:result.game,step:0},selectedPiece:null,selectedRoll:null,selectedChoice:null},()=>this.defer(()=>this.moveTick(),220));
};
moveTick(){
 const moving=this.state.moving;if(!moving)return;
 if(moving.step+1<moving.meta.path.length){this.setState({moving:{...moving,step:moving.step+1}},()=>this.defer(()=>this.moveTick(),235));return;}
 const unlockedJustNow=!this.state.game.itemsUnlocked&&moving.resolution.itemsUnlocked;
 const note=unlockedJustNow?'🎁 중반전 돌입! 전술 패물과 복주머니가 등장했습니다!':moving.meta.shieldBlocked?'🛡️ 호패 방패가 상대 공격을 막아냈습니다!':moving.meta.pickedItem?`🎁 복주머니 획득: ${E.ITEMS[moving.meta.pickedItem].name}!`:moving.meta.captured?'말 잡기! 추가 던지기':moving.meta.joined?'말 업기 성공!':moving.meta.to==='FIN'?'완주했습니다!':'말 이동 완료';
 this.setState({game:moving.resolution,moving:null,stage:'idle',result:null,burst:{node:moving.meta.to,capture:!!moving.meta.captured,joined:!!moving.meta.joined}},()=>{
  this.defer(()=>this.setState({burst:null}),850);
  this.playSound(moving.meta.captured?'nak':'land');
  if(unlockedJustNow||moving.meta.shieldBlocked||moving.meta.pickedItem||moving.meta.captured||moving.meta.joined||moving.meta.to==='FIN')this.notify(note);
  if(moving.resolution.winner!==null)this.recordMatchEnd(moving.resolution);
 });
};
render(){
 const s=this.state,g=s.game,owner=E.currentPlayer(g),graph=M.makeGraph(g.config.board),human=!owner.ai;
 const watching=g.config.mode==='spectate',busy=s.stage==='throwing'||!!s.moving;
 const watchPaused=watching&&s.aiPaused;
 const roll=this.activeRoll(),opts=s.selectedPiece&&roll?E.moveOptions(g,s.selectedPiece,roll.id):[];
 const defaultChoice=M.suggestedOption(opts.map(o=>({value:o.choice,label:o.label})));
 const selectedOpt=opts.find(o=>o.choice===s.selectedChoice)||opts.find(o=>o.choice===defaultChoice);
 const groups=E.uniqueMovablePieces(g),allowed=roll?new Set(E.legalActions(g,roll.id).map(o=>o.pieceId)):new Set();
 const turnTitle=g.winner!==null?'게임 종료':watchPaused&&!busy?'관전 일시정지':s.moving?'말이 이동하고 있어요':g.phase==='roll'?(owner.ai?'AI가 윷을 던지는 중':'윷을 던져주세요'):(owner.ai?'AI가 말 선택 중':s.selectedPiece?'이동 경로를 선택하세요':'움직일 말을 선택하세요');
 const statusDesc=g.phase==='won'?`승리: ${g.players[g.winner ?? 0]?.label||''}`:watching?(watchPaused?busy?'진행 중인 동작을 마친 뒤 멈춥니다.':'재개를 누르면 같은 상태에서 계속 진행합니다.':g.logs[0]?.type==='capture'?'상대 말을 잡아 추가 던지기를 얻었습니다.':g.phase==='roll'&&g.lastRoll&&(g.lastRoll.value===4||g.lastRoll.value===5)?`${E.NAMES[g.lastRoll.value]}! 추가로 한 번 더 던집니다.`:'AI끼리 윷을 던지고 말을 선택해 자동으로 대전합니다.'):g.phase==='roll'?'멍석 안에 윷가락이 모두 떨어져야 유효해요.':'결과 선택 → 말 선택 → 목적지 클릭';
 const players=g.players.map(p=>{
  const pcs=g.pieces.filter(x=>x.player===p.id),ready=pcs.filter(x=>x.node==='WAIT').length,done=pcs.filter(x=>x.node==='FIN').length;
  return h('div',{className:cx('player-card',p.id===g.current&&'active',`player-${p.id}`),key:p.id,style:{'--player-accent':p.color}},
    h('div',{className:'player-hanji-pattern','aria-hidden':true},'✿'),
    h('div',{className:'player-main'},
      h('div',{className:'avatar-coin'},h('div',{className:'avatar'},p.avatar)),
      h('div',{className:'player-identity'},
        h('div',{className:'player-name'},p.label),
        h('div',{className:'player-role'},p.ai?watching?'AI 선수':(s.layaConnected?`달빛 Laya AI (${s.layaModelName?.replace('checkpoint-rollout-','')||'1500'})`:'인공지능 상대'):p.id===0&&g.config.mode==='ai'?'내 플레이어':'참가자'),
        h('div',{className:'pawns'},...pcs.map((pc,i)=>h('span',{key:i,className:cx('pawn-mini',pc.node==='FIN'&&'done'),style:{'--piece':p.color},title:pc.node==='FIN'?'완주':pc.node==='WAIT'?'대기':'이동 중'}))),
        h('div',{className:'player-progress','aria-label':`${done}개 완주`},h('div',{className:'player-progress-fill',style:{width:`${done*25}%`}}))
      ),
      h('div',{className:'player-right'},
        p.id===g.current?h('span',{className:'on-turn'},p.ai?'● AI 차례':'● 내 차례'):h('span',{className:'player-tag'},p.ai?'AI':'대기'),
        h('div',{className:'player-status'},done>0?`${done}/4 완주`:`대기 ${ready}개`),
        g.config.itemMode&&p.items.length?h('div',{className:'player-items-mini','aria-label':`보유 패물 ${p.items.length}개`},...p.items.map(it=>h('span',{key:it.id,title:E.ITEMS[it.type].name},E.ITEMS[it.type].icon))):null
      )
    )
  );
 });
 const readyPieces=g.pieces.filter(p=>p.player===g.current&&p.node==='WAIT');
 const mobilePieces=groups.filter(p=>g.phase!=='move'||!roll||allowed.has(p.id));
 const rack=readyPieces.map((p,i)=>h('button',{key:p.id,className:cx('rack-piece',allowed.has(p.id)&&human&&'pickable',s.selectedPiece===p.id&&'selected'),disabled:!human||g.phase!=='move'||!allowed.has(p.id)||!!s.moving,onClick:()=>this.selectPiece(p.id),'aria-label':`대기 말 ${p.index+1} 선택`},h('span',{className:'rack-token',style:{'--piece':owner.color}},'♟'),h('small',null,`${p.index+1}번 말`)));
 const mobileControlDock=h('div',{className:'mobile-action-dock',role:'region','aria-label':'모바일 조작 영역'},
  h('div',{className:'mobile-dock-section'},
   h('div',{className:'mobile-dock-header'},
    h('span',{className:'mobile-dock-title'},'✦ 사용할 윷 결과'),
    h('span',{className:'mobile-dock-badge'},g.rolls.length?`${owner.label} · ${g.rolls.length}개 남음`:(g.winner!==null?'게임 종료':`${owner.label} 차례`))
   ),
   h('div',{className:'mobile-roll-row'},
    g.rolls.length?g.rolls.map(r=>{
     const eff=E.effectivePips(r.value,owner.stoneDelta);
     const isActive=roll&&roll.id===r.id;
     return h('button',{key:r.id,className:cx('mobile-roll-chip',isActive&&'active'),'aria-pressed':!!isActive,disabled:!human||g.phase!=='move'||!!s.moving,onClick:()=>this.setState({selectedRoll:r.id,selectedPiece:null,selectedChoice:null})},
      h('span',{className:'chip-name'},E.NAMES[r.value]),
      h('span',{className:'chip-pips'},eff===-1?'↶ 빽도':owner.stoneDelta?`${eff}칸(${owner.stoneDelta>0?'+1':'-1'})`:`${eff}칸`)
     );
    }):h('div',{className:'mobile-dock-empty'},g.phase==='roll'?'아래 멍석에서 윷을 던져주세요.':'남은 윷 결과가 없습니다.')
   )
  ),
  h('div',{className:'mobile-dock-section'},
   h('div',{className:'mobile-dock-header'},
    h('span',{className:'mobile-dock-title'},'♟ 선택 가능한 말'),
    h('span',{className:'mobile-dock-badge'},human&&g.phase==='move'?`${mobilePieces.length}개 선택 가능`:owner.ai?'AI 차례':'결과를 얻은 뒤 선택')
   ),
   h('div',{className:'mobile-piece-row'},
    mobilePieces.length?mobilePieces.map(p=>{
     const canPick=allowed.has(p.id)&&human&&g.phase==='move'&&!s.moving;
     const stack=E.sameStack(g,p),isSelected=stack.some(piece=>piece.id===s.selectedPiece);
     const numbers=stack.map(piece=>piece.index+1).join('·'),label=`${numbers}번 말`;
     const position=p.node==='WAIT'?'출발 대기':stack.length>1?`판 위 · ${stack.length}개 업기`:'판 위';
     return h('button',{key:p.id,className:cx('mobile-rack-chip',canPick&&'pickable',isSelected&&'selected'),'aria-pressed':isSelected,disabled:!canPick,onClick:()=>this.selectPiece(p.id),'aria-label':`${position} ${label} 선택`},
      h('span',{className:'mobile-rack-token',style:{'--piece':owner.color}},'♟'),
      h('span',{className:'mobile-rack-text'},numbers,h('small',null,position))
     );
    }):h('div',{className:'mobile-dock-empty'},g.winner!==null?'대전이 끝났습니다.':'이 결과로 움직일 수 있는 말이 없습니다. 다른 결과를 선택해 주세요.')
   )
  ),
  s.selectedPiece&&selectedOpt?h('div',{className:'mobile-dock-section mobile-dock-confirm'},
   opts.length>1?h('div',{className:'mobile-route-selector'},
    ...opts.map(o=>h('button',{key:o.choice,className:cx('route-btn','mobile-route-btn',selectedOpt.choice===o.choice&&'active'),disabled:!!s.moving,'aria-pressed':selectedOpt.choice===o.choice,onClick:()=>this.setState({selectedChoice:o.choice})},o.label))
   ):null,
   h('button',{className:'primary-action mobile-confirm-button',disabled:!!s.moving,onClick:()=>this.commitMove(selectedOpt,false)},
    `✦ ${E.NAMES[roll?.value ?? 0]||''} · 선택한 말 이동 확정`
   )
  ):null
 );
 const logViews=g.logs.slice(0,9).map(l=>h('div',{className:'log-line',key:l.id},h('div',{className:'log-icon'},l.player==null?'✦':g.players[l.player]?.avatar||'◈'),h('div',{className:'log-content'},h('b',null,l.player==null?'알림':g.players[l.player]?.label),h('span',null,l.text))));
 const rollViews=g.rolls.length?g.rolls.map(r=>{
  const eff=E.effectivePips(r.value,owner.stoneDelta);
  return h('button',{key:r.id,className:cx('roll-pill',roll&&roll.id===r.id&&'active'),disabled:!human||g.phase!=='move'||!!s.moving,onClick:()=>this.setState({selectedRoll:r.id,selectedPiece:null,selectedChoice:null})},E.NAMES[r.value],h('small',null,eff===-1?'↶':owner.stoneDelta?`${eff}칸(${owner.stoneDelta>0?'+1':'-1'})`:`${eff}칸`));
 }):h('div',{className:'no-rolls'},g.phase==='roll'?'아직 던진 결과가 없어요.':'윷 던지기 버튼으로 시작하세요.');
 const activeBuffs=[owner.geumjulArmed&&'🌾 금줄 준비됨',owner.keyArmed&&'🔑 돌담 열쇠 활성',owner.stoneDelta!==0&&`🪨 디딤돌(${owner.stoneDelta>0?'+1':'-1'}칸)`].filter(Boolean);
 const itemPouchView=!g.config.itemMode?null:h('div',{className:'tactical-pouch'},
  h('div',{className:'results-caption'},h('span',null,'전술 패물 주머니'),h('span',null,g.itemsUnlocked?`${owner.items.length}/2 보유`:`중반 대기 (${g.turn}/${g.itemUnlockTurn}턴)`)),
  !g.itemsUnlocked?h('div',{className:'no-rolls'},`⏳ ${g.config.count}인 대전 기준 제 ${g.itemUnlockTurn}턴(중반)부터 패물과 복주머니가 등장합니다.`):FRAG([
   activeBuffs.length?h('div',{name:'buffs',className:'active-buffs'},...activeBuffs.map((b,i)=>h('span',{key:i,className:'buff-chip'},b))):null,
   owner.items.length?h('div',{className:'item-cards'},...owner.items.map(it=>{
    const meta=E.ITEMS[it.type];
    if(it.type==='stone'){
     return h('div',{key:it.id,className:'item-card stone-card',title:meta.summary},
      h('span',{className:'item-title'},`${meta.icon} ${meta.name}`),
      h('div',{className:'stone-actions'},
       h('button',{className:'stone-btn',disabled:!human||g.phase!=='move'||!!s.moving,onClick:()=>this.activateItem(it,1)},'+1칸'),
       h('button',{className:'stone-btn',disabled:!human||g.phase!=='move'||!!s.moving,onClick:()=>this.activateItem(it,-1)},'-1칸')
      )
     );
    }
    const canUse=human&&!s.moving&&(it.type==='geumjul'?!owner.geumjulArmed:it.type==='key'?g.phase==='move'&&!owner.keyArmed:g.pieces.some(p=>p.player===g.current&&p.node!=='WAIT'&&p.node!=='FIN'&&!p.shielded));
    return h('button',{key:it.id,className:'item-card',disabled:!canUse,onClick:()=>this.activateItem(it),title:meta.summary},
     h('span',{className:'item-title'},`${meta.icon} ${meta.name}`),
     h('small',null,it.type==='geumjul'?'낙 1회 방어':it.type==='key'?'지나치며 분기':'말 1회 보호')
    );
   })):h('div',{className:'no-rolls'},'보유한 패물이 없습니다. 판 위의 복주머니 칸에 정차해 획득하세요.')
  ])
 );
 const menuAction=(action: ()=>void)=>(ev)=>{
  const menu=ev.currentTarget.closest('details.mobile-game-menu');if(menu)menu.open=false;
  action();
 };
 const mobileMenu=h('details',{className:'mobile-game-menu',onKeyDown:ev=>{
  if(ev.key==='Escape'){ev.currentTarget.open=false;ev.currentTarget.querySelector('summary')?.focus();}
 }},
  h('summary',{'aria-label':'게임 메뉴','aria-controls':'mobile-game-menu-content'},'☰'),
  h('button',{className:'mobile-menu-dismiss','aria-label':'메뉴 닫기',onClick:menuAction(()=>{})}),
  h('nav',{className:'mobile-menu-content',id:'mobile-game-menu-content','aria-label':'게임 메뉴'},
   h('button',{className:'mobile-menu-item',onClick:menuAction(()=>this.setState({settingsOpen:true,setup:{...g.config}}))},'⚙ 새 게임 · 윷판 · 인원 설정'),
   h('button',{className:'mobile-menu-item',onClick:menuAction(()=>this.setState({settingsOpen:true,setup:{...g.config}}))},g.config.itemMode?'🎁 아이템전 설정':'🎲 일반전 / 아이템전'),
   h('button',{className:'mobile-menu-item',onClick:menuAction(()=>this.setState({settingsOpen:true,setup:{...g.config,mode:'spectate',count:watching?g.players.length:4}}))},watching?'◉ 관전 설정':'◉ AI 관전'),
   watching?h('button',{className:'mobile-menu-item',disabled:g.winner!==null,onClick:menuAction(()=>this.toggleSpectatorPause())},watchPaused?'▶ 관전 재개':'Ⅱ 관전 일시정지'):null,
   h('button',{className:'mobile-menu-item','aria-pressed':s.sound,onClick:menuAction(()=>this.setState({sound:!s.sound}))},s.sound?'♫ 소리 끄기':'♬ 소리 켜기'),
   h('details',{className:'mobile-menu-section'},h('summary',null,'♟ 참가자'),h('div',{className:'mobile-menu-players'},...players)),
   g.config.itemMode?h('details',{className:'mobile-menu-section'},h('summary',null,'🎁 보유 패물'),itemPouchView):null,
   h('details',{className:'mobile-menu-section'},h('summary',null,'☷ 대전 기록'),h('div',{className:'log-list'},...logViews)),
   h('details',{className:'mobile-menu-section'},h('summary',null,'? 이동 방법'),h('p',null,'윷 결과와 말을 선택하고, 경로를 고른 뒤 윷판의 금빛 목적지를 누르세요.')),
   !watching?h('button',{className:'mobile-menu-item',disabled:!human||g.phase!=='roll'||busy,onClick:menuAction(()=>this.throwYut('nak',false))},'낙 시연 (테스트)'):null
  )
 );
 return h('div',{className:'app-shell'},
  h('div',{className:'lantern-decor lantern-decor-left','aria-hidden':true}),h('div',{className:'lantern-decor lantern-decor-right','aria-hidden':true}),
  h('div',{className:'ambient-leaves','aria-hidden':true},...Array.from({length:12},(_,i)=>h('i',{className:'ambient-leaf',key:i,style:{'--left':`${6+i*8}%`,'--delay':`${i*-1.6}s`,'--duration':`${14+i%5*2}s`}}))),
  h('div',{className:'app-wrap'},
  h('header',{className:'header'},
   h('div',{className:'brand'},h('div',{className:'brand-mark'},h('strong',null,'달빛 윷마당'),h('span',{className:'brand-seal'},'전통')),h('div',{className:'brand-sub'},'한옥 마루에서 즐기는 우리들의 한 판')),
   h('div',{className:'header-right'},
    h('span',{className:'head-chip'},`제 ${String(g.turn)} 턴`),
    h('button',{className:cx('header-btn','watch-entry'),onClick:()=>this.setState({settingsOpen:true,setup:{...g.config}}),title:'일반전 / 아이템전 설정 변경'},g.config.itemMode?'🎁 아이템전':'일반전'),
    h('button',{className:'header-btn watch-entry',onClick:()=>this.setState({settingsOpen:true,setup:{...g.config,mode:'spectate',count:watching?g.players.length:4}})},watching?'관전 설정':'AI 관전'),
    h('button',{className:'header-btn icon-button','aria-label':s.sound?'소리 끄기':'소리 켜기','aria-pressed':s.sound,title:s.sound?'소리 끄기':'소리 켜기',onClick:()=>this.setState({sound:!s.sound})},s.sound?'♫':'♬'),
    h('button',{className:'header-btn icon-button','aria-label':'새 게임 설정',title:'새 게임 설정',onClick:()=>this.setState({settingsOpen:true,setup:{...g.config}})},'⚙'))
  ),
  h('main',{className:'layout'},
   h('aside',{className:'panel side player-panel'},
    h('div',{className:'side-section-title'},'지금은 누구 차례?',h('span',null,watching?`AI ${g.players.length}명 관전`:g.config.mode==='ai'?`나 + AI ${g.players.length-1}명`:`함께하기 · ${g.players.length}인`)),
    h('div',{className:'turn-hero'},h('div',{className:'eyebrow'},watchPaused?'PAUSED':'CURRENT TURN'),h('div',{className:'turn-name'},h('span',{className:'turn-dot',style:{background:owner.color}}),owner.label),h('div',{className:'turn-sub'},watchPaused?busy?'현재 동작을 마친 뒤 멈춥니다.':'AI 대전을 일시정지했습니다.':s.moving?'선택한 말이 윷판 위를 이동 중입니다.':owner.ai?'AI가 다음 행동을 결정하고 있습니다.':g.phase==='move'?'말을 직접 눌러 이동해보세요.':'아래 멍석에서 윷을 던져주세요.')),
    h('div',{className:'side-section-title'},'참가자',h('span',null,'각 4개의 말')),
    h('div',{className:'players-list'},...players),
    h('div',{className:'subpanel rack-subpanel'},h('div',{className:'rack-title'},h('b',null,'출발 대기 말'),h('span',null,`${readyPieces.length}개`)),h('div',{className:'rack'},rack.length?rack:h('div',{style:{gridColumn:'1/-1',fontSize:11,color:'#c4d1d9'}},'출발 대기 중인 말이 없습니다.'))),
    h('div',{className:'subpanel tips-block'},h('div',{className:'side-section-title'},watching?'관전 안내':'이동하는 방법'),
      ...(watching?[['1','AI가 차례대로 윷을 던집니다.'],['2','말과 경로를 자동으로 선택합니다.'],['3','윷·모 또는 잡기 시 추가로 던집니다.']]:[['1','윷을 던져 결과를 얻습니다.'],['2','결과와 움직일 말을 직접 누릅니다.'],['3','경로를 고르고 빛나는 목적지를 누릅니다.']]).map(([num,text])=>h('div',{key:num,className:'tiny-guide'},h('b',null,num),h('p',{className:'tips'},text))))
   ),
   h('section',{className:'panel board-panel'},
    mobileMenu,
    h('div',{className:'board-top'},h('div',{className:'board-heading'},h('strong',null,`✿ ${graph.title}`),h('small',null,graph.subtitle)),
     h('div',{className:'board-switch'},...M.BOARD_TYPES.map(key=>h('button',{key,className:cx('board-choice',g.config.board===key&&'active'),'aria-pressed':g.config.board===key,onClick:()=>{if(g.config.board!==key)this.startGame({...g.config,board:key});}},key==='S'?'기본판':key==='A'?'팔각형':key==='B'?'이중 링':'나선정원')))),
    mobileControlDock,
    h('div',{className:'board-shadow'},h('div',{className:'board-cloth'},h('div',{className:'frame-charm frame-charm-left','aria-hidden':true},'❖'),h('div',{className:'frame-charm frame-charm-right','aria-hidden':true},'❖'),h(Board,{game:g,chosenRoll:roll,chosenPiece:g.pieces.find(p=>p.id===s.selectedPiece),chosenChoice:selectedOpt?.choice,onPiece:id=>this.selectPiece(id),onTarget:opt=>this.commitMove(opt,false),moving:s.moving,burst:s.burst}))),
    h('div',{className:'board-cap'},h('span',null,g.config.itemMode?(g.config.board==='G'?'✦ 모 자리 정차 시 협문 · 중반 복주머니 정차 시 패물 획득':'✦ 갈림길 정차 시 지름길 · 중반 복주머니 정차 시 패물 획득'):(g.config.board==='G'?'✦ 모 자리(5·10·15·20) 정차 시 협문 지름길 진입':'✦ 갈림길에 정확히 멈추었을 때만 지름길 진입')),h('span',null,watching?'AI 판단 → 자동 말 이동':'말 선택 → 황금색 목적지 클릭')),
    h('div',{className:'map-sep'}),
    h('div',{className:'throw-top'},h('div',null,h('div',{className:'throw-title'},'✦ 달빛 멍석 · 윷 던지기'),h('div',{className:'throw-desc'},'네 가락이 멍석 경계 안에 걸쳐야 유효 · 완전히 밖이면 낙')),h('div',{style:{fontSize:11,color:'#eac78f',fontWeight:850}},watchPaused?busy?'동작 마무리 중':'관전 일시정지':g.phase==='move'?'말 이동 중':`${g.players[g.current].label} 차례`)),
    h(ThrowMat,{sticks:s.sticks,stage:s.stage,result:s.result,watching}),
    watching?h('div',{className:'throw-actions spectator-controls'},
     h('button',{className:'primary-action',disabled:g.winner!==null,'aria-label':watchPaused?'관전 재개':'관전 일시정지',onClick:()=>this.toggleSpectatorPause(),title:'진행 중인 던지기나 이동은 마친 뒤 다음 행동부터 멈춥니다.'},watchPaused?'▶ 관전 재개': 'Ⅱ 관전 일시정지'),
     h('button',{className:'sub-action',onClick:()=>this.startGame(g.config)},'새 AI 대전')):
    h('div',{className:'throw-actions'},
     h('button',{className:'primary-action throw-main-button',disabled:!human||g.phase!=='roll'||s.stage==='throwing'||!!s.moving,onClick:()=>this.throwYut('random',false)},h('span',{className:'throw-icon'},'♢'),s.stage==='throwing'?'윷가락이 날아갑니다…':g.phase==='move'?'말을 이동해 주세요':g.lastRoll&&(g.lastRoll.value===4||g.lastRoll.value===5)?'보너스 윷 던지기':'윷 던지기',h('span',{className:'button-ornament'},'❖')),
     h('button',{className:'sub-action',disabled:!human||g.phase!=='roll'||s.stage==='throwing'||!!s.moving,onClick:()=>this.throwYut('nak',false)},'낙 시연'))
   ),
   h('aside',{className:'panel right-panel'},
    h('div',{className:'action-section'},h('div',{className:'phase-badge'},g.phase==='won'?'♛ 승리':watching?watchPaused?'Ⅱ 관전 일시정지':'◉ AI 자동 대전':g.phase==='move'?'✦ 직접 말 이동':'✦ 윷 던지기'),
     h('h2',{className:'step-title'},turnTitle),h('p',{className:'step-desc'},statusDesc),
     h('div',{className:'move-steps'},...(watching?['윷 던지기','AI 판단','말 이동']:['윷 결과','말 선택','도착점']).map((name,i)=>h('div',{className:cx('move-step',(watching?i===(g.phase==='roll'?0:s.moving?2:1):((i===0&&g.phase==='roll')||(i===1&&g.phase==='move'&&!s.selectedPiece)||(i===2&&!!s.selectedPiece)))&&'is-current',i===0&&g.phase==='move'&&'is-done'),key:i},h('small',null,`0${i+1}`),h('b',null,name)))),
     itemPouchView,
     h('div',{className:'results-caption'},h('span',null,'사용할 윷 결과'),h('span',null,`${g.rolls.length}개 남음`)),
     h('div',{className:'results'},...Array.isArray(rollViews)?rollViews:[rollViews]),
     watching?h('div',{className:'manual-block spectator-note'},h('div',{className:'manual-title'},watchPaused?'Ⅱ 잠시 멈춤':'◉ 관전 중'),h('p',{className:'target-help'},watchPaused?'현재 동작이 끝나면 멈추며, 재개하면 이어서 대전합니다.':'AI가 모든 윷 던지기와 말 이동을 수행합니다. 윷·모 또는 잡기가 나오면 같은 AI가 추가로 던집니다.')):
     s.selectedPiece&&selectedOpt?h('div',{className:'manual-block is-ready'},h('div',{className:'manual-title'},'✦ 이동 경로를 선택하세요'),
       h('div',{className:'route-buttons'},...opts.map(o=>h('button',{className:cx('route-btn',selectedOpt.choice===o.choice&&'active'),key:o.choice,onClick:()=>this.setState({selectedChoice:o.choice})},o.label))),
       h('p',{className:'target-help'},'윷판에서 금빛으로 빛나는 도착점을 누르거나 아래 버튼으로 이동하세요.'),
       h('button',{className:'primary-action',style:{width:'100%',minHeight:44,fontSize:13,marginTop:11},disabled:!!s.moving,onClick:()=>this.commitMove(selectedOpt,false)},`✦ ${E.NAMES[roll?.value ?? 0]||''} · 선택한 말 이동 확정`)):
       h('div',{className:'manual-block'},h('div',{className:'manual-title'},'✦ 조작 안내'),h('p',{className:'target-help'},g.phase==='move'?'윷 결과 선택 → 윷판의 내 말이나 왼쪽 대기 말을 클릭하세요.':g.phase==='roll'?'윷을 던져 도·개·걸·윷·모·빽도 결과를 확인하세요.':'말 4개를 모두 완주시켜 승리하세요.')),
    ),
    h('div',{className:'log-section'},h('div',{className:'side-section-title'},'게임 기록',h('span',null,'LIVE')),h('div',{className:'log-list'},...logViews)),
   )
  ),
  h('div',{className:'footer-copy'},'DALBIT YUT · 나 + AI 1~3명 / 2~4인 로컬 / AI 자동 대전 관전'),
  s.toast?h('div',{className:'toast',role:'status'},s.toast):null,
  s.settingsOpen?h('div',{className:'modal-backdrop',role:'presentation',onMouseDown:(ev)=>{if(ev.target===ev.currentTarget)this.setState({settingsOpen:false});}},
   h('div',{className:'modal settings-modal',role:'dialog','aria-modal':true,'aria-labelledby':'settings-title',onKeyDown:ev=>{if(ev.key==='Escape')this.setState({settingsOpen:false});}},
    h('div',{className:'settings-header'},h('h2',{id:'settings-title'},'새로운 한 판'),h('button',{className:'settings-close',type:'button','aria-label':'게임 설정 닫기',autoFocus:true,onClick:()=>this.setState({settingsOpen:false})},'×')),
    h('div',{className:'settings-body'},
    h('p',{className:'settings-description'},'직접 플레이하거나 AI끼리 대전하는 모습을 관전하세요.'),
    h('label',{className:'form-label'},'게임 모드'),h('div',{className:'setting-options',style:{gridTemplateColumns:'repeat(3,1fr)'}},...[['ai','나 + AI 대전'],['local','함께하기'],['spectate','AI 관전']].map(([value,text])=>h('button',{key:value,className:cx('setting-btn',s.setup.mode===value&&'active'),'aria-pressed':s.setup.mode===value,onClick:()=>this.setState({setup:{...s.setup,mode:value as GameConfig['mode']}})},text))),
    h('label',{className:'form-label'},s.setup.mode==='spectate'?'참가 AI 수':s.setup.mode==='ai'?'AI 상대 수':'총 참가 인원'),h('div',{className:'setting-options',style:{gridTemplateColumns:'repeat(3,1fr)'}},...[2,3,4].map(n=>h('button',{key:n,className:cx('setting-btn',s.setup.count===n&&'active'),'aria-pressed':s.setup.count===n,onClick:()=>this.setState({setup:{...s.setup,count:n}})},s.setup.mode==='spectate'?`AI ${n}명`:s.setup.mode==='ai'?`AI ${n-1}명`:`${n}명`))),
    h('label',{className:'form-label'},'대전 방식'),
    h('div',{className:'setting-options',style:{gridTemplateColumns:'repeat(2,1fr)'}},
     h('button',{className:cx('setting-btn',!s.setup.itemMode&&'active'),'aria-pressed':!s.setup.itemMode,onClick:()=>this.setState({setup:{...s.setup,itemMode:false}})},'일반전 (전통 윷놀이)'),
     h('button',{className:cx('setting-btn',s.setup.itemMode&&'active'),'aria-pressed':!!s.setup.itemMode,onClick:()=>this.setState({setup:{...s.setup,itemMode:true}})},'🎁 아이템전 (중반 패물)')
    ),
    h('p',{className:'setup-composition',role:'status'},(s.setup.mode==='spectate'?`AI ${s.setup.count}명 자동 대전 · 관전 전용`:s.setup.mode==='ai'?`나 1명 + AI ${s.setup.count-1}명 · 총 ${s.setup.count}인`:`사람 ${s.setup.count}명 · 로컬 대전`)+(s.setup.itemMode?` · 아이템전(제 ${E.itemUnlockTurn(s.setup.count)}턴 중반 등장)`:' · 일반전')),
    h('label',{className:'form-label'},'윷놀이판'),h('div',{className:'setting-options',style:{gridTemplateColumns:'repeat(2,1fr)'}},...M.BOARD_TYPES.map(value=>h('button',{key:value,className:cx('setting-btn',s.setup.board===value&&'active'),'aria-pressed':s.setup.board===value,onClick:()=>this.setState({setup:{...s.setup,board:value}})},M.boardMeta(value).title))),
    h('details',{className:'settings-extra'},h('summary',null,'음악 · 규칙'),
     h('label',{className:'form-label',htmlFor:'music-volume'},`배경음악 (${Math.round(s.musicVolume*100)}%)`),
     h('input',{id:'music-volume',type:'range',min:0,max:100,step:1,value:Math.round(s.musicVolume*100),'aria-label':'배경음악 음량',onChange:(ev)=>this.setState({musicVolume:Number(ev.target.value)/100}),style:{width:'100%',accentColor:'#e5c17d'}}),
     h('p',{className:'modal-note'},'규칙: 갈림길 정차 시 지름길, 빽도는 지나온 경로로 후진, 낙은 그 던지기만 무효. 아이템전 선택 시 참가 인원에 따른 중반 턴부터 패물이 등장합니다.')
    )),
    h('div',{className:'settings-footer'},h('button',{className:'primary-action',onClick:()=>this.startGame(s.setup)},s.setup.mode==='spectate'?`AI ${s.setup.count}명 관전 시작`:s.setup.mode==='ai'?`나 + AI ${s.setup.count-1}명으로 시작`:`사람 ${s.setup.count}명으로 시작`))
   )):null,
  g.winner!==null?h('div',{className:'modal-backdrop'},h('div',{className:'modal victory'},h('div',{style:{color:'#f2d098',fontSize:12,textAlign:'center'}},'승부 결정'),h('div',{className:'prize'},'🏆'),h('h2',{style:{textAlign:'center'}},`${g.players[g.winner].label} 승리!`),h('p',{style:{textAlign:'center'}},'네 개의 말을 모두 완주했습니다.'),h('button',{className:'primary-action',onClick:()=>this.startGame(g.config)},'다시 한 판'))):null
 ));
};

state: GameUIState={game:E.createGame(INITIAL_CONFIG),setup:{...INITIAL_CONFIG},selectedRoll:null,selectedPiece:null,selectedChoice:null,settingsOpen:false,sound:true,musicVolume:0.3,aiPaused:false,stage:'idle',sticks:initialSticks(),result:null,moving:null,burst:null,toast:null};

}
const mount=document.getElementById('root');
if(!mount) throw new Error('Game root element was not found');
// The TSX entry is compiled by Vite for production and by tsc for offline QA.
// Expose the mounted component for visual regression and movement QA.
(window as any).__DALBIT_INSTANCE__=ReactDOM.render(h(App),mount);
(window as any).__DALBIT_APP__={version:'3.0.0-ts',engine:E,maps:M};
