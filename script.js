const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("game-over");
const finalScoreEl = document.querySelector(".final-score");
const scoreEl = document.querySelector(".score");
const highScoreEl = document.querySelector(".high-score");
const restartBtn = document.getElementById("restart-btn");
const shareBtn = document.getElementById("share-btn");
const shareCanvas = document.getElementById("share-canvas");
const shareCtx = shareCanvas.getContext("2d");

const STORAGE_KEY = "flappy-bird-high-score";
const LEGACY_KEY = "flappy-dino-high-score";

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  groundY: canvas.height - 32,
};

const PHYSICS = {
  gravity: 1400,
  flapImpulse: -420,
  diveImpulse: 520,
  maxVelocity: 720,
};

const SPEED = {
  world: 260, // pixels per second
  spawnInterval: 1800, // milliseconds
};

const player = {
  x: 120,
  y: WORLD.height / 2,
  width: 52,
  height: 36,
  velocity: 0,
  frame: 0,
  animationTimer: 0,
};

const stars = Array.from({ length: 18 }, () => ({
  x: Math.random() * WORLD.width,
  y: Math.random() * (WORLD.height / 2),
  size: Math.random() > 0.7 ? 2 : 1,
}));

const BIRD_COLORS = {
  outline: "#2c241a",
  body: "#f9d64c",
  belly: "#fbeea2",
  wing: "#f4b641",
  eye: "#1b1b1b",
  beak: "#f79d2a",
  highlight: "#ffffff",
};

const WING_ANGLES = [-0.8, 0.45];

let obstacles = [];
let score = 0;
const storedHigh =
  localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
let highScore = Number(storedHigh || 0);
let lastTime = performance.now();
let spawnAccumulator = 0;

const state = {
  started: false,
  running: false,
  over: false,
};

function resetGame() {
  obstacles = [];
  score = 0;
  player.y = WORLD.height / 2;
  player.velocity = 0;
  player.frame = 0;
  player.animationTimer = 0;
  spawnAccumulator = 0;
  state.started = false;
  state.running = false;
  state.over = false;
  overlay.classList.add("overlay--hidden");
  updateScoreboard();
}

function startGame() {
  if (state.running) return;
  state.started = true;
  state.running = true;
  state.over = false;
  spawnAccumulator = SPEED.spawnInterval * 0.6;
}

function gameOver() {
  state.running = false;
  state.over = true;
  finalScoreEl.textContent = `Score: ${score}`;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(STORAGE_KEY, highScore);
    if (localStorage.getItem(LEGACY_KEY)) {
      localStorage.removeItem(LEGACY_KEY);
    }
  }
  renderShareCard();
  overlay.classList.remove("overlay--hidden");
  updateScoreboard();
}

function spawnObstacle() {
  const gapSize = 120;
  const minGapY = 80;
  const maxGapY = WORLD.groundY - 80;
  const gapY =
    Math.random() * (maxGapY - minGapY) + minGapY;
  const width = 64;

  obstacles.push({
    x: WORLD.width + width,
    width,
    gapY,
    gapSize,
    passed: false,
  });
}

function update(deltaMs) {
  const delta = Math.min(deltaMs, 60);
  const deltaSeconds = delta / 1000;

  stepBirdAnimation(deltaSeconds);

  if (!state.running) return;

  spawnAccumulator += delta;
  if (spawnAccumulator >= SPEED.spawnInterval) {
    spawnObstacle();
    spawnAccumulator -= SPEED.spawnInterval;
  }

  player.velocity += PHYSICS.gravity * deltaSeconds;
  player.velocity = Math.max(
    Math.min(player.velocity, PHYSICS.maxVelocity),
    -PHYSICS.maxVelocity
  );
  player.y += player.velocity * deltaSeconds;

  if (player.y < 16) {
    player.y = 16;
    player.velocity = 0;
  }
  if (player.y + player.height > WORLD.groundY) {
    player.y = WORLD.groundY - player.height;
    gameOver();
  }

  const moveBy = SPEED.world * deltaSeconds;
  obstacles.forEach((obstacle) => {
    obstacle.x -= moveBy;
    if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
      obstacle.passed = true;
      score += 1;
      updateScoreboard();
    }

    if (collidesWithObstacle(obstacle)) {
      gameOver();
    }
  });

  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);
}

