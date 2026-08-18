(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highscoreEl = document.getElementById("highscore");
  const hitsEl = document.getElementById("hits");
  const levelEl = document.getElementById("level");
  const startScreen = document.getElementById("start-screen");
  const startBtn = document.getElementById("start-btn");
  const newRoundBtn = document.getElementById("new-round-btn");
  const janettePopup = document.getElementById("janette-popup");
  const messageEl = document.getElementById("message");
  const titleJoe = document.querySelector(".title-joe");
  const titleJoeFallback = document.getElementById("title-joe-fallback");
  const janetteImg = document.getElementById("janette-img");
  const janetteFallback = document.getElementById("janette-fallback");

  const sfxHit = document.getElementById("sfx-hit");
  const sfxJanette = document.getElementById("sfx-janette");
  const sfxThrow = document.getElementById("sfx-throw");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;
  let score = 0;
  let hits = 0;
  let level = 1;
  let hitStreak = 0;
  let highScore = loadHighScore();
  let lastTime = 0;
  let messageTimer = 0;
  let janetteTimer = 0;
  let audioCtx = null;
  let audioReady = false;

  const JANETTE_DURATION = 2200;
  const PROJECTILE_GRAVITY = 1000; // pixels per second squared
  const particles = [];
  const projectiles = [];
  const backgroundDots = [];

  const joeImg = new Image();
  let joeImageLoaded = false;
  joeImg.addEventListener("load", () => {
    joeImageLoaded = joeImg.naturalWidth > 0;
  });
  joeImg.addEventListener("error", () => {
    joeImageLoaded = false;
  });
  joeImg.src = "assets/joe.jpg";

  // The photo is preserved when present; the canvas game remains playable if it is not yet supplied.
  function showTitleImageFallback() {
    titleJoe.classList.add("hidden");
    titleJoeFallback.classList.remove("hidden");
  }

  titleJoe.addEventListener("error", showTitleImageFallback);
  if (titleJoe.complete && titleJoe.naturalWidth === 0) {
    showTitleImageFallback();
  }

  function showJanetteImageFallback() {
    janetteImg.classList.add("hidden");
    janetteFallback.classList.remove("hidden");
  }

  janetteImg.addEventListener("error", showJanetteImageFallback);
  if (janetteImg.complete && janetteImg.naturalWidth === 0) {
    showJanetteImageFallback();
  }

  const joe = {
    x: 0,
    y: 0,
    w: 160,
    h: 213,
    baseSpeed: 48,
    facing: 1,
    shake: 0,
    hitFlash: 0
  };

  const projectileTypes = [
    { name: "golf", radius: 11, speed: 930, points: 45, color: "#f0f0f0", emoji: "⛳" },
    { name: "football", radius: 20, speed: 690, points: 22, color: "#8B4513", emoji: "🏈" },
    { name: "mic", radius: 24, speed: 520, points: 12, color: "#333", emoji: "🎤" }
  ];

  const pointer = {
    activeId: null,
    down: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    dragging: false
  };

  let aimLine = null;

  function loadHighScore() {
    try {
      const stored = Number(window.localStorage.getItem("dfwj-high"));
      return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
    } catch (_) {
      return 0;
    }
  }

  function saveHighScore() {
    try {
      window.localStorage.setItem("dfwj-high", String(highScore));
    } catch (_) {
      // Storage can be blocked in private browsing; play continues without persistence.
    }
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function createBackground() {
    backgroundDots.length = 0;
    const dotCount = Math.max(7, Math.min(14, Math.round((width * height) / 110000)));

    for (let i = 0; i < dotCount; i += 1) {
      backgroundDots.push({
        x: Math.random(),
        y: Math.random(),
        radius: randomBetween(44, 128),
        alpha: randomBetween(0.009, 0.024)
      });
    }
  }

  function resize() {
    const previousWidth = width || window.innerWidth;
    const normalizedJoeX = joe.x / Math.max(previousWidth, 1);

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    joe.w = Math.max(118, Math.min(210, width * 0.25));
    joe.h = joe.w * 1.33;
    joe.y = height * 0.32;

    const sidePadding = joe.w * 0.46 + 20;
    if (running) {
      joe.x = Math.min(width - sidePadding, Math.max(sidePadding, normalizedJoeX * width));
    } else {
      joe.x = width / 2;
    }

    createBackground();
  }

  function showMessage(text, duration = 900) {
    messageEl.textContent = text;
    messageEl.classList.remove("hidden");
    messageEl.classList.add("show");

    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      messageEl.classList.remove("show");
      window.setTimeout(() => messageEl.classList.add("hidden"), 220);
    }, duration);
  }

  // Safari/iOS requires a user gesture before Web Audio can be created or resumed.
  async function initializeAudioFromGesture() {
    if (audioReady) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      audioCtx = audioCtx || new AudioContextClass();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioReady = audioCtx.state === "running";
    } catch (_) {
      audioCtx = null;
      audioReady = false;
    }
  }

  function optionalAudioSource(audio) {
    return Boolean(audio.getAttribute("src") || audio.querySelector("source"));
  }

  function playOptionalAudio(audio, fallback) {
    if (!audioReady) return;

    if (optionalAudioSource(audio)) {
      try {
        audio.currentTime = 0;
        const playResult = audio.play();
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch(fallback);
        }
        return;
      } catch (_) {
        fallback();
        return;
      }
    }

    fallback();
  }

  function synthesizeHit() {
    if (!audioReady || !audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.35);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    } catch (_) {
      // Sound must never interrupt play.
    }
  }

  function synthesizeJanette() {
    if (!audioReady || !audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.linearRampToValueAtTime(920, now + 0.15);
      osc.frequency.linearRampToValueAtTime(780, now + 0.55);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.linearRampToValueAtTime(0.21, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.75);
    } catch (_) {
      // Sound must never interrupt play.
    }
  }

  function synthesizeThrow() {
    if (!audioReady || !audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_) {
      // Sound must never interrupt play.
    }
  }

  function playHitSound() {
    playOptionalAudio(sfxHit, synthesizeHit);
  }

  function playJanetteSound() {
    playOptionalAudio(sfxJanette, synthesizeJanette);
  }

  function playThrowSound() {
    playOptionalAudio(sfxThrow, synthesizeThrow);
  }

  function spawnProjectile(targetX, targetY, power = 1) {
    const type = projectileTypes[Math.floor(Math.random() * projectileTypes.length)];
    const startX = width / 2 + randomBetween(-40, 40);
    const startY = height - 30;
    let dx = targetX - startX;
    let dy = targetY - startY;
    const length = Math.hypot(dx, dy) || 1;
    const speed = type.speed * (0.7 + Math.min(power, 1.8) * 0.6);

    dx /= length;
    dy /= length;

    projectiles.push({
      x: startX,
      y: startY,
      vx: dx * speed,
      vy: dy * speed,
      radius: type.radius,
      points: type.points,
      color: type.color,
      emoji: type.emoji,
      rotation: 0,
      rotSpeed: randomBetween(-12, 12),
      alive: true
    });

    playThrowSound();
  }

  function spawnHitParticles(x, y, color) {
    for (let i = 0; i < 14; i += 1) {
      particles.push({
        x,
        y,
        vx: randomBetween(-240, 240),
        vy: randomBetween(-360, -65),
        life: 0.7,
        color,
        size: randomBetween(2, 5)
      });
    }
  }

  function levelSpeedMultiplier() {
    // Makes levels 2–4 clearly faster while retaining room to react at higher levels.
    return 1 + 0.72 * Math.pow(Math.max(0, level - 1), 1.05);
  }

  function triggerJanette() {
    janetteTimer = JANETTE_DURATION;
    janettePopup.classList.remove("hidden");
    void janettePopup.offsetWidth;
    janettePopup.classList.add("show");
    playJanetteSound();
    showMessage("JOEEEEEEE!", 1400);
  }

  function updateUI() {
    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }

    scoreEl.textContent = String(score);
    highscoreEl.textContent = String(highScore);
    hitsEl.textContent = String(hits);
    levelEl.textContent = String(level);
  }

  function update(dt) {
    if (!running) return;

    const seconds = Math.min(dt, 50) / 1000;
    const halfW = joe.w * 0.42;
    joe.x += joe.baseSpeed * levelSpeedMultiplier() * joe.facing * seconds;

    if (joe.x < halfW + 20) {
      joe.x = halfW + 20;
      joe.facing = 1;
    } else if (joe.x > width - halfW - 20) {
      joe.x = width - halfW - 20;
      joe.facing = -1;
    }

    joe.y = height * 0.32 + Math.sin(performance.now() / 450) * 6;
    joe.shake = Math.max(0, joe.shake - 90 * seconds);
    joe.hitFlash = Math.max(0, joe.hitFlash - dt);

    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      if (!projectile.alive) {
        projectiles.splice(i, 1);
        continue;
      }

      projectile.vy += PROJECTILE_GRAVITY * seconds;
      projectile.x += projectile.vx * seconds;
      projectile.y += projectile.vy * seconds;
      projectile.rotation += projectile.rotSpeed * seconds;

      if (projectile.y > height + 70 || projectile.x < -70 || projectile.x > width + 70) {
        projectile.alive = false;
        hitStreak = 0;
        continue;
      }

      const headX = joe.x;
      const headY = joe.y - joe.h * 0.18;
      const headRadius = joe.w * 0.46; // Slightly friendlier than the original approximation.

      if (distance(projectile.x, projectile.y, headX, headY) < projectile.radius + headRadius) {
        projectile.alive = false;
        hits += 1;
        hitStreak += 1;

        const comboBonus = Math.min(hitStreak - 1, 5) * 5;
        const gained = projectile.points + comboBonus;
        score += gained;
        joe.shake = 14;
        joe.hitFlash = 180;

        spawnHitParticles(projectile.x, projectile.y, projectile.color);
        playHitSound();

        const nextLevel = Math.floor(hits / 5) + 1;
        if (nextLevel > level) {
          level = nextLevel;
          showMessage(`LEVEL ${level}! Joe is moving faster.`, 1150);
        } else if (hitStreak >= 3) {
          showMessage(`${hitStreak}x COMBO! +${gained}`, 850);
        }

        if (hits % 3 === 0) {
          triggerJanette();
        }

        updateUI();
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.vy += 720 * seconds;
      particle.life -= seconds / 0.7;

      if (particle.life <= 0) {
        particles.splice(i, 1);
      }
    }

    if (janetteTimer > 0) {
      janetteTimer -= dt;
      if (janetteTimer <= 0) {
        janettePopup.classList.remove("show");
        window.setTimeout(() => janettePopup.classList.add("hidden"), 300);
      }
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    for (const dot of backgroundDots) {
      ctx.fillStyle = `rgba(255,255,255,${dot.alpha})`;
      ctx.beginPath();
      ctx.arc(dot.x * width, dot.y * height, dot.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFallbackJoe() {
    const headRadius = joe.w * 0.37;
    ctx.save();
    ctx.fillStyle = "#202020";
    ctx.fillRect(-joe.w * 0.29, -joe.h * 0.02, joe.w * 0.58, joe.h * 0.46);
    ctx.fillStyle = joe.hitFlash > 0 ? "#ff7373" : "#cb9f83";
    ctx.beginPath();
    ctx.arc(0, -joe.h * 0.18, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#161616";
    ctx.beginPath();
    ctx.arc(-headRadius * 0.35, -joe.h * 0.2, 6, 0, Math.PI * 2);
    ctx.arc(headRadius * 0.35, -joe.h * 0.2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `800 ${Math.max(15, joe.w * 0.11)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("JOE", 0, joe.h * 0.16);
    ctx.restore();
  }

  function drawJoe() {
    const shakeX = joe.shake ? randomBetween(-joe.shake / 2, joe.shake / 2) : 0;
    const shakeY = joe.shake ? randomBetween(-joe.shake * 0.3, joe.shake * 0.3) : 0;

    ctx.save();
    ctx.translate(joe.x + shakeX, joe.y + shakeY);
    ctx.scale(joe.facing > 0 ? 1 : -1, 1);

    if (joe.hitFlash > 0) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(joe.hitFlash * 0.1);
    }

    if (joeImageLoaded) {
      ctx.drawImage(joeImg, -joe.w / 2, -joe.h / 2, joe.w, joe.h);
    } else {
      drawFallbackJoe();
    }

    ctx.restore();
  }

  function drawAimLine() {
    if (!aimLine) return;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.58)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(aimLine.x1, aimLine.y1);
    ctx.lineTo(aimLine.x2, aimLine.y2);
    ctx.stroke();
    ctx.setLineDash([]);

    const power = Math.min(aimLine.power, 1.6);
    ctx.beginPath();
    ctx.arc(aimLine.x1, aimLine.y1, 10 + power * 18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, ${Math.floor(180 - power * 60)}, 50, 0.72)`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawProjectiles() {
    for (const projectile of projectiles) {
      if (!projectile.alive) continue;

      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(projectile.rotation);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.arc(2, 3, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.27)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `${projectile.radius * 1.3}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(projectile.emoji, 0, 1);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    drawAimLine();
    drawJoe();
    drawProjectiles();
    drawParticles();

    if (running) {
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.fillRect(0, height - 50, width, 50);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("tap / click or drag to throw", width / 2, height - 18);
    }
  }

  function loop(timestamp) {
    const dt = lastTime ? Math.min(timestamp - lastTime, 50) : 1000 / 60;
    lastTime = timestamp;
    update(dt);
    draw();
    window.requestAnimationFrame(loop);
  }

  function getPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function resetPointer() {
    pointer.activeId = null;
    pointer.down = false;
    pointer.dragging = false;
    aimLine = null;
  }

  function onPointerDown(event) {
    if (!running || pointer.down) return;

    event.preventDefault();
    const position = getPosition(event);
    pointer.activeId = event.pointerId;
    pointer.down = true;
    pointer.dragging = false;
    pointer.startX = position.x;
    pointer.startY = position.y;
    pointer.x = position.x;
    pointer.y = position.y;

    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture is an enhancement, not a gameplay dependency.
      }
    }
  }

  function onPointerMove(event) {
    if (!running || !pointer.down || event.pointerId !== pointer.activeId) return;

    event.preventDefault();
    const position = getPosition(event);
    pointer.x = position.x;
    pointer.y = position.y;

    const dragDistance = distance(pointer.startX, pointer.startY, position.x, position.y);
    if (dragDistance > 12) {
      pointer.dragging = true;
      aimLine = {
        x1: width / 2,
        y1: height - 30,
        x2: position.x,
        y2: position.y,
        power: Math.min(dragDistance / 140, 1.8)
      };
    }
  }

  function onPointerUp(event) {
    if (!running || !pointer.down || event.pointerId !== pointer.activeId) return;

    event.preventDefault();
    const position = getPosition(event);

    if (pointer.dragging && aimLine) {
      spawnProjectile(aimLine.x2, aimLine.y2, aimLine.power);
    } else {
      spawnProjectile(position.x, position.y, 1);
    }

    if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_) {
        // No action required when the browser already released capture.
      }
    }

    resetPointer();
  }

  function startGame() {
    void initializeAudioFromGesture();
    score = 0;
    hits = 0;
    level = 1;
    hitStreak = 0;
    projectiles.length = 0;
    particles.length = 0;
    joe.x = width / 2;
    joe.facing = Math.random() > 0.5 ? 1 : -1;
    joe.shake = 0;
    joe.hitFlash = 0;
    janetteTimer = 0;
    resetPointer();
    janettePopup.classList.add("hidden");
    janettePopup.classList.remove("show");
    updateUI();
    startScreen.classList.add("hidden");
    running = true;
    showMessage("DON'T FUCK WITH JOE.", 1050);
  }

  startBtn.addEventListener("click", startGame);
  newRoundBtn.addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", resetPointer);
  canvas.addEventListener("lostpointercapture", resetPointer);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", resize, { passive: true });

  updateUI();
  resize();
  window.requestAnimationFrame(loop);
})();
