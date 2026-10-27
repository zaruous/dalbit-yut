// Preserve valid foreground runs and deterministic landing checks as a reviewable artifact.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'preview-build');
const files=fs.readdirSync(dir).filter(f=>/^throw-.*\.json$/.test(f));
const records=files.map(file=>({file,data:JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))}));
const runs=records.filter(({data:d})=>d.topLevel&&d.profile==='desktop'&&d.width===1600&&d.height===900&&d.results?.every(r=>r.samples.length===6&&r.idle.fps>=10));
const timings=['previous','current'].map(version=>records.filter(({data:d})=>d.profile==='timing-desktop'&&d.version===version&&d.width===1600&&d.height===900).sort((a,b)=>a.data.date.localeCompare(b.data.date)).at(-1));
if(runs.length<4||timings.some(x=>!x))throw Error('Four foreground conditions and two timing checks are required');
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const summary=runs.flatMap(({file,data})=>data.results.map(r=>({file,version:r.version,blur:r.blur,n:r.samples.length,idleFps:r.idle.fps,throwMeanFps:mean(r.samples.map(s=>s.fps)),throwMinFps:Math.min(...r.samples.map(s=>s.fps)),throwMaxFps:Math.max(...r.samples.map(s=>s.fps)),meanP95Ms:mean(r.samples.map(s=>s.p95Ms)),maxFrameMs:Math.max(...r.samples.map(s=>s.maxMs)),framesOver50ms:r.samples.reduce((n,s)=>n+s.over50,0)})));
const report={scope:'Windows Chrome, actual CSS viewport 1600x900, same seeds 400-405, 5 safe + 1 forced nak per condition; rAF scheduling, not GPU presentation tracing',summary,runs,timings,excludedFiles:records.filter(r=>!runs.includes(r)&&!timings.includes(r)).map(r=>r.file)};
fs.writeFileSync(path.join(root,'docs/throw-animation-measurements.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
