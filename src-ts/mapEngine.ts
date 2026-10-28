/** Deterministic Yutnori graphs: standard square and optional custom maps. */
export const BOARD_TYPES = ['S','A','B','G'] as const;
export type BoardType = typeof BOARD_TYPES[number];
export type Lane = 'outer' | 'ne' | 'nw' | 'sw' | 'se' | 'ring' | 'spiral' | 'complete';
export type MoveChoice = 'outer' | 'shortcut' | 'straight' | 'finish' | 'normal' | 'back';
export interface Point { x: number; y: number }
export interface BoardMeta { title: string; subtitle: string; outerSteps: number }
export interface BoardRoute { label: string; nodes: string[]; note: string }
export interface BoardGraph extends BoardMeta {
  type: BoardType;
  xy: Record<string, Point>;
  outerIds: string[];
  cornerIds: [string,string,string,string];
  routes: Record<string, BoardRoute>;
}
export interface PieceStep { node: string; lane: Lane }
export interface PiecePath extends PieceStep {
  history: PieceStep[];
  lastPath: string[];
  lastResult: string;
}
export interface RouteChoice { value: MoveChoice; label: string }

/**
 * Standard square plus deterministic variants with a graph-based move engine.
 * Rules are a proposed house-ruleset, not a claim of one universal folk standard.
 * Physical nodes are unique: O0 is BOTH arrival and exit checkpoint, but WAIT is off-board.
 */
const TYPE_META: Record<BoardType, BoardMeta> = {
  S: { title:'기본 윷판', subtitle:'사각 외곽 · 중앙 X자 지름길', outerSteps:20 },
  A: { title:'팔각 순환형', subtitle:'정통 X자 지름길을 팔각 외곽으로 변형', outerSteps:24 },
  B: { title:'이중 링형', subtitle:'두 분기에서 열린 내선으로 합류하는 일방향 윷판', outerSteps:24 },
  G: { title:'돌담 나선정원', subtitle:'3중 나선 돌담길 · 모 자리 협문 지름길 · 중심 완주', outerSteps:25 }
};

