/**
 * YUT MAP LAB v3: two deterministic variants with a graph-based move engine.
 * Rules are a proposed house-ruleset, not a claim of one universal folk standard.
 * Physical nodes are unique: O0 is BOTH arrival and exit checkpoint, but WAIT is off-board.
 */
const TYPE_META = {
  A: { title:'팔각 순환형', subtitle:'정통 X자 지름길을 팔각 외곽으로 변형', outerSteps:24 },
  B: { title:'이중 링형', subtitle:'두 분기에서 열린 내선으로 합류하는 일방향 윷판', outerSteps:24 }
};

const outerIds = Array.from({length:24}, (_,i)=>`O${i}`);
const point = (x,y)=>({x:Number(x.toFixed(2)),y:Number(y.toFixed(2))});
function makeOuterCoordinates(){
  const x0=250,y0=235,r=181;
  const corners=Array.from({length:8},(_,i)=>point(x0+r*Math.cos((45-i*45)*Math.PI/180),y0+r*Math.sin((45-i*45)*Math.PI/180)));
  return Object.fromEntries(outerIds.map((id,i)=>{
    const segment=Math.floor(i/3),t=(i%3)/3;
    const a=corners[segment],b=corners[(segment+1)%8];
    return [id,point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)];
  }));
}
function interpolate(a,b,t){return point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)}
function makeGraph(type){
  if(!TYPE_META[type]) throw new Error(`Unknown map ${type}`);
  const xy=makeOuterCoordinates();
  if(type==='A'){
    const c=point(250,235);xy.C=c;
    for(const [prefix,anchor] of [['NE',xy.O6],['NW',xy.O12],['SW',xy.O18],['SE',xy.O0]]){
      xy[`${prefix}1`]=interpolate(anchor,c,1/3);
      xy[`${prefix}2`]=interpolate(anchor,c,2/3);
    }
    // For SW and SE travel center -> corner, so swap order to keep XX1 near center.
    for(const prefix of ['SW','SE']){
      const nearCorner=xy[`${prefix}1`],nearCenter=xy[`${prefix}2`];
      xy[`${prefix}1`]=nearCenter; xy[`${prefix}2`]=nearCorner;
    }
  } else {
    const angles=[-46,-70,-95,-120,-145,178,144,99,52];
    angles.forEach((deg,i)=>{
      const v=deg*Math.PI/180;
      xy[`I${i}`]=point(250+117*Math.cos(v),235+117*Math.sin(v));
    });
    xy.W0=interpolate(xy.O12,xy.I4,.52);
    xy.R1=interpolate(xy.I8,xy.O0,.54);
  }
  const routes=type==='A' ? {
    outer:{ label:'외곽 완주', nodes:[...outerIds,'O0'],note:'지름길을 사용하지 않는 기본 경로' },
    east:{ label:'① 북동 분기', nodes:[...outerIds.slice(0,7),'NE1','NE2','C','SW1','SW2',...outerIds.slice(18),'O0'],note:'북동에서 진입 후 중앙을 통과해 남서로 직진' },
    west:{ label:'② 북서 분기', nodes:[...outerIds.slice(0,13),'NW1','NW2','C','SE1','SE2','O0'],note:'북서에서 진입 후 중앙을 통과해 완주점으로 직진' },
    center:{ label:'중앙 정차 → 전환', nodes:[...outerIds.slice(0,7),'NE1','NE2','C','SE1','SE2','O0'],note:'①번 지름길의 중앙에 정확히 정차한 뒤 다음 이동에서 남동쪽 선택' }
  } : {
    outer:{ label:'외곽 완주', nodes:[...outerIds,'O0'],note:'지름길을 사용하지 않는 기본 경로' },
    east:{ label:'① 내선 진입', nodes:[...outerIds.slice(0,7),'I0','I1','I2','I3','I4','I5','I6','I7','I8','R1','O0'],note:'북동에서 내부 일방향 경로로 진입' },
    west:{ label:'② 내선 합류', nodes:[...outerIds.slice(0,13),'W0','I4','I5','I6','I7','I8','R1','O0'],note:'북서에서 내선의 공유 합류점 I4로 진입' }
  };
  return {type,...TYPE_META[type],xy,outerIds,routes};
}

