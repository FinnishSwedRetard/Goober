import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigins = new Set([
  "https://finnishswedretard.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765"
]);
const gameIds = new Set(["snack-snake", "mini-tetris", "flappy-rat"]);
const maxTicks = 100_000;
const maxEvents = 25_000;

function response(body: unknown, status: number, origin: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function database(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceKey);
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${projectUrl}/rest/v1/${path}`, { ...init, headers });
}

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function validateEvents(
  events: unknown,
  ticks: number,
  allowedActions: Set<string>
): events is Array<{ tick: number; action: string }> {
  if (!Array.isArray(events) || events.length > maxEvents) return false;
  let previousTick = 0;
  let actionsAtTick = 0;
  for (const event of events) {
    if (!event || !Number.isInteger(event.tick) || event.tick < 1 || event.tick > ticks
      || event.tick < previousTick || !allowedActions.has(event.action)) return false;
    actionsAtTick = event.tick === previousTick ? actionsAtTick + 1 : 1;
    if (actionsAtTick > 3) return false;
    previousTick = event.tick;
  }
  return true;
}

function verifySnake(seed: number, ticks: number, events: Array<{ tick: number; action: string }>) {
  const columns = 35;
  const rows = 24;
  let snake = [
    { x: Math.floor(columns / 2), y: Math.floor(rows / 2) },
    { x: Math.floor(columns / 2) - 1, y: Math.floor(rows / 2) },
    { x: Math.floor(columns / 2) - 2, y: Math.floor(rows / 2) }
  ];
  let direction = { x: 1, y: 0 };
  let queued = { ...direction };
  let score = 0;
  let eventIndex = 0;
  let ended = false;
  let elapsedTicks = 0;
  const random = randomGenerator(seed);

  function spawnSnack() {
    const empty = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        if (!snake.some(part => part.x === x && part.y === y)) empty.push({ x, y });
      }
    }
    return empty[Math.floor(random() * empty.length)];
  }

  let snack = spawnSnack();
  const vectors: Record<string, { x: number; y: number }> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  for (let tick = 1; tick <= ticks; tick++) {
    elapsedTicks = tick;
    while (eventIndex < events.length && events[eventIndex].tick === tick) {
      const next = vectors[events[eventIndex].action];
      if (!(next.x === -queued.x && next.y === -queued.y)) queued = next;
      eventIndex++;
    }
    direction = queued;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const eating = head.x === snack.x && head.y === snack.y;
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows
      || body.some(part => part.x === head.x && part.y === head.y)) {
      ended = true;
      break;
    }
    snake.unshift(head);
    if (eating) {
      score++;
      if (snake.length === columns * rows) {
        ended = true;
        break;
      }
      snack = spawnSnack();
    } else snake.pop();
  }

  return ended && elapsedTicks === ticks && eventIndex === events.length && score > 0 ? score : null;
}

function verifyTetris(seed: number, ticks: number, events: Array<{ tick: number; action: string }>) {
  const columns = 10;
  const rows = 20;
  const shapes: Record<string, number[][]> = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  };
  const types = Object.keys(shapes);
  let board: Array<Array<string | null>> = Array.from({ length: rows }, () => Array(columns).fill(null));
  let bag: string[] = [];
  let score = 0;
  let lines = 0;
  let level = 1;
  let gravityTicks = 0;
  let state: "playing" | "over" = "playing";
  let eventIndex = 0;
  let piece: { type: string; matrix: number[][]; x: number; y: number } = {
    type: "I",
    matrix: shapes.I,
    x: 0,
    y: 0
  };
  let nextType: string;
  const random = randomGenerator(seed);

  function takeType() {
    if (!bag.length) {
      bag = types.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  }

  function makePiece(type: string) {
    const matrix = shapes[type].map(row => row.slice());
    return { type, matrix, x: Math.floor((columns - matrix[0].length) / 2), y: 0 };
  }

  function collides(test: { matrix: number[][]; x: number; y: number }) {
    for (let y = 0; y < test.matrix.length; y++) {
      for (let x = 0; x < test.matrix[y].length; x++) {
        if (!test.matrix[y][x]) continue;
        const boardX = test.x + x;
        const boardY = test.y + y;
        if (boardX < 0 || boardX >= columns || boardY >= rows
          || (boardY >= 0 && board[boardY][boardX])) return true;
      }
    }
    return false;
  }

  function spawn() {
    piece = makePiece(nextType);
    nextType = takeType();
    if (collides(piece)) state = "over";
  }

  function lockPiece() {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const boardY = piece.y + y;
        if (boardY < 0) {
          state = "over";
          return;
        }
        board[boardY][piece.x + x] = piece.type;
      }
    }
    let count = 0;
    for (let y = rows - 1; y >= 0;) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(columns).fill(null));
        count++;
      } else y--;
    }
    if (count) {
      lines += count;
      score += [0, 100, 300, 500, 800][count] * level;
      level = Math.floor(lines / 10) + 1;
    }
    spawn();
  }

  function stepDown(soft = false) {
    const moved = { ...piece, y: piece.y + 1 };
    if (!collides(moved)) {
      piece = moved;
      if (soft) score++;
    } else lockPiece();
  }

  function act(action: string) {
    if (state !== "playing") return;
    if (action === "left" || action === "right") {
      const moved = { ...piece, x: piece.x + (action === "left" ? -1 : 1) };
      if (!collides(moved)) piece = moved;
    } else if (action === "rotate") {
      const matrix = piece.matrix[0].map((_, x) => piece.matrix.map(row => row[x]).reverse());
      for (const offset of [0, -1, 1, -2, 2]) {
        const rotated = { ...piece, matrix, x: piece.x + offset };
        if (!collides(rotated)) {
          piece = rotated;
          break;
        }
      }
    } else if (action === "down") stepDown(true);
    else if (action === "drop") {
      let distance = 0;
      while (!collides({ ...piece, y: piece.y + 1 })) {
        piece.y++;
        distance++;
      }
      score += distance * 2;
      lockPiece();
    }
  }

  spawn();
  let elapsedTicks = 0;
  for (let tick = 1; tick <= ticks && state === "playing"; tick++) {
    elapsedTicks = tick;
    while (eventIndex < events.length && events[eventIndex].tick === tick && state === "playing") {
      act(events[eventIndex].action);
      eventIndex++;
    }
    if (state !== "playing") break;
    gravityTicks++;
    const interval = Math.max(2, Math.ceil((.72 * Math.pow(.82, level - 1) * 1000) / 50));
    if (gravityTicks >= interval) {
      gravityTicks = 0;
      stepDown();
    }
  }

  return state === "over" && elapsedTicks === ticks && eventIndex === events.length && score > 0
    ? score : null;
}

function verifyFlappyRat(seed: number, ticks: number, events: Array<{ tick: number; action: string }>) {
  const width = 1150;
  const height = 800;
  const playerX = 280;
  const playerRadius = 22;
  const pipeWidth = 96;
  const gapHeight = 244;
  let randomSeed = seed >>> 0;
  const random = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  };
  let score = 0;
  let gameTicks = 0;
  let ratY = 400;
  let upHeld = false;
  let downHeld = false;
  let fastHeld = false;
  let slowHeld = false;
  let boostCharges = 0;
  let boostTicks = 0;
  let obstacles: Array<{
    x: number;
    gapCenter: number;
    passed: boolean;
  }> = [];
  let powerups: Array<{ x: number; y: number; collected: boolean }> = [];
  let nextObstacleTick = 38;
  let eventIndex = 0;

  function spawnObstacle() {
    const obstacle = {
      x: width + 30,
      gapCenter: 270 + random() * 260,
      passed: false
    };
    obstacles.push(obstacle);
    if (random() < .62) {
      powerups.push({
        x: obstacle.x + 166,
        y: obstacle.gapCenter + (random() * 100 - 50),
        collected: false
      });
    }
    nextObstacleTick += 72;
  }

  for (let tick = 1; tick <= ticks; tick++) {
    gameTicks = tick;
    score++;
    let pendingBoost = false;
    while (eventIndex < events.length && events[eventIndex].tick === tick) {
      switch (events[eventIndex].action) {
        case "up_on": upHeld = true; break;
        case "up_off": upHeld = false; break;
        case "down_on": downHeld = true; break;
        case "down_off": downHeld = false; break;
        case "fast_on": fastHeld = true; break;
        case "fast_off": fastHeld = false; break;
        case "slow_on": slowHeld = true; break;
        case "slow_off": slowHeld = false; break;
        case "boost": pendingBoost = true; break;
      }
      eventIndex++;
    }
    if (pendingBoost && boostCharges > 0) {
      boostCharges--;
      boostTicks = 45;
    }
    if (gameTicks >= nextObstacleTick) spawnObstacle();

    ratY = Math.max(54, Math.min(746,
      ratY + (upHeld ? -5.2 : 0) + (downHeld ? 5.2 : 0) + Math.sin(gameTicks * .13) * .55));
    const speed = boostTicks > 0 ? 14 : fastHeld ? 9 : slowHeld ? 3 : 5.5;
    const tideY = 772 - Math.floor(gameTicks / 2000 * 288);

    for (const obstacle of obstacles) {
      obstacle.x -= speed;
      const gapTop = obstacle.gapCenter - gapHeight / 2;
      const gapBottom = obstacle.gapCenter + gapHeight / 2;
      if (playerX + playerRadius > obstacle.x && playerX - playerRadius < obstacle.x + pipeWidth
        && (ratY - playerRadius < gapTop || ratY + playerRadius > gapBottom)) return null;
      if (!obstacle.passed && obstacle.x + pipeWidth < playerX) {
        obstacle.passed = true;
        score += 100;
      }
    }
    obstacles = obstacles.filter(obstacle => obstacle.x + pipeWidth > -10);

    for (const powerup of powerups) {
      powerup.x -= speed;
      if (!powerup.collected && Math.abs(playerX - powerup.x) < 34 && Math.abs(ratY - powerup.y) < 34) {
        powerup.collected = true;
        boostCharges = Math.min(3, boostCharges + 1);
        score += 50;
      }
    }
    powerups = powerups.filter(powerup => !powerup.collected && powerup.x > -35);

    if (boostTicks > 0) boostTicks--;
    if (ratY + playerRadius >= tideY) return null;
  }

  return gameTicks === 2000 && eventIndex === events.length && score > 0 ? score : null;
}

async function handle(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins.has(origin)) return response({ error: "origin_not_allowed" }, 403, origin);
  if (request.method === "OPTIONS") return response({}, 200, origin);
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405, origin);
  const action = new URL(request.url).pathname.split("/").filter(Boolean).pop();
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 1_500_000) return response({ error: "request_too_large" }, 413, origin);
  if ((action === "start" || action === "submit")
    && request.headers.get("Content-Type")?.startsWith("application/json") !== true) {
    return response({ error: "invalid_content_type" }, 415, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return response({ error: "invalid_json" }, 400, origin);
  }

  if (action === "start") {
    const gameId = body.gameId;
    if (typeof gameId !== "string" || !gameIds.has(gameId)) {
      return response({ error: "unsupported_game" }, 400, origin);
    }
    const cleanupBefore = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const cleanup = await database(`game_sessions?created_at=lt.${encodeURIComponent(cleanupBefore)}`, {
      method: "DELETE"
    });
    if (!cleanup.ok) return response({ error: "could_not_prepare_game_session" }, 503, origin);

    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const created = await database("game_sessions?select=id,seed", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ game_id: gameId, seed })
    });
    if (!created.ok) return response({ error: "could_not_start_game_session" }, 503, origin);
    const [session] = await created.json();
    return response({ sessionId: session.id, seed: Number(session.seed) }, 200, origin);
  }

  if (action !== "submit") return response({ error: "unknown_action" }, 404, origin);
  const gameId = body.gameId;
  const sessionId = body.sessionId;
  const playerName = body.playerName;
  const score = body.score;
  const ticks = body.ticks;
  const events = body.events;
  if (typeof gameId !== "string" || !gameIds.has(gameId)
    || typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)
    || typeof playerName !== "string" || !/^[A-Z]{5}$/.test(playerName)
    || typeof score !== "number" || !Number.isSafeInteger(score) || score <= 0 || score > 100_000_000
    || typeof ticks !== "number" || !Number.isSafeInteger(ticks) || ticks < 1 || ticks > maxTicks) {
    return response({ error: "invalid_submission" }, 400, origin);
  }

  const allowedActions = gameId === "snack-snake"
    ? new Set(["up", "down", "left", "right"])
    : gameId === "mini-tetris"
      ? new Set(["left", "right", "down", "rotate", "drop"])
      : new Set(["up_on", "up_off", "down_on", "down_off", "fast_on", "fast_off", "slow_on", "slow_off", "boost"]);
  if (!validateEvents(events, ticks, allowedActions)) {
    return response({ error: "invalid_replay" }, 400, origin);
  }

  const lookup = await database(
    `game_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,game_id,seed,created_at,used_at`
  );
  if (!lookup.ok) return response({ error: "could_not_verify_game_session" }, 503, origin);
  const [session] = await lookup.json();
  if (!session || session.game_id !== gameId || session.used_at
    || Date.now() - Date.parse(session.created_at) > 4 * 60 * 60 * 1000) {
    return response({ error: "invalid_or_expired_game_session" }, 400, origin);
  }
  const minimumDuration = Math.max(0, ticks * (gameId === "snack-snake" ? 72 : 50) - 500);
  if (Date.now() - Date.parse(session.created_at) < minimumDuration) {
    return response({ error: "replay_completed_too_quickly" }, 422, origin);
  }

  const verifiedScore = gameId === "snack-snake"
    ? verifySnake(Number(session.seed), ticks, events)
    : gameId === "mini-tetris"
      ? verifyTetris(Number(session.seed), ticks, events)
      : verifyFlappyRat(Number(session.seed), ticks, events);
  if (verifiedScore === null || verifiedScore !== score) {
    return response({ error: "score_replay_mismatch" }, 422, origin);
  }

  const saved = await database("rpc/submit_verified_game_score", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: sessionId,
      p_game_id: gameId,
      p_player_name: playerName,
      p_score: score
    })
  });
  const result = await saved.json().catch(() => null);
  if (saved.status === 400 && JSON.stringify(result).includes("score_did_not_make_top_five")) {
    return response({
      accepted: false,
      message: "The leaderboard changed while you were playing. Your score no longer makes the top 5."
    }, 200, origin);
  }
  if (!saved.ok) return response({ error: "could_not_save_verified_score" }, 503, origin);
  return response({ accepted: true, score: result }, 200, origin);
}

Deno.serve(async request => {
  try {
    return await handle(request);
  } catch (error) {
    console.error("Leaderboard request failed.", error);
    return response({ error: "leaderboard_service_error" }, 500, request.headers.get("Origin"));
  }
});
