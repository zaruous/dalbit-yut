const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { LayaWorker, chooseLayaAction, candidatesFor } = require('./laya-client.cjs');

const port = Number(process.env.LAYA_PORT || 3005);
const modelPath = process.env.LAYA_MODEL || path.resolve(__dirname, '../laya-data/checkpoint-rollout-1500');
const pythonPath = process.env.LAYA_PYTHON || path.resolve(__dirname, '../.venv-laya/Scripts/python.exe');
const device = process.env.LAYA_DEVICE || 'cuda';

process.env.LAYA_MODEL = modelPath;
process.env.LAYA_PYTHON = pythonPath;
process.env.LAYA_DEVICE = device;
process.env.LAYA_INPUT_VERSION = process.env.LAYA_INPUT_VERSION || 'v2';
process.env.LAYA_MAX_LEN = process.env.LAYA_MAX_LEN || '1024';
process.env.LAYA_HEAD_MAX_LEN = process.env.LAYA_HEAD_MAX_LEN || '512';

// SQLite Database Setup
const dbPath = path.resolve(__dirname, '../laya-data/dalbit_matches.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    match_id TEXT PRIMARY KEY,
    board TEXT,
    mode TEXT,
    winner INTEGER,
    total_turns INTEGER,
    model TEXT,
    started_at TEXT,
    ended_at TEXT,
    logs_json TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS ai_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT,
    turn INTEGER,
    player INTEGER,
    board TEXT,
    rolls_json TEXT,
    state_preview TEXT,
    candidates_json TEXT,
    chosen_action_json TEXT,
    source TEXT,
    confidence REAL,
    inference_ms REAL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

console.log(`[Laya Server] SQLite Database connected at: ${dbPath}`);
console.log(`[Laya Server] Initializing worker with model: ${modelPath}`);
console.log(`[Laya Server] Device: ${device}, Python: ${pythonPath}`);

const worker = new LayaWorker({
  command: pythonPath,
  startupMs: 120000,
  decisionMs: 15000,
});

let isReady = false;
let runtimeInfo = null;

worker.ready.then(info => {
  isReady = true;
  runtimeInfo = info;
  console.log(`[Laya Server] Laya worker is ready!`, info);
}).catch(err => {
  console.error(`[Laya Server] Failed to initialize worker:`, err);
});

const insertAiMoveStmt = db.prepare(`
  INSERT INTO ai_moves (
    match_id, turn, player, board, rolls_json, state_preview,
    candidates_json, chosen_action_json, source, confidence, inference_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMatchStmt = db.prepare(`
  INSERT OR REPLACE INTO matches (
    match_id, board, mode, winner, total_turns, model, started_at, ended_at, logs_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. Status endpoint
  if (req.method === 'GET' && (url.pathname === '/api/status' || url.pathname === '/api/laya/status')) {
    const matchCount = db.prepare('SELECT COUNT(*) as count FROM matches').get();
    const moveCount = db.prepare('SELECT COUNT(*) as count FROM ai_moves').get();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ready: isReady,
      model: path.basename(modelPath),
      device,
      stats: {
        overallWinRate: '51.7% (Final) / 61.7% (Ep2)',
        standardSquareWinRate: '70.0%',
        octagonalWinRate: '40.0%',
        doubleRingWinRate: '45.0%',
        samples: 1500,
      },
      sqlite: {
        enabled: true,
        recordedMatches: matchCount?.count || 0,
        recordedMoves: moveCount?.count || 0,
      },
      runtime: runtimeInfo,
    }));
    return;
  }

  // 2. Query recent matches / moves from SQLite
  if (req.method === 'GET' && (url.pathname === '/api/matches' || url.pathname === '/api/laya/matches')) {
    const recentMatches = db.prepare('SELECT * FROM matches ORDER BY created_at DESC LIMIT 20').all();
    const recentMoves = db.prepare('SELECT * FROM ai_moves ORDER BY id DESC LIMIT 50').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ matches: recentMatches, moves: recentMoves }));
    return;
  }

  // 3. AI Action endpoint (with SQLite logging)
  if (req.method === 'POST' && (url.pathname === '/api/action' || url.pathname === '/api/laya/action')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { game, matchId } = JSON.parse(body);
        if (!game) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing game state' }));
          return;
        }

        if (!isReady) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Laya model warming up' }));
          return;
        }

        const input = candidatesFor(game, 'v2');
        const result = await chooseLayaAction(game, worker);

        // Record to SQLite
        try {
          insertAiMoveStmt.run(
            matchId || `match_${game.createdAt || Date.now()}`,
            game.turn || 0,
            game.current,
            game.config?.board || 'S',
            JSON.stringify(game.rolls || []),
            (input.state || '').slice(0, 300),
            JSON.stringify(input.criteria || {}),
            JSON.stringify(result.action || null),
            result.source || 'laya',
            result.confidence ?? null,
            result.inferenceMs ?? 0
          );
        } catch (dbErr) {
          console.error('[SQLite] Failed to record AI move:', dbErr.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[Laya Server] Error processing action:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4. Match End endpoint (Record completed game)
  if (req.method === 'POST' && (url.pathname === '/api/match-end' || url.pathname === '/api/laya/match-end')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        insertMatchStmt.run(
          data.matchId || `match_${Date.now()}`,
          data.board || 'S',
          data.mode || 'ai',
          data.winner ?? -1,
          data.totalTurns || 0,
          path.basename(modelPath),
          data.startedAt || new Date().toISOString(),
          new Date().toISOString(),
          JSON.stringify(data.logs || [])
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error('[SQLite] Match end recording error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
  console.log(`[Laya Server] Listening on http://localhost:${port}`);
});

process.on('SIGINT', () => {
  worker.close();
  server.close();
  db.close();
  process.exit(0);
});
