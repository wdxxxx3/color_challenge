const board = document.querySelector('#board');
const messageEl = document.querySelector('#message');
const levelEl = document.querySelector('#levelValue');
const scoreEl = document.querySelector('#scoreValue');
const bestScoreEl = document.querySelector('#bestScoreValue');
const progressFillEl = document.querySelector('#progressFill');
const startBtn = document.querySelector('#startBtn');
const restartBtn = document.querySelector('#restartBtn');
const resultsModal = document.querySelector('#resultsModal');
const finalScoreEl = document.querySelector('#finalScore');
const finalAccuracyEl = document.querySelector('#finalAccuracy');
const finalBestScoreEl = document.querySelector('#finalBestScore');
const playAgainBtn = document.querySelector('#playAgainBtn');
const closeModalBtn = document.querySelector('#closeModalBtn');

const TOTAL_ROUNDS = 12;
const STORAGE_KEY = 'colorChallengeHighScore';

let currentRound = 0;
let score = 0;
let correctRounds = 0;
let gameActive = false;
let roundStart = 0;
let highScore = loadHighScore();
let locked = false;

bestScoreEl.textContent = highScore.toString();
levelEl.textContent = `0 / ${TOTAL_ROUNDS}`;
scoreEl.textContent = '0';

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
  if (!gameActive) {
    startGame();
    return;
  }
  flashButton(restartBtn);
  resetGame();
  nextRound();
});
playAgainBtn.addEventListener('click', () => {
  hideModal();
  startGame();
});
closeModalBtn.addEventListener('click', () => {
  hideModal();
  messageEl.textContent = '点击“开始挑战”开启测试';
  startBtn.classList.remove('hidden');
  restartBtn.classList.add('hidden');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !gameActive && resultsModal.classList.contains('hidden')) {
    startBtn.focus();
  }
});

function startGame() {
  startBtn.classList.add('hidden');
  restartBtn.classList.remove('hidden');
  messageEl.textContent = '观察色块，找出与众不同的颜色';
  hideModal();
  resetGame();
  nextRound();
}

function resetGame() {
  currentRound = 0;
  score = 0;
  correctRounds = 0;
  gameActive = true;
  locked = false;
  board.innerHTML = '';
  updateScoreboard();
  updateProgress(0);
}

function nextRound() {
  if (!gameActive) {
    return;
  }
  if (currentRound >= TOTAL_ROUNDS) {
    endGame();
    return;
  }

  currentRound += 1;
  locked = false;

  const { size, delta } = getLevelConfig(currentRound);
  const baseColor = generateRandomColor();
  const oddColor = shiftLightness(baseColor, delta);
  const totalTiles = size * size;
  const oddIndex = randomInt(totalTiles);

  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
  const baseCss = toCss(baseColor);
  const oddCss = toCss(oddColor);

  for (let index = 0; index < totalTiles; index += 1) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'color-tile';
    tile.style.backgroundColor = index === oddIndex ? oddCss : baseCss;
    tile.setAttribute('role', 'gridcell');
    tile.setAttribute('aria-label', index === oddIndex ? '不同的色块' : '色块');
    tile.addEventListener('click', () =>
      handleSelection(index === oddIndex, tile, oddIndex, delta, size)
    );
    tile.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        tile.click();
      }
    });
    board.appendChild(tile);
  }

  messageEl.textContent = `第 ${currentRound} 关：找到唯一不同的色块`;
  updateScoreboard();
  updateProgress(((currentRound - 1) / TOTAL_ROUNDS) * 100);
  roundStart = performance.now();
}

function handleSelection(isCorrect, tile, oddIndex, delta, gridSize) {
  if (!gameActive || locked) {
    return;
  }
  locked = true;
  disableTiles();
  const elapsed = performance.now() - roundStart;

  if (isCorrect) {
    correctRounds += 1;
    const roundScore = calculateRoundScore(delta, elapsed, gridSize);
    score += roundScore;
    tile.classList.add('tile-correct');
    messageEl.textContent = `太棒了！本轮获得 ${roundScore} 分`;
  } else {
    tile.classList.add('tile-wrong');
    const correctTile = board.children[oddIndex];
    if (correctTile) {
      correctTile.classList.add('tile-highlight');
    }
    messageEl.textContent = '可惜！仔细感受两种颜色的差异';
  }

  updateScoreboard();
  updateProgress((currentRound / TOTAL_ROUNDS) * 100);

  setTimeout(() => {
    if (currentRound >= TOTAL_ROUNDS) {
      endGame();
      return;
    }
    nextRound();
  }, 900);
}

function disableTiles() {
  const tiles = board.querySelectorAll('.color-tile');
  tiles.forEach((item) => {
    item.disabled = true;
  });
}

function endGame() {
  gameActive = false;
  board.innerHTML = '';
  messageEl.textContent = '挑战结束！你的眼力真棒～';
  startBtn.classList.remove('hidden');
  restartBtn.classList.add('hidden');
  updateProgress(100);

  const accuracy = TOTAL_ROUNDS === 0 ? 0 : Math.round((correctRounds / TOTAL_ROUNDS) * 100);
  finalScoreEl.textContent = score.toString();
  finalAccuracyEl.textContent = `${accuracy}%`;

  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
  }

  finalBestScoreEl.textContent = highScore.toString();
  bestScoreEl.textContent = highScore.toString();

  showModal();
}

function updateScoreboard() {
  levelEl.textContent = `${Math.min(currentRound, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`;
  scoreEl.textContent = score.toString();
}

function updateProgress(value) {
  const clamped = Math.max(0, Math.min(100, value));
  progressFillEl.style.width = `${clamped}%`;
  const progressEl = progressFillEl.parentElement;
  if (progressEl) {
    progressEl.setAttribute('aria-valuenow', clamped.toFixed(0));
  }
}

function getLevelConfig(round) {
  const size = Math.min(2 + Math.floor((round - 1) / 2), 6);
  const delta = Math.max(26 - round * 2, 4);
  return { size, delta };
}

function generateRandomColor() {
  const hue = randomInt(360);
  const saturation = 60 + randomInt(21); // 60 - 80
  const lightness = 45 + randomInt(21); // 45 - 65
  return { hue, saturation, lightness };
}

function shiftLightness(color, delta) {
  const direction = Math.random() > 0.5 ? 1 : -1;
  let nextLightness = color.lightness + direction * delta;

  if (nextLightness > 88 || nextLightness < 18) {
    nextLightness = color.lightness - direction * delta;
  }

  nextLightness = clamp(nextLightness, 12, 92);
  return { ...color, lightness: nextLightness };
}

function calculateRoundScore(delta, elapsedMs, gridSize) {
  const difficultyBonus = Math.round((gridSize - 1) * 18 + (12 - Math.min(delta, 12)) * 6);
  const speedBonus = Math.max(0, 60 - Math.floor(elapsedMs / 50));
  const baseScore = 40;
  return baseScore + difficultyBonus + speedBonus;
}

function toCss(color) {
  const { hue, saturation, lightness } = color;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadHighScore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return 0;
    }
    const parsed = Number.parseInt(saved, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch (error) {
    // 忽略保存失败
  }
}

function showModal() {
  resultsModal.classList.remove('hidden');
}

function hideModal() {
  resultsModal.classList.add('hidden');
}

function flashButton(button) {
  button.classList.add('button--ghost-active');
  setTimeout(() => {
    button.classList.remove('button--ghost-active');
  }, 200);
}
