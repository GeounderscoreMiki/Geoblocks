/***********************
 * INDSTILLINGER
 ************************/
const TARGET_SCORE = 1000;
const SECRET_COORDINATE = "N 55° 40.123 E 012° 34.567"; // <-- Skift denne efter behov
const BOARD_W = 10;
const BOARD_H = 20;
const BLOCK = 30;
const DROP_INTERVAL = 500; // ms

/***********************
 * DOM
 ************************/
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
const touchButtons = document.querySelectorAll(".touch-btn");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.scale(BLOCK, BLOCK);

/***********************
 * SPILSTATE
 ************************/
let board, piece, score, playerName;
let lastTime = 0;
let dropCounter = 0;
let running = false;

/***********************
 * TETROMINOER
 ************************/
const SHAPES = [
  [[1, 1, 1, 1, 1]],   // I5 (giver mulighed for 5 linjer i denne variant)
  [[2, 2], [2, 2]],    // O
  [[0, 3, 0], [3, 3, 3]], // T
  [[4, 0, 0], [4, 4, 4]], // L
  [[0, 0, 5], [5, 5, 5]], // J
  [[0, 6, 6], [6, 6, 0]], // S
  [[7, 7, 0], [0, 7, 7]]  // Z
];

function createBoard(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function randomPiece() {
  const shape = SHAPES[(Math.random() * SHAPES.length) | 0];
  return {
    matrix: shape.map(row => [...row]),
    pos: {
      x: ((BOARD_W / 2) | 0) - ((shape[0].length / 2) | 0),
      y: 0
    }
  };
}

/***********************
 * TEGN
 ************************/
function color(v) {
  const map = {
    1: "#22d3ee",
    2: "#facc15",
    3: "#a78bfa",
    4: "#fb923c",
    5: "#60a5fa",
    6: "#34d399",
    7: "#f87171"
  };
  return map[v] || "#fff";
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v !== 0) {
        ctx.fillStyle = color(v);
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function draw() {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  drawMatrix(board, { x: 0, y: 0 });
  drawMatrix(piece.matrix, piece.pos);
}

/***********************
 * LOGIK
 ************************/
function collide(b, p) {
  for (let y = 0; y < p.matrix.length; y++) {
    for (let x = 0; x < p.matrix[y].length; x++) {
      if (p.matrix[y][x] !== 0) {
        const by = y + p.pos.y;
        const bx = x + p.pos.x;
        if (
          by < 0 || by >= BOARD_H ||
          bx < 0 || bx >= BOARD_W ||
          b[by][bx] !== 0
        ) return true;
      }
    }
  }
  return false;
}

function merge(b, p) {
  p.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v !== 0) b[y + p.pos.y][x + p.pos.x] = v;
    });
  });
}

function rotate(matrix) {
  // transpose + reverse rows
  const m = matrix.map((_, i) => matrix.map(r => r[i]));
  m.forEach(r => r.reverse());
  return m;
}

function playerRotate() {
  const prev = piece.matrix;
  piece.matrix = rotate(piece.matrix);

  // wall-kick light
  const oldX = piece.pos.x;
  let offset = 1;
  while (collide(board, piece)) {
    piece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > piece.matrix[0].length) {
      piece.matrix = prev;
      piece.pos.x = oldX;
      return;
    }
  }
}

function playerMove(dir) {
  piece.pos.x += dir;
  if (collide(board, piece)) piece.pos.x -= dir;
}

function playerDrop() {
  piece.pos.y++;
  if (collide(board, piece)) {
    piece.pos.y--;
    merge(board, piece);
    clearLines();
    piece = randomPiece();

    if (collide(board, piece)) {
      gameOver();
    }
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collide(board, piece)) {
    piece.pos.y++;
  }
  piece.pos.y--;
  merge(board, piece);
  clearLines();
  piece = randomPiece();
  if (collide(board, piece)) gameOver();
  dropCounter = 0;
}

