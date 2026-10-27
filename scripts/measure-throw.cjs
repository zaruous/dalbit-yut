// Local, visible-browser benchmark. Does not change production sources.
// node scripts/measure-throw.cjs -> open http://127.0.0.1:4178
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const previous = '1931602';
const current = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8'}).trim();
const cache = new Map();
// Read the historical tree in one operation, rather than spawning git per request.
const historical = execFileSync('git',['archive','--format=tar',previous,'index.html','src-ts'],{cwd:root,maxBuffer:16e6,timeout:30000});
for(let offset=0;offset+512<=historical.length;){
  const header=historical.subarray(offset,offset+512);
  const name=header.subarray(0,100).toString().replace(/\0.*$/s,'');
  if(!name)break;
  const size=parseInt(header.subarray(124,136).toString().replace(/\0.*$/s,'').trim()||'0',8);
  if(header[156]!==53)cache.set('previous/'+name,historical.subarray(offset+512,offset+512+size).toString('utf8'));
  offset+=512+Math.ceil(size/512)*512;
}
function source(version, file) {
  const key = version + '/' + file;
  if (!cache.has(key)) cache.set(key, version === 'previous'
    ? execFileSync('git', ['show', `${previous}:${file}`], {cwd:root, encoding:'utf8', maxBuffer:8e6})
    : fs.readFileSync(path.join(root,file), 'utf8'));
  return cache.get(key);
}
http.createServer((req,res) => {
  if(!['127.0.0.1:4178','localhost:4178'].includes(req.headers.host)){res.writeHead(403);res.end('Local benchmark only');return;}
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/results') {
    const allowedOrigins=['http://127.0.0.1:4178','http://localhost:4178','http://127.0.0.1:5173','http://localhost:5173'];
    if(req.headers.origin&&!allowedOrigins.includes(req.headers.origin)){res.writeHead(403);res.end('Local benchmark origin required');return;}
    let body = '',bytes=0;
    req.on('data', chunk => {bytes+=chunk.length;if(bytes>1048576){res.writeHead(413);res.end('Result too large');req.destroy();return;}body+=chunk;});
    req.on('end', () => {
      if(res.writableEnded)return;
      try {
        const data = JSON.parse(body);
        if(typeof data.profile!=='string'||!/^[a-z0-9-]{1,40}$/.test(data.profile))throw Error('Invalid profile');
        fs.mkdirSync(path.join(root,'preview-build'), {recursive:true});
        const file = path.join(root,'preview-build',`throw-${data.profile}-${Date.now()}.json`);
        fs.writeFileSync(file, JSON.stringify({current,previous,...data},null,2));
        console.log('Saved ' + file);
        res.end('saved');
      } catch(e) {res.writeHead(400);res.end(String(e));}
    });
    return;
  }
  try {
    let text, mime = 'text/html';
    if (url.pathname === '/') text = fs.readFileSync(path.join(__dirname,'throw-benchmark.html'),'utf8');
    else if (url.pathname === '/benchmark-runtime.js') {text=fs.readFileSync(path.join(__dirname,'throw-benchmark-runtime.js'),'utf8');mime='text/javascript';}
    else if (/^\/variant\/(current|previous)\/$/.test(url.pathname)) {
      const version = url.pathname.split('/')[2];
      text = source(version,'index.html').replaceAll('/src-ts/', `/variant/${version}/`).replace('App.tsx','App.js');
      if(url.searchParams.has('measure'))text=text.replace('</body>','<script defer src="/benchmark-runtime.js"></script></body>');
    } else if (/^\/variant\/(current|previous)\/[\w.-]+$/.test(url.pathname)) {
      const [, ,version,name] = url.pathname.split('/');
      if (name.endsWith('.css')) {text = source(version,'src-ts/'+name);mime='text/css';}
      else {
        const file = name === 'App.js' ? 'App.tsx' : name.replace(/\.js$/,'.ts');
        text = ts.transpileModule(source(version,'src-ts/'+file), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
        mime='text/javascript';
      }
    } else {
      const target = path.resolve(root,'public','.'+url.pathname);
      if (!target.startsWith(path.join(root,'public')+path.sep)) throw Error('Invalid asset');
      text = fs.readFileSync(target);
      mime = ({'.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'})[path.extname(target)] || 'application/octet-stream';
    }
    res.writeHead(200, {'Content-Type':mime,'Cache-Control':'no-store'});res.end(text);
  } catch(e) {res.writeHead(500);res.end(String(e));}
}).listen(4178,'127.0.0.1',()=>console.log(`Throw benchmark: http://127.0.0.1:4178 (current ${current}, previous ${previous})`));
