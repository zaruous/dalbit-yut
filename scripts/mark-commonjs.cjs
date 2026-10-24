const fs=require('node:fs');
fs.writeFileSync('build-test/package.json', JSON.stringify({type:'commonjs'}));