function collidesWithObstacle(obstacle) {
  const px = player.x;
  const py = player.y;
  const pw = player.width;
  const ph = player.height;
  const ox = obstacle.x;
  const ow = obstacle.width;
  const gapHalf = obstacle.gapSize / 2;
  const upperLimit = obstacle.gapY - gapHalf;
  const lowerLimit = obstacle.gapY + gapHalf;

  const horizontalOverlap = px + pw > ox && px < ox + ow;
  if (!horizontalOverlap) return false;

  if (py < upperLimit || py + ph > lowerLimit) {
    return true;
  }

  return false;
}

function stepBirdAnimation(deltaSeconds) {
  const cycle = state.running ? 0.12 : 0.24;
  player.animationTimer += deltaSeconds;
  if (player.animationTimer >= cycle) {
    player.animationTimer = 0;
    player.frame = (player.frame + 1) % WING_ANGLES.length;
  }
}

function updateScoreboard() {
  scoreEl.textContent = score.toString().padStart(5, "0");
  highScoreEl.textContent = highScore.toString().padStart(5, "0");
}

function drawBackground() {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.strokeStyle = "#292929";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.groundY + 6);
  ctx.lineTo(WORLD.width, WORLD.groundY + 6);
  ctx.stroke();

  ctx.fillStyle = "#eaeaea";
  stars.forEach((star) => {
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });

  ctx.strokeStyle = "#333333";
  ctx.beginPath();
  ctx.moveTo(0, WORLD.groundY);
  ctx.lineTo(WORLD.width, WORLD.groundY);
  ctx.stroke();
}

