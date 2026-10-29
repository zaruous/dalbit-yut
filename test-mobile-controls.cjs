// Render-tree checks only; this does not replace mobile browser visual review.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const E=require('./build-test/gameEngine.js');
function app(){
 const window={location:{search:''}};
 window.React={Component:class{setState(value,done){Object.assign(this.state,value);done?.();}},createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)})};
 window.ReactDOM={render:node=>new node.type(node.props)};
 const code=ts.transpileModule(fs.readFileSync('src-ts/App.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{window,document:{getElementById:()=>({})},exports:{},URLSearchParams,console,setTimeout,clearTimeout,require:name=>require('./build-test/'+name.replace('./',''))});
 return window.__DALBIT_INSTANCE__;
}
function nodes(tree,className){
 if(!tree||typeof tree!=='object')return [];
 return [...((tree.props?.className||'').split(' ').includes(className)?[tree]:[]),...(tree.children||[]).flatMap(child=>nodes(child,className))];
}
test('mobile top controls select rolls and on-board stacks without moving a human piece',()=>{
 const instance=app(),g=E.createGame({board:'S',mode:'local'});
 g.phase='move';g.rolls=[{id:'one',value:1,faces:[false,true,false,false]},{id:'two',value:2,faces:[true,true,false,false]}];
 const own=g.pieces.filter(p=>p.player===g.current);
 own[0].node=own[1].node='O3';
 instance.state.game=g;
 const before=JSON.stringify(g),tree=instance.render(),panel=nodes(tree,'board-panel')[0];
 assert(panel.children.indexOf(nodes(tree,'mobile-action-dock')[0])<panel.children.indexOf(nodes(tree,'board-shadow')[0]));
 const pieces=nodes(tree,'mobile-rack-chip');assert.equal(pieces.length,3);
 const stack=pieces.find(p=>p.props['aria-label'].includes('업기'));assert(stack&&!stack.props.disabled);
 stack.props.onClick();assert.equal(instance.state.selectedPiece,own[0].id);
 assert.equal(JSON.stringify(g),before);
 const rolls=nodes(instance.render(),'mobile-roll-chip');assert.equal(rolls.length,2);
 rolls[1].props.onClick();assert.equal(instance.state.selectedRoll,'two');assert.equal(instance.state.selectedPiece,null);
 assert.equal(JSON.stringify(g),before);
 g.players[g.current].ai=true;
 assert(nodes(instance.render(),'mobile-rack-chip').every(p=>p.props.disabled));
 assert(nodes(instance.render(),'mobile-roll-chip').every(p=>p.props.disabled));
});
test('hamburger functions close the menu without changing the live game',()=>{
 const instance=app(),before=JSON.stringify(instance.state.game),menu=nodes(instance.render(),'mobile-game-menu')[0];
 assert.equal(menu.type,'details');
 const nativeMenu={open:true,querySelector:()=>({focus:()=>{}})};
 const click={currentTarget:{closest:()=>nativeMenu}};
 const items=nodes(menu,'mobile-menu-item');
 items.find(item=>item.children.some(text=>typeof text==='string'&&text.includes('소리 끄기'))).props.onClick(click);
 assert.equal(instance.state.sound,false);assert.equal(nativeMenu.open,false);
 nativeMenu.open=true;
 items.find(item=>item.children.some(text=>typeof text==='string'&&text.includes('새 게임'))).props.onClick(click);
 assert.equal(instance.state.settingsOpen,true);assert.equal(nativeMenu.open,false);
 nativeMenu.open=true;
 menu.props.onKeyDown({key:'Escape',currentTarget:nativeMenu});assert.equal(nativeMenu.open,false);
 assert.equal(JSON.stringify(instance.state.game),before);
});
test('settings keep close/start outside scrolling content and cancel without restarting',()=>{
 const instance=app(),before=JSON.stringify(instance.state.game);
 instance.state.settingsOpen=true;
 const dialog=nodes(instance.render(),'settings-modal')[0];
 assert.equal(dialog.props.role,'dialog');
 const header=nodes(dialog,'settings-header')[0],body=nodes(dialog,'settings-body')[0],footer=nodes(dialog,'settings-footer')[0];
 assert(dialog.children.includes(header)&&dialog.children.includes(body)&&dialog.children.includes(footer));
 assert.equal(nodes(body,'settings-close').length,0);
 assert.equal(nodes(body,'primary-action').length,0);
 const extra=nodes(body,'settings-extra')[0];assert.equal(extra.type,'details');assert(!extra.props.open);
 nodes(body,'setting-btn').find(button=>button.children.includes('AI 관전')).props.onClick();
 assert.equal(instance.state.setup.mode,'spectate');assert.equal(JSON.stringify(instance.state.game),before);
 nodes(header,'settings-close')[0].props.onClick();
 assert.equal(instance.state.settingsOpen,false);assert.equal(JSON.stringify(instance.state.game),before);
});
