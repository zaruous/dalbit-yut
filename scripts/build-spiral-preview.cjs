// 돌담 나선정원 — standalone in-game preview rebuilt in the current DALBIT YUT design language.
// Static concept only: it does not change the playable graphs in src-ts/mapEngine.ts.
// Usage: node scripts/build-spiral-preview.cjs  → public/spiral-preview.html
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const OUT = path.join(root, 'public/spiral-preview.html');

/* ---------- 1. Spiral graph geometry (board viewBox 500 x 470, same as Board in App.tsx) ---------- */
// Square spiral with a constant 70px lap gap. Start at the bottom-right 어귀, move up (counter-clockwise),
// and curl inward three laps to the central 달빛정자 (node 25 = 완주).
const LAP = [[438,412],[438,58],[62,58],[62,412],[368,412],[368,128],[132,128],[132,342],[298,342],[298,198],[202,198],[202,236],[250,236]];
const r1 = n => Math.round(n * 10) / 10;
function rounded(c, R) {
  const out = [c[0]];
  for (let i = 1; i < c.length - 1; i++) {
    const [a, b, d] = [c[i-1], c[i], c[i+1]];
    const l1 = Math.hypot(b[0]-a[0], b[1]-a[1]), l2 = Math.hypot(d[0]-b[0], d[1]-b[1]);
    const r = Math.min(R, l1/2, l2/2);
    const p = [b[0]+(a[0]-b[0])*r/l1, b[1]+(a[1]-b[1])*r/l1], q = [b[0]+(d[0]-b[0])*r/l2, b[1]+(d[1]-b[1])*r/l2];
    out.push(p);
    for (let t = 1; t < 12; t++) { const s = t/12; out.push([(1-s)*(1-s)*p[0]+2*(1-s)*s*b[0]+s*s*q[0], (1-s)*(1-s)*p[1]+2*(1-s)*s*b[1]+s*s*q[1]]); }
    out.push(q);
  }
  out.push(c[c.length-1]);
  return out;
}
const track = rounded(LAP, 24);
const acc = [0];
for (let i = 1; i < track.length; i++) acc.push(acc[i-1] + Math.hypot(track[i][0]-track[i-1][0], track[i][1]-track[i-1][1]));
const TOTAL = acc[acc.length-1];
const STEPS = 25;
const N = Array.from({length: STEPS+1}, (_, k) => {
  const s = TOTAL*k/STEPS; let j = 1;
  while (j < acc.length-1 && acc[j] < s) j++;
  const t = (s-acc[j-1])/((acc[j]-acc[j-1])||1);
  return [r1(track[j-1][0]+(track[j][0]-track[j-1][0])*t), r1(track[j-1][1]+(track[j][1]-track[j-1][1])*t)];
});
const pathD = pts => 'M' + pts.map(p => `${r1(p[0])} ${r1(p[1])}`).join(' L');

// 모(5칸) 자리마다 돌담 협문. Each shortcut passes one gate node (G#) set into the wall between laps.
const GATES = [
  {from:5,  to:17, via:[279,93],  name:'첫모문', sub:'외곽 돌담문', color:'#a33c3d'},
  {from:10, to:21, via:[100,352], name:'뒷모문', sub:'이끼 중문',   color:'#395987'},
  {from:15, to:23, via:[333,248], name:'찌모문', sub:'안뜰 협문',   color:'#b7833c'},
  {from:20, to:25, via:[170,283], name:'넷모문', sub:'정자 다리',   color:'#3f7053'}
];
// Shortest route = 0→5 (5) + 첫모문 (2) + 17→20 (3) + 넷모문 (2).
const SHORTEST = 5 + 2 + 3 + 2;

// Stone walls (돌담): 35px inside the lap so each wall sits exactly between two corridors.
const WALL = [[403,444],[403,93],[97,93],[97,377],[333,377],[333,163],[167,163],[167,307],[263,307],[263,262]];
const OUTER_WALL = [[470,404],[470,26],[30,26],[30,444],[403,444]]; // opening at the bottom-right 출발 어귀

/* ---------- 2. Demo game state ---------- */
const PLAYERS = [
  {name:'나',     role:'내 플레이어',   color:'#eca14d', avatar:'🐕', ai:false, pieces:[5,5,2,'WAIT']},
  {name:'청월 AI', role:'인공지능 상대', color:'#6daefb', avatar:'🐰', ai:true,  pieces:[11,13,'WAIT','WAIT']},
  {name:'초록 AI', role:'인공지능 상대', color:'#55c77f', avatar:'🐯', ai:true,  pieces:[22,8,'WAIT','FIN']}
];
const SELECTED_NODE = 5;          // 내 말 2개(업힘)가 첫모 자리에 정확히 정차
const MOVE = [5, 'G0', 17, 18];   // 걸(3칸) + 첫모문 진입 → 18번 자리