function drawBird(x, y, frame) {
  ctx.save();
  ctx.translate(x, y);

  // tail outline
  ctx.fillStyle = BIRD_COLORS.outline;
  ctx.beginPath();
  ctx.moveTo(6, 18);
  ctx.lineTo(0, 14);
  ctx.lineTo(0, 24);
  ctx.closePath();
  ctx.fill();

  // tail fill
  ctx.fillStyle = BIRD_COLORS.body;
  ctx.beginPath();
  ctx.moveTo(6, 18);
  ctx.lineTo(2, 16);
  ctx.lineTo(2, 22);
  ctx.closePath();
  ctx.fill();

  // body outline
  ctx.fillStyle = BIRD_COLORS.outline;
  ctx.beginPath();
  ctx.ellipse(26, 18, 24, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // body fill
  ctx.fillStyle = BIRD_COLORS.body;
  ctx.beginPath();
  ctx.ellipse(26, 18, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // belly
  ctx.fillStyle = BIRD_COLORS.belly;
  ctx.beginPath();
  ctx.ellipse(24, 22, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // wing
  ctx.save();
  ctx.translate(28, 20);
  const wingAngle = WING_ANGLES[frame % WING_ANGLES.length] || WING_ANGLES[0];
  ctx.rotate(wingAngle);
  ctx.fillStyle = BIRD_COLORS.outline;
  ctx.beginPath();
  ctx.ellipse(-14, 0, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BIRD_COLORS.wing;
  ctx.beginPath();
  ctx.ellipse(-13, 0, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // beak
  ctx.fillStyle = BIRD_COLORS.beak;
  ctx.beginPath();
  ctx.moveTo(42, 18);
  ctx.lineTo(52, 21);
  ctx.lineTo(42, 24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = BIRD_COLORS.outline;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(42, 18);
  ctx.lineTo(52, 21);
  ctx.lineTo(42, 24);
  ctx.closePath();
  ctx.stroke();

  // eye
  ctx.fillStyle = BIRD_COLORS.eye;
  ctx.beginPath();
  ctx.arc(36, 18, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // eye highlight
  ctx.fillStyle = BIRD_COLORS.highlight;
  ctx.beginPath();
  ctx.arc(35.2, 17, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawObstacle(obstacle) {
  const { x, width, gapY, gapSize } = obstacle;
  const gapHalf = gapSize / 2;
  const topHeight = gapY - gapHalf;
  const bottomHeight = WORLD.groundY - (gapY + gapHalf);

  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(x, 0, width, topHeight);
  ctx.fillRect(x, gapY + gapHalf, width, bottomHeight);

  ctx.fillStyle = "#1f1f1f";
  ctx.fillRect(x, topHeight - 6, width, 6);
  ctx.fillRect(x, gapY + gapHalf, width, 6);
}

function drawIdlePrompt() {
  ctx.fillStyle = "#f0f0f0";
  ctx.font = "22px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillText("FLAPPY BIRD", WORLD.width / 2, WORLD.height / 2 - 52);

  ctx.fillStyle = "#9d9d9d";
  ctx.font = "16px 'Press Start 2P', monospace";
  ctx.fillText("Press ↑ to start", WORLD.width / 2, WORLD.height / 2);

  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText("Hold ↑ to soar • Press ↓ to dive", WORLD.width / 2, WORLD.height / 2 + 28);
}

function draw() {
  drawBackground();
  obstacles.forEach(drawObstacle);
  if (!state.over) {
    drawBird(player.x, player.y, player.frame);
  }

  if (!state.started) {
    drawIdlePrompt();
  }
}

function loop(now) {
  const delta = now - lastTime;
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function applyFlapImpulse(direction) {
  if (!state.started) startGame();

  if (direction === "up") {
    player.velocity = PHYSICS.flapImpulse;
    player.frame = 0;
    player.animationTimer = 0;
  } else if (direction === "down") {
    player.velocity = Math.min(
      player.velocity + PHYSICS.diveImpulse * 0.6,
      PHYSICS.maxVelocity
    );
    player.frame = 1;
    player.animationTimer = 0;
  }
}

function handleKeydown(event) {
  if (event.repeat) return;
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.over) return;
    applyFlapImpulse("up");
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.over) return;
    applyFlapImpulse("down");
  } else if (event.key === "Enter" && state.over) {
    event.preventDefault();
    resetGame();
  }
}

function renderShareCard() {
  const width = shareCanvas.width;
  const height = shareCanvas.height;
  shareCtx.fillStyle = "#121212";
  shareCtx.fillRect(0, 0, width, height);

  const gradient = shareCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(60,60,60,0.25)");
  gradient.addColorStop(1, "rgba(18,18,18,0.8)");
  shareCtx.fillStyle = gradient;
  shareCtx.fillRect(14, 14, width - 28, height - 28);

  shareCtx.strokeStyle = "#2d2d2d";
  shareCtx.lineWidth = 4;
  shareCtx.strokeRect(14, 14, width - 28, height - 28);

  shareCtx.fillStyle = "#f2f2f2";
  shareCtx.font = "28px 'Press Start 2P', monospace";
  shareCtx.textAlign = "center";
  shareCtx.fillText("FLAPPY BIRD", width / 2, 86);

  shareCtx.font = "18px 'Press Start 2P', monospace";
  shareCtx.fillStyle = "#9d9d9d";
  shareCtx.fillText(`Score ${score.toString().padStart(5, "0")}`, width / 2, 148);
  shareCtx.fillText(`Best  ${highScore.toString().padStart(5, "0")}`, width / 2, 192);

  shareCtx.font = "12px 'Press Start 2P', monospace";
  shareCtx.fillStyle = "#666666";
  shareCtx.fillText("#FlappyBird", width / 2, height - 48);
  shareCtx.fillText("chrome vibes • offline flaps", width / 2, height - 28);
}

function downloadShareImage() {
  const dataUrl = shareCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `flappy-dino-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function init() {
  updateScoreboard();
  resetGame();
  requestAnimationFrame((time) => {
    lastTime = time;
    loop(time);
  });
}

document.addEventListener("keydown", handleKeydown, { passive: false });
restartBtn.addEventListener("click", resetGame);
shareBtn.addEventListener("click", downloadShareImage);

init();
