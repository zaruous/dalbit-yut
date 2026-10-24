(function(root){
'use strict';
const React=root.React, ReactDOM=root.ReactDOM;
const h=React.createElement, E=root.YutEngine, M=root.YutMaps;
const FRAG=(children)=>h('div',null,children);
const cx=(...names)=>names.filter(Boolean).join(' ');
function coords(g,id){
 if(id==='WAIT')return g.xy.O0;
 if(id==='FIN')return {x:432,y:406};
 return g.xy[id]||g.xy.O0;
}
function poly(g,nodes){return nodes.map((id,i)=>{const p=coords(g,id);return `${i===0?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`}).join(' ');}
function PieceShape(props){
 const {x,y,color,number,selected,available,animated,onClick}=props;
 return h('g',{className:cx('piece-handle',selected&&'selected',available&&'available',animated&&'animated'),transform:`translate(${x} ${y})`,onClick,role:onClick?'button':undefined,tabIndex:onClick?0:undefined, 'aria-label':onClick?'말 선택':undefined,onKeyDown:onClick?(ev)=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();onClick();}}:undefined},
   h('ellipse',{cx:0,cy:13,rx:17,ry:5,fill:'#1e2636',opacity:'.24'}),
   h('circle',{className:'piece-halo',cx:0,cy:0,r:20,fill:'none',stroke:selected?'#fee4a3':available?'#f9ce83':'#222f44',strokeWidth:selected?4:available?4:2,opacity:.95}),
   h('rect',{x:-12.5,y:-2,width:25,height:17,rx:7,fill:color,stroke:'#fff2d4',strokeWidth:1.8}),
   h('ellipse',{cx:0,cy:-6,rx:10.5,ry:8.7,fill:color,stroke:'#fff2d4',strokeWidth:1.8}),
   h('ellipse',{cx:-3,cy:-8,rx:4.5,ry:2.2,fill:'#ffffffaa',opacity:'.8'}),
   number>1?h('g',null,h('circle',{cx:15,cy:-13,r:10,fill:'#233248',stroke:'#ffe1a6',strokeWidth:1.4}),h('text',{x:15,y:-9,textAnchor:'middle',fontSize:11,fontWeight:900,fill:'#fff6d8'},number)):null
 );
}
function Board({game,chosenRoll,chosenPiece,chosenChoice,onPiece,onTarget,moving,burst}){
 const graph=M.makeGraph(game.config.board),xy=graph.xy;
 const outer=[...graph.outerIds,'O0'];
 const routes=game.config.board==='A' ?
  [['O6','NE1','NE2','C','SW1','SW2','O18'],['O12','NW1','NW2','C','SE1','SE2','O0']]:
  [['O6',...Array.from({length:9},(_,i)=>`I${i}`),'R1','O0'],['O12','W0','I4']];
 const isHuman=!game.players[game.current].ai;
 const availableIds=new Set(game.phase==='move'&&chosenRoll&&isHuman?E.legalActions(game,chosenRoll.id).map(a=>a.pieceId):[]);
 const groups=[];const index=new Map();
 for(const p of game.pieces){
  if(p.node==='WAIT'||p.node==='FIN')continue;
  const key=`${p.player}-${p.node}`;
  if(!index.has(key)){index.set(key,groups.length);groups.push({player:p.player,node:p.node,items:[p]});}
  else groups[index.get(key)].items.push(p);
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
  return h('g',{className:'board-target',onClick:()=>onTarget(chosenOption),key:'target'},
     h('circle',{cx:to.x,cy:to.y,r:27,fill:'#d7af6a',opacity:'.24'}),
     h('circle',{cx:to.x,cy:to.y,r:22,fill:'#6ad3c4',stroke:'#faf3c0',strokeWidth:2.8,strokeDasharray:'5 3'}),
     h('text',{x:to.x,y:to.y+5,textAnchor:'middle',fontSize:11,fontWeight:900,fill:'#132c33'},chosenOption.destination==='FIN'?'완주':chosenOption.destination==='WAIT'?'대기':'여기'),
     h('circle',{className:'invisible-hit',cx:to.x,cy:to.y,r:28})
  );
 })():null;
 const decor=h('g',{opacity:'.24',stroke:'#ac946c',fill:'none'},
  h('circle',{cx:250,cy:235,r:65,strokeDasharray:'4 8'}),
  h('circle',{cx:250,cy:235,r:85,strokeDasharray:'2 13'}),
  h('path',{d:'M78 228q40-48 86 0t84 0 M313 220q60-43 115 9 M160 334q85-54 160 0',strokeWidth:1.3}),
  h('path',{d:'M113 344q15-27 32-5 20-41 42-2 22-20 41-1 M327 147q24-42 48 0',strokeWidth:2})
 );
 return h('svg',{className:'board-svg',viewBox:'0 0 500 470',role:'img','aria-label':game.config.board==='A'?'팔각 순환형 윷판':'이중 링형 윷판'},
  h('defs',null,
   h('radialGradient',{id:'paperFill',cx:'.5',cy:'.4',r:'.9'},h('stop',{offset:'0%',stopColor:'#fff7e5'}),h('stop',{offset:'100%',stopColor:'#dbc69e'})),
   h('pattern',{id:'grain',width:15,height:15,patternUnits:'userSpaceOnUse'},h('circle',{cx:2,cy:2,r:'.5',fill:'#8c6c44',opacity:'.12'}),h('path',{d:'M10 10l3-2',stroke:'#775939',strokeWidth:.3,opacity:'.13'}))
  ),
  h('rect',{x:4,y:4,width:492,height:462,rx:8,fill:'url(#paperFill)'}),h('rect',{x:4,y:4,width:492,height:462,rx:8,fill:'url(#grain)'}),
  h('rect',{x:15,y:15,width:470,height:440,rx:4,fill:'none',stroke:'#aa8b65',strokeWidth:1,opacity:.6}),
  h('path',{d:'M28 48V28h24 M448 28h24v20 M28 422v20h24 M448 442h24v-20',fill:'none',stroke:'#926f49',strokeWidth:5,strokeLinecap:'square'}),
  decor,
  h('path',{d:poly(graph,outer),className:'route-line'}),
  ...routes.map((r,i)=>h('path',{d:poly(graph,r),key:'route'+i,className:'route-inner'})),
  ...nodes,
  h('g',{className:'board-label'},
   h('text',{x:403,y:397,className:'board-label'},'출발 · 완주'),
   h('text',{x:393,y:86,className:'board-label'},'갈림길 ①'),
   h('text',{x:76,y:87,className:'board-label'},'갈림길 ②'),
   game.config.board==='A'?h('text',{x:264,y:221,className:'board-label'},'중앙'):h('text',{x:214,y:222,className:'board-label'},'내선')
  ),
  highlight?h('path',{d:poly(graph,highlight),className:'movement-trail'}):null,
  ...(moving?[h('path',{d:poly(graph,moving.meta.path.slice(0,moving.step+1)),className:'movement-trail',key:'animTrail'})]:[]),
  ...tokenViews,
  movingToken,
  burst?(()=>{const pos=coords(graph,burst.node);return h('g',{className:'arrival-burst',key:'burst'},
   h('circle',{cx:pos.x,cy:pos.y,r:24,fill:'none',stroke:burst.capture?'#da6256':'#ffcf7e',strokeWidth:6}),
   h('circle',{cx:pos.x,cy:pos.y,r:37,fill:'none',stroke:burst.capture?'#e55c55':'#ffe2aa',strokeWidth:2,strokeDasharray:'5 5'}),
   h('text',{x:pos.x,y:pos.y-30,textAnchor:'middle',fontSize:14,fontWeight:900,fill:burst.capture?'#c5524c':'#b16c3e',paintOrder:'stroke',stroke:'#fff6e0',strokeWidth:4},burst.capture?'잡았다!':burst.joined?'업기!':burst.node==='FIN'?'완주!':'착지')
  );})():null,
  target
 );
}
function ThrowMat({sticks,stage,result}){
 const rendered=sticks.map((st,i)=>{
  const fx=st.front;
  return h('g',{key:i,transform:`translate(${st.x} ${st.y}) rotate(${st.angle})`,className:cx('yutstick',st.nak&&'is-nak'),style:{'--delay':`${i*76}ms`}},
    h('rect',{x:-40,y:-11,width:80,height:23,rx:9,fill:'#64412f',stroke:'#fbe2a6',strokeWidth:1}),
    h('rect',{x:-37,y:-10,width:74,height:19,rx:7,fill:fx?'#c99459':'#e8c58c'}),
    h('path',{d:'M-30 -5Q0 -8 30 -4 M-30 4Q0 0 30 5',stroke:'#fff7cf',opacity:.32,strokeWidth:1.3,fill:'none'}),
    fx?h('g',{stroke:'#5b3729',strokeWidth:2.5,strokeLinecap:'round'},
      [-19,0,19].map(z=>h('path',{key:z,d:`M${z-5} -5l10 10 M${z+5} -5l-10 10`}))):
      h('path',{d:'M-23 0H22',stroke:'#8c6039',strokeWidth:2.7,strokeLinecap:'round'}),
    i===0?h('circle',{cx:31,cy:0,r:3.7,fill:'#b24f43',stroke:'#f8e3a3',strokeWidth:1}):null,
    st.nak?h('circle',{cx:0,cy:0,r:45,stroke:'#ff6966',strokeWidth:2,strokeDasharray:'4 6',fill:'none',opacity:.9}):null
  );
 });
 return h('div',{className:'throw-sandbox'},
   h('div',{className:cx('throw-ripple',stage==='throwing'&&'playing')}),
   h('div',{className:cx('sparkles',stage==='throwing'&&'throwing')},Array.from({length:8},(_,i)=>h('i',{className:'spark',key:i}))),
   h('svg',{className:cx('mat-svg','mat-sticks',stage==='throwing'&&'throwing'),viewBox:'0 0 690 150',preserveAspectRatio:'xMidYMid meet'},
     h('defs',null,h('radialGradient',{id:'matGlow'},h('stop',{offset:0,stopColor:'#aa7c50',stopOpacity:.7}),h('stop',{offset:1,stopColor:'#372c33',stopOpacity:.3}))),
     h('rect',{x:65,y:7,width:520,height:136,rx:57,fill:'url(#matGlow)',stroke:'#a78a64',strokeWidth:4,strokeDasharray:'4 4'}),
     h('rect',{x:79,y:18,width:492,height:115,rx:48,fill:'none',stroke:'#e1bb7a',strokeWidth:1.1,opacity:.5}),
     h('ellipse',{cx:325,cy:75,rx:162,ry:48,fill:'none',stroke:'#b99969',strokeWidth:2,strokeDasharray:'8 9',opacity:.4}),
     h('text',{x:105,y:76,className:'mat-label'},'DALBIT'),
     h('text',{x:525,y:76,textAnchor:'end',className:'mat-label'},'YUT'),
     h('g',null,...rendered)
   ),
   result?h('div',{className:cx('result-orb','visible',result==='낙'&&'nak')},result):null
 );
}
function App(){React.Component.apply(this,arguments);} // React 16-compatible class inheritance below
App.prototype=Object.create(React.Component.prototype);App.prototype.constructor=App;
App.prototype.componentDidMount=function(){this.checkAI();};
App.prototype.componentDidUpdate=function(){this.checkAI();};
App.prototype.componentWillUnmount=function(){this.destroyed=true;this.timers.forEach(clearTimeout);clearTimeout(this.aiTimer);};
App.prototype.defer=function(fn,ms){const t=setTimeout(()=>{this.timers=this.timers.filter(x=>x!==t);if(!this.destroyed)fn();},ms);this.timers.push(t);return t;};
App.prototype.notify=function(text){this.setState({toast:text});clearTimeout(this.toastTimer);this.toastTimer=this.defer(()=>this.setState({toast:null}),2400);};
App.prototype.playSound=function(kind){
 if(!this.state.sound)return;
 try{const C=root.AudioContext||root.webkitAudioContext;if(!C)return;const ctx=this.audioCtx||(this.audioCtx=new C());const os=ctx.createOscillator(),gain=ctx.createGain();os.connect(gain);gain.connect(ctx.destination);const t=ctx.currentTime;os.type=kind==='nak'?'sawtooth':'sine';os.frequency.setValueAtTime(kind==='nak'?240:520,t);os.frequency.exponentialRampToValueAtTime(kind==='nak'?135:680,t+.18);gain.gain.setValueAtTime(.045,t);gain.gain.exponentialRampToValueAtTime(.001,t+.22);os.start(t);os.stop(t+.23);}catch(e){}
};
App.prototype.checkAI=function(){
 const s=this.state,g=s.game;
 if(!g||!g.players[g.current].ai||g.winner!==null||s.settingsOpen||s.moving||s.stage==='throwing'||this.aiTimer)return;
 if(g.phase!=='roll'&&g.phase!=='move')return;
 this.aiTimer=setTimeout(()=>{this.aiTimer=null;if(this.destroyed)return;const current=this.state.game;if(!current.players[current.current].ai||this.state.moving||this.state.stage==='throwing'||this.state.settingsOpen)return;
  if(current.phase==='roll')this.throwYut('safe',true);else if(current.phase==='move'){
   const acts=E.legalActions(current);if(!acts.length){this.setState({game:E.normalize(current)});return;}
   const ranked=acts.sort((a,b)=>E.scoreOption(current,b)-E.scoreOption(current,a));this.commitMove(ranked[0],true);
  }
 },g.phase==='roll'?850:620);
};
App.prototype.throwYut=function(mode,ai){
 const g=this.state.game;
 if(g.phase!=='roll'||this.state.stage==='throwing'||this.state.moving)return;
 if(!ai&&g.players[g.current].ai)return;
 const rolled=E.rollSticks(g.config.backdo),landing=E.generateLanding(this.state.force,mode);
 const sticks=landing.sticks.map((st,i)=>({...st,front:rolled.faces[i]}));
 this.setState({stage:'throwing',sticks,result:null,selectedPiece:null,selectedChoice:null});this.playSound('throw');
 this.defer(()=>{
  const nak=landing.nak,next=E.throwResult(this.state.game,rolled,nak);
  this.setState({game:next,stage:'settled',result:nak?'낙':E.NAMES[rolled.value],selectedRoll:null},()=>this.playSound(nak?'nak':'land'));
  if(nak)this.notify('낙! 윷이 멍석 경계를 완전히 벗어나 차례가 넘어갑니다.');
 },1450);
};
App.prototype.startGame=function(opts){
 this.timers.forEach(clearTimeout);this.timers=[];clearTimeout(this.aiTimer);this.aiTimer=null;
 const game=E.createGame(opts||this.state.setup);
 this.setState({game,setup:{...game.config},settingsOpen:false,selectedRoll:null,selectedPiece:null,selectedChoice:null,
  stage:'idle',result:null,moving:null,burst:null,toast:null,sticks:initialSticks()});
};
App.prototype.selectPiece=function(id){
 const g=this.state.game,roll=this.activeRoll();if(!roll||g.phase!=='move'||g.players[g.current].ai||this.state.moving)return;
 const opts=E.moveOptions(g,id,roll.id);if(!opts.length)return;
 if(this.state.selectedPiece===id){this.setState({selectedPiece:null,selectedChoice:null});return;}
 this.setState({selectedPiece:id,selectedChoice:opts[0].choice});
};
App.prototype.activeRoll=function(){const g=this.state.game;return g.rolls.find(x=>x.id===this.state.selectedRoll)||g.rolls[0]||null;};
App.prototype.commitMove=function(option,ai){
 const g=this.state.game;if(g.phase!=='move'||this.state.moving||(!ai&&g.players[g.current].ai))return;
 const result=E.resolveMove(g,option);if(!result)return;
 const meta=result.meta;
 this.setState({moving:{meta,resolution:result.game,step:0},selectedPiece:null,selectedRoll:null,selectedChoice:null},()=>this.defer(()=>this.moveTick(),220));
};
App.prototype.moveTick=function(){
 const moving=this.state.moving;if(!moving)return;
 if(moving.step+1<moving.meta.path.length){this.setState({moving:{...moving,step:moving.step+1}},()=>this.defer(()=>this.moveTick(),235));return;}
 const note=moving.meta.captured?'말 잡기! 추가 던지기':moving.meta.joined?'말 업기 성공!':moving.meta.to==='FIN'?'완주했습니다!':'말 이동 완료';
 this.setState({game:moving.resolution,moving:null,stage:'idle',result:null,burst:{node:moving.meta.to,capture:!!moving.meta.captured,joined:!!moving.meta.joined}},()=>{
  this.defer(()=>this.setState({burst:null}),850);
  this.playSound(moving.meta.captured?'nak':'land');
  if(moving.meta.captured||moving.meta.joined||moving.meta.to==='FIN')this.notify(note);
 });
};
App.prototype.render=function(){
 const s=this.state,g=s.game,owner=E.currentPlayer(g),graph=M.makeGraph(g.config.board),human=!owner.ai;
 const roll=this.activeRoll(),opts=s.selectedPiece&&roll?E.moveOptions(g,s.selectedPiece,roll.id):[];
 const selectedOpt=opts.find(o=>o.choice===s.selectedChoice)||opts[0];
 const groups=E.uniqueMovablePieces(g),allowed=roll?new Set(E.legalActions(g,roll.id).map(o=>o.pieceId)):new Set();
 const turnTitle=g.winner!==null?'게임 종료':s.moving?'말이 이동하고 있어요':g.phase==='roll'?(owner.ai?'AI가 윷을 던지는 중':'윷을 던져주세요'):(owner.ai?'AI가 말 선택 중':s.selectedPiece?'이동 경로를 선택하세요':'움직일 말을 선택하세요');
 const statusDesc=g.phase==='roll'?'멍석 안에 윷가락이 모두 떨어져야 유효해요.':g.phase==='move'?'결과 선택 → 말 선택 → 목적지 클릭':`승리: ${g.players[g.winner]?.label||''}`;
 const players=g.players.map(p=>{
  const pcs=g.pieces.filter(x=>x.player===p.id),ready=pcs.filter(x=>x.node==='WAIT').length,done=pcs.filter(x=>x.node==='FIN').length;
  return h('div',{className:cx('player-card',p.id===g.current&&'active'),key:p.id},
    p.id===g.current?h('span',{className:'on-turn'},'현재 차례'):null,
    h('div',{className:'player-main'},h('div',{className:'avatar'},p.avatar),h('div',null,h('div',{className:'player-name',style:{color:p.light}},p.label),h('div',{className:'player-status'},`대기 ${ready} · 완주 ${done} ${p.ai?'· AI':''}`))),
    h('div',{className:'pawns'},...pcs.map((pc,i)=>h('span',{key:i,className:cx('pawn-mini',pc.node==='FIN'&&'done'),style:{'--piece':p.color},title:pc.node==='FIN'?'완주':pc.node==='WAIT'?'대기':'이동 중'})))
  );
 });
 const readyPieces=g.pieces.filter(p=>p.player===g.current&&p.node==='WAIT');
 const rack=readyPieces.map((p,i)=>h('button',{key:p.id,className:cx('rack-piece',allowed.has(p.id)&&human&&'pickable',s.selectedPiece===p.id&&'selected'),disabled:!human||g.phase!=='move'||!allowed.has(p.id)||!!s.moving,onClick:()=>this.selectPiece(p.id),'aria-label':`대기 말 ${p.index+1} 선택`},'♟',h('small',null,`${p.index+1}번 말`)));
 const logViews=g.logs.slice(0,9).map(l=>h('div',{className:'log-line',key:l.id},h('div',{className:'log-icon'},l.player==null?'✦':g.players[l.player]?.avatar||'◈'),h('div',null,h('b',null,l.player==null?'알림':g.players[l.player]?.label),l.text)));
 const rollViews=g.rolls.length?g.rolls.map(r=>h('button',{key:r.id,className:cx('roll-pill',roll&&roll.id===r.id&&'active'),disabled:!human||g.phase!=='move'||!!s.moving,onClick:()=>this.setState({selectedRoll:r.id,selectedPiece:null,selectedChoice:null})},E.NAMES[r.value],h('small',null,r.value===-1?'↶':`${r.value}칸`))):h('div',{className:'no-rolls'},g.phase==='roll'?'아직 던진 결과가 없어요.':'윷 던지기 버튼으로 시작하세요.');
 return h('div',{className:'app-shell'},
  h('div',{className:'ambient-leaves','aria-hidden':true},...Array.from({length:12},(_,i)=>h('i',{className:'ambient-leaf',key:i,style:{'--left':`${6+i*8}%`,'--delay':`${i*-1.6}s`,'--duration':`${14+i%5*2}s`}}))),
  h('div',{className:'app-wrap'},
  h('header',{className:'header'},
   h('div',{className:'brand'},h('div',{className:'brand-seal'},'✦'),h('div',null,h('h1',null,'달빛 윷마당'),h('small',null,'MOONLIT YUT · 직접 움직이는 윷놀이'))),
   h('div',{className:'header-right'},h('span',{className:'head-chip'},`ROUND ${String(g.turn).padStart(2,'0')}`),
    h('button',{className:'header-btn',onClick:()=>this.setState({sound:!s.sound})},s.sound?'♪ 소리 켜짐':'♪ 소리 꺼짐'),
    h('button',{className:'header-btn',onClick:()=>this.setState({settingsOpen:true})},'⚙ 새 게임'))
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
    h('div',{className:'board-top'},h('div',{className:'board-heading'},h('strong',null,`✧ ${g.config.board==='A'?'팔각 순환형':'이중 링형'}`),h('small',null,g.config.board==='A'?'중앙 교차 지름길로 역전하세요':'내선에서 합류하는 단방향 지름길')),
     h('div',{className:'board-switch'},...['A','B'].map(key=>h('button',{key,className:cx('board-choice',g.config.board===key&&'active'),onClick:()=>{if(g.config.board!==key)this.startGame({...g.config,board:key});}},key==='A'?'팔각형':'이중 링')))),
    h('div',{className:'board-shadow'},h('div',{className:'board-cloth'},h(Board,{game:g,chosenRoll:roll,chosenPiece:g.pieces.find(p=>p.id===s.selectedPiece),chosenChoice:s.selectedChoice,onPiece:id=>this.selectPiece(id),onTarget:opt=>this.commitMove(opt,false),moving:s.moving,burst:s.burst}))),
    h('div',{className:'board-cap'},h('span',null,'● 갈림길에 정확히 멈추면 지름길 가능'),h('span',null,'말 선택 후 목적지를 눌러 이동')),
    h('div',{className:'map-sep'}),
    h('div',{className:'throw-top'},h('div',null,h('div',{className:'throw-title'},'✧ 윷 던지는 마당'),h('div',{className:'throw-desc'},'멍석 밖으로 완전히 나가면 낙! 차례가 넘어갑니다.')),h('div',{style:{fontSize:11,color:'#eac78f',fontWeight:850}},g.phase==='move'?'말 이동 중':`${g.players[g.current].label} 차례`)),
    h(ThrowMat,{sticks:s.sticks,stage:s.stage,result:s.result}),
    h('div',{className:'throw-actions'},
     h('button',{className:'primary-action',disabled:!human||g.phase!=='roll'||s.stage==='throwing'||!!s.moving,onClick:()=>this.throwYut('random',false)},s.stage==='throwing'?'✧ 윷가락이 날아갑니다…':g.phase==='move'?'말을 직접 이동해 주세요':g.lastRoll&&(g.lastRoll.value===4||g.lastRoll.value===5)?'✦ 보너스 윷 던지기':'▰▰ 윷 던지기'),
     h('button',{className:'sub-action',disabled:!human||g.phase!=='roll'||s.stage==='throwing'||!!s.moving,onClick:()=>this.throwYut('nak',false)},'낙 시험')),
    h('div',{className:'power-row'},h('span',null,'던지는 힘'),h('input',{type:'range',min:20,max:100,value:s.force,onChange:ev=>this.setState({force:+ev.target.value}),disabled:s.stage==='throwing','aria-label':'던지는 힘'}),h('strong',null,`${s.force}%`),h('em',null,s.force>75?'낙 위험 ↑':' '))
   ),
   h('aside',{className:'panel right-panel'},
    h('div',{className:'action-section'},h('div',{className:'phase-badge'},g.phase==='move'?'◎ MANUAL MOVE':g.phase==='won'?'♛ WINNER':'✦ THROW'),
     h('h2',{className:'step-title'},turnTitle),h('p',{className:'step-desc'},statusDesc),
     h('div',{className:'results-caption'},h('span',null,'사용할 윷 결과'),h('span',null,`${g.rolls.length}개 남음`)),
     h('div',{className:'results'},...Array.isArray(rollViews)?rollViews:[rollViews]),
     s.selectedPiece&&selectedOpt?h('div',{className:'manual-block'},h('div',{className:'manual-title'},'이동 경로를 골라주세요'),
       h('div',{className:'route-buttons'},...opts.map(o=>h('button',{className:cx('route-btn',selectedOpt.choice===o.choice&&'active'),key:o.choice,onClick:()=>this.setState({selectedChoice:o.choice})},o.label))),
       h('p',{className:'target-help'},'윷판의 민트색 목적지를 누르거나 아래 버튼으로 이동을 확정하세요.'),
       h('button',{className:'primary-action',style:{width:'100%',minHeight:35,fontSize:12,marginTop:7},disabled:!!s.moving,onClick:()=>this.commitMove(selectedOpt,false)},`선택한 말 ${E.NAMES[roll?.value]||''} 이동 →`)):
       h('div',{className:'manual-block'},h('div',{className:'manual-title'},'직접 조작 안내'),h('p',{className:'target-help'},g.phase==='move'?'사용할 결과를 고른 뒤 왼쪽 대기 말 또는 윷판의 빛나는 말을 클릭하세요.':g.phase==='roll'?'윷을 던져 도·개·걸·윷·모·빽도 결과를 확인하세요.':'말 4개를 모두 완주시켜 승리하세요.')),
    ),
    h('div',{className:'log-section'},h('div',{className:'side-section-title'},'최근 게임 기록',h('span',null,'LIVE')),h('div',{className:'log-list'},...logViews)),
   )
  ),
  h('div',{className:'footer-copy'},'DALBIT YUT GARDEN  ·  한국의 놀이를 새롭게  ·  1인 AI / 2~4인 로컬 대전'),
  s.toast?h('div',{className:'toast',role:'status'},s.toast):null,
  s.settingsOpen?h('div',{className:'modal-backdrop',role:'presentation',onMouseDown:(ev)=>{if(ev.target===ev.currentTarget)this.setState({settingsOpen:false});}},
   h('div',{className:'modal',role:'dialog','aria-modal':true,'aria-label':'게임 설정'},h('div',{style:{color:'#e5c17d',fontSize:12,fontWeight:900}},'새로운 한 판'),h('h2',null,'달빛 아래 윷놀이'),h('p',null,'모드와 참가 인원을 선택하세요. 1인 모드는 나머지 참가자가 AI입니다.'),
    h('label',{className:'form-label'},'게임 모드'),h('div',{className:'setting-options'},...[['ai','1인 · AI 대전'],['local','2~4인 · 함께하기']].map(([value,text])=>h('button',{key:value,className:cx('setting-btn',s.setup.mode===value&&'active'),onClick:()=>this.setState({setup:{...s.setup,mode:value}})},text))),
    h('label',{className:'form-label'},'총 참가 인원'),h('div',{className:'setting-options',style:{gridTemplateColumns:'repeat(3,1fr)'}},...[2,3,4].map(n=>h('button',{key:n,className:cx('setting-btn',s.setup.count===n&&'active'),onClick:()=>this.setState({setup:{...s.setup,count:n}})},`${n}명`))),
    h('label',{className:'form-label'},'윷놀이판'),h('div',{className:'setting-options'},...[['A','팔각 순환형'],['B','이중 링형']].map(([value,text])=>h('button',{key:value,className:cx('setting-btn',s.setup.board===value&&'active'),onClick:()=>this.setState({setup:{...s.setup,board:value}})},text))),
    h('p',{className:'modal-note'},'규칙: 갈림길 정차 시 지름길, 빽도는 지나온 경로로 후진, 낙은 차례 종료. 직접 말 선택과 목적지 확정이 기본입니다.'),
    h('button',{className:'primary-action',onClick:()=>this.startGame(s.setup)},'이 설정으로 게임 시작')
   )):null,
  g.winner!==null?h('div',{className:'modal-backdrop'},h('div',{className:'modal victory'},h('div',{style:{color:'#f2d098',fontSize:12,textAlign:'center'}},'승부 결정'),h('div',{className:'prize'},'🏆'),h('h2',{style:{textAlign:'center'}},`${g.players[g.winner].label} 승리!`),h('p',{style:{textAlign:'center'}},'네 개의 말을 모두 완주했습니다.'),h('button',{className:'primary-action',onClick:()=>this.startGame(g.config)},'다시 한 판'))):null
 ));
};
function initialSticks(){return [0,1,2,3].map((i)=>({id:i,x:226+i*73,y:78+(i%2)*10,angle:-20+i*19,front:i%2===0,nak:false,delay:0}));}
App.prototype.state={game:E.createGame({mode:'ai',count:2,board:'A'}),setup:{mode:'ai',count:2,board:'A',backdo:true},selectedRoll:null,selectedPiece:null,selectedChoice:null,settingsOpen:false,sound:true,stage:'idle',sticks:initialSticks(),force:55,result:null,moving:null,burst:null,toast:null};
App.prototype.timers=[];
const mount=root.document.getElementById('root');
root.__DALBIT_INSTANCE__ = ReactDOM.render(h(App),mount);
root.__DALBIT_APP__={version:'1.0.0',engine:E,maps:M};
})(window);