/* ---------- 3. Board SVG (mirrors the Board component's materials and classes) ---------- */
const xy = id => typeof id === 'string' && id[0] === 'G' ? GATES[+id.slice(1)].via : N[id];
function piece(x, y, color, number, selected) {
  return `<g class="piece-handle${selected ? ' selected' : ''}" transform="translate(${x} ${y})">
  <ellipse class="piece-floor-shadow" cx="0" cy="16" rx="17" ry="6" fill="#2d1a10" opacity=".34"/>
  <circle class="piece-halo" cx="0" cy="0" r="23" fill="none" stroke="${selected ? '#ffe4a1' : '#604129'}" stroke-width="${selected ? 4 : 1.5}"${selected ? ' stroke-dasharray="7 4"' : ''}/>
  <rect x="-13" y="-1" width="26" height="17" rx="8" fill="#43281c" stroke="#2b180e" stroke-width="1.2"/>
  <rect x="-12" y="-4" width="24" height="17" rx="8" fill="${color}" stroke="#fff4dd" stroke-width="1.2"/>
  <ellipse cx="0" cy="7" rx="13" ry="7.5" fill="${color}" stroke="#4b2b20" stroke-width="1.3"/>
  <ellipse cx="0" cy="-8" rx="11" ry="10" fill="${color}" stroke="#fff0d1" stroke-width="2"/>
  <ellipse cx="0" cy="-8" rx="10" ry="9" fill="url(#tokenEnamel)"/>
  <ellipse cx="-3.3" cy="-10" rx="4.8" ry="3" fill="#fff9df" opacity=".65"/>
  <circle cx="0" cy="-8" r="2.5" fill="#fff1cf" opacity=".6"/>
  ${number > 1 ? `<g><circle cx="15" cy="-14" r="10.5" fill="#33251d" stroke="#ffdd94" stroke-width="1.8"/><text x="15" y="-10" text-anchor="middle" font-size="11" font-weight="900" fill="#ffe7b9">${number}</text></g>` : ''}
  ${selected ? `<g class="selected-piece-label"><rect x="-27" y="-40" width="54" height="19" rx="8" fill="#55301c" stroke="#ffdc8f" stroke-width="1.4"/><text x="0" y="-27" text-anchor="middle" font-size="11">선택한 말</text></g>` : ''}
</g>`;
}
function node(x, y, kind) {
  const big = kind === 'goal' ? 14 : kind === 'fork' ? 13 : kind === 'gate' ? 7.5 : 9;
  const cls = kind === 'gate' ? 'inner' : kind;
  return `<g>${kind === 'goal' ? `<circle cx="${x}" cy="${y}" r="${big+6}" fill="none" stroke="#7fb9a1" stroke-width="1" stroke-dasharray="3 4"/>` : ''}
  <ellipse cx="${x}" cy="${y+2}" rx="${big+1.8}" ry="${big+1}" fill="#593c21" opacity=".2"/>
  <circle cx="${x}" cy="${y}" r="${big+1.5}" fill="url(#boardBrass)" stroke="#9d7845" stroke-width=".6"/>
  <circle class="node-circle ${cls}" cx="${x}" cy="${y}" r="${big}"/>
  <circle class="node-engraving" cx="${x}" cy="${y}" r="${big-2}"/>
  ${kind === 'fork' ? `<circle cx="${x}" cy="${y}" r="3.5" fill="#ba7142"/>` : ''}
  ${kind === 'goal' ? `<text x="${x}" y="${y+4}" text-anchor="middle" font-size="10" font-weight="900" fill="#f4f3cf">출</text>` : ''}</g>`;
}
function landmark(x, y, color, r = 21) {
  return `<g class="board-landmark"><ellipse cx="${x}" cy="${y+3}" rx="${r+1}" ry="${r}" fill="#593c21" opacity=".22"/>
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#boardBrass)" stroke="#73502e" stroke-width="1"/>
  <circle cx="${x}" cy="${y}" r="${r-2.5}" fill="#3a2c23" stroke="#fff0bc" stroke-width=".8"/>
  <circle cx="${x}" cy="${y}" r="${r-5.5}" fill="${color}" stroke="#e1bd7a" stroke-width="1"/>
  <circle cx="${x}" cy="${y}" r="${r-6}" fill="url(#tokenEnamel)"/>
  ${Array.from({length:12}, (_, i) => { const a = i*Math.PI/6; return `<circle cx="${r1(x+(r-4)*Math.cos(a))}" cy="${r1(y+(r-4)*Math.sin(a))}" r=".55" fill="#efd599"/>`; }).join('')}</g>`;
}
// 협문: the wall opens at the gate node and two tile-capped stone pillars frame the passage.
const gateArch = ([x, y], horizontalWall) => {
  const pillar = (px, py) => `<rect x="${px-5}" y="${py-5}" width="10" height="10" rx="1.5" fill="#8a7a63" stroke="#4d3f2f" stroke-width=".8"/><path d="M${px-6.5} ${py-4}h13" stroke="#3f4a46" stroke-width="3" stroke-linecap="round"/>`;
  const [dx, dy] = horizontalWall ? [16, 0] : [0, 16];
  return `<g aria-hidden="true"><rect x="${x-(horizontalWall ? 13 : 8)}" y="${y-(horizontalWall ? 8 : 13)}" width="${horizontalWall ? 26 : 16}" height="${horizontalWall ? 16 : 26}" fill="#f2e3c3"/>${pillar(x-dx, y-dy)}${pillar(x+dx, y+dy)}</g>`;
};
function wallPath(pts, extra = '') {
  const d = pathD(pts);
  return `<path d="${d}" stroke="#7e7262" stroke-width="13" opacity=".42" ${extra}/>
  <path d="${d}" stroke="#cbbd9f" stroke-width="9" stroke-dasharray="11 3" opacity=".75" ${extra}/>
  <path d="${d}" stroke="#8f826d" stroke-width="9" stroke-dasharray="1 13" stroke-dashoffset="-6" opacity=".55" ${extra}/>`;
}
function boardSvg() {
  const trail = MOVE.map(xy);
  const dest = trail[trail.length-1];
  const stacks = new Map();
  PLAYERS.forEach((p, pi) => p.pieces.forEach(n => { if (typeof n !== 'number') return; const k = pi+'-'+n; stacks.set(k, {pi, n, count:(stacks.get(k)?.count||0)+1}); }));
  const gateNodes = new Set(GATES.map(g => g.from));
  return `<svg class="board-svg" viewBox="0 0 500 470" shape-rendering="geometricPrecision" role="img" aria-label="돌담 나선정원 윷판 미리보기">
<defs>
  <radialGradient id="paperFill" cx=".36" cy=".26" r=".85"><stop offset="0" stop-color="#fff9e9"/><stop offset=".6" stop-color="#f1e2c2"/><stop offset="1" stop-color="#d6bd92"/></radialGradient>
  <linearGradient id="boardWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6c4930"/><stop offset=".35" stop-color="#38251a"/><stop offset=".7" stop-color="#583b27"/><stop offset="1" stop-color="#261c15"/></linearGradient>
  <linearGradient id="boardBrass" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff0bd"/><stop offset=".25" stop-color="#d1a35b"/><stop offset=".5" stop-color="#9a7039"/><stop offset=".73" stop-color="#e9cc8e"/><stop offset="1" stop-color="#8a5d2e"/></linearGradient>
  <radialGradient id="nodeIvory" cx=".32" cy=".24" r=".85"><stop offset="0" stop-color="#fffcf0"/><stop offset=".65" stop-color="#f4e5c5"/><stop offset="1" stop-color="#c6aa77"/></radialGradient>
  <radialGradient id="nodeAmber" cx=".3" cy=".22" r=".9"><stop offset="0" stop-color="#fff0b9"/><stop offset=".6" stop-color="#e2b464"/><stop offset="1" stop-color="#986630"/></radialGradient>
  <radialGradient id="nodeJade" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#a4c6a2"/><stop offset=".55" stop-color="#58816a"/><stop offset="1" stop-color="#2d5042"/></radialGradient>
  <radialGradient id="nodeObsidian" cx=".32" cy=".22" r=".85"><stop offset="0" stop-color="#73543e"/><stop offset=".55" stop-color="#443326"/><stop offset="1" stop-color="#2b231e"/></radialGradient>
  <radialGradient id="tokenEnamel" cx=".28" cy=".18" r=".9"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".48" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#23170c" stop-opacity=".35"/></radialGradient>
  <radialGradient id="mossCourt" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fb58f" stop-opacity=".55"/><stop offset="1" stop-color="#9fb58f" stop-opacity="0"/></radialGradient>
  <pattern id="grain" width="37" height="31" patternUnits="userSpaceOnUse"><path d="M2 7l5-1m11 17 7-2M29 5l3 1M8 28l4-1" stroke="#94764b" stroke-width=".4" opacity=".16"/><path d="M3 8l5-1m11 17 7-2M7 17l9-1" stroke="#fffef0" stroke-width=".65" opacity=".6"/><circle cx="31" cy="18" r=".45" fill="#856842" opacity=".16"/></pattern>
  <pattern id="boardEdgeGrain" width="80" height="12" patternUnits="userSpaceOnUse"><path d="M0 3Q20 0 40 3T80 3M0 9Q20 6 40 9T80 9" fill="none" stroke="#d5aa6a" stroke-width=".45" opacity=".17"/></pattern>
</defs>
<rect x="2" y="2" width="496" height="466" rx="7" fill="url(#boardWood)"/>
<rect x="2" y="2" width="496" height="466" rx="7" fill="url(#boardEdgeGrain)"/>
<rect x="7" y="7" width="486" height="456" rx="5" fill="none" stroke="#edcd8c" stroke-width=".65" opacity=".7"/>
<rect x="16" y="16" width="468" height="438" rx="3" fill="url(#boardBrass)" stroke="#241c13" stroke-width="1.2"/>
<rect x="21" y="21" width="458" height="428" rx="2" fill="url(#paperFill)" stroke="#fff2ca" stroke-width="1"/>
<rect x="21" y="21" width="458" height="428" rx="2" fill="url(#grain)"/>
<g class="board-craft-detail" aria-hidden="true">${[{x:16,y:16,r:0},{x:484,y:16,r:90},{x:484,y:454,r:180},{x:16,y:454,r:270}].map(c => `<g transform="translate(${c.x} ${c.y}) rotate(${c.r})"><path d="M0 29V0h29v5H5v24Z" fill="url(#boardBrass)" stroke="#624522" stroke-width=".6"/><path d="M9 27V9h18M13 23V13h10" fill="none" stroke="#a17b43" stroke-width=".7"/><circle cx="2.5" cy="2.5" r="1" fill="#fff3c6"/></g>`).join('')}</g>

<!-- 이끼 안뜰 + 수묵 장식 (경로 가독성을 해치지 않는 낮은 농도) -->
<g class="board-ink-scenes" aria-hidden="true">
  <ellipse cx="250" cy="236" rx="78" ry="62" fill="url(#mossCourt)"/>
  <g fill="none" stroke="#7d6955" stroke-width="1.2" opacity=".3">
    <path d="M196 386q14-10 28 0 12-8 24 0M300 388q12-9 24 0 10-7 20 0"/>
    <path d="M118 108q10-14 24-4 9-12 23-2M322 106q12-12 25-2 11-10 22 0"/>
  </g>
</g>

<!-- 돌담: 외곽 담장(출발 어귀가 열림) + 회랑 사이 나선 담장 -->
<g fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  ${wallPath(OUTER_WALL)}
  ${wallPath(WALL)}
</g>
${GATES.map((g, i) => gateArch(g.via, i === 0)).join('')}

<!-- 이동로: 정통판과 같은 상아 인레이 + 먹선 -->
<path d="${pathD(track)}" class="route-inlay"/>
${GATES.map(g => `<path d="${pathD([N[g.from], g.via, N[g.to]])}" class="route-inlay"/>`).join('')}
<path d="${pathD(track)}" class="route-line" fill="none"/>
${GATES.map(g => `<path d="${pathD([N[g.from], g.via, N[g.to]])}" class="route-inner" fill="none" stroke-dasharray="5 4"/>`).join('')}
${[2, 7, 12, 19, 22].map(i => { const [a, b] = [N[i], N[i+1]]; const ang = r1(Math.atan2(b[1]-a[1], b[0]-a[0])*180/Math.PI); return `<path d="M-4-4L1 0-4 4" fill="none" stroke="#7a5c3c" stroke-width="2" opacity=".6" transform="translate(${r1((a[0]+b[0])/2)} ${r1((a[1]+b[1])/2)}) rotate(${ang})"/>`; }).join('')}

<!-- 출발 어귀 · 모 협문 · 달빛정자 -->
${landmark(N[0][0], N[0][1], '#3f7053', 23)}
${GATES.map(g => landmark(N[g.from][0], N[g.from][1], g.color, 24)).join('')}
<g class="board-landmark">
  <circle cx="250" cy="236" r="31" fill="none" stroke="#b38a51" stroke-width="1" stroke-dasharray="3 4"/>
  <circle cx="250" cy="236" r="26" fill="url(#boardBrass)" stroke="#73502e"/>
  <circle cx="250" cy="236" r="23" fill="url(#nodeObsidian)" stroke="#deb66f" stroke-width="1.6"/>
  <g transform="translate(250 232) scale(.62)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-26 21h52" stroke="#e8c98a" stroke-width="3"/><path d="M-17 18v-22M17 18v-22" stroke="#e8c98a" stroke-width="3.4"/>
    <path d="M-31 -6Q-15 -12 0 -24q15 12 31 18L22 -2H-22Z" fill="#f2d79a" stroke="#fff3cc" stroke-width="1.4"/>
  </g>
</g>
${N.map((p, i) => i === 25 ? '' : node(p[0], p[1], i === 0 ? 'goal' : gateNodes.has(i) ? 'fork' : 'normal')).join('')}
${GATES.map(g => node(g.via[0], g.via[1], 'gate')).join('')}

<g class="board-label">
  <text x="${N[0][0]}" y="${N[0][1]-34}" text-anchor="middle" class="board-label">출발 어귀</text>
  <text x="${N[5][0]+30}" y="${N[5][1]+4}" text-anchor="start" class="board-label">첫모 ①</text>
  <text x="${N[10][0]+4}" y="${N[10][1]+38}" text-anchor="start" class="board-label">뒷모 ②</text>
  <text x="${N[15][0]+29}" y="${N[15][1]+4}" text-anchor="start" class="board-label">찌모 ③</text>
  <text x="${N[20][0]}" y="${N[20][1]-30}" text-anchor="middle" class="board-label">넷모 ④</text>
  <text x="250" y="281" text-anchor="middle" class="board-label">달빛정자 · 완주</text>
</g>

<!-- 선택한 경로: 번호 경유점 + 금빛 목적지 -->
<path d="${pathD(trail)}" class="movement-trail"/>
${trail.slice(1, -1).map(([x, y], i) => `<g class="target-waypoint"><circle cx="${x}" cy="${y}" r="9.5" fill="#644124" stroke="#ffe1a0" stroke-width="1.5"/><text x="${x}" y="${y+3.4}" text-anchor="middle" font-weight="900" font-size="10" fill="#fff2c7">${i+1}</text></g>`).join('')}
${[...stacks.values()].filter(s => !(s.pi === 0 && s.n === SELECTED_NODE)).map(s => piece(N[s.n][0], N[s.n][1], PLAYERS[s.pi].color, s.count, false)).join('')}
${piece(N[SELECTED_NODE][0], N[SELECTED_NODE][1], PLAYERS[0].color, 2, true)}
<g class="board-target" role="button" tabindex="0" aria-label="강조 표시된 목적지로 이동">
  <circle class="target-waves" cx="${dest[0]}" cy="${dest[1]}" r="30" fill="#ffe4a3" opacity=".2"/>
  <circle class="target-outer" cx="${dest[0]}" cy="${dest[1]}" r="23" fill="#f8d58f" stroke="#fff4cc" stroke-width="2.7" stroke-dasharray="5 4"/>
  <circle cx="${dest[0]}" cy="${dest[1]}" r="17" fill="#5c3c27" stroke="#ffc864" stroke-width="2.2"/>
  <text x="${dest[0]}" y="${dest[1]+4.5}" text-anchor="middle" font-size="10.5" font-weight="900" fill="#fff1c8">이동</text>
</g>
</svg>`;
}

