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
    [[1, 1, 1, 1]],
    [[2, 2], [2, 2]],
    [[0, 3, 0], [3, 3, 3]],
    [[4, 0, 0], [4, 4, 4]],
    [[0, 0, 5], [5, 5, 5]],
    [[0, 6, 6], [6, 6, 0]],
    [[7, 7, 0], [0, 7, 7]]
  ];

  function createBoard(width, height) {
    return Array.from({ length: height }, () => Array(width).fill(0));
  }

  function createPiece() {
    const original = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const matrix = original.map(row => [...row]);
    return {
      matrix,
      pos: {
        x: Math.floor((BOARD_W - matrix[0].length) / 2),
        y: 0
      }
    };
  }

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

  function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillStyle = getColor(value);
          ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
          ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
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

  function collide(currentBoard, currentPiece) {
    for (let y = 0; y < currentPiece.matrix.length; y++) {
      for (let x = 0; x < currentPiece.matrix[y].length; x++) {
        if (currentPiece.matrix[y][x] === 0) continue;

        const boardX = x + currentPiece.pos.x;
        const boardY = y + currentPiece.pos.y;

        if (
          boardX < 0 ||
          boardX >= BOARD_W ||
          boardY >= BOARD_H ||
          (boardY >= 0 && currentBoard[boardY][boardX] !== 0)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function merge(currentBoard, currentPiece) {
    currentPiece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value === 0) return;

        const boardY = y + currentPiece.pos.y;
        const boardX = x + currentPiece.pos.x;

        if (
          boardY >= 0 && boardY < BOARD_H &&
          boardX >= 0 && boardX < BOARD_W
        ) {
          currentBoard[boardY][boardX] = value;
        }
      });
    });
  }

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

    piece.matrix = rotate90Clockwise(piece.matrix);

    for (const offset of [0, -1, 1, -2, 2]) {
      piece.pos.x = oldX + offset;
      if (!collide(board, piece)) return;
    }

    piece.matrix = oldMatrix;
    piece.pos.x = oldX;
  }

  function playerMove(direction) {
    if (!running || !piece) return;

    piece.pos.x += direction;
    if (collide(board, piece)) piece.pos.x -= direction;
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

  function hardDrop() {
    if (!running || !piece) return;

    while (!collide(board, piece)) piece.pos.y++;
    piece.pos.y--;
    lockPiece();
    dropCounter = 0;
  }

  function clearLines() {
    let cleared = 0;

    for (let y = BOARD_H - 1; y >= 0; y--) {
      if (board[y].every(value => value !== 0)) {
        board.splice(y, 1);
        board.unshift(Array(BOARD_W).fill(0));
        cleared++;
        y++;
      }
    }

    if (cleared === 0) return;

    score += cleared === 4 ? 100 : cleared * 20;
    scoreEl.textContent = score;
  }

  function update(time = 0) {
    if (!running) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > DROP_INTERVAL) playerDrop();

    draw();
    requestAnimationFrame(update);
  }

  const LEADERBOARD_KEY = "geoBlocksLeaderboard";

  function getLeaderboard() {
    try {
      return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveLeaderboard(list) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
  }

  function addScore(name, points) {
    const list = getLeaderboard();
    list.push({ name, points });
    list.sort((a, b) => b.points - a.points);
    saveLeaderboard(list.slice(0, 10));
  }

  function renderLeaderboard() {
    if (!leaderboardEl) return;

    leaderboardEl.innerHTML = "";
    const list = getLeaderboard();

    if (list.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Ingen scores endnu";
      leaderboardEl.appendChild(item);
      return;
    }

    list.forEach((entry, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${entry.name} — ${entry.points} point`;
      leaderboardEl.appendChild(item);
    });
  }

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
      messageEl.innerHTML = `
        <strong>🎉 Tillykke ${playerName}!</strong><br>
        Du fik ${score} point og har fortjent koordinaten:<br><br>
        <code>${SECRET_COORDINATE}</code>
      `;
    } else {
      messageEl.classList.add("fail");
      messageEl.innerHTML = `
        <strong>Game Over</strong><br>
        Score: ${score}<br>
        Du mangler: ${TARGET_SCORE - score}
      `;
    }
  }

  document.addEventListener("keydown", event => {
    if (!running) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      playerMove(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      playerMove(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      playerDrop();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      playerRotate();
    } else if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      hardDrop();
    }
  });

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();

      switch (button.dataset.action) {
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
      }
    });
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  playerNameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") startGame();
  });

  renderLeaderboard();
  console.log("game.js loaded OK");
})();
