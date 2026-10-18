/* prey.js — 四套猎物状态机（鱼三阶段 / 老鼠 peek-dart-hole / 蝴蝶七态 / 激光甩停）
   参数与流转逻辑与 H5 原型 1:1 对齐；渲染改为 Canvas 矢量绘制 */
module.exports = function (G) {
  const rand = G.rand, clamp = G.clamp;
  let preys = [];
  G.preys = preys;

  /* 选洞：优先「未被占用 且 非蹲守热点」；不可用时依次放宽 */
  G.pickHoleIdx = (prey, excludeIdx) => {
    const S = G.scene;
    if (!S.holes || !S.holes.length) return -1;
    const now = performance.now();
    const free = [], cool = [], last = [];
    for (let i = 0; i < S.holes.length; i++) {
      if (i === excludeIdx) continue;
      if (S.holeOwners[i] && S.holeOwners[i] !== prey) continue;
      const h = S.holeHeat[i] || [];
      if (h.length >= 3 && now - h[0] < 8000) { cool.push(i); continue; }   // 8s 内被拍偏 ≥3 次
      free.push(i);
    }
    if (!free.length && !cool.length) for (let i = 0; i < S.holes.length; i++) if (i !== excludeIdx) last.push(i);
    const pool = free.length ? free : (cool.length ? cool : last);
    return pool.length ? pool[Math.floor(rand(0, pool.length))] : -1;
  };

  class Prey {
    constructor(type, forcedSpecies) {
      this.type = type;
      this.def = G.PREY_DEF[type];
      this.baseW = this.def.w; this.baseH = this.def.h;
      this.speciesSpeed = 1;
      if (type === "fish") {
        this.pickFishSpecies(forcedSpecies);
      }
      if (type === "laser") {
        // 加权随机花色：红色为主，翠绿光点更快更小（约 1/4 概率）
        const lpool = [];
        G.LASER_VARIANTS.forEach(v => { for (let i = 0; i < (v.w || 1); i++) lpool.push(v); });
        this.laserVar = lpool[Math.floor(rand(0, lpool.length))];
        this.speciesSpeed = this.laserVar.speed;                  // 速度倍率（绿色 1.5）
        if (this.laserVar.size !== 1) {                           // 花色体型差异
          this.baseW = Math.round(this.baseW * this.laserVar.size);
          this.baseH = Math.round(this.baseH * this.laserVar.size);
        }
        this.state = "dart"; this.stateT = 0; this.stateDur = 1.2;
        this.vx = 1; this.vy = 0;
        this.trailAcc = 0; this.lastTrailX = 0; this.lastTrailY = 0;
      }
      if (type === "butterfly") {
        // 加权随机：白/淡黄为主（w 权重），虎斑蝶偶现
        const pool = [];
        G.BFLY_VARIANTS.forEach(v => { for (let i = 0; i < (v.w || 1); i++) pool.push(v); });
        this.bflyVar = pool[Math.floor(rand(0, pool.length))];
        this.speciesSpeed = this.bflyVar.speed;
        this.baseW = Math.round(this.baseW * this.bflyVar.size);   // 命中盒随花色体型
        this.baseH = Math.round(this.baseH * this.bflyVar.size);
        this.speciesScale = this.bflyVar.size;                     // 视觉尺寸（render 用）
        this.state = "FLAP"; this.stateT = 0;
        this.flapDur = rand(0.16, 0.26);
        this.glideDur = rand(1.0, 1.6);
        this.hoverDur = rand(0.6, 1.5);
        this.flapImpulse = 1; this.vx = 0; this.vy = 0;
        this.turnCd = 0; this.flyT = 0;
        this.landInterval = rand(3, 5);
        this.landTarget = null; this.landStartX = 0; this.landStartY = 0;
        this.restDur = 1.2; this.hoverY0 = 0;
        this.fadeInT = 0;                                  // 屏内淡入计时
        this.exitCd = rand(7, 11);                         // 主动飞出屏幕的冷却
        this.exVx = 0; this.exVy = 0;                      // 飞出屏幕的方向速度
      }
      if (type === "mouse") {
        this.mouseVar = G.MOUSE_VARIANTS[Math.floor(rand(0, G.MOUSE_VARIANTS.length))];
        this.mSpeed = this.mouseVar.speed || 1;               // 花色冲刺速度差异
        this.baseW = this.def.w * (this.mouseVar.size || 1);  // 花色体型差异
        this.baseH = this.def.h * (this.mouseVar.size || 1);
        this.holeWait = 0.7; this.holeIdx = -1; this.hole = null;
        this.mState = null; this.mT = 0;
        this.pawAcc = 0; this.scared = false; this.fakeAt = -1;
        this.dartFromY = 0; this.dartStartX = 0; this.dartTarget = null;
        this.lift = 64;
      }
      this.phase = rand(0, Math.PI * 2);
      this.adaptiveScale = 1; this.adaptiveSlow = 1;
      this.comboSpeed = 1; this.comboSpeedTarget = 1; this.comboSize = 1;
      const D0 = G.DIFF[G.config.difficulty];
      this.sizeMul = D0.size;
      this.speedMul = D0.speed * ((D0.typeSpeed || {})[type] || 1);   // 标准/激烈下蝴蝶与老鼠额外提速
      this.applySize();
      this.spawn();
    }
    /* 抽取鱼品种（forced 指定品种用于开局去重；复活/补点时重抽保证一局内种类丰富） */
    pickFishSpecies(forced) {
      this.species = forced || G.FISH_SPECIES[Math.floor(rand(0, G.FISH_SPECIES.length))];
      this.speciesSpeed = this.species.speed;
      this.baseW = this.species.w || this.def.w;
      this.baseH = this.species.h || this.def.h;
      this.cruiser = Math.random() < (this.species.speed >= 1.2 ? 0.55 : 0.22);
      const variants = this.species.variants || [{}];
      this.speciesColors = variants[Math.floor(rand(0, variants.length))];
      this.speciesBurst = this.species.burst || 3.1;          // 品种冲刺爆发
      this.dartMul = this.species.dartMul || 1;               // 品种冲刺频率
      this.speciesScale = (this.species.w || 120) / 120;      // 品种视觉尺寸（命中盒用 baseW）
    }
    applySize() {
      const S = G.platform.S || 1;
      const isLaser = this.type === "laser";
      const big = Math.min(1 + (S - 1) * (isLaser ? 0.8 : 0.45), isLaser ? 1.7 : 1.3);
      // 小屏（S<1.15，典型手机尺寸）紧凑系数：鱼和老鼠略缩小，鱼额外收窄横向比例（sx），
      // 避免"又大又胖"；iPad 等大屏（S≥1.15）完全不受影响
      let slim = 1, sx = 1;
      if (!isLaser && S < 1.15) {
        if (this.type === "fish") { slim = 0.9; sx = 0.9; }
        else if (this.type === "mouse") slim = 0.93;
      }
      this.sxMul = sx;
      this.sc = this.sizeMul * this.adaptiveScale * this.comboSize * big * slim;
    }

    spawn() {
      const b = G.bounds();
      this.faceDir = Math.random() > 0.5 ? 1 : -1;
      this.dirX = this.faceDir;
      this.stage = 0; this.stageSpeed = 1;
      this.fade = 1; this.vanishT = 0;
      this.wagDur = 0.5;
      this.dartCd = rand(this.def.dartMin, this.def.dartMax) * (this.dartMul || 1);
      this.burstT = 0;
      if (this.type === "laser") {
        const s0 = this.laserSpot();
        this.x = s0.x; this.y = s0.y;
        this.baseY = this.y;
        this.state = "dart"; this.stateT = 0;
        this.stateDur = rand(this.def.dartMin, this.def.dartMax);
        const ang = rand(0, Math.PI * 2);
        this.vx = Math.cos(ang); this.vy = Math.sin(ang);
        this.wx = this.x + this.vx * 260; this.wy = this.y + this.vy * 260;
        this.fade = 1;
        return;
      }
      if (this.type === "mouse") {
        const idx0 = G.pickHoleIdx(this, -1);
        if (idx0 >= 0) this.setHole(idx0);
        else this.hole = { x: b.x + b.w / 2, y: b.y + b.h * 0.7 };
        this.state = "peek"; this.stateT = 0; this.mT = 0; this.mState = null;
        this.x = this.hole.x; this.y = this.hole.y; this.baseY = this.hole.y;
        this.lift = 64;
        return;
      }
      if (this.type === "butterfly") {
        this.warpIn();               // 从上/左/右屏外飞入（含首只）
        this.applyFlapImpulse();     // 带初始动量，入场即飞
        return;
      }
      this.x = b.x + rand(0.15, 0.85) * b.w;
      this.y = b.y + rand(this.def.yMin, this.def.yMax) * b.h;
      this.baseY = this.y;
    }
    newWaypoint() {
      const b = G.bounds();
      if (this.stage === 3 && Math.random() < 0.34) {   // 后期 1/3 航点在屏外，引诱游出
        const side = Math.floor(rand(0, 4));
        const m = rand(90, 170);
        if (side === 0)      { this.wx = b.x - m;       this.wy = b.y + rand(this.def.yMin, this.def.yMax) * b.h; }
        else if (side === 1) { this.wx = b.x + b.w + m; this.wy = b.y + rand(this.def.yMin, this.def.yMax) * b.h; }
        else if (side === 2) { this.wx = b.x + rand(0.05, 0.95) * b.w; this.wy = b.y - m; }
        else                 { this.wx = b.x + rand(0.05, 0.95) * b.w; this.wy = b.y + b.h + m; }
        return;
      }
      this.wx = b.x + rand(0.04, 0.96) * b.w;
      this.wy = b.y + rand(this.def.yMin, this.def.yMax) * b.h;
    }
    dartNow() {
      this.burstT = 0.45;
      this.dartCd = rand(this.def.dartMin, this.def.dartMax) * (this.dartMul || 1);
      if (this.stage === 3) this.newWaypoint();
    }
    warpIn() {
      if (this.type === "butterfly") { this.butterflyEnter(); return; }
      const b = G.bounds(), m = 110, FD = 120;
      const top = b.y + this.def.yMin * b.h, bot = b.y + this.def.yMax * b.h;
      const sides = this.stage === 3 ? [0, 1, 2, 3]
        : this.type === "butterfly"
          ? (Math.random() > 0.5 ? [2, 0, 1] : [1, 0, 2])   // 蝴蝶：上/左/右三向飞入
          : (Math.random() > 0.5 ? [0, 1] : [1, 0]);
      for (let attempt = 0; attempt < 4; attempt++) {
        const side = sides[attempt % sides.length];
        if (side === 0)      { this.x = b.x - m; this.y = b.y + rand(this.def.yMin, this.def.yMax) * b.h; this.dirX = 1; }
        else if (side === 1) { this.x = b.x + b.w + m; this.y = b.y + rand(this.def.yMin, this.def.yMax) * b.h; this.dirX = -1; }
        else if (side === 2) { this.x = b.x + rand(0.1, 0.9) * b.w; this.y = b.y - m; }
        else                 { this.x = b.x + rand(0.1, 0.9) * b.w; this.y = b.y + b.h + m; }
        const crowded = preys.some(q => q !== this && Math.hypot(q.x - this.x, q.y - this.y) < 90);
        if (!crowded) break;
      }
      if (this.dirX) this.faceDir = this.dirX;
      this.baseY = this.y;
      if (this.stage === 2) this.midY = clamp(this.y, top + this.vAmp, bot - this.vAmp);
      this.newWaypoint();
      this.fade = clamp(1 - m / FD, 0, 1);
    }
    vanish() {
      if (this.type === "butterfly" && this.state === "STARTLED") return;   // 惊飞中防重入
      this.vanishT = 0.3;
      this.burstT = 0;
      if (this.type === "butterfly") {
        this.state = "STARTLED"; this.stateT = 0;
        this.landTarget = null;
        this.vx = (this.x > G.platform.W / 2 ? 1 : -1) * rand(180, 260);
        this.vy = -rand(80, 140);
        return;
      }
      if (this.type === "mouse") {
        this.scared = true;
        this.state = "hole"; this.stateT = 0; this.mT = 0;
        this.x = this.hole.x; this.y = this.hole.y;
      }
    }
    enterStage(n) {
      this.stage = n;
      if (this.type === "mouse") return;
      const b = G.bounds();
      const top = b.y + this.def.yMin * b.h, bot = b.y + this.def.yMax * b.h;
      const base = n === 1 ? 0.34 : n === 2 ? 0.58 : 0.46;
      this.wagDur = clamp(base / ((this.speciesSpeed || 1) * (this.cruiser ? 1.3 : 1)), 0.22, 0.85);
      if (n === 1) {
        if (!this.dirX) this.dirX = Math.random() > 0.5 ? 1 : -1;
        this.baseY = clamp(this.y, top, bot);
        this.stageSpeed = 1.8;
      } else if (n === 2) {
        this.vAmp = Math.min((bot - top) * 0.28, Math.max(b.h * 0.16, 60));
        this.midY = clamp(this.y, top + this.vAmp, bot - this.vAmp);
        this.stageSpeed = 1.1;
      } else {
        this.stageSpeed = 1.0;
        this.newWaypoint();
      }
    }

    /* ============ 主分发 ============ */
    update(dt, t) {
      const b = G.bounds();
      const MS = Math.pow(G.platform.S || 1, 0.5);   // 大屏下按比例略微提速，保持相对运动手感
      this.comboSpeed += ((this.comboSpeedTarget || 1) - this.comboSpeed) * Math.min(1, dt * 6);
      if (this.type === "mouse")   { this.updateMouse(dt, t); return; }
      if (this.type === "butterfly") { this.updateButterfly(dt, t); return; }
      if (this.type === "laser")   { this.updateLaser(dt, t); return; }
      // ---- 鱼：三阶段 ----
      const d = this.def;
      this.dartCd -= dt; this.burstT -= dt;
      if (this.cruiser) this.burstT = 0;
      else if (this.dartCd <= 0) this.dartNow();
      if (this.stage !== G.session.stage) this.enterStage(G.session.stage);
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        if (this.vanishT <= 0) { this.vanishT = 0; if (this.type === "fish") this.pickFishSpecies(); this.warpIn(); }
      }
      const sp = d.speed * this.speedMul * this.comboSpeed * this.adaptiveSlow * this.speciesSpeed * (this.cruiser ? 1.5 : 1) * this.stageSpeed * (this.burstT > 0 ? (this.speciesBurst || 3.1) : 1);
      if (this.stage === 1) {
        this.x += this.dirX * sp * dt * MS;
        this.y = this.baseY + Math.sin(t * 2 + this.phase) * 3;
        this.faceDir = this.dirX;
      } else if (this.stage === 2) {
        this.x += this.dirX * sp * 0.8 * dt * MS;
        this.y = this.midY + Math.sin(t * 2.0 + this.phase) * this.vAmp;
        this.faceDir = this.dirX;
      } else {
        let ang = Math.atan2(this.wy - this.y, this.wx - this.x);
        ang += Math.sin(t * d.wobF + this.phase) * d.wobA * (this.cruiser ? 0.3 : 1);
        this.x += Math.cos(ang) * sp * dt * MS;
        this.y += Math.sin(ang) * sp * dt * MS;
        if (Math.abs(Math.cos(ang)) > 0.25) this.faceDir = Math.cos(ang) > 0 ? 1 : -1;
        const dx = this.wx - this.x, dy = this.wy - this.y;
        if (dx * dx + dy * dy < 3600) this.newWaypoint();
      }
      // 边界渐隐
      const FD = 120;
      let past = 0;
      if (this.x < b.x) past = b.x - this.x;
      else if (this.x > b.x + b.w) past = this.x - (b.x + b.w);
      if (this.y < b.y) past = Math.max(past, b.y - this.y);
      else if (this.y > b.y + b.h) past = Math.max(past, this.y - (b.y + b.h));
      this.fade = clamp(1 - past / FD, 0, 1);
      if (past >= FD && this.vanishT <= 0) this.warpIn();
    }

    /* ============ 老鼠：peek → dart → hole ============ */
    setHole(idx) {
      if (idx < 0) return;
      const S = G.scene;
      if (this.holeIdx >= 0 && S.holeOwners[this.holeIdx] === this) S.holeOwners[this.holeIdx] = null;
      this.holeIdx = idx;
      S.holeOwners[idx] = this;
      this.hole = S.holes[idx];
    }
    startDart() {
      const st = G.MOUSE_STAGE[G.session.stage];
      const S = G.scene;
      let idx = -1;
      if (st.adjacent && S.holes.length > 1) {
        const order = S.holes.map((h, i) => i).sort((a, b2) => S.holes[a].x - S.holes[b2].x);
        const cur = order.indexOf(this.holeIdx);
        const cand = [];
        if (cur > 0) cand.push(order[cur - 1]);
        if (cur < order.length - 1) cand.push(order[cur + 1]);
        const ok = cand.filter(i => !S.holeOwners[i] || S.holeOwners[i] === this);
        if (ok.length) idx = ok[Math.floor(rand(0, ok.length))];
      }
      if (idx < 0) idx = G.pickHoleIdx(this, this.holeIdx);
      if (idx < 0 || idx === this.holeIdx) { this.state = "hole"; return; }
      this.dartFromY = this.hole.y;
      this.dartStartX = this.x;
      this.setHole(idx);
      this.dartTarget = this.hole;
      this.state = "dart";
      G.dustBurst(this.x, this.dartFromY + 6, 2);
    }
    updateMouse(dt, t) {
      if (this.stage !== G.session.stage) this.enterStage(G.session.stage);
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        const p = 1 - Math.max(this.vanishT, 0) / 0.3;
        this.lift = p * p * 64;
        this.fade = 1;   // 受惊滑回洞里全程可见
        if (this.vanishT <= 0) { this.vanishT = 0; this.state = "hole"; this.lift = 64; this.mT = 0; this.mState = null; }
        return;
      }
      if (this.mState !== this.state) {
        this.mState = this.state; this.mT = 0;
        if (this.state === "hole") {
          this.holeWait = this.scared ? rand(0.18, 0.3)
            : G.session.stage === 1 ? rand(0.36, 0.66) : G.session.stage === 2 ? rand(0.28, 0.5) : rand(0.18, 0.34);
        }
        if (this.state === "peek") {
          this.scared = false;
          this.peekFirst = Math.random() > 0.5 ? 1 : -1;   // 左右各看一次：先看的方向随机
          const st0 = G.MOUSE_STAGE[G.session.stage];
          const dur0 = st0.peek / Math.sqrt(Math.max(this.comboSpeed || 1, 1));
          this.fakeAt = (st0.fakeP > 0 && Math.random() < st0.fakeP && dur0 > 1.1) ? rand(0.5, dur0 - 0.45) : -1;
        }
      }
      this.mT += dt;
      const stage = G.session.stage;
      if (this.state === "peek") {
        this.fade = 1;
        const st = G.MOUSE_STAGE[stage];
        const peekDur = st.peek / Math.sqrt(Math.max(this.comboSpeed || 1, 1));
        // 左右探头各一次即跑：前 45% 看一边、中 45% 看另一边，看完立即进入逃跑判定
        this.faceDir = this.mT < peekDur * 0.45 ? this.peekFirst : -this.peekFirst;
        this.y = this.hole.y;
        const rp = Math.min(this.mT / 0.15, 1);      // 探头更快（0.24s → 0.15s），一冒头就跑
        const eased = 1 - Math.pow(1 - rp, 3);
        let lift = (1 - eased) * 64;
        if (rp >= 1) {
          lift += Math.sin(this.mT * 9 + this.phase) * 1.4;
          if (this.fakeAt >= 0 && this.mT >= this.fakeAt) {
            const ft = (this.mT - this.fakeAt) / 0.36;
            if (ft < 1) lift = Math.max(lift, 64 - Math.sin(ft * Math.PI) * 26);
            else this.fakeAt = -1;
          }
        }
        this.lift = lift;
        if (this.mT >= peekDur) {
          if (Math.random() < st.dartP) this.startDart();
          else { this.state = "hole"; }
        }
      } else if (this.state === "dart") {
        this.fade = 1;
        const st = G.MOUSE_STAGE[stage];
        const dir = this.dartTarget.x >= this.x ? 1 : -1;
        this.faceDir = dir;
        const sp = st.dartSpeed * Math.sqrt(Math.max(this.comboSpeed || 1, 1)) * (this.adaptiveSlow || 1) * (this.mSpeed || 1);
        this.x += dir * sp * dt * Math.pow(G.platform.S || 1, 0.5);
        // 跨排逃窜 y 插值（同排退化为定值）
        const totalDx = this.dartTarget.x - this.dartStartX;
        const prog = Math.abs(totalDx) > 1 ? Math.min(1, (this.x - this.dartStartX) / totalDx) : 1;
        this.y = this.dartFromY + (this.hole.y - this.dartFromY) * prog - Math.abs(Math.sin(this.mT * 13)) * 3;
        this.lift = Math.abs(Math.sin(this.mT * 22)) * 6;
        this.pawAcc += sp * dt;
        if (this.pawAcc > 34) { this.pawAcc = 0; G.pawPrint(this.x, this.y + 14 + rand(-3, 3), dir); }
        if ((dir > 0 && this.x >= this.dartTarget.x) || (dir < 0 && this.x <= this.dartTarget.x)) {
          this.x = this.dartTarget.x;
          G.dustBurst(this.hole.x, this.hole.y + 6, 3);
          this.state = "hole";
        }
      } else {
        // hole：缩回洞内等待（0.15s 下滑后隐身）
        if (this.mT < 0.15) this.lift = Math.pow(this.mT / 0.15, 2) * 64;
        else this.lift = 64;
        this.fade = this.mT < 0.15 ? 1 : 0;   // 对齐原型 hole 态 opacity=0
        if (this.mT >= (this.holeWait || 0.7)) {
          const ni = G.pickHoleIdx(this, this.holeIdx);
          if (ni >= 0) this.setHole(ni);
          this.x = this.hole.x; this.y = this.hole.y; this.baseY = this.hole.y;
          this.state = "peek";
        }
      }
    }

    /* ============ 蝴蝶：七态 ============ */
    enterButterflyStage(n) {
      this.stage = n;
      const P = G.BFLY_PARAMS[n];
      this.glideDur = rand(P.glide[0], P.glide[1]);
      if (P.land) this.landInterval = P.land.interval();
      this.flyT = 0;
    }
    applyFlapImpulse() {
      const P = G.BFLY_PARAMS[this.stage] || G.BFLY_PARAMS[1];
      const dir = this.faceDir || 1;
      const aux = this.speedMul * (this.speciesSpeed || 1) * (this.adaptiveSlow || 1) * Math.sqrt(this.comboSpeed || 1);
      this.vx = dir * rand(P.impulse[0], P.impulse[1]) * aux;
      const b = G.bounds();
      const bandTop = b.y + 0.28 * b.h, bandBot = b.y + 0.68 * b.h;
      let up;
      if (this.y < bandTop - 70)      up = rand(-24, -8);
      else if (this.y < bandTop)      up = rand(P.up[0], P.up[1]) * 0.3;
      else if (this.y > bandBot)      up = rand(P.up[1], P.up[1] * 1.6);
      else                            up = rand(P.up[0], P.up[1]);
      this.vy = -up * aux;
      this.flapImpulse = 1.8;
    }
    tryLand() {
      if (!G.gardenFlowers.length) return;
      let best = null, bd = Infinity;
      G.gardenFlowers.forEach(f => {
        const dist = Math.hypot(f.x - this.x, f.y - this.y);
        if (dist < bd) { bd = dist; best = f; }
      });
      if (!best || bd > Math.max(G.platform.W * 0.45, 260)) return;
      this.landTarget = best;
      this.landStartX = this.x; this.landStartY = this.y;
      this.state = "LANDING"; this.stateT = 0;
    }
    /* 蝴蝶入场：四向随机（含底部）+ 一定概率在屏内任意位置淡入 */
    butterflyEnter() {
      const b = G.bounds(), m = 110, FD = 120;
      const crowdedAt = (x, y) => preys.some(q => q !== this && Math.hypot(q.x - x, q.y - y) < 90);
      if (Math.random() < 0.28) {
        // 屏内淡入：任意位置出现，淡入 0.35s
        let x = b.x + b.w / 2, y = b.y + b.h / 2;
        for (let i = 0; i < 6; i++) {
          const nx = b.x + rand(0.12, 0.88) * b.w, ny = b.y + rand(0.30, 0.66) * b.h;
          x = nx; y = ny;
          if (!crowdedAt(nx, ny)) break;
        }
        this.x = x; this.y = y;
        this.faceDir = Math.random() > 0.5 ? 1 : -1;
        this.fadeInT = 0.35;
        this.fade = 0;
        this.baseY = this.y;
        return;
      }
      // 四向飞入：左/右/上/下随机（下方向上飞入也自然）
      const sides = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      for (let attempt = 0; attempt < 4; attempt++) {
        const side = sides[attempt % sides.length];
        if (side === 0)      { this.x = b.x - m;     this.y = b.y + rand(0.25, 0.68) * b.h; this.dirX = 1;  this.faceDir = 1; }
        else if (side === 1) { this.x = b.x + b.w + m; this.y = b.y + rand(0.25, 0.68) * b.h; this.dirX = -1; this.faceDir = -1; }
        else if (side === 2) { this.x = b.x + rand(0.1, 0.9) * b.w; this.y = b.y - m;      this.faceDir = Math.random() > 0.5 ? 1 : -1; }
        else                 { this.x = b.x + rand(0.1, 0.9) * b.w; this.y = b.y + b.h + m; this.faceDir = Math.random() > 0.5 ? 1 : -1; }
        if (!crowdedAt(this.x, this.y)) break;
      }
      this.fadeInT = 0;
      this.baseY = this.y;
      this.fade = clamp(1 - m / FD, 0, 1);
      const ex = (G.BFLY_PARAMS[this.stage] || {}).exit || [7, 11];
      this.exitCd = rand(ex[0], ex[1]);
    }
    /* 主动飞出屏幕：朝某个边界外侧直线飞走，边界外渐隐后重新入场 */
    startExit() {
      const b = G.bounds();
      const side = Math.floor(rand(0, 4));
      let tx, ty;
      if (side === 0)      { tx = b.x - 200;        ty = this.y + rand(-60, 60); }
      else if (side === 1) { tx = b.x + b.w + 200;  ty = this.y + rand(-60, 60); }
      else if (side === 2) { tx = this.x + rand(-60, 60); ty = b.y - 200; }
      else                 { tx = this.x + rand(-60, 60); ty = b.y + b.h + 200; }
      const d = Math.max(Math.hypot(tx - this.x, ty - this.y), 1);
      const sp = rand(150, 210) * this.speedMul * (this.speciesSpeed || 1) * Math.sqrt(G.platform.S || 1);
      this.exVx = (tx - this.x) / d * sp;
      this.exVy = (ty - this.y) / d * sp;
      if (Math.abs(this.exVx) > 8) this.faceDir = this.exVx > 0 ? 1 : -1;
      this.state = "EXIT"; this.stateT = 0;
      this.landTarget = null;
    }
    takeOff() {
      const P = G.BFLY_PARAMS[this.stage] || G.BFLY_PARAMS[2];
      this.state = "TAKEOFF"; this.stateT = 0;
      this.flyT = 0;
      if (P.land) this.landInterval = P.land.interval();
      if (this.landTarget) this.landTarget.nudgeT = 0.36;   // 离花轻颤
    }
    updateButterfly(dt, t) {
      const b = G.bounds();
      if (this.stage !== G.session.stage) this.enterButterflyStage(G.session.stage);
      const P = G.BFLY_PARAMS[this.stage] || G.BFLY_PARAMS[1];
      // 飞一段时间后，有概率主动飞出屏幕（之后会从任意位置重新入场）
      const st0 = this.state;
      if (st0 === "FLAP" || st0 === "GLIDE" || st0 === "HOVER") {
        this.exitCd -= dt;
        if (this.exitCd <= 0) {
          const ex = P.exit || [7, 11];
          this.exitCd = rand(ex[0], ex[1]);
          if (Math.random() < 0.55 && this.state !== "LANDING") { this.startExit(); this.flyT = 0; }
        }
      }
      if (this.state === "STARTLED") {
        this.stateT += dt;
        const p = Math.min(this.stateT / 0.4, 1);
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vx *= Math.pow(0.3, dt); this.vy *= Math.pow(0.3, dt);
        this.vanishT = 0.3 * (1 - p);
        if (p >= 1) {
          this.vanishT = 0;
          this.warpIn();
          this.state = "FLAP"; this.stateT = 0;
          this.flapDur = rand(0.16, 0.26);
          this.applyFlapImpulse();
        }
        return;
      }
      this.stateT += dt;
      if (this.state === "FLAP") {
        if (this.stateT >= this.flapDur) {
          this.state = "GLIDE"; this.stateT = 0;
          this.glideDur = rand(P.glide[0], P.glide[1]);
        }
      } else if (this.state === "GLIDE") {
        this.turnCd -= dt;
        if (this.turnCd <= 0 && Math.random() < P.turn * dt * 60) {
          this.vx = -this.vx * rand(0.6, 1.2);
          this.faceDir = -this.faceDir;
          this.flapImpulse = 2.2;
          this.turnCd = 0.6;
        }
        if (P.land) {
          this.flyT += dt;
          if (this.flyT > this.landInterval) {
            this.flyT = 0; this.landInterval = P.land.interval();
            if (Math.random() < P.land.chance) this.tryLand();
          }
        }
        if (this.state === "GLIDE" && this.stateT >= this.glideDur) {
          this.stateT = 0;
          if (this.stage >= 2 && Math.random() < P.hoverChance) {
            this.state = "HOVER";
            this.hoverDur = this.stage === 3 ? rand(0.4, 0.8) : rand(0.6, 1.5);
            this.hoverY0 = this.y;
          } else {
            this.state = "FLAP";
            this.flapDur = rand(0.16, 0.26);
            this.applyFlapImpulse();
            G.scalesBurst(this.x, this.y + 10, 2);
          }
        }
      } else if (this.state === "HOVER") {
        if (this.stateT >= this.hoverDur) {
          this.state = "FLAP"; this.stateT = 0;
          this.flapDur = rand(0.16, 0.26);
          this.applyFlapImpulse();
          G.scalesBurst(this.x, this.y + 10, 2);
        }
      } else if (this.state === "LANDING") {
        if (!this.landTarget) { this.state = "FLAP"; this.stateT = 0; this.applyFlapImpulse(); }
        else {
          const lp = Math.min(this.stateT / 0.35, 1);
          const eased = 1 - Math.pow(1 - lp, 3);
          const tx = this.landTarget.x, ty = this.landTarget.y - 14;
          this.x = this.landStartX + (tx - this.landStartX) * eased;
          this.y = this.landStartY + (ty - this.landStartY) * eased;
          if (lp >= 1) {
            this.state = "RESTING"; this.stateT = 0;
            this.restDur = P.land ? P.land.dur() : 1.2;
          }
        }
      } else if (this.state === "RESTING") {
        this.x = this.landTarget.x;
        this.y = this.landTarget.y - 14 + Math.sin(t * 3) * 1.2;
        if (Math.random() < 0.015) G.scalesBurst(this.x, this.y + 8, 1);
        if (this.stateT >= this.restDur) this.takeOff();
      } else if (this.state === "TAKEOFF") {
        const tp = Math.min(this.stateT / 0.3, 1);
        this.vy = -rand(40, 60) * (0.4 + tp);
        this.vx = rand(-20, 20);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (tp >= 1) {
          this.state = "FLAP"; this.stateT = 0;
          this.flapDur = rand(0.16, 0.26);
          this.applyFlapImpulse();
          G.pollenBurst(this.x, this.y, 3);
          this.landTarget = null;
        }
      }
      // 物理积分
      const MS = Math.pow(G.platform.S || 1, 0.5);
      if (this.state === "FLAP" || this.state === "GLIDE") {
        this.flapImpulse *= Math.pow(0.12, dt);
        if (this.state === "GLIDE") this.vy += 60 * dt * MS;
        this.vx *= Math.pow(P.drag, dt);
        this.x += this.vx * this.flapImpulse * dt * MS;
        this.y += this.vy * dt * MS;
        if (Math.abs(this.vx) > 8) this.faceDir = this.vx > 0 ? 1 : -1;
      } else if (this.state === "HOVER") {
        this.vx *= Math.pow(0.02, dt); this.vy *= Math.pow(0.02, dt);
        this.x += this.vx * dt * MS;
        this.y = this.hoverY0 + Math.sin(t * 8) * 2;
      } else if (this.state === "EXIT") {
        this.x += this.exVx * dt * MS;
        this.y += this.exVy * dt * MS;              // 直线飞向屏外，带轻微飘摆
        this.y += Math.sin(t * 5 + this.phase) * 10 * dt * MS;
      }
      // 边界渐隐（落花链路豁免）
      if (this.state !== "LANDING" && this.state !== "RESTING" && this.state !== "TAKEOFF") {
        const FD = 120;
        let past = 0;
        if (this.x < b.x) past = b.x - this.x;
        else if (this.x > b.x + b.w) past = this.x - (b.x + b.w);
        if (this.y < b.y) past = Math.max(past, b.y - this.y);
        else if (this.y > b.y + b.h) past = Math.max(past, this.y - (b.y + b.h));
        this.fade = clamp(1 - past / FD, 0, 1);
        if (this.fadeInT > 0) {                       // 屏内淡入：0 → 1
          this.fadeInT = Math.max(this.fadeInT - dt, 0);
          this.fade *= 1 - this.fadeInT / 0.35;
        }
        if (past >= FD) {
          this.warpIn();
          if (this.state === "EXIT") {                // 飞出后重新起飞入场
            this.state = "FLAP"; this.stateT = 0;
            this.flapDur = rand(0.16, 0.26);
            this.applyFlapImpulse();
          }
        }
      } else this.fade = 1;
    }

    /* ============ 激光：dart ↔ hold ============ */
    laserNewWaypoint() {
      const b = G.bounds(), P = G.LASER_PARAMS[G.session.stage] || G.LASER_PARAMS[1];
      this.wx = b.x + rand(0.03, 0.97) * b.w;
      this.wy = b.y + rand(0.03, 0.97) * b.h;
      const dx = this.wx - this.x, dy = this.wy - this.y, len = Math.hypot(dx, dy) || 1;
      this.vx = dx / len; this.vy = dy / len;
      this.stateDur = rand(P.dart[0], P.dart[1]);
    }
    /* 激光落点：随机取点并尽量与其他光点保持距离；重试期间保留"离群最远"候选，
       即使空间拥挤也返回最优解而不是随机凑合。取值范围几乎贴边（0.03~0.97），覆盖全屏 */
    laserSpot(tries) {
      const b = G.bounds(), m = Math.pow(G.platform.S || 1, 0.5);
      const minDist = 150 * m;
      let best = null, bestD = -1;
      const T = tries || 24;
      for (let i = 0; i < T; i++) {
        const x = b.x + rand(0.03, 0.97) * b.w;
        const y = b.y + rand(0.03, 0.97) * b.h;
        let d = Infinity;
        preys.forEach(q => {
          if (q !== this && q.type === "laser") d = Math.min(d, Math.hypot(q.x - x, q.y - y));
        });
        if (d >= minDist) return { x, y };
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
      return best || { x: b.x + rand(0.03, 0.97) * b.w, y: b.y + rand(0.03, 0.97) * b.h };
    }
    laserTeleport() {
      const s0 = this.laserSpot();
      this.x = s0.x; this.y = s0.y;
      G.laserFlash(this.x, this.y, this.laserVar && this.laserVar.key);
      this.laserNewWaypoint();
    }
    updateLaser(dt, t) {
      const d = this.def, b = G.bounds();
      if (this.stage !== G.session.stage) this.stage = G.session.stage;
      const P = G.LASER_PARAMS[this.stage] || G.LASER_PARAMS[1];
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        if (this.vanishT <= 0) {
          this.vanishT = 0;
          const s0 = this.laserSpot();
          this.x = s0.x; this.y = s0.y;
          this.state = "dart"; this.stateT = 0;
          this.laserNewWaypoint();
        }
        return;
      }
      this.stateT += dt;
      if (this.state === "dart") {
        const sp = d.speed * this.speedMul * this.comboSpeed * (this.adaptiveSlow || 1) * (this.speciesSpeed || 1);
        const MS = Math.pow(G.platform.S || 1, 0.5);
        this.x += this.vx * sp * dt * MS;
        this.y += this.vy * sp * dt * MS;
        let bounced = false;
        if (this.x < b.x + 10)            { this.x = b.x + 10;            this.vx = Math.abs(this.vx); bounced = true; }
        else if (this.x > b.x + b.w - 10) { this.x = b.x + b.w - 10;      this.vx = -Math.abs(this.vx); bounced = true; }
        if (this.y < b.y + 10)            { this.y = b.y + 10;            this.vy = Math.abs(this.vy); bounced = true; }
        else if (this.y > b.y + b.h - 10) { this.y = b.y + b.h - 10;      this.vy = -Math.abs(this.vy); bounced = true; }
        if (bounced) {
          G.playBounce();
          this.wx = this.x + this.vx * 260; this.wy = this.y + this.vy * 260;
        }
        if (P.trail) {
          this.trailAcc += Math.hypot(this.x - this.lastTrailX, this.y - this.lastTrailY);
          if (this.trailAcc > 22) { this.trailAcc = 0; G.laserTrail(this.x, this.y, this.laserVar && this.laserVar.key); }
        }
        this.lastTrailX = this.x; this.lastTrailY = this.y;
        const near = (this.wx - this.x) * (this.wx - this.x) + (this.wy - this.y) * (this.wy - this.y) < 900;
        if (near || this.stateT >= this.stateDur * 2.2) {
          this.state = "hold"; this.stateT = 0;
          this.stateDur = rand(P.hold[0], P.hold[1]);
        } else if (Math.random() < P.tele * dt * 8) {
          this.laserTeleport();
        }
      } else {
        // hold 停留（主要命中窗口）
        this.x += Math.sin(t * 7 + this.phase) * 2 * dt;
        this.y += Math.cos(t * 8.3 + this.phase) * 2 * dt;
        if (this.stateT >= this.stateDur / Math.sqrt(Math.max(this.comboSpeed || 1, 1))) {
          this.stateT = 0;
          this.state = "dart";
          if (Math.random() < P.tele) this.laserTeleport();
          else this.laserNewWaypoint();
        }
      }
      this.fade = 1;
    }

    /* ============ 命中判定（对齐 DOM 包围盒点击语义） ============ */
    hittable(x, y) {
      if (this.vanishT > 0) return false;
      // 蝴蝶移动快、入场频繁：宽容判定（外扩 1.7 倍 ≈ 可见翅膀再加大圈容错边；半透明期放宽到 0.25）
      const bPad = this.type === "butterfly" ? 1.7 : 1;
      const fMin = this.type === "butterfly" ? 0.25 : 0.4;
      if (this.fade < fMin) return false;
      const hw = this.baseW * this.sc * (this.sxMul || 1) / 2 * bPad, hh = this.baseH * this.sc / 2 * bPad;
      if (Math.abs(x - this.x) > hw || Math.abs(y - this.y) > hh) return false;
      if (this.type === "mouse") return (this.state === "peek" || this.state === "dart") && this.lift < 48;
      if (this.type === "butterfly") return this.state !== "TAKEOFF" && this.state !== "STARTLED";
      return true;
    }

    /* ============ 渲染 ============ */
    render(ctx, t) {
      const vs = this.vanishT > 0 ? (0.25 + 0.75 * this.vanishT / 0.3) : 1;
      const alpha = this.fade * (this.vanishT > 0 ? this.vanishT / 0.3 : 1);
      if (alpha <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      if (this.type === "mouse") {
        // 裁剪到猎物包围盒（模拟 overflow:hidden 的洞口钻出效果）
        const hw = this.baseW * this.sc / 2, hh = this.baseH * this.sc / 2;
        ctx.beginPath(); ctx.rect(this.x - hw, this.y - hh, hw * 2, hh * 2); ctx.clip();
        ctx.translate(this.x, this.y + this.lift * this.sc);
        const s = this.sc;
        ctx.scale(s * (this.def.face ? this.faceDir : 1), s);
        ctx.translate(-60, -39);
        G.draw.mouse(ctx, this, t);
      } else if (this.type === "butterfly") {
        const tilt = this.state === "FLAP" ? -12 : this.state === "GLIDE" ? 6 : this.state === "LANDING" ? -8 : 0;
        ctx.translate(this.x, this.y);
        ctx.rotate(tilt * Math.PI / 180 * (this.faceDir || 1));
        const s = this.sc * vs * (this.speciesScale || 1);
        ctx.scale(s, s);
        ctx.translate(-60, -56);
        G.draw.butterfly(ctx, this, t);
      } else if (this.type === "laser") {
        ctx.translate(this.x, this.y);
        G.draw.laser(ctx, this, t);
      } else {
        ctx.translate(this.x, this.y);
        const s = this.sc * vs * (this.speciesScale || 1);
        ctx.scale(s * (this.def.face ? this.faceDir : 1) * (this.sxMul || 1), s);
        ctx.translate(-60, -36);
        G.draw.fish(ctx, this, t);
      }
      ctx.restore();
    }
  }
  G.Prey = Prey;

  G.buildPreys = () => {
    preys.forEach(p => {
      if (p.holeIdx >= 0 && G.scene.holeOwners && G.scene.holeOwners[p.holeIdx] === p) G.scene.holeOwners[p.holeIdx] = null;
    });
    preys.length = 0;
    if (G.scene.holeOwners) G.scene.holeOwners = G.scene.holeOwners.map(() => null);
    if (G.scene.holeHeat) G.scene.holeHeat = G.scene.holeHeat.map(() => []);
    const n = Number(G.config.preyCount) === 1 ? 1 : 3;
    if (G.config.targetType === "fish" && n > 1) {
      // 开局鱼种去重：洗牌后按序取，保证同时在场鱼互不相同
      const idxs = G.FISH_SPECIES.map((_, i) => i);
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(rand(0, i + 1));
        const tmp = idxs[i]; idxs[i] = idxs[j]; idxs[j] = tmp;
      }
      for (let i = 0; i < n; i++) preys.push(new Prey("fish", G.FISH_SPECIES[idxs[i % idxs.length]]));
    } else {
      for (let i = 0; i < n; i++) preys.push(new Prey(G.config.targetType));
    }
  };
  G.clearPreys = () => { preys.length = 0; };

  /* 多只模式：猎物同时在场数量随阶段循序渐进（①3 → ②5 → ③7，上限 7）；单只模式不变。
     捕鼠按洞口数封顶（至少留 1 个空洞供轮换）。 */
  G.stageTargetCount = () => {
    if (Number(G.config.preyCount) === 1) return 0;
    const base = ({ 1: 3, 2: 5, 3: 7 })[G.session.stage] || 3;
    if (G.config.targetType === "mouse") {
      const holeN = (G.scene && G.scene.holes ? G.scene.holes.length : 8);
      return Math.min(base, Math.max(1, holeN - 1));
    }
    return base;
  };
  G.topUpPreys = () => {
    const target = G.stageTargetCount();
    while (target && preys.length < target) {
      if (G.config.targetType === "fish") {
        // 补点时避开已在场品种（10 种 > 上限 7，可全程不重样）
        const used = {};
        preys.forEach(p => { if (p.type === "fish" && p.species) used[p.species.key] = 1; });
        const pool = G.FISH_SPECIES.filter(s => !used[s.key]);
        preys.push(new Prey("fish", pool.length ? pool[Math.floor(rand(0, pool.length))] : undefined));
      } else {
        preys.push(new Prey(G.config.targetType));
      }
    }
  };
};
