/***********************
 * INDSTILLINGER
 ************************/
const TARGET_SCORE = 1000;

// SKIFT KOORDINATEN HER
const SECRET_COORDINATE = "N 55° 40.123 E 012° 34.567";

const BOARD_W = 10;
const BOARD_H = 20;
const BLOCK_SIZE = 30;
const DROP_INTERVAL = 500;


/***********************
 * DOM-ELEMENTER
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

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

ctx.scale(BLOCK_SIZE, BLOCK_SIZE);


/***********************
 * SPIL-STATE
 ************************/
let board = [];
let piece = null;
let score = 0;
let playerName = "";

let running = false;
let lastTime = 0;
let dropCounter = 0;


/***********************
 * KLASSISKE TETRIS-BRIKKER
 ************************/
const SHAPES = [
  // I-brik
  [
    [1, 1, 1, 1]
  ],

  // O-brik
  [
    [2, 2],
    [2, 2]
  ],

  // T-brik
  [
    [0, 3, 0],
    [3, 3, 3]
  ],

  // L-brik
  [
    [4, 0, 0],
    [4, 4, 4]
  ],

  // J-brik
  [
    [0, 0, 5],
    [5, 5, 5]
  ],

  // S-brik
  [
    [0, 6, 6],
    [6, 6, 0]
  ],

  // Z-brik
  [
    [7, 7, 0],
    [0, 7, 7]
  ]
];


/***********************
 * FARVER
 ************************/
function getColor(value) {
  const colors = {
    1: "#22d3ee",
    2: "#facc15",
    3: "#a78bfa",
    4: "#fb923c",
    5: "#60a5fa",
    6: "#34d399",
    7: "#f87171"
  };

  return colors[value] || "#ffffff";
}


/***********************
 * OPRET SPILLEBRÆT
 ************************/
function createBoard(width, height) {
  return Array.from(
    { length: height },
    () => Array(width).fill(0)
  );
}


/***********************
 * OPRET NY BRIK
 ************************/
function createPiece() {
  const originalShape =
    SHAPES[Math.floor(Math.random() * SHAPES.length)];

  // Lav en kopi, så originalformen ikke ændres
  const matrix = originalShape.map(row => [...row]);

  return {
    matrix,
    pos: {
      x: Math.floor((BOARD_W - matrix[0].length) / 2),
      y: 0
    }
  };
}


/***********************
 * TEGNING
 ************************/
function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = getColor(value);

        ctx.fillRect(
          x + offset.x,
          y + offset.y,
          1,
          1
        );

        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 0.05;

        ctx.strokeRect(
          x + offset.x,
          y + offset.y,
          1,
          1
        );
      }
    });
  });
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 0.03;

  for (let x = 0; x <= BOARD_W; x++) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BOARD_H);
    ctx.stroke();
  }

  for (let y = 0; y <= BOARD_H; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_W, y);
    ctx.stroke();
  }
}

function draw() {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  drawGrid();
  drawMatrix(board, { x: 0, y: 0 });

  if (piece) {
    drawMatrix(piece.matrix, piece.pos);
  }
}


/***********************
 * KOLLISION
 ************************/
function collide(currentBoard, currentPiece) {
  const matrix = currentPiece.matrix;
  const position = currentPiece.pos;

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x] !== 0) {
        const boardX = x + position.x;
        const boardY = y + position.y;

        if (
          boardX < 0 ||
          boardX >= BOARD_W ||
          boardY >= BOARD_H ||
          (
            boardY >= 0 &&
            currentBoard[boardY][boardX] !== 0
          )
        ) {
          return true;
        }
      }
    }
  }

  return false;
}


/***********************
 * LÆG BRIK PÅ BRÆTTET
 ************************/
function merge(currentBoard, currentPiece) {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        const boardX = x + currentPiece.pos.x;
        const boardY = y + currentPiece.pos.y;

        if (
          boardX >= 0 &&
          boardX < BOARD_W &&
          boardY >= 0 &&
          boardY < BOARD_H
        ) {
          currentBoard[boardY][boardX] = value;
        }
      }
    });
  });
}


/***********************
 * ROTATION - 90 GRADER
 ************************/
function rotate90Clockwise(matrix) {
  const rows = matrix.length;
  const columns = matrix[0].length;

  const rotated = Array.from(
    { length: columns },
    () => Array(rows).fill(0)
  );

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      rotated[x][rows - 1 - y] = matrix[y][x];
    }
  }

  return rotated;
}

function playerRotate() {
  if (!running || !piece) return;

  const oldMatrix = piece.matrix.map(row => [...row]);
  const oldX = piece.pos.x;

  // Roter præcis 90 grader med uret
  piece.matrix = rotate90Clockwise(piece.matrix);

  // Hjælper brikken væk fra kanten
  const wallKicks = [0, -1, 1, -2, 2];

  for (const offset of wallKicks) {
    piece.pos.x = oldX + offset;

    if (!collide(board, piece)) {
      return;
    }
  }

  // Fortryd rotationen hvis der ikke er plads
  piece.matrix = oldMatrix;
  piece.pos.x = oldX;
}


/***********************
 * SPILLERKONTROLLER
 ************************/