function clearLines() {
  let cleared = 0;

  outer: for (let y = BOARD_H - 1; y >= 0; y--) {
    for (let x = 0; x < BOARD_W; x++) {
      if (board[y][x] === 0) continue outer;
    }
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    cleared++;
    y++;
  }

  if (cleared > 0) {
    // Regel:
    // 10 point pr linje
    // 60 point hvis 5 linjer på én gang
    if (cleared === 5) {
      score += 60;
    } else {
      score += cleared * 10;
    }
    scoreEl.textContent = score;
  }
}

function update(time = 0) {
  if (!running) return;

  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  if (dropCounter > DROP_INTERVAL) {
    playerDrop();
  }

  draw();
  requestAnimationFrame(update);
}

/***********************
 * LEADERBOARD (localStorage)
 ************************/
const LS_KEY = "geoBlocksLeaderboard";

function getLeaderboard() {
  return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
}

function saveLeaderboard(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function addScore(name, points) {
  const list = getLeaderboard();
  list.push({ name, points });
  list.sort((a, b) => b.points - a.points);
  saveLeaderboard(list.slice(0, 10));
}

function renderLeaderboard() {
  const list = getLeaderboard();
  leaderboardEl.innerHTML = "";
  list.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.name} — ${item.points} point`;
    leaderboardEl.appendChild(li);
  });
}

/***********************
 * FLOW
 ************************/
function startGame() {
  const name = playerNameInput.value.trim();
  if (!name) {
    alert("Skriv dit navn først 🙂");
    return;
  }

  playerName = name;
  score = 0;
  board = createBoard(BOARD_W, BOARD_H);
  piece = randomPiece();
  running = true;
  dropCounter = 0;
  lastTime = 0;

  currentPlayerEl.textContent = playerName;
  scoreEl.textContent = score;
  targetScoreEl.textContent = TARGET_SCORE;

  messageEl.classList.add("hidden");
  messageEl.classList.remove("fail");
  restartBtn.classList.add("hidden");

  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  renderLeaderboard();
  update();
}

function gameOver() {
  running = false;
  addScore(playerName, score);
  renderLeaderboard();

  messageEl.classList.remove("hidden");
  restartBtn.classList.remove("hidden");

  if (score >= TARGET_SCORE) {
    messageEl.innerHTML = `
      <strong>🎉 Flot ${playerName}!</strong><br>
      Du nåede ${score} point og har fortjent koordinaten:<br>
      <code>${SECRET_COORDINATE}</code>
    `;
    messageEl.classList.remove("fail");
  } else {
    messageEl.innerHTML = `
      <strong>Game Over, ${playerName}</strong><br>
      Du fik ${score} point. Du mangler ${TARGET_SCORE - score} point for at få koordinaten.
    `;
    messageEl.classList.add("fail");
  }
}

function restartGame() {
  startGame();
}

function handleControlAction(action) {
  if (!running) return;

  if (action === "left") playerMove(-1);
  else if (action === "right") playerMove(1);
  else if (action === "down") playerDrop();
  else if (action === "rotate") playerRotate();
  else if (action === "drop") hardDrop();
}

/***********************
 * EVENTS
 ************************/
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);

document.addEventListener("keydown", e => {
  if (!running) return;

  if (e.key === "ArrowLeft") handleControlAction("left");
  else if (e.key === "ArrowRight") handleControlAction("right");
  else if (e.key === "ArrowDown") handleControlAction("down");
  else if (e.key === "ArrowUp") handleControlAction("rotate");
  else if (e.code === "Space") {
    e.preventDefault();
    handleControlAction("drop");
  }
});

touchButtons.forEach(button => {
  const { action } = button.dataset;
  let suppressNextClick = false;
  let suppressResetTimer;

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    suppressNextClick = true;
    clearTimeout(suppressResetTimer);
    suppressResetTimer = setTimeout(() => {
      suppressNextClick = false;
    }, 500);
    handleControlAction(action);
  });

  button.addEventListener("click", () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    handleControlAction(action);
  });
});

// første render af tom leaderboard
renderLeaderboard();