/* ---------- 4. Throw mat (same markup as ThrowMat, 걸 result) ---------- */
function throwMat() {
  const faces = [true, true, true, false];
  const sticks = [0,1,2,3].map(i => ({x:226+i*73, y:78+(i%2)*10, angle:-20+i*19, front:faces[i]}));
  const marks = [-23, -7, 9];
  const rendered = sticks.map((st, i) => `<g transform="translate(${st.x} ${st.y})" class="yutstick">
   <g transform="rotate(${st.angle})"><ellipse class="stick-shadow" cx="3" cy="14" rx="43" ry="9" fill="#24130d" opacity=".36"/></g>
   <g class="stick-flight"><g class="stick-arc"><g transform="rotate(${st.angle})">
    <rect x="-44" y="-12" width="88" height="27" rx="10" fill="#3e1b13" stroke="#ffe5a2" stroke-width="1.5"/>
    <path d="M-41 -8L-37 -14H33L41 -8H-41Z" fill="#f5c985" stroke="#ffe5b3" stroke-width="1"/>
    <rect x="-41" y="-10" width="82" height="23" rx="8" fill="${st.front ? 'url(#yutWoodFace)' : 'url(#yutWoodBack)'}" stroke="#fce2a5" stroke-width="1.2"/>
    <path d="M-36 -5Q-9 -7 37 -4M-36 5Q0 3 34 6M-20 -9Q-24 2 -18 12M13 -9Q17 -1 13 12" stroke="#7a3b20" opacity=".22" stroke-width="1.3" fill="none"/>
    ${st.front ? `<g stroke="#502b21" stroke-width="2.7" stroke-linecap="round">${marks.map(z => `<path d="M${z-4} -5l8 10 M${z+4} -5l-8 10"/>`).join('')}</g>` : '<path d="M-24 0H23" stroke="#8b532e" stroke-width="2.7" stroke-linecap="round"/>'}
    <path d="M-31 -7L23 -7" fill="none" stroke="#fff8d7" stroke-width="1.3" opacity=".56"/>
    ${i === 0 ? '<circle cx="33" cy="0" r="3.6" fill="#b64b39" stroke="#f8e2a8" stroke-width="1"/>' : ''}
   </g></g></g></g>`).join('');
  return `<div class="throw-sandbox cinematic-throw">
  <div class="throw-etched-cloud throw-etched-cloud-left" aria-hidden="true">☁</div>
  <div class="throw-etched-cloud throw-etched-cloud-right" aria-hidden="true">☁</div>
  <div class="throw-ripple"></div>
  <svg class="mat-svg mat-sticks" viewBox="0 0 690 160" preserveAspectRatio="xMidYMid meet" aria-label="멍석 위의 윷가락 네 개">
   <defs>
    <radialGradient id="matGlow" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#a27649" stop-opacity=".55"/><stop offset=".7" stop-color="#5b3522" stop-opacity=".53"/><stop offset="1" stop-color="#211710" stop-opacity=".24"/></radialGradient>
    <linearGradient id="yutWoodFace" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff2bc"/><stop offset=".27" stop-color="#eaba77"/><stop offset=".65" stop-color="#bc7d44"/><stop offset="1" stop-color="#8e512b"/></linearGradient>
    <linearGradient id="yutWoodBack" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe6ac"/><stop offset=".4" stop-color="#eec48a"/><stop offset="1" stop-color="#b67f4c"/></linearGradient>
   </defs>
   <ellipse cx="329" cy="85" rx="268" ry="60" fill="#261510" opacity=".38"/>
   <rect x="65" y="7" width="520" height="136" rx="56" class="throw-mat-boundary" fill="url(#matGlow)" stroke="#d2a86b" stroke-width="3.3" stroke-dasharray="4 4"/>
   <rect x="73" y="15" width="504" height="120" rx="50" fill="none" stroke="#ffe0aa" stroke-width="1.1" opacity=".65"/>
   <ellipse cx="325" cy="75" rx="194" ry="54" fill="none" stroke="#f6cb79" stroke-width="1.3" stroke-dasharray="4 11" opacity=".58"/>
   <ellipse cx="325" cy="75" rx="164" ry="44" fill="none" stroke="#f5c66b" stroke-width="1.7" opacity=".48" class="throw-energy-circle"/>
   <ellipse cx="325" cy="76" rx="133" ry="39" fill="none" stroke="#ffe1a0" stroke-width="1.3" stroke-dasharray="7 7" opacity=".43"/>
   <text x="108" y="78" class="mat-label">DALBIT</text><text x="546" y="78" text-anchor="end" class="mat-label">YUT</text>
   <g class="sticks-shadow">${rendered}</g>
  </svg>
  <div class="throw-stage-caption" aria-hidden="true"><span>✦</span><span>윷 결과를 확인하고 내 말을 선택하세요</span><span>✦</span></div>
  <div class="result-orb visible" aria-live="polite"><span class="result-small">윷 결과</span><strong>걸</strong><span class="result-small">말을 이동하세요</span></div>
</div>`;
}

