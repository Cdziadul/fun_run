(() => {
  'use strict';
  const menu = document.querySelector('main');
  const canvas = document.createElement('canvas');
  canvas.id = 'game'; canvas.hidden = true;
  canvas.setAttribute('aria-label', 'Alien escape runner. Arrow keys move and jump. Space shoots. P pauses.');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const hud = document.createElement('div'); hud.id = 'hud'; hud.hidden = true;
  document.body.append(hud);
  const overlay = document.createElement('div'); overlay.id = 'overlay'; overlay.hidden = true;
  document.body.append(overlay);
  const touch = document.createElement('div'); touch.id = 'touch'; touch.hidden = true;
  touch.innerHTML = '<div><button data-key="ArrowLeft" aria-label="Move left">←</button><button data-key="ArrowRight" aria-label="Move right">→</button></div><div><button data-key="ArrowUp">Jump</button><button data-key="Space">Shoot</button></div>';
  document.body.append(touch);
  const W = 1100, H = 620, ground = 490;
  let mode = 'menu', previous = 0, time = 0, camera = 0, speed = 235;
  let platforms = [], enemies = [], birds = [], obstacles = [], bullets = [], sparks = [];
  let birdKills = 0, nextBird = 8;
  let player, edge, kills, score, best = 0, cooldown = 0, jumpBuffer = 0, coyote = 0;
  const keys = new Set();
  try { best = Number(localStorage.getItem('fun-run-best')) || 0; } catch {}
  const random = (a, b) => a + Math.random() * (b - a);
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  }
  addEventListener('resize', resize); resize();
  function addPlatform(x, w, bridge = false) { platforms.push({ x, y: ground, w, h: 30, bridge, timer: null, fall: 0 }); }
  function generate() {
    while (edge < camera + W + 800) {
      const gap = random(90, 155);
      if (Math.random() < .55) {
        for (let x = edge; x < edge + gap; x += 36) addPlatform(x, Math.min(36, edge + gap - x), true);
      }
      const start = edge + gap, length = random(430, 670);
      addPlatform(start, length);
      if (Math.random() < .75) enemies.push({ x: start + length * .67, y: ground - 42, w: 34, h: 42, phase: random(0, 6) });
      obstacles.push({ x: start + 110, y: ground - 35, w: 38, h: 35 });
      edge = start + length;
    }
  }
  function start() {
    time = camera = kills = score = cooldown = jumpBuffer = coyote = 0; speed = 235;
    player = { x: 150, y: ground - 48, w: 30, h: 48, vy: 0, grounded: true };
    platforms = []; enemies = []; birds = []; obstacles = []; bullets = []; sparks = []; keys.clear();
    birdKills = 0; nextBird = 8;
    addPlatform(-200, 1100); edge = 900; generate();
    menu.hidden = true; canvas.hidden = hud.hidden = touch.hidden = false; overlay.hidden = true;
    document.body.classList.add('playing'); mode = 'running'; previous = performance.now();
  }
  function panel(title, message, label, action) {
    overlay.innerHTML = `<section><h2>${title}</h2><p>${message}</p><button type="button">${label}</button></section>`;
    overlay.hidden = false; const button = overlay.querySelector('button'); button.onclick = action; button.focus();
  }
  function end(reason) {
    mode = 'over'; keys.clear(); best = Math.max(best, score);
    try { localStorage.setItem('fun-run-best', String(best)); } catch {}
    panel('RUN COMPLETE', `${reason}<br>Score: ${score.toLocaleString()} · Aliens: ${kills} · Birds: ${birdKills}<br>Survived ${time.toFixed(1)}s · Best: ${best.toLocaleString()}`, 'PLAY AGAIN', start);
  }
  function pause() {
    if (mode !== 'running') return;
    mode = 'paused'; keys.clear();
    panel('PAUSED', 'Take a breath. Your run is waiting.', 'RESUME', () => { mode = 'running'; overlay.hidden = true; previous = performance.now(); });
  }
  function press(key) {
    if (mode !== 'running') return;
    if (key === 'ArrowUp' && !keys.has(key)) jumpBuffer = .14;
    keys.add(key);
  }
  addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && mode !== 'menu') e.preventDefault();
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      if (mode === 'running') pause(); else if (mode === 'paused') overlay.querySelector('button').click();
    }
    press(e.code);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  touch.querySelectorAll('button').forEach(button => {
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); press(button.dataset.key); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(button.dataset.key));
  });
  document.getElementById('play').addEventListener('click', start);
  function burst(x, y) {
    for (let i = 0; i < 12; i++) sparks.push({ x, y, vx: random(-160, 160), vy: random(-180, 100), life: .5 });
  }
  function updateBirds(dt) {
    nextBird -= dt;
    if (nextBird <= 0 && birds.length === 0) {
      // Predict the impact point and allow early encounters only on clear solid ground.
      const targetX = player.x + speed * 1.6;
      const safe = platforms.some(p => !p.bridge && p.x < targetX - 80 && p.x + p.w > targetX + 110)
        && ![...obstacles, ...enemies].some(o => o.x < targetX + 110 && o.x + o.w > targetX - 80);
      if (time > 35 || safe) {
        birds.push({ x: player.x + 490, y: 100, w: 38, h: 24, age: 0, state: 'approach' });
        nextBird = random(Math.max(3.5, 7 - time * .035), Math.max(5, 10 - time * .035));
      } else nextBird = .4;
    }
    for (const bird of birds) {
      bird.age += dt;
      if (bird.state === 'approach') {
        bird.x += (speed - 110) * dt;
        bird.y = 100 + Math.min(1, bird.age / .9) * 200;
        if (bird.age >= .9) {
          bird.state = 'dive'; bird.age = 0;
          bird.startX = bird.x; bird.startY = bird.y;
          // Lock once: movement after this warning can dodge the dive.
          bird.targetX = player.x + speed * .7;
          bird.targetY = ground - 42;
        }
      } else if (bird.state === 'dive') {
        const t = Math.min(1, bird.age / .7);
        bird.x = bird.startX + (bird.targetX - bird.startX) * t;
        bird.y = bird.startY + (bird.targetY - bird.startY) * t * t;
        if (t === 1) { bird.state = 'climb'; bird.age = 0; }
      } else {
        bird.x += (speed - 240) * dt;
        bird.y -= 300 * dt;
      }
    }
  }
  function update(dt) {
    time += dt; speed = Math.min(380, 235 + time * 1.7); camera += speed * dt;
    const direction = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
    player.x += (speed + direction * 190) * dt;
    player.x = Math.min(camera + W * .72, player.x);
    jumpBuffer -= dt; coyote = player.grounded ? .1 : coyote - dt;
    if (jumpBuffer > 0 && coyote > 0) { player.vy = -625; player.grounded = false; coyote = 0; jumpBuffer = 0; }
    const oldBottom = player.y + player.h;
    player.vy += 1750 * dt; player.y += player.vy * dt; player.grounded = false;
    for (const p of platforms) {
      if (p.timer !== null) { p.timer -= dt; if (p.timer <= 0) { p.fall += 1600 * dt; p.y += p.fall * dt; } }
      if (p.fall || player.vy < 0) continue;
      if (player.x + player.w > p.x && player.x < p.x + p.w && oldBottom <= p.y + 1 && player.y + player.h >= p.y) {
        player.y = p.y - player.h; player.vy = 0; player.grounded = true;
        if (p.bridge && p.timer === null) p.timer = .23;
      }
    }
    updateBirds(dt);
    cooldown -= dt;
    if (keys.has('Space') && cooldown <= 0) {
      bullets.push({ x: player.x + player.w + 12, y: player.y + 20, w: 16, h: 5 }); cooldown = .17;
    }
    for (const b of bullets) {
      b.x += 950 * dt;
      for (const e of enemies) if (!e.dead && !b.dead && overlaps(b, e)) {
        e.dead = b.dead = true; kills++; burst(e.x + 17, e.y + 20);
      }
      for (const bird of birds) if (!bird.dead && !b.dead && overlaps(b, bird)) {
        bird.dead = b.dead = true; birdKills++; burst(bird.x + 19, bird.y + 12);
      }
    }
    bullets = bullets.filter(b => !b.dead && b.x < camera + W + 100);
    enemies = enemies.filter(e => !e.dead && e.x > camera - 100);
    birds = birds.filter(b => !b.dead && b.x + b.w > camera - 100 && b.y > -80);
    platforms = platforms.filter(p => p.x + p.w > camera - 100 && p.y < H + 150);
    obstacles = obstacles.filter(o => o.x + o.w > camera - 100);
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; s.life -= dt; }
    sparks = sparks.filter(s => s.life > 0);
    score = Math.floor(time * 10) + kills * 100 + birdKills * 150;
    hud.innerHTML = `<div>${score.toLocaleString()} POINTS<small>${time.toFixed(1)}s · ${kills} aliens × 100 · ${birdKills} birds × 150</small></div><div>BEST ${best.toLocaleString()}<small>↑ Jump · Space Shoot · P Pause</small></div>`;
    if (birds.some(b => overlaps(player, b))) return end('A swooping bird caught you.');
    if (enemies.some(e => overlaps(player, e))) return end('An alien caught you.');
    if (obstacles.some(o => overlaps(player, o))) return end('Watch out for the spikes.');
    if (player.y > H || player.x + player.w < camera) return end('The outpost claimed another runner.');
    generate();
  }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function draw() {
    const scale = Math.min(canvas.width / W, canvas.height / H);
    ctx.setTransform(1, 0, 0, 1, 0, 0); rect(0, 0, canvas.width, canvas.height, '#0b1020');
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - W * scale) / 2, (canvas.height - H * scale) / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0b1020'); sky.addColorStop(1, '#193b49');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 65; i++) rect(((i * 157 - camera * .08) % W + W) % W, (i * 71) % 340, 2, 2, '#7d9db4');
    ctx.fillStyle = '#b6e8d9'; ctx.beginPath(); ctx.arc(860 - camera * .015 % 1200, 105, 43, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 14; i++) {
      const x = i * 140 - camera * .25 % 140;
      rect(x, 310 - i % 3 * 35, 90, 260, '#112936'); rect(x + 12, 330 - i % 3 * 35, 8, 8, '#28535b');
    }
    ctx.save(); ctx.translate(-camera, 0);
    for (const p of platforms) {
      if (p.bridge) {
        rect(p.x, p.y, p.w - 2, 12, p.timer !== null ? '#ffb458' : '#bd8852');
        rect(p.x + 5, p.y + 12, 4, 15, '#745235');
      } else {
        rect(p.x, p.y, p.w, 180, '#182830'); rect(p.x, p.y, p.w, 6, '#70ebbe');
        for (let x = p.x + 15; x < p.x + p.w; x += 42) rect(x, p.y + 25, 22, 3, '#2b4046');
      }
    }
    for (const o of obstacles) {
      ctx.fillStyle = '#ff737e';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(o.x + i * 13, ground); ctx.lineTo(o.x + i * 13 + 6, o.y); ctx.lineTo(o.x + i * 13 + 13, ground); ctx.fill(); }
    }
    for (const e of enemies) {
      const bob = Math.sin(time * 5 + e.phase) * 2;
      rect(e.x + 4, e.y + 8 + bob, 26, 25, '#bb90ff'); rect(e.x, e.y + 13 + bob, 34, 12, '#bb90ff');
      rect(e.x + 6, e.y + 15 + bob, 7, 8, '#142139'); rect(e.x + 21, e.y + 15 + bob, 7, 8, '#142139');
      rect(e.x + 5, e.y + 33, 7, 9, '#8c66c5'); rect(e.x + 23, e.y + 33, 7, 9, '#8c66c5');
      rect(e.x + 7, e.y, 3, 9, '#bb90ff'); rect(e.x + 24, e.y, 3, 9, '#bb90ff');
    }
    for (const bird of birds) {
      if (bird.state === 'dive') {
        ctx.strokeStyle = '#ffbc70'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(bird.targetX + bird.w / 2, ground - 2, 27, 6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const wing = Math.sin(time * 22) * 14;
      ctx.fillStyle = '#ffbc70';
      ctx.beginPath(); ctx.moveTo(bird.x + 18, bird.y + 12);
      ctx.lineTo(bird.x - 12, bird.y - 6 + wing); ctx.lineTo(bird.x + 6, bird.y + 20);
      ctx.lineTo(bird.x + 33, bird.y + 18); ctx.lineTo(bird.x + 49, bird.y - 6 + wing); ctx.closePath(); ctx.fill();
      rect(bird.x + 4, bird.y + 6, 28, 16, '#ef895f');
      rect(bird.x, bird.y + 9, 10, 10, '#ffd7a0'); rect(bird.x + 3, bird.y + 10, 4, 4, '#172339');
      ctx.fillStyle = '#ffe8a8'; ctx.beginPath(); ctx.moveTo(bird.x, bird.y + 13); ctx.lineTo(bird.x - 10, bird.y + 17); ctx.lineTo(bird.x, bird.y + 19); ctx.fill();
    }
    const p = player, step = p.grounded ? Math.sin(time * 19) * 5 : 3;
    rect(p.x + 5, p.y, 23, 20, '#e8f5fa'); rect(p.x + 15, p.y + 5, 15, 9, '#52d7c2');
    rect(p.x + 4, p.y + 20, 22, 18, '#55ddb4'); rect(p.x - 3, p.y + 22, 7, 17, '#319d90');
    rect(p.x + 5, p.y + 36, 8, 12 + step, '#d5e8ef'); rect(p.x + 19, p.y + 36, 8, 12 - step, '#d5e8ef');
    rect(p.x + 22, p.y + 23, 22, 7, '#d7e5ed'); rect(p.x + 34, p.y + 19, 13, 7, '#8fa8bd');
    for (const b of bullets) { rect(b.x, b.y, b.w, b.h, '#fff1a1'); rect(b.x - 8, b.y + 1, 8, 3, '#efad52'); }
    for (const s of sparks) { ctx.globalAlpha = s.life * 2; rect(s.x, s.y, 5, 5, '#d1a1ff'); }
    ctx.globalAlpha = 1; ctx.restore();
    ctx.fillStyle = '#8faab6'; ctx.font = '12px system-ui'; ctx.fillText('BRIDGES CRUMBLE  /  ALIENS +100  /  BIRDS +150 — DODGE THE DIVE', 28, H - 28);
    ctx.restore();
  }
  function frame(now) {
    const dt = Math.min((now - previous) / 1000, .04); previous = now;
    if (mode === 'running') update(dt);
    if (mode !== 'menu') draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