function playerMove(direction) {
  if (!running || !piece) return;

  piece.pos.x += direction;

  if (collide(board, piece)) {
    piece.pos.x -= direction;
  }
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

function hardDrop() {
  if (!running || !piece) return;

  while (!collide(board, piece)) {
    piece.pos.y++;
  }

  piece.pos.y--;

  lockPiece();
  dropCounter = 0;
}

function lockPiece() {
  merge(board, piece);
  clearLines();

  piece = createPiece();

  if (collide(board, piece)) {
    gameOver();
  }
}


/***********************
 * LINJER OG POINT
 ************************/
function clearLines() {
  let clearedLines = 0;

  for (let y = BOARD_H - 1; y >= 0; y--) {
    const isFull = board[y].every(value => value !== 0);

    if (isFull) {
      board.splice(y, 1);
      board.unshift(Array(BOARD_W).fill(0));

      clearedLines++;
      y++;
    }
  }

  if (clearedLines === 0) {
    return;
  }

  /*
   * Pointsystem:
   * 1 linje = 10 point
   * 2 linjer = 20 point
   * 3 linjer = 30 point
   * 4 linjer = 60 point
   */
  if (clearedLines === 4) {
    score += 60;
  } else {
    score += clearedLines * 10;
  }

  scoreEl.textContent = score;
}


/***********************
 * SPILLELOOP
 ************************/
function update(time = 0) {
  if (!running) return;

  const deltaTime = time - lastTime;

  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > DROP_INTERVAL) {
    playerDrop();
  }

  draw();
  requestAnimationFrame(update);
}


/***********************
 * LEADERBOARD
 ************************/
const LEADERBOARD_KEY = "geoBlocksLeaderboard";

function getLeaderboard() {
  try {
    return JSON.parse(
      localStorage.getItem(LEADERBOARD_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function saveLeaderboard(list) {
  localStorage.setItem(
    LEADERBOARD_KEY,
    JSON.stringify(list)
  );
}

function addScore(name, points) {
  const list = getLeaderboard();

  list.push({
    name,
    points
  });

  list.sort((a, b) => b.points - a.points);

  saveLeaderboard(list.slice(0, 10));
}

function renderLeaderboard() {
  if (!leaderboardEl) return;

  const list = getLeaderboard();

  leaderboardEl.innerHTML = "";

  if (list.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Ingen scores endnu";
    leaderboardEl.appendChild(emptyItem);
    return;
  }

  list.forEach((item, index) => {
    const listItem = document.createElement("li");

    listItem.textContent =
      `${index + 1}. ${item.name} — ${item.points} point`;

    leaderboardEl.appendChild(listItem);
  });
}


/***********************
 * START SPIL
 ************************/
function startGame() {
  const enteredName = playerNameInput.value.trim();

  if (!enteredName) {
    alert("Skriv dit navn først 🙂");
    playerNameInput.focus();
    return;
  }

  playerName = enteredName;
  score = 0;

  board = createBoard(BOARD_W, BOARD_H);
  piece = createPiece();

  running = true;
  lastTime = 0;
  dropCounter = 0;

  currentPlayerEl.textContent = playerName;
  scoreEl.textContent = score;
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


/***********************
 * GAME OVER
 ************************/
function gameOver() {
  running = false;

  addScore(playerName, score);
  renderLeaderboard();

  messageEl.classList.remove("hidden");
  restartBtn.classList.remove("hidden");

  if (score >= TARGET_SCORE) {
    messageEl.classList.remove("fail");

    messageEl.innerHTML = `
      <strong>🎉 Tillykke ${playerName}!</strong><br>
      Du fik ${score} point og har fortjent koordinaten:<br><br>
      <code>${SECRET_COORDINATE}</code>
    `;
  } else {
    messageEl.classList.add("fail");

    const missingPoints = TARGET_SCORE - score;

    messageEl.innerHTML = `
      <strong>Game Over, ${playerName}</strong><br>
      Du fik ${score} point.<br>
      Du mangler ${missingPoints} point for at få koordinaten.
    `;
  }
}


/***********************
 * TASTATURSTYRING
 ************************/
document.addEventListener("keydown", event => {
  if (!running) return;

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      playerMove(-1);
      break;

    case "ArrowRight":
      event.preventDefault();
      playerMove(1);
      break;

    case "ArrowDown":
      event.preventDefault();
      playerDrop();
      break;

    case "ArrowUp":
      event.preventDefault();
      playerRotate();
      break;

    case " ":
    case "Spacebar":
      event.preventDefault();
      hardDrop();
      break;
  }
});


/***********************
 * MOBILKNAPPER
 ************************/
function performControl(action) {
  if (!running) return;

  switch (action) {
    case "left":
      playerMove(-1);
      break;

    case "right":
      playerMove(1);
      break;

    case "down":
      playerDrop();
      break;

    case "rotate":
      playerRotate();
      break;

    case "drop":
      hardDrop();
      break;
  }
}

// Understøtter knapper med data-action,
// fx: <button data-action="left">◀</button>
document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();

    const action = button.dataset.action;
    performControl(action);
  });
});


/***********************
 * ALTERNATIVE KNAP-ID'ER
 ************************/
const mobileButtonActions = {
  moveLeftBtn: "left",
  moveRightBtn: "right",
  moveDownBtn: "down",
  rotateBtn: "rotate",
  hardDropBtn: "drop"
};

Object.entries(mobileButtonActions).forEach(
  ([buttonId, action]) => {
    const button = document.getElementById(buttonId);

    if (!button) return;

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      performControl(action);
    });
  }
);


/***********************
 * START-, RESTART- OG ENTER-KNAPPER
 ************************/
if (startBtn) {
  startBtn.addEventListener("click", startGame);
}

if (restartBtn) {
  restartBtn.addEventListener("click", startGame);
}

if (playerNameInput) {
  playerNameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      startGame();
    }
  });
}


/***********************
 * FØRSTE VISNING
 ************************/
renderLeaderboard();