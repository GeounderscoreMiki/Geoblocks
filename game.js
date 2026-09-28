/***********************
 * SAFE GAME.JS
 ************************/
(() => {
  "use strict";

  const TARGET_SCORE = 1000;
  const SECRET_COORDINATE = "N 55° 40.123 E 012° 34.567";

  const BOARD_W = 10;
  const BOARD_H = 20;
  const BLOCK_SIZE = 30;
  const DROP_INTERVAL = 500;

  const startScreen = document.getElementById("startScreen");
  const gameScreen = document.getElementById("gameScreen");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const playerNameInput = document.getElementById("playerName");
  const currentPlayerEl = document.getElementById("currentPlayer");
  const scoreEl = document.getElementById("score");
  const targetScoreEl = document.getElementById("targetScore");
  const messageEl = document.getElementById("message");
  const leaderboardEl = document.getElementById("leaderboard");
  const canvas = document.getElementById("game");

  if (!canvas || !startBtn || !playerNameInput) {
    console.error("Mangler nødvendige DOM-elementer");
    return;
  }

  const ctx = canvas.getContext("2d");
  ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

  let board = [];
  let piece = null;
  let score = 0;
  let playerName = "";
  let running = false;
  let lastTime = 0;
  let dropCounter = 0;

  const SHAPES = [
    [[1,1,1,1]],
    [[2,2],[2,2]],
    [[0,3,0],[3,3,3]],
    [[4,0,0],[4,4,4]],
    [[0,0,5],[5,5,5]],
    [[0,6,6],[6,6,0]],
    [[7,7,0],[0,7,7]]
  ];

  function createBoard(w, h) {
    return Array.from({ length: h }, () => Array(w).fill(0));
  }

  function createPiece() {
    const original = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const matrix = original.map(r => [...r]);
    return {
      matrix,
      pos: { x: Math.floor((BOARD_W - matrix[0].length) / 2), y: 0 }
    };
  }

  function getColor(v) {
    return {
      1:"#22d3ee",2:"#facc15",3:"#a78bfa",4:"#fb923c",
      5:"#60a5fa",6:"#34d399",7:"#f87171"
    }[v] || "#fff";
  }

  function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v) {
          ctx.fillStyle = getColor(v);
          ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
          ctx.strokeStyle = "rgba(0,0,0,0.3)";
          ctx.lineWidth = 0.05;
          ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
        }
      });
    });
  }

  function draw() {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    drawMatrix(board, { x: 0, y: 0 });
    if (piece) drawMatrix(piece.matrix, piece.pos);
  }

  function collide(b, p) {
    for (let y = 0; y < p.matrix.length; y++) {
      for (let x = 0; x < p.matrix[y].length; x++) {
        if (!p.matrix[y][x]) continue;
        const bx = x + p.pos.x;
        const by = y + p.pos.y;
        if (bx < 0 || bx >= BOARD_W || by >= BOARD_H) return true;
        if (by >= 0 && b[by][bx] !== 0) return true;
      }
    }
    return false;
  }

  function merge(b, p) {
    p.matrix.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const by = y + p.pos.y, bx = x + p.pos.x;
      if (by >= 0 && by < BOARD_H && bx >= 0 && bx < BOARD_W) b[by][bx] = v;
    }));
  }

  function rotate90(matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    const r = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) r[x][rows - 1 - y] = matrix[y][x];
    return r;
  }

  function playerRotate() {
    if (!running || !piece) return;
    const old = piece.matrix.map(r => [...r]);
    const oldX = piece.pos.x;
    piece.matrix = rotate90(piece.matrix);
    for (const k of [0, -1, 1, -2, 2]) {
      piece.pos.x = oldX + k;
      if (!collide(board, piece)) return;
    }
    piece.matrix = old;
    piece.pos.x = oldX;
  }

  function playerMove(d) {
    if (!running || !piece) return;
    piece.pos.x += d;
    if (collide(board, piece)) piece.pos.x -= d;
  }

  function lockPiece() {
    merge(board, piece);
    clearLines();
    piece = createPiece();
    if (collide(board, piece)) gameOver();
  }

  function playerDrop() {
    if (!running || !piece) return;
    piece.pos.y++;
    if (collide(board, piece)) {
      piece.pos.y--;
      lockPiece();
    }
    dropCounter = 0;
  }

  function clearLines() {
    let cleared = 0;
    for (let y = BOARD_H - 1; y >= 0; y--) {
      if (board[y].every(v => v !== 0)) {
        board.splice(y, 1);
        board.unshift(Array(BOARD_W).fill(0));
        cleared++;
        y++;
      }
    }
    if (!cleared) return;
    score += (cleared === 4) ? 100 : cleared * 20;
    scoreEl.textContent = score;
  }

  function update(t = 0) {
    if (!running) return;
    const dt = t - lastTime;
    lastTime = t;
    dropCounter += dt;
    if (dropCounter > DROP_INTERVAL) playerDrop();
    draw();
    requestAnimationFrame(update);
  }

  const LEADERBOARD_KEY = "geoBlocksLeaderboard";
  function getLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]"); }
    catch { return []; }
  }
  function saveLeaderboard(list) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
  }
  function addScore(name, points) {
    const list = getLeaderboard();
    list.push({ name, points });
    list.sort((a,b) => b.points - a.points);
    saveLeaderboard(list.slice(0, 10));
  }
  function renderLeaderboard() {
    if (!leaderboardEl) return;
    leaderboardEl.innerHTML = "";
    const list = getLeaderboard();
    if (!list.length) {
      const li = document.createElement("li");
      li.textContent = "Ingen scores endnu";
      leaderboardEl.appendChild(li);
      return;
    }
    list.forEach((it, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${it.name} — ${it.points} point`;
      leaderboardEl.appendChild(li);
    });
  }

  function startGame() {
    const entered = playerNameInput.value.trim();
    if (!entered) return alert("Skriv dit navn først 🙂");
    playerName = entered;
    score = 0;
    board = createBoard(BOARD_W, BOARD_H);
    piece = createPiece();
    running = true;
    lastTime = 0;
    dropCounter = 0;

    currentPlayerEl.textContent = playerName;
    scoreEl.textContent = "0";
    targetScoreEl.textContent = TARGET_SCORE;

    messageEl.classList.add("hidden");
    messageEl.classList.remove("fail");
    restartBtn.classList.add("hidden");
    startScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    renderLeaderboard();
    draw();
    update();
  }

  function gameOver() {
    running = false;
    addScore(playerName, score);
    renderLeaderboard();

    messageEl.classList.remove("hidden");
    restartBtn.classList.remove("hidden");

    if (score >= TARGET_SCORE) {
      messageEl.classList.remove("fail");
      messageEl.innerHTML = `<strong>🎉 Tillykke ${playerName}!</strong><br>Koordinat:<br><code>${SECRET_COORDINATE}</code>`;
    } else {
      messageEl.classList.add("fail");
      messageEl.innerHTML = `<strong>Game Over</strong><br>Score: ${score}<br>Mangler: ${TARGET_SCORE - score}`;
    }
  }

  document.addEventListener("keydown", (e) => {
    if (!running) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); playerMove(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); playerMove(1); }
    if (e.key === "ArrowDown") { e.preventDefault(); playerDrop(); }
    if (e.key === "ArrowUp") { e.preventDefault(); playerRotate(); }
  });

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const a = btn.dataset.action;
      if (a === "left") playerMove(-1);
      if (a === "right") playerMove(1);
      if (a === "down") playerDrop();
      if (a === "rotate") playerRotate();
    });
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);
  playerNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });

  renderLeaderboard();
  console.log