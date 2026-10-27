// Collect reproducible AI turn diagnostics; rejects incomplete/failed audit inputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'preview-build');
const read=file=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
function latest(prefix){const files=fs.readdirSync(dir).filter(f=>f.startsWith(prefix)&&f.endsWith('.json')).sort();assert(files.length,'Missing '+prefix);return read(files.at(-1))}
const engine=read('ai-turn-engine-audit.json'),browser=latest('throw-ai-turn-browser-'),live=latest('throw-ai-turn-live-');
for(const data of [engine,browser,live]){assert(!data.error,data.error);assert.equal(data.violations.length,0)}
assert.equal(browser.games,6);assert(live.realTime&&live.throws>=20);
const earned=data=>data.bonusYut+data.bonusMo+data.bonusCapture;
const accounting={engine:{turnStarts:engine.games+engine.turns,bonusThrows:earned(engine),actualThrows:engine.throws},browser:{turnStarts:browser.configurations.reduce((sum,c)=>sum+c.turns,0),bonusThrows:earned(browser),actualThrows:browser.throws},live:{turnStarts:live.configurations.reduce((sum,c)=>sum+c.turns,0),bonusThrows:earned(live),actualThrows:live.throws}};
for(const name of ['engine','browser'])assert.equal(accounting[name].turnStarts+accounting[name].bonusThrows,accounting[name].actualThrows,'Unaccounted throw in '+name);
accounting.live.unspentCredit=accounting.live.turnStarts+accounting.live.bonusThrows-accounting.live.actualThrows;
assert.equal(accounting.live.unspentCredit,live.trace.at(-1).nextPhase==='roll'?1:0,'Unaccounted live throw');
const files=['src-ts/App.tsx','src-ts/gameEngine.ts','src-ts/aiEngine.ts','build-test/gameEngine.js','build-test/aiEngine.js'];
const sources=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const report={date:new Date().toISOString(),scope:'No production gameplay changes. All seats controlled by current search AI, not Laya. Two maps and 2/3/4 players; engine simulation + actual mounted React controller + native-timer animation sample.',sources,accounting,engine,browser,live};
fs.writeFileSync(path.join(root,'docs/ai-turn-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({engineGames:engine.games,engineThrows:engine.throws,browserGames:browser.games,browserThrows:browser.throws,liveThrows:live.throws,violations:0,accounting},null,2));