/* ---------- 5. Page shell (same DOM/classes as App.render) ---------- */
function playerCard(p, i) {
  const done = p.pieces.filter(n => n === 'FIN').length, ready = p.pieces.filter(n => n === 'WAIT').length;
  return `<div class="player-card${i === 0 ? ' active' : ''} player-${i}" style="--player-accent:${p.color}">
   <div class="player-hanji-pattern" aria-hidden="true">✿</div>
   <div class="player-main">
    <div class="avatar-coin"><div class="avatar">${p.avatar}</div></div>
    <div class="player-identity"><div class="player-name">${p.name}</div><div class="player-role">${p.role}</div>
     <div class="pawns">${p.pieces.map(n => `<span class="pawn-mini${n === 'FIN' ? ' done' : ''}" style="--piece:${p.color}" title="${n === 'FIN' ? '완주' : n === 'WAIT' ? '대기' : '이동 중'}"></span>`).join('')}</div>
     <div class="player-progress" aria-label="${done}개 완주"><div class="player-progress-fill" style="width:${done*25}%"></div></div></div>
    <div class="player-right">${i === 0 ? '<span class="on-turn">● 내 차례</span>' : '<span class="player-tag">AI</span>'}<div class="player-status">${done > 0 ? `${done}/4 완주` : `대기 ${ready}개`}</div></div>
   </div></div>`;
}
const logs = [
  ['🐕', '나', '모! 첫모(5)에 정확히 정차 · 한 번 더 던집니다.'],
  ['🐯', '초록 AI', '넷모문을 지나 달빛정자에 완주했습니다.'],
  ['🐰', '청월 AI', '외곽 돌담길 13번 자리로 이동했습니다.'],
  ['✦', '알림', '돌담 나선정원 윷놀이가 시작되었습니다.']
];
const css = ['styles.css', 'theme-cinematic.css', 'quality-v1.css']
  .map(f => `/* ${f} */\n` + fs.readFileSync(path.join(root, 'src-ts', f), 'utf8'))
  .join('\n')
  // Relative asset URLs keep the page working under the GitHub Pages base (/dalbit-yut/).
  .replace(/url\((['"]?)\/(?!\/)/g, 'url($1');

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#341d18">
<title>돌담 나선정원 — 인게임 미리보기 | 달빛 윷마당</title>
<meta name="description" content="달빛 윷마당 신규 지형 시안: 3중 나선 돌담길과 모 자리 협문 지름길. 실제 게임 화면 디자인으로 재구성한 정적 미리보기.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>
${css}
/* ---- spiral preview only ---- */
.preview-ribbon{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:30;display:flex;gap:10px;align-items:center;padding:7px 9px 7px 15px;border-radius:999px;border:1px solid #e0aa68cf;background:#22151bec;box-shadow:0 8px 22px #0009;font-size:11.5px;color:#f4dcb4;white-space:nowrap}
.preview-ribbon b{color:#ffe3ae}
.preview-ribbon a{color:#2d1a10;background:linear-gradient(#fff3c2,#f2af59);border-radius:999px;padding:5px 11px;font-weight:900;text-decoration:none}
.board-choice.concept{border-style:dashed}
.spiral-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}
.spiral-facts div{border:1px solid #d2a16c57;border-radius:9px;padding:7px 6px;background:#5d403b33;text-align:center}
.spiral-facts small{display:block;font-size:10px;color:#dfc4ad}
.spiral-facts b{font-size:17px;color:#fff0cb}
.gate-legend{display:grid;gap:5px;margin-top:10px;font-size:11px;color:#efd8b8}
.gate-legend span{display:flex;align-items:center;gap:7px}
.gate-legend i{width:11px;height:11px;border-radius:50%;border:1.5px solid #f1cf8d;flex:none}
.app-wrap{padding-bottom:58px}@media(max-width:700px){.preview-ribbon{font-size:10.5px;bottom:8px}.preview-ribbon span{display:none}}
</style>
</head>
<body>
<div id="root"><div class="app-shell">
 <div class="ambient-leaves" aria-hidden="true">${Array.from({length:12}, (_, i) => `<i class="ambient-leaf" style="--left:${6+i*8}%;--delay:${i*-1.6}s;--duration:${14+i%5*2}s"></i>`).join('')}</div>
 <div class="app-wrap">
  <header class="header">
   <div class="brand"><div class="brand-mark"><strong>달빛 윷마당</strong><span class="brand-seal">시안</span></div><div class="brand-sub">한옥 마루에서 즐기는 우리들의 한 판</div></div>
   <div class="header-right"><span class="head-chip">제 6 턴</span><a class="header-btn watch-entry" href="map-concepts/index.html" style="text-decoration:none">지도첩</a><button class="header-btn icon-button" aria-label="소리">♫</button><button class="header-btn icon-button" aria-label="설정">⚙</button></div>
  </header>
  <main class="layout">
   <aside class="panel side player-panel">
    <div class="side-section-title">지금은 누구 차례?<span>나 + AI 2명</span></div>
    <div class="turn-hero"><div class="eyebrow">CURRENT TURN</div><div class="turn-name"><span class="turn-dot" style="background:${PLAYERS[0].color}"></span>나</div><div class="turn-sub">첫모 자리에 멈춘 말이 돌담 협문을 통과할 수 있어요.</div></div>
    <div class="side-section-title">참가자<span>각 4개의 말</span></div>
    <div class="players-list">${PLAYERS.map(playerCard).join('')}</div>
    <div class="subpanel"><div class="rack-title"><b>출발 대기 말</b><span>1개</span></div><div class="rack"><button class="rack-piece pickable" aria-label="대기 말 4 선택"><span class="rack-token" style="--piece:${PLAYERS[0].color}">♟</span><small>4번 말</small></button></div></div>
    <div class="subpanel tips-block"><div class="side-section-title">나선정원 규칙</div>
     <div class="tiny-guide"><b>1</b><p class="tips">출발 어귀에서 돌담길을 따라 안쪽으로 감아 듭니다.</p></div>
     <div class="tiny-guide"><b>2</b><p class="tips">5·10·15·20번 모 자리에 정확히 멈추면 협문이 열립니다.</p></div>
     <div class="tiny-guide"><b>3</b><p class="tips">중심 달빛정자에 닿으면 완주합니다.</p></div>
    </div>
   </aside>
   <section class="panel board-panel">
    <div class="board-top"><div class="board-heading"><strong>✿ 돌담 나선정원</strong><small>3중 나선 돌담길 · 모 자리 협문 지름길 · 중심 완주</small></div>
     <div class="board-switch"><button class="board-choice">기본판</button><button class="board-choice">팔각형</button><button class="board-choice">이중 링</button><button class="board-choice concept active" aria-pressed="true">나선정원</button></div></div>
    <div class="board-shadow"><div class="board-cloth"><div class="frame-charm frame-charm-left" aria-hidden="true">❖</div><div class="frame-charm frame-charm-right" aria-hidden="true">❖</div>
${boardSvg()}
    </div></div>
    <div class="board-cap"><span>✦ 모 자리(5·10·15·20)에 정확히 정차하면 협문 지름길</span><span>말 선택 → 황금색 목적지 클릭</span></div>
    <div class="map-sep"></div>
    <div class="throw-top"><div><div class="throw-title">✦ 달빛 멍석 · 윷 던지기</div><div class="throw-desc">네 가락이 멍석 경계 안에 걸쳐야 유효 · 완전히 밖이면 낙</div></div><div style="font-size:11px;color:#eac78f;font-weight:850">말 이동 중</div></div>
${throwMat()}
    <div class="throw-actions"><button class="primary-action throw-main-button" disabled><span class="throw-icon">♢</span>말을 이동해 주세요<span class="button-ornament">❖</span></button><button class="sub-action" disabled>낙 시연</button></div>
   </section>
   <aside class="panel right-panel">
    <div class="action-section"><div class="phase-badge">✦ 직접 말 이동</div>
     <h2 class="step-title">이동 경로를 선택하세요</h2><p class="step-desc">결과 선택 → 말 선택 → 목적지 클릭</p>
     <div class="move-steps"><div class="move-step is-done"><small>01</small><b>윷 결과</b></div><div class="move-step"><small>02</small><b>말 선택</b></div><div class="move-step is-current"><small>03</small><b>도착점</b></div></div>
     <div class="results-caption"><span>사용할 윷 결과</span><span>2개 남음</span></div>
     <div class="results"><button class="roll-pill active">걸<small>3칸</small></button><button class="roll-pill">개<small>2칸</small></button></div>
     <div class="manual-block is-ready"><div class="manual-title">✦ 이동 경로를 선택하세요</div>
      <div class="route-buttons"><button class="route-btn">바깥 돌담길 유지</button><button class="route-btn active">① 첫모문 진입</button></div>
      <p class="target-help">첫모문을 지나 안쪽 회랑 18번 자리로 이동합니다. 윷판의 금빛 도착점을 누르세요.</p>
      <button class="primary-action" style="width:100%;min-height:44px;font-size:13px;margin-top:11px">✦ 걸 · 선택한 말 이동 확정</button></div>
     <div class="spiral-facts"><div><small>기본 경로</small><b>${STEPS}</b><small>칸</small></div><div><small>최단 경로</small><b>${SHORTEST}</b><small>칸</small></div><div><small>협문</small><b>${GATES.length}</b><small>곳</small></div></div>
     <div class="gate-legend">${GATES.map(g => `<span><i style="background:${g.color}"></i>${g.name} · ${g.from}번 → ${g.to === 25 ? '정자' : g.to + '번'} <small style="color:#cdb08c">(${g.sub})</small></span>`).join('')}</div>
    </div>
    <div class="log-section"><div class="side-section-title">게임 기록<span>LIVE</span></div><div class="log-list">${logs.map(([icon, who, text]) => `<div class="log-line"><div class="log-icon">${icon}</div><div class="log-content"><b>${who}</b><span>${text}</span></div></div>`).join('')}</div></div>
   </aside>
  </main>
  <div class="footer-copy">DALBIT YUT · 돌담 나선정원 시안 · 실제 게임 규칙/그래프에는 아직 적용되지 않은 정적 미리보기</div>
 </div>
</div></div>
<div class="preview-ribbon"><b>미리보기</b><span>정적 시안 화면입니다 · 버튼은 동작하지 않습니다</span><a href="map-concepts/index.html">← 지도첩</a></div>
</body>
</html>
`;
fs.writeFileSync(OUT, html);
console.log(`Wrote ${path.relative(root, OUT)} — ${STEPS} steps, shortest ${SHORTEST}, step ≈ ${r1(TOTAL/STEPS)}px`);
GATES.forEach(g => console.log(`  ${g.name}: ${g.from} [${N[g.from]}] → via [${g.via}] → ${g.to} [${N[g.to]}]`));
