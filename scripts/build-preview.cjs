// Builds a standalone preview.html (works via file://) from compiled src-ts. Usage: node scripts/build-preview.cjs [out]
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),rd=p=>fs.readFileSync(path.join(root,p),'utf8');
const out=path.resolve(root,process.argv[2]||process.env.OUT||'preview.html');
// Invoke the JS entry point directly: .bin/tsc is a shell shim on Windows.
const tsc=require.resolve('typescript/bin/tsc');
execFileSync(process.execPath,[tsc,'-p','tsconfig.static.json'],{cwd:root,stdio:'inherit'});
const MIME={'.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
const dataUri=f=>{const p=path.join(root,'public',f);return fs.existsSync(p)&&MIME[path.extname(f)]?`data:${MIME[path.extname(f)]};base64,${fs.readFileSync(p).toString('base64')}`:null};
const inlineUrls=css=>css.replace(/url\((['"]?)\/([^'")]+)\1\)/g,(m,q,f)=>{const d=dataUri(f);return d?`url("${d}")`:m});
const safe=s=>s.replace(/<\/script/gi,'<\\/script');
// Wrap each ES module in a function scope; imports become references to earlier module namespaces.
const ns=f=>'__mod_'+path.basename(f,'.js').replace(/\W/g,'_');
const wrap=f=>{const names=[];let src=fs.readFileSync(path.join(root,'build-static',f),'utf8')
 .replace(/^import \* as (\w+) from '\.\/([\w.]+)';$/gm,(m,id,dep)=>`const ${id}=${ns(dep)};`)
 .replace(/^import \{([^}]+)\} from '\.\/([\w.]+)';$/gm,(m,ids,dep)=>`const {${ids}}=${ns(dep)};`)
 .replace(/^export \{([^}]+)\};$/gm,(m,ids)=>{names.push(...ids.split(',').map(s=>s.trim()).filter(Boolean));return ''})
 .replace(/^export (async function|function|const|let|var|class) (\w+)/gm,(m,kw,id)=>{names.push(id);return `${kw} ${id}`});
 if(/^\s*(import|export)\b/m.test(src))throw new Error('Unsupported import/export in '+f);
 return `const ${ns(f)}=(()=>{'use strict';\n${src}\nreturn {${names.join(',')}};\n})();`};
const css=['src-ts/styles.css','src-ts/theme-cinematic.css','src-ts/quality-v1.css'].map(f=>inlineUrls(rd(f))).join('\n');
const js=['mapEngine.js','gameEngine.js','aiEngine.js','layaCandidates.js','App.js'].map(wrap).join('\n');
const head=rd('index.html').match(/<head>([\s\S]*?)<\/head>/)[1]
 .replace(/\s*<link rel="stylesheet"[^>]*>/g,'').replace(/\s*<script[^>]*><\/script>/g,'')
 .replace(/href="(?:\/|\.\/)([^"]+)"/g,(m,f)=>{const d=dataUri(f);return d?`href="${d}"`:m});
const html=`<!doctype html><html lang="ko"><head>${head}<style>${css}</style></head><body><audio id="dalbit-bgm" src="${dataUri('audio/moonlit-porch.mp3')}" loop preload="none"></audio><div id="root"></div>
<script>${safe(rd('public/react.production.min.js'))}</script>
<script>${safe(rd('public/react-dom.production.min.js'))}</script>
<script>${safe(js)}</script></body></html>`;
fs.writeFileSync(out,html);console.log('Wrote '+path.relative(process.cwd(),out)+' ('+Math.round(html.length/1024)+' KB)');