function initialState(){return { node:'WAIT', lane:'outer', history:[{node:'WAIT',lane:'outer'}], lastPath:[], lastResult:'시작 전' }}
function getOptions(graph,state){
  if(state.node==='O6'||state.node==='O12') return [{value:'outer',label:'바깥길 유지'},{value:'shortcut',label:state.node==='O6'?'① 지름길 진입':'② 지름길 진입'}];
  if(graph.type==='A'&&state.node==='C'&&state.lane==='ne') return [{value:'straight',label:'남서로 직진'},{value:'finish',label:'남동으로 전환'}];
  return [{value:'normal',label:'정해진 방향으로 전진'}];
}
function suggestedOption(options){return options.find(x=>x.value==='shortcut')?.value ?? options.find(x=>x.value==='straight')?.value ?? 'normal'}

function advanceOnce(graph,pos,first,choice){
  const node=pos.node,lane=pos.lane;
  if(node==='WAIT') return {node:'O1',lane:'outer'};
  if(node==='FIN') return {node:'FIN',lane};
  if(node==='O0')return {node:'FIN',lane:'complete'};
  if(/^O\d+$/.test(node)){
    const i=Number(node.slice(1));
    if((i===6||i===12)&&first&&choice==='shortcut'){
      if(graph.type==='A')return i===6?{node:'NE1',lane:'ne'}:{node:'NW1',lane:'nw'};
      return i===6?{node:'I0',lane:'ring'}:{node:'W0',lane:'ring'};
    }
    return {node:`O${(i+1)%24}`,lane:'outer'};
  }
  if(graph.type==='A'){
    const next={NE1:'NE2',NE2:'C',NW1:'NW2',NW2:'C',SW1:'SW2',SW2:'O18',SE1:'SE2',SE2:'O0'};
    if(node==='C'){
      if(lane==='ne' && first && choice==='finish') return {node:'SE1',lane:'se'};
      return lane==='ne'?{node:'SW1',lane:'sw'}:{node:'SE1',lane:'se'};
    }
    if(next[node]) return {node:next[node],lane};
  } else {
    if(node==='W0')return {node:'I4',lane:'ring'};
    if(node==='R1')return {node:'O0',lane:'ring'};
    if(/^I\d+$/.test(node)){
      const n=Number(node.slice(1));return {node:n===8?'R1':`I${n+1}`,lane:'ring'};
    }
  }
  throw new Error(`Bad transition ${graph.type} ${node} (${lane})`);
}

/** One move takes an integer number of pips. Back-do = -1. Choices only at starting node. */
function movePiece(graph,oldState,pips,choice){
  if(!Number.isInteger(pips)||pips<-1||pips===0||pips>5)throw new Error('pips must be -1 or 1..5');
  if(oldState.node==='FIN')return {...oldState,lastPath:[],lastResult:'이미 완주했습니다'};
  const state={...oldState,history:oldState.history.map(item=>({...item})),lastPath:[]};
  const validChoices=getOptions(graph,state).map(o=>o.value);
  if(pips>0 && choice && !validChoices.includes(choice)) throw new Error(`Invalid choice ${choice} for ${state.node}`);
  if(pips===-1){
    if(state.history.length<2)return {...state,lastResult:'판에 말이 없어 빽도를 사용할 수 없습니다'};
    const prev=state.node;
    state.history.pop();const last=state.history.at(-1);
    state.node=last.node;state.lane=last.lane;
    state.lastPath=[prev,state.node];state.lastResult=`빽도: ${prev} → ${state.node}`;
    return state;
  }
  const selected=choice||suggestedOption(getOptions(graph,state));
  state.lastPath=[state.node];
  for(let step=0;step<pips;step++){
    const pos=advanceOnce(graph,{node:state.node,lane:state.lane},step===0,selected);
    state.node=pos.node;state.lane=pos.lane;
    state.history.push({...pos});
    state.lastPath.push(pos.node);
    if(pos.node==='FIN')break;
  }
  state.lastResult=`${pips}칸 이동: ${state.lastPath.join(' → ')}`;
  return state;
}

function countRouteSteps(route){return route.nodes.length-1}
function validateGraph(graph){
  const errors=[];
  for(const [key,route] of Object.entries(graph.routes)){
    if(route.nodes[0]!=='O0'||route.nodes.at(-1)!=='O0')errors.push(`route ${key} must start and end at O0`);
    for(const id of route.nodes)if(!graph.xy[id])errors.push(`missing coordinate ${id}`);
    const seen=new Set();
    for(const id of route.nodes.slice(1,-1)){
      if(seen.has(id))errors.push(`cycle in ${key} at ${id}`); seen.add(id);
    }
  }
  return errors;
}

window.YutMaps = {makeGraph, initialState, getOptions, suggestedOption, movePiece, countRouteSteps, validateGraph};