export function boardMeta(type: BoardType): BoardMeta{return TYPE_META[type];}
const point = (x: number,y: number): Point=>({x:Number(x.toFixed(2)),y:Number(y.toFixed(2))});
export const SPIRAL_LAP: [number,number][]=[[438,412],[438,58],[62,58],[62,412],[368,412],[368,128],[132,128],[132,342],[298,342],[298,198],[202,198],[202,236],[250,236]];
export const SPIRAL_WALL: [number,number][]=[[403,444],[403,93],[97,93],[97,377],[333,377],[333,163],[167,163],[167,307],[263,307],[263,262]];
export const SPIRAL_OUTER_WALL: [number,number][]=[[470,404],[470,26],[30,26],[30,444],[403,444]];
export const SPIRAL_GATES=[
  {from:'O5',to:'O17',id:'G0',via:point(279,93),name:'① 첫모문 진입',short:'첫모 ①',color:'#a33c3d',horizontal:true},
  {from:'O10',to:'O21',id:'G1',via:point(100,352),name:'② 뒷모문 진입',short:'뒷모 ②',color:'#395987',horizontal:false},
  {from:'O15',to:'O23',id:'G2',via:point(333,248),name:'③ 찌모문 진입',short:'찌모 ③',color:'#b7833c',horizontal:false},
  {from:'O20',to:'C',id:'G3',via:point(170,283),name:'④ 넷모문 진입',short:'넷모 ④',color:'#3f7053',horizontal:false}
] as const;
export function roundedPolyline(corners: [number,number][],radius=24): Point[]{
  const out: Point[]=[point(corners[0][0],corners[0][1])];
  for(let i=1;i<corners.length-1;i++){
    const [a,b,d]=[corners[i-1],corners[i],corners[i+1]];
    const l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(d[0]-b[0],d[1]-b[1]);
    const r=Math.min(radius,l1/2,l2/2);
    const p=[b[0]+(a[0]-b[0])*r/l1,b[1]+(a[1]-b[1])*r/l1],q=[b[0]+(d[0]-b[0])*r/l2,b[1]+(d[1]-b[1])*r/l2];
    out.push(point(p[0],p[1]));
    for(let t=1;t<12;t++){const s=t/12;out.push(point((1-s)*(1-s)*p[0]+2*(1-s)*s*b[0]+s*s*q[0],(1-s)*(1-s)*p[1]+2*(1-s)*s*b[1]+s*s*q[1]));}
    out.push(point(q[0],q[1]));
  }
  out.push(point(corners[corners.length-1][0],corners[corners.length-1][1]));
  return out;
}
function makeOuterCoordinates(type: BoardType,outerIds: string[]): Record<string, Point>{
  if(type==='G'){
    const track=roundedPolyline(SPIRAL_LAP,24);
    const acc=[0];
    for(let i=1;i<track.length;i++)acc.push(acc[i-1]+Math.hypot(track[i].x-track[i-1].x,track[i].y-track[i-1].y));
    const total=acc[acc.length-1],steps=TYPE_META.G.outerSteps;
    const xy: Record<string, Point>={};
    for(let k=0;k<=steps;k++){
      const s=total*k/steps;let j=1;
      while(j<acc.length-1&&acc[j]<s)j++;
      const t=(s-acc[j-1])/((acc[j]-acc[j-1])||1);
      xy[k===steps?'C':`O${k}`]=point(track[j-1].x+(track[j].x-track[j-1].x)*t,track[j-1].y+(track[j].y-track[j-1].y)*t);
    }
    return xy;
  }
  const x0=250,y0=235,r=181;
  const corners=type==='S'?[point(420,405),point(420,65),point(80,65),point(80,405)]:Array.from({length:8},(_,i)=>point(x0+r*Math.cos((45-i*45)*Math.PI/180),y0+r*Math.sin((45-i*45)*Math.PI/180)));
  const perSide=outerIds.length/corners.length;
  return Object.fromEntries(outerIds.map((id,i)=>{
    const segment=Math.floor(i/perSide),t=(i%perSide)/perSide;
    const a=corners[segment],b=corners[(segment+1)%corners.length];
    return [id,point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)];
  }));
}
function interpolate(a: Point,b: Point,t: number): Point{return point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)}
export function makeGraph(type: BoardType): BoardGraph{
  if(!TYPE_META[type]) throw new Error(`Unknown map ${type}`);
  const outerIds=Array.from({length:TYPE_META[type].outerSteps},(_,i)=>`O${i}`);
  const cornerIds: BoardGraph['cornerIds']=type==='S'||type==='G'?['O0','O5','O10','O15']:['O0','O6','O12','O18'];
  const [home,ne,nw,sw]=cornerIds;
  const xy: Record<string, Point>=makeOuterCoordinates(type,outerIds);
  if(type==='G'){
    for(const g of SPIRAL_GATES)xy[g.id]=g.via;
    const routes: Record<string, BoardRoute>={
      outer:{ label:'나선 돌담길 완주', nodes:[...outerIds,'C'],note:'지름길을 사용하지 않고 중심 달빛정자로 들어가는 기본 경로' },
      gate1:{ label:'① 첫모문 진입', nodes:[...outerIds.slice(0,6),'G0',...outerIds.slice(17),'C'],note:'첫모(O5)에서 외곽 돌담문을 통과해 O17로 진입' },
      gate2:{ label:'② 뒷모문 진입', nodes:[...outerIds.slice(0,11),'G1',...outerIds.slice(21),'C'],note:'뒷모(O10)에서 이끼 중문을 통과해 O21로 진입' },
      gate3:{ label:'③ 찌모문 진입', nodes:[...outerIds.slice(0,16),'G2',...outerIds.slice(23),'C'],note:'찌모(O15)에서 안뜰 협문을 통과해 O23으로 진입' },
      gate4:{ label:'④ 넷모문 진입', nodes:[...outerIds.slice(0,21),'G3','C'],note:'넷모(O20)에서 정자 다리를 건너 중심 달빛정자로 진입' },
      shortest:{ label:'최단 협문 연쇄', nodes:['O0','O1','O2','O3','O4','O5','G0','O17','O18','O19','O20','G3','C'],note:'첫모문과 넷모문을 연달아 통과하는 12칸 최단 경로' }
    };
    return {type,...TYPE_META[type],xy,outerIds,cornerIds,routes};
  }
  if(type!=='B'){
    const c=point(250,235);xy.C=c;
    for(const [prefix,anchor] of ([['NE',xy[ne]],['NW',xy[nw]],['SW',xy[sw]],['SE',xy[home]]] as Array<[string,Point]>)){
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
  const neIndex=outerIds.indexOf(ne),nwIndex=outerIds.indexOf(nw),swIndex=outerIds.indexOf(sw);
  const routes: Record<string, BoardRoute>=type!=='B' ? {
    outer:{ label:'외곽 완주', nodes:[...outerIds,'O0'],note:'지름길을 사용하지 않는 기본 경로' },
    east:{ label:'① 북동 분기', nodes:[...outerIds.slice(0,neIndex+1),'NE1','NE2','C','SW1','SW2',...outerIds.slice(swIndex),'O0'],note:'북동에서 진입 후 중앙을 통과해 남서로 직진' },
    west:{ label:'② 북서 분기', nodes:[...outerIds.slice(0,nwIndex+1),'NW1','NW2','C','SE1','SE2','O0'],note:'북서에서 진입 후 중앙을 통과해 완주점으로 직진' },
    center:{ label:'중앙 정차 → 전환', nodes:[...outerIds.slice(0,neIndex+1),'NE1','NE2','C','SE1','SE2','O0'],note:'①번 지름길의 중앙에 정확히 정차한 뒤 다음 이동에서 남동쪽 선택' }
  } : {
    outer:{ label:'외곽 완주', nodes:[...outerIds,'O0'],note:'지름길을 사용하지 않는 기본 경로' },
    east:{ label:'① 내선 진입', nodes:[...outerIds.slice(0,7),'I0','I1','I2','I3','I4','I5','I6','I7','I8','R1','O0'],note:'북동에서 내부 일방향 경로로 진입' },
    west:{ label:'② 내선 합류', nodes:[...outerIds.slice(0,13),'W0','I4','I5','I6','I7','I8','R1','O0'],note:'북서에서 내선의 공유 합류점 I4로 진입' }
  };
  return {type,...TYPE_META[type],xy,outerIds,cornerIds,routes};
}

export function initialState(): PiecePath{return { node:'WAIT', lane:'outer', history:[{node:'WAIT',lane:'outer'}], lastPath:[], lastResult:'시작 전' }}
export function getOptions(graph: BoardGraph,state: Pick<PiecePath, 'node'|'lane'>): RouteChoice[]{
  if(graph.type==='G'){
    const gate=SPIRAL_GATES.find(g=>g.from===state.node);
    if(gate)return [{value:'outer',label:'바깥 돌담길 유지'},{value:'shortcut',label:gate.name}];
    return [{value:'normal',label:'정해진 방향으로 전진'}];
  }
  if(state.node===graph.cornerIds[1]||state.node===graph.cornerIds[2]) return [{value:'outer',label:'바깥길 유지'},{value:'shortcut',label:state.node===graph.cornerIds[1]?'① 지름길 진입':'② 지름길 진입'}];
  if(graph.type!=='B'&&state.node==='C'&&state.lane==='ne') return [{value:'straight',label:'남서로 직진'},{value:'finish',label:'남동으로 전환'}];
  return [{value:'normal',label:'정해진 방향으로 전진'}];
}
export function suggestedOption(options: RouteChoice[]): MoveChoice{return options.find(x=>x.value==='shortcut')?.value ?? options.find(x=>x.value==='finish')?.value ?? options[0]?.value ?? 'normal'}

function advanceOnce(graph: BoardGraph,pos: PieceStep,first: boolean,choice: MoveChoice): PieceStep{
  const node=pos.node,lane=pos.lane;
  if(node==='WAIT') return {node:'O1',lane:'outer'};
  if(node==='FIN') return {node:'FIN',lane};
  if(graph.type==='G'){
    if(node==='C'||node==='O0')return {node:'FIN',lane:'complete'};
    const gateByFrom=SPIRAL_GATES.find(g=>g.from===node);
    if(gateByFrom&&first&&choice==='shortcut')return {node:gateByFrom.id,lane:'spiral'};
    const gateById=SPIRAL_GATES.find(g=>g.id===node);
    if(gateById)return {node:gateById.to,lane:'outer'};
    if(/^O\d+$/.test(node)){
      const i=Number(node.slice(1));
      return {node:i===24?'C':`O${i+1}`,lane:'outer'};
    }
    throw new Error(`Bad transition ${graph.type} ${node} (${lane})`);
  }
  if(node==='O0')return {node:'FIN',lane:'complete'};
  if(/^O\d+$/.test(node)){
    const i=Number(node.slice(1));
    if((node===graph.cornerIds[1]||node===graph.cornerIds[2])&&first&&choice==='shortcut'){
      if(graph.type!=='B')return node===graph.cornerIds[1]?{node:'NE1',lane:'ne'}:{node:'NW1',lane:'nw'};
      return node===graph.cornerIds[1]?{node:'I0',lane:'ring'}:{node:'W0',lane:'ring'};
    }
    return {node:`O${(i+1)%graph.outerIds.length}`,lane:'outer'};
  }
  if(graph.type!=='B'){
    const next={NE1:'NE2',NE2:'C',NW1:'NW2',NW2:'C',SW1:'SW2',SW2:graph.cornerIds[3],SE1:'SE2',SE2:'O0'};
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
export function movePiece(graph: BoardGraph,oldState: PiecePath,pips: number,choice?: MoveChoice): PiecePath{
  if(!Number.isInteger(pips)||pips<-1||pips===0||pips>5)throw new Error('pips must be -1 or 1..5');
  if(oldState.node==='FIN')return {...oldState,lastPath:[],lastResult:'이미 완주했습니다'};
  const state: PiecePath={...oldState,history:oldState.history.map(item=>({...item})),lastPath:[]};
  const validChoices=getOptions(graph,state).map(o=>o.value);
  if(pips>0 && choice && !validChoices.includes(choice)) throw new Error(`Invalid choice ${choice} for ${state.node}`);
  if(pips===-1){
    if(state.history.length<2)return {...state,lastResult:'판에 말이 없어 빽도를 사용할 수 없습니다'};
    const prev=state.node;
    if(prev==='O1'&&state.history.at(-2)?.node==='WAIT'){
      // Reverse onto the on-board finish checkpoint, never back into the reserve.
      // Seed the map's outer approach so further back-do moves follow its last nodes.
      if(graph.type==='G'){
        state.history=[{node:'WAIT',lane:'outer'},...graph.outerIds.slice(1).map(node=>({node,lane:'outer' as const})),{node:'C',lane:'outer'}];
      }else{
        state.history=[{node:'WAIT',lane:'outer'},...graph.outerIds.slice(1).map(node=>({node,lane:'outer' as const})),{node:'O0',lane:'outer'}];
      }
    }else state.history.pop();
    const last=state.history.at(-1)!;
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

export function countRouteSteps(route: BoardRoute): number{return route.nodes.length-1}
export function validateGraph(graph: BoardGraph): string[]{
  const errors: string[]=[];
  const endNode=graph.type==='G'?'C':'O0';
  for(const [key,route] of Object.entries(graph.routes)){
    if(route.nodes[0]!=='O0'||route.nodes.at(-1)!==endNode)errors.push(`route ${key} must start at O0 and end at ${endNode}`);
    for(const id of route.nodes)if(!graph.xy[id])errors.push(`missing coordinate ${id}`);
    const seen=new Set<string>();
    for(const id of route.nodes.slice(1,-1)){
      if(seen.has(id))errors.push(`cycle in ${key} at ${id}`); seen.add(id);
    }
  }
  return errors;
}
