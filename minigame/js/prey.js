/* prey.js — 四套猎物状态机（鱼三阶段 / 老鼠 peek-dart-hole / 蝴蝶七态 / 激光甩停）
   参数与流转逻辑与 H5 原型 1:1 对齐；渲染改为 Canvas 矢量绘制 */
module.exports = function (G) {
  const rand = G.rand, clamp = G.clamp;
  let preys = [];
  G.preys = preys;
  /* 泳池模式判定：捕鱼 + 当前海域为泳池追鱼（鱼不出屏，区别于水草模式的边界渐隐玩法） */
  const inPoolMode = () => !!(G.session && G.session.sea && G.session.sea.key === "pool");
  /* 鱼群信息：其他鱼的平均位置（聚拢目标），无同伴时返回 null */
  const schoolInfo = (self) => {
    let n = 0, sx = 0, sy = 0;
    preys.forEach(q => {
      if (q === self || q.type !== "fish" || q.vanishT > 0) return;
      n++; sx += q.x; sy += q.y;
    });
    return n ? { n, x: sx / n, y: sy / n } : null;
  };
  /* 鱼群模式判定：捕鱼 + 当前海域为鱼群巡游（boids 结群游动，鱼不出屏） */
  const inSchoolMode = () => !!(G.session && G.session.sea && G.session.sea.key === "school");

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
      if (type === "laser" || type === "pool") {
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
        } else {
          this.speciesSpeed = 1.1;                                  // 水面光斑：整体比激光再快一档
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
      if (type === "frog") {
        /* 青蛙跳：蹲荷叶 → 蓄力 → 抛物线腾空（唯一 +2 窗口）→ 落水 → 静坐。
           蓄力末尾把落点荷叶点亮（pad.hint），是猫唯一的预判依据 */
        this.fState = "crouch"; this.fT = 0;
        this.padIdx = -1; this.targetPadIdx = -1;
        this.jumpH = 0; this.leapK = 0;
        this.chain = 0;                 // 本次跳组已完成的跳跃数（阶段③ 最多 2）
        this.rspT = 0;                  // 被拍后的重生等待
        this.croakCd = rand(1.2, 3.2);
        this._visRot = 0; this._squash = 1;
        this.faceDir = 1;
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
    /* 抽取鱼品种（forced 指定品种用于开局去重；复活/补点时重抽保证一局内种类丰富）
       泳池追鱼由 fishSpeciesList 返回专属鱼种（与深海完全区分），其余海域取全表 */
    pickFishSpecies(forced) {
      const list = (G.fishSpeciesList && G.fishSpeciesList()) || G.FISH_SPECIES;
      this.species = forced || list[Math.floor(rand(0, list.length))];
      // 海域主题游速差异（只乘游速不动命中盒：深海慢幽、冰海快滑）
      this.speciesSpeed = this.species.speed * ((G.seaThemeNow && G.seaThemeNow().speed) || 1);
      this.baseW = this.species.w || this.def.w;
      this.baseH = this.species.h || this.def.h;
      // Peppy Cat 式行为个性：有 behavior 的品种不走"平稳巡游"（cruiser），统一交给行为层管节奏
      this.behavior = this.species.behavior || null;
      this.cruiser = this.behavior ? false : Math.random() < (this.species.speed >= 1.2 ? 0.55 : 0.22);
      const variants = this.species.variants || [{}];
      this.speciesColors = variants[Math.floor(rand(0, variants.length))];
      this.speciesBurst = this.species.burst || 3.1;          // 品种冲刺爆发
      this.dartMul = this.species.dartMul || 1;               // 品种冲刺频率
      this.speciesScale = (this.species.w || 120) / 120;      // 品种视觉尺寸（命中盒用 baseW）
      // 行为状态（hop 的绒线拖尾/弹跳相位；stalk 的潜伏节奏；zigzag 的转向计时）
      this.behT = rand(0.5, 1.4);
      this.stalking = true; this.stalkT = rand(0.8, 1.8);
      this.hopPhase = rand(0, Math.PI * 2); this.hopCyc = null; this.hopOff = 0;
      this.trail = []; this.yarnAcc = 0;
    }
    applySize() {
      const S = G.platform.S || 1;
      const isLaser = this.type === "laser" || this.type === "pool";
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
      if (this.type === "laser" || this.type === "pool") {
        const s0 = this.laserSpot();
        this.x = s0.x; this.y = s0.y;
        if (this.type === "pool") {
          // pool 出生点压进固定容器内，直接以爬行状态入场
          const pad = 26 * Math.pow(G.platform.S || 1, 0.4);
          this.x = Math.min(Math.max(this.x, b.x + pad), b.x + b.w - pad);
          this.y = Math.min(Math.max(this.y, b.y + pad), b.y + b.h - pad);
          this.crawlAng = rand(0, Math.PI * 2);
          this.straight = Math.random() < 0.5;        // 一半虫子走直线（撞边反射），一半蛇行
          this.state = "crawl"; this.stateT = 0;
          this.stateDur = rand(0.65, 1.1);
          this.fade = 1;
          return;
        }
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
        // 群鼠模式：无洞口——随机落位（互不重叠）+ 随机初始航向
        if (G.scene.mouseBg === "swarm") {
          for (let attempt = 0; attempt < 6; attempt++) {
            this.x = b.x + rand(0.08, 0.92) * b.w;
            this.y = b.y + rand(0.12, 0.88) * b.h;
            if (!preys.some(q => q !== this && Math.hypot(q.x - this.x, q.y - this.y) < 100)) break;
          }
          this.swimAng = rand(0, Math.PI * 2);
          this.state = "scurry"; this.stateT = 0; this.stateDur = rand(0.7, 1.6);
          this.fade = 1;
          return;
        }
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
      if (this.type === "frog") {
        this.spawnOnPad();           // 落到一片空荷叶上开始蓄力
        return;
      }
      this.x = b.x + rand(0.15, 0.85) * b.w;
      this.y = b.y + rand(this.def.yMin, this.def.yMax) * b.h;
      this.baseY = this.y;
    }

    /* ============ 青蛙：荷叶跳跃四态机 ============ */
    /* 落到一片没被其他青蛙占用的荷叶 */
    spawnOnPad() {
      const pads = (G.scene && G.scene.pads) || [];
      if (!pads.length) {
        const b = G.bounds();
        this.x = b.x + b.w / 2; this.y = b.y + b.h / 2; this.padIdx = -1;
      } else {
        const taken = {};
        preys.forEach(q => { if (q !== this && q.type === "frog" && q.padIdx >= 0) taken[q.padIdx] = 1; });
        let free = [];
        pads.forEach((p, i) => { if (!taken[i] && i !== this.padIdx) free.push(i); });
        if (!free.length) free = pads.map((_, i) => i).filter(i => i !== this.padIdx);
        if (!free.length) free = [0];
        const pick = free[Math.floor(rand(0, free.length))];
        this.padIdx = pick;
        this.x = pads[pick].x; this.y = pads[pick].y;
      }
      this.fState = "crouch"; this.fT = 0; this.leapK = 0; this.jumpH = 0;
      this.chain = 0; this.rspT = 0; this.vanishT = 0; this.fade = 1;
      this._visRot = 0; this._squash = 1;
      if (G.session && G.session.stage) this.stage = G.session.stage;
      this.pickTargetPad();
    }
    /* 选下一片落点荷叶：阶段①只挑最近的（短弧线好追），连跳第二跳必跨远 */
    pickTargetPad() {
      const pads = (G.scene && G.scene.pads) || [];
      if (!pads.length) { this.targetPadIdx = -1; return; }
      const P = G.FROG_PARAMS[this.stage || 1] || G.FROG_PARAMS[1];
      const taken = {};
      preys.forEach(q => { if (q !== this && q.type === "frog" && q.padIdx >= 0) taken[q.padIdx] = 1; });
      let cands = pads.map((_, i) => i).filter(i => i !== this.padIdx && !taken[i]);
      if (!cands.length) cands = pads.map((_, i) => i).filter(i => i !== this.padIdx);
      if (!cands.length) { this.targetPadIdx = this.padIdx; return; }
      const cur = pads[this.padIdx] || pads[0];
      const dist = (i) => Math.hypot(pads[i].x - cur.x, pads[i].y - cur.y);
      if (P.nearFirst > 0) {
        cands.sort((a, b) => dist(a) - dist(b));
        cands = cands.slice(0, Math.max(1, P.nearFirst));
      } else if (this.chain >= 1) {
        cands.sort((a, b) => dist(b) - dist(a));          // 连跳第二跳：取最远的一半
        cands = cands.slice(0, Math.max(1, Math.ceil(cands.length / 2)));
      }
      this.targetPadIdx = cands[Math.floor(rand(0, cands.length))];
    }
    startLeap() {
      const pads = (G.scene && G.scene.pads) || [];
      if (this.targetPadIdx < 0 || this.targetPadIdx === this.padIdx || !pads[this.targetPadIdx]) this.pickTargetPad();
      this.fState = "leap"; this.fT = 0; this.leapK = 0;
      if (this.targetPadIdx >= 0 && pads[this.targetPadIdx]) pads[this.targetPadIdx].hint = performance.now();
      // 起跳不配音（只留视觉与落点光圈），声音全部留给落地后的"呱呱"
    }
    updateFrog(dt, t) {
      const pads = (G.scene && G.scene.pads) || [];
      const stage = (G.session && G.session.stage) || 1;
      if (this.stage !== stage) this.stage = stage;
      const P = G.FROG_PARAMS[this.stage] || G.FROG_PARAMS[1];
      // 被拍中：先淡出（0.3s），再等 0.9s 从另一片荷叶水波里重生
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        if (this.vanishT <= 0) { this.vanishT = 0; this.fade = 0; this.jumpH = 0; this.rspT = 0.9; }
        return;
      }
      if (this.rspT > 0) {
        this.rspT -= dt;
        if (this.rspT <= 0) { this.rspT = 0; this.spawnOnPad(); }
        return;
      }
      this.fade = 1;
      // 时长缩放：难度 / 自适应辅助 / 连击提速 全部压进同一乘子（与现有玩法一致）
      const k = clamp((this.speedMul || 1) * (this.adaptiveSlow || 1) * (this.comboSpeed || 1), 0.45, 2.4);
      this.fT += dt * k;
      const MS = Math.pow(G.platform.S || 1, 0.5);

      if (this.fState === "crouch") {
        // 蓄力末段点亮落点荷叶：猫的预判窗口
        if (P.crouch - this.fT <= P.prep && this.targetPadIdx >= 0 && pads[this.targetPadIdx]) {
          pads[this.targetPadIdx].hint = performance.now();
        }
        this._squash = 1 - Math.min(0.16, this.fT / Math.max(P.crouch, 0.01) * 0.16);
        this._visRot = 0;
        this.croakCd -= dt;
        if (this.croakCd <= 0) { this.croakCd = rand(3, 6); if (G.playFrogCroak) G.playFrogCroak(); }
        if (this.fT >= P.crouch) this.startLeap();
        return;
      }
      if (this.fState === "leap") {
        const A = pads[this.padIdx], B = pads[this.targetPadIdx];
        this.leapK = Math.min(1, this.fT / P.leap);
        const k2 = this.leapK;
        if (A && B) {
          this.x = A.x + (B.x - A.x) * k2;
          this.y = A.y + (B.y - A.y) * k2;
          this.jumpH = 4 * 66 * MS * k2 * (1 - k2);        // 抛物线：最高点 ~66px
          this.faceDir = B.x < A.x ? -1 : 1;
        }
        this._visRot = (0.5 - k2) * 0.85;                  // 起跳抬头 → 落地低头
        this._squash = 1 + Math.sin(k2 * Math.PI) * 0.08;
        if (this.leapK >= 1) {
          this.padIdx = this.targetPadIdx;
          this.fState = "land"; this.fT = 0; this.jumpH = 0; this._squash = 0.82;
          if (G.playFrogLandCroak) G.playFrogLandCroak();   // 落地后"呱呱"两声（不再有起跳音）
          if (G.ripple) G.ripple(this.x, this.y, false);
          if (G.padSway) G.padSway(this.x, this.y);
        }
        return;
      }
      if (this.fState === "land") {
        this._squash = 0.82 + Math.min(1, this.fT / 0.18) * 0.18;
        this._visRot = 0;
        if (this.fT >= P.land) {
          this.chain = (this.chain || 0) + 1;
          this.fT = 0;
          if (this.chain < (P.chain || 1)) {
            // 阶段③ 连跳：落地几乎不停顿，再跳一次（光圈立刻亮起，仍有预兆）
            this.pickTargetPad();
            this.fState = "crouch";
            this.fT = Math.max(0, P.crouch - 0.14);
            if (this.targetPadIdx >= 0 && pads[this.targetPadIdx]) pads[this.targetPadIdx].hint = performance.now();
          } else {
            this.chain = 0;
            this.fState = "settle";
          }
        }
        return;
      }
      // settle 静坐：呼吸起伏，随时可拍（+1）
      this._squash = 1 + Math.sin(this.fT * 6) * 0.015;
      this._visRot = 0;
      if (this.fT >= P.settle) { this.fState = "crouch"; this.fT = 0; this.pickTargetPad(); }
    }
    /* 平滑泳姿：朝目标点转向——转向速率有上限（慢鱼更缓），近边提前缓弯，
       位置强制夹在屏内。鱼不会突然调头、也不会游出去淡出消失 */
    steerFish(dt, MS, b, sp, tx, ty) {
      if (this.headAng == null) this.headAng = this.dirX === 1 ? 0 : Math.PI;
      const speedK = clamp((this.speciesSpeed || 1) * 1.15, 0.5, 1.8);
      const rate = 1.9 * speedK;                                  // rad/s
      let want = Math.atan2(ty - this.y, tx - this.x);
      // 软边界：进入边缘缓冲带且朝外时，期望航向提前弯回屏内（缓弯，不是折返）
      const pad = 68 * MS;
      const L = b.x + pad, R = b.x + b.w - pad, T = b.y + pad, B = b.y + b.h - pad;
      if (this.x < L && Math.cos(want) < 0) want = 0;
      else if (this.x > R && Math.cos(want) > 0) want = Math.PI;
      if (this.y < T && Math.sin(want) < 0) want = Math.PI * 0.5;
      else if (this.y > B && Math.sin(want) > 0) want = -Math.PI * 0.5;
      // 转向速率上限
      let da = want - this.headAng;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const maxTurn = rate * dt;
      this.headAng += clamp(da, -maxTurn, maxTurn);
      // 游动 + 硬夹屏内
      this.x += Math.cos(this.headAng) * sp * dt * MS;
      this.y += Math.sin(this.headAng) * sp * dt * MS;
      this.x = clamp(this.x, b.x + 10, b.x + b.w - 10);
      this.y = clamp(this.y, b.y + 10, b.y + b.h - 10);
      this.faceDir = Math.cos(this.headAng) >= 0 ? 1 : -1;
      // 阶段①②沿泳道：完成调头后翻转前进方向，避免目标点来回拉扯（转向本身仍是缓弯）
      if (this.stage < 3 && Math.cos(this.headAng) * (this.dirX || 1) < -0.55) this.dirX = -this.dirX;
    }
    newWaypoint() {
      const b = G.bounds();
      // 航点永远在屏内（鱼不出屏、不淡出消失）
      // 鱼群聚拢：航点围绕鱼群中心取点（不再满屏随机），让整群鱼一起移动
      if (this.type === "fish") {
        const g = schoolInfo(this);
        if (g) {
          this.wx = clamp(g.x + rand(-165, 165), b.x + 0.04 * b.w, b.x + 0.96 * b.w);
          this.wy = clamp(g.y + rand(-120, 120), b.y + this.def.yMin * b.h, b.y + this.def.yMax * b.h);
          return;
        }
      }
      this.wx = b.x + rand(0.04, 0.96) * b.w;
      this.wy = b.y + rand(this.def.yMin, this.def.yMax) * b.h;
    }
    dartNow() {
      this.burstT = 0.45;
      this.dartCd = rand(this.def.dartMin, this.def.dartMax) * (this.dartMul || 1);
      if (this.stage === 3) this.newWaypoint();
    }
    /* ============ Peppy Cat 式行为个性（只调节奏/轨迹/拖尾，不动命中盒） ============
       pulse  忽快忽慢（金鱼/锦鲤）   zigzag 突然转向（神仙鱼/小丑鱼/沙丁鱼）
       hop    弹跳+绒线拖尾（河豚）   stalk  潜伏突进（鲨鱼） */
    behaviorTick(dt, t) {
      if (!this.behavior) return 1;
      const b = this.behavior;
      if (b === "pulse") {
        // 忽快忽慢：速度在 0.72×~1.28× 间正弦波动（收敛到均值 1×，对齐 23 日前的整体游速）
        return 0.72 + 0.56 * (0.5 + 0.5 * Math.sin(t * 1.15 + this.phase));
      }
      if (b === "zigzag") {
        // 灵活换线：周期性换泳道 / 换航点（不再瞬间翻转方向，靠光滑转向完成）
        this.behT -= dt;
        if (this.behT <= 0) {
          this.behT = rand(1.4, 2.6);
          if (this.stage === 3) this.newWaypoint();
          else {
            const b2 = G.bounds();
            const top = b2.y + this.def.yMin * b2.h, bot = b2.y + this.def.yMax * b2.h;
            const lane = this.stage === 2 ? this.midY : this.baseY;
            const shifted = clamp(lane + rand(-95, 95), top + 12, bot - 12);
            if (this.stage === 2) this.midY = shifted; else this.baseY = shifted;
          }
        }
        return 1.05;
      }
      if (b === "hop") {
        // 弹跳：垂直起伏（毛线球式）+ 落地涟漪 + 绒线拖尾
        this.hopPhase += dt * 3.1;
        const cyc = Math.floor(this.hopPhase / Math.PI);
        if (this.hopCyc != null && cyc > this.hopCyc && G.session.running) {
          try { G.ripple(this.x, this.y + this.baseH * 0.4, true); } catch (e) {}
        }
        this.hopCyc = cyc;
        this.hopOff = Math.abs(Math.sin(this.hopPhase)) * 26;
        this.yarnAcc += dt;
        if (this.yarnAcc > 0.06) {
          this.yarnAcc = 0;
          this.trail.push({ x: this.x, y: this.y - this.hopOff });
          if (this.trail.length > 14) this.trail.shift();
        }
        for (let i = this.trail.length - 1; i >= 0; i--) {
          this.trail[i].life = (this.trail[i].life || 1) - dt * 1.15;
          if (this.trail[i].life <= 0) this.trail.splice(i, 1);
        }
        return 1.05 - 0.05 * (1 - Math.abs(Math.cos(this.hopPhase)));
      }
      if (b === "stalk") {
        // 潜伏突进：慢速巡游 2s 上下 → 0.9s 爆发突进，鲨鱼捕猎节奏
        this.stalkT -= dt;
        if (this.stalkT <= 0) {
          if (this.stalking) {
            this.stalking = false;
            this.stalkT = rand(0.7, 1.1);
            this.burstT = Math.max(this.burstT, this.stalkT + 0.25);
          } else {
            this.stalking = true;
            this.stalkT = rand(1.6, 2.8);
          }
        }
        return this.stalking ? 0.58 : 1.25;
      }
      return 1;
    }
    warpIn() {
      if (this.trail) this.trail.length = 0;      // 换位后旧绒线拖尾不能留在原地
      if (this.type === "butterfly") { this.butterflyEnter(); return; }
      const b = G.bounds(), m = 110, FD = 120;
      const top = b.y + this.def.yMin * b.h, bot = b.y + this.def.yMax * b.h;
      // 泳池模式：直接在屏内随机点入场（淡入），不从屏外游入
      if (this.type === "fish" && inPoolMode()) {
        for (let attempt = 0; attempt < 6; attempt++) {
          this.x = b.x + rand(0.08, 0.92) * b.w;
          this.y = b.y + rand(this.def.yMin, this.def.yMax) * b.h;
          if (!preys.some(q => q !== this && Math.hypot(q.x - this.x, q.y - this.y) < 90)) break;
        }
        this.swimAng = rand(0, Math.PI * 2);          // 入场即带随机航向
        this._visAng = this.swimAng;
        this.dirX = Math.cos(this.swimAng) >= 0 ? 1 : -1;
        this.faceDir = this.dirX;
        this.baseY = this.y;
        if (this.stage === 2) this.midY = clamp(this.y, top + this.vAmp, bot - this.vAmp);
        this.newWaypoint();
        this.fade = 1;
        return;
      }
      // 鱼群模式：第一条随机落位，后续贴着同伴入群（出生即在群里）
      if (this.type === "fish" && inSchoolMode()) {
        const mates = preys.filter(q => q !== this && q.type === "fish" && q.x != null);
        if (mates.length) {
          const m = mates[Math.floor(rand(0, mates.length))];
          this.x = clamp(m.x + rand(-80, 80), b.x + 30, b.x + b.w - 30);
          this.y = clamp(m.y + rand(-80, 80), b.y + 30, b.y + b.h - 30);
        } else {
          this.x = b.x + rand(0.15, 0.85) * b.w;
          this.y = b.y + rand(this.def.yMin, this.def.yMax) * b.h;
        }
        const a = rand(0, Math.PI * 2);
        this.vx = Math.cos(a) * this.def.speed;
        this.vy = Math.sin(a) * this.def.speed;
        this._visAng = a;
        this.faceDir = Math.cos(a) >= 0 ? 1 : -1;
        this.fade = 1;
        return;
      }
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
      if (this.type === "fish") this.headAng = this.dirX === 1 ? 0 : Math.PI;   // 入场朝向与前进方向一致
      this.baseY = this.y;
      if (this.stage === 2) this.midY = clamp(this.y, top + this.vAmp, bot - this.vAmp);
      this.newWaypoint();
      this.fade = clamp(1 - m / FD, 0, 1);
    }
    /* 鱼群巡游：鲸鱼捕猎式"饵球"——全体小鱼聚成一个致密鱼团，
       群心缓慢漂移（共享虚拟引点），球内鱼群绕心旋转（漩涡），
       叠加局部 boids（质心/对齐/近距分离）与法线漫游，边界软反弹，朝向平滑跟随速度 */
    updateSchoolSwim(dt, t, sp, MS, b) {
      if (this.vx == null) {
        const a = rand(0, Math.PI * 2);
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
        this._visAng = a;
      }
      // 共享群心（漂移引点）：每帧只由第一条鱼推进（lastT 戳去重）
      const S = G.scene;
      if (!S.schoolC) {
        S.schoolC = {
          x: b.x + b.w * 0.5, y: b.y + b.h * 0.45,
          tx: b.x + b.w * 0.5, ty: b.y + b.h * 0.45,
          cd: 0, dir: Math.random() < 0.5 ? 1 : -1, flipCd: rand(5, 9), lastT: -1
        };
      }
      const C = S.schoolC;
      if (C.lastT !== t) {
        C.lastT = t;
        C.cd -= dt; C.flipCd -= dt;
        if (C.flipCd <= 0) { C.flipCd = rand(5, 9); C.dir = -C.dir; }   // 漩涡定期换向
        const dcx = C.tx - C.x, dcy = C.ty - C.y;
        const dc = Math.hypot(dcx, dcy);
        if (dc < 24 || C.cd <= 0) {                                      // 到点/超时 → 换漂移目标
          C.tx = b.x + rand(0.26, 0.74) * b.w;                           // 目标收在屏幕中部，鱼群不散到边缘
          C.ty = b.y + rand(0.24, 0.66) * b.h;
          C.cd = rand(4, 7);
        } else {
          C.x += dcx / dc * 52 * dt; C.y += dcy / dc * 52 * dt;          // 群心缓慢漂移（过快会拖散队形）
        }
      }
      // 局部 boids：质心 + 对齐 + 近距分离（22px，致密饵球）
      let cx = 0, cy = 0, ax = 0, ay = 0, n = 0, sx = 0, sy = 0;
      preys.forEach(q => {
        if (q === this || q.type !== "fish" || q.vx == null) return;
        const dx = q.x - this.x, dy = q.y - this.y;
        const d2 = dx * dx + dy * dy;
        cx += q.x; cy += q.y; ax += q.vx; ay += q.vy; n++;
        if (d2 < 22 * 22 && d2 > 1) {
          const dd = Math.sqrt(d2);
          sx -= dx / dd * (22 - dd); sy -= dy / dd * (22 - dd);
        }
      });
      let steerX = 0, steerY = 0;
      if (n > 0) {
        steerX += (cx / n - this.x) * 0.55 + (ax / n - this.vx) * 1.2 + sx * 2.6;
        steerY += (cy / n - this.y) * 0.55 + (ay / n - this.vy) * 1.2 + sy * 2.6;
      }
      // 群心聚拢（越远拉力越大）+ 绕心漩涡（饵球旋转，方向随 C.dir 定期翻转）
      const dxc = C.x - this.x, dyc = C.y - this.y;
      const dc = Math.hypot(dxc, dyc) || 1;
      const pull = sp * 2.2 * Math.min(1, dc / 130);           // 聚拢力加强：远处也被快速拉回（鱼群更紧）
      steerX += dxc / dc * pull + -dyc / dc * sp * 0.5 * C.dir;   // 漩涡减弱 → 绕行半径变小
      steerY += dyc / dc * pull + dxc / dc * sp * 0.5 * C.dir;
      // 侧向漫游：球内个体微摆，避免机械同步
      const wob = Math.sin(t * 1.3 + this.phase) * 0.26 * sp;
      steerX += -Math.sin(this._visAng) * wob;
      steerY += Math.cos(this._visAng) * wob;
      // 转向 + 速度钳制
      this.vx += steerX * dt; this.vy += steerY * dt;
      const v = Math.hypot(this.vx, this.vy) || 1;
      const cap = sp, min = sp * 0.65;
      if (v > cap) { this.vx *= cap / v; this.vy *= cap / v; }
      else if (v < min) { this.vx *= min / v; this.vy *= min / v; }
      this.x += this.vx * dt * MS;
      this.y += this.vy * dt * MS;
      // 边界软反弹（不出屏）
      const pad = 16 * MS;
      const L = b.x + pad, R = b.x + b.w - pad, T = b.y + pad, B = b.y + b.h - pad;
      if (this.x < L) { this.x = L; this.vx = Math.abs(this.vx); }
      else if (this.x > R) { this.x = R; this.vx = -Math.abs(this.vx); }
      if (this.y < T) { this.y = T; this.vy = Math.abs(this.vy); }
      else if (this.y > B) { this.y = B; this.vy = -Math.abs(this.vy); }
      // 朝向平滑跟随速度方向
      const ta = Math.atan2(this.vy, this.vx);
      let d = ta - this._visAng;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this._visAng += d * Math.min(1, dt * 8);
      this.faceDir = Math.cos(ta) >= 0 ? 1 : -1;
    }

    /* 泳池巡游：任意方向直线游动——随机航向 + 撞边反射 + 低频随机换向（直线段更长）；
       贴边换向只选"朝池内"的角度、长时间位移不足自动朝池心纠偏（角落不卡死）；
       视觉朝向平滑追赶航向（转身不瞬跳），帶极轻微摆动保持"活"感 */
    updatePoolSwim(dt, t, sp, MS, b) {
      if (this.swimAng == null) { this.swimAng = rand(0, Math.PI * 2); this._visAng = this.swimAng; }
      // 换向计时：间隔拉长（3.2~5.6s）→ 直线段更长；贴边时只允许朝池内的航向
      this.swimTurnCd = (this.swimTurnCd || rand(3.2, 5.6)) - dt;
      if (this.swimTurnCd <= 0) { this.swimTurnCd = rand(3.2, 5.6); this.swimAng = this.pickPoolHeading(b); }
      // 视觉角平滑追赶航向（按最短弧；限速 4.2rad/s，贴边反射时不至于原地猛甩尾）
      let dAng = this.swimAng - this._visAng;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      this._visAng += clamp(dAng * Math.min(1, dt * 9), -4.2 * dt, 4.2 * dt);
      // 直线游动 + 极轻微正弦摆动
      const ang = this._visAng + Math.sin(t * 3 + this.phase) * 0.05;
      this.x += Math.cos(ang) * sp * dt * MS;
      this.y += Math.sin(ang) * sp * dt * MS;
      // 撞边反射：只在「确实朝墙外游」时翻转航向（否则贴边会每帧反复翻转 → 尾巴抖动闪动）；
      // 位置无论如何都夹回池内
      const pad = 14 * MS;
      const L = b.x + pad, R = b.x + b.w - pad, T = b.y + pad, B = b.y + b.h - pad;
      if (this.x < L && Math.cos(this.swimAng) < 0)      this.swimAng = Math.PI - this.swimAng;
      else if (this.x > R && Math.cos(this.swimAng) > 0) this.swimAng = Math.PI - this.swimAng;
      if (this.y < T && Math.sin(this.swimAng) < 0)      this.swimAng = -this.swimAng;
      else if (this.y > B && Math.sin(this.swimAng) > 0) this.swimAng = -this.swimAng;
      this.x = clamp(this.x, L, R);
      this.y = clamp(this.y, T, B);
      // 卡死保险：连续 0.5s 位移不足（被夹在角落）→ 立即朝池心纠偏
      const moved2 = (this.x - (this._lx != null ? this._lx : this.x)) ** 2 + (this.y - (this._ly != null ? this._ly : this.y)) ** 2;
      this._stuckT = moved2 < 0.04 ? (this._stuckT || 0) + dt : 0;
      if (this._stuckT > 0.5) {
        this._stuckT = 0;
        this.swimAng = Math.atan2(b.y + b.h / 2 - this.y, b.x + b.w / 2 - this.x);
        this._visAng = this.swimAng;
      }
      this._lx = this.x; this._ly = this.y;
      // 左右朝向：按视觉角的水平分量判断，并留死区（垂直游动时不再每帧来回镜像 → 修复鱼尾闪动）
      const ca = Math.cos(this._visAng);
      if (ca > 0.34) this.faceDir = 1;
      else if (ca < -0.34) this.faceDir = -1;
    }

    /* 挑选航向：远离墙壁（90px 内）时纯随机；贴边时重 roll 到"分量朝池内"的角度，
       roll 不中兜底直接朝池心——保证换向不会把鱼抵在墙上/角落 */
    pickPoolHeading(b) {
      const nearL = this.x - b.x < 90, nearR = b.x + b.w - this.x < 90;
      const nearT = this.y - b.y < 90, nearB = b.y + b.h - this.y < 90;
      for (let i = 0; i < 10; i++) {
        const a = rand(0, Math.PI * 2);
        if (nearL && Math.cos(a) < 0.25) continue;
        if (nearR && Math.cos(a) > -0.25) continue;
        if (nearT && Math.sin(a) < 0.25) continue;
        if (nearB && Math.sin(a) > -0.25) continue;
        return a;
      }
      return Math.atan2(b.y + b.h / 2 - this.y, b.x + b.w / 2 - this.x);
    }

    vanish() {
      if (this.type === "butterfly" && this.state === "STARTLED") return;   // 惊飞中防重入
      // 青蛙：拍中要"干脆消失"，只留 0.16s 残影，观感交给 frogPop 的爆开特效
      if (this.type === "frog") { this.burstT = 0; this.vanishT = 0.16; return; }
      this.vanishT = 0.3;
      this.burstT = 0;
      if (this.type === "butterfly") {
        this.state = "STARTLED"; this.stateT = 0;
        this.landTarget = null;
        this.vx = (this.x > G.platform.W / 2 ? 1 : -1) * rand(180, 260);
        this.vy = -rand(80, 140);
        return;
      }
      if (this.type === "mouse" && !(G.scene && G.scene.mouseBg === "swarm")) {
        this.scared = true;
        this.state = "hole"; this.stateT = 0; this.mT = 0;
        this.x = this.hole.x; this.y = this.hole.y;
      }
      // 鱼群模式：被捕一条 → 邻近小鱼受惊四散（饵球被咬一口的炸开反应），速度上限会自然带回
      if (this.type === "fish" && inSchoolMode()) {
        preys.forEach(q => {
          if (q === this || q.type !== "fish" || q.vx == null) return;
          const dx = q.x - this.x, dy = q.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d > 1) {
            const kk = (130 - Math.min(d, 130)) / 130 * 360 + 90;   // 全群拍散：近炸远也推
            q.vx += dx / d * kk; q.vy += dy / d * kk;
          }
        });
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
        this.stageSpeed = 1.1;                  // 开局放缓：让猫先抓到、再加速
      } else if (n === 2) {
        this.vAmp = Math.min((bot - top) * 0.28, Math.max(b.h * 0.16, 60));
        this.midY = clamp(this.y, top + this.vAmp, bot - this.vAmp);
        this.stageSpeed = 1.2;
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
      if (this.type === "mouse")   {
        if (G.scene.mouseBg === "swarm") { this.updateSwarmMouse(dt, t); return; }
        this.updateMouse(dt, t); return;
      }
      if (this.type === "butterfly") { this.updateButterfly(dt, t); return; }
      if (this.type === "frog") { this.updateFrog(dt, t); return; }
      if (this.type === "pool") { this.updateCrawl(dt, t); return; }
      if (this.type === "laser") { this.updateLaser(dt, t); return; }
      // ---- 鱼：三阶段 ----
      const d = this.def;
      this.dartCd -= dt; this.burstT -= dt;
      // 冲刺只给「游速快」的鱼种（鲨鱼/沙丁鱼）；慢鱼与普通鱼恒速巡游，不做突然加速
      const canDash = !!(this.species && this.species.burst && this.species.speed >= 1.0);
      // 泳池模式：定时冲刺移除——恒速巡游，节奏靠随机换向计时与撞边反射
      if (this.type === "fish" && inPoolMode()) { this.burstT = 0; this.dartCd = 1; }
      else if (this.cruiser || !canDash) this.burstT = 0;
      else if (this.dartCd <= 0) this.dartNow();
      if (this.stage !== G.session.stage) this.enterStage(G.session.stage);
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        if (this.vanishT <= 0) { this.vanishT = 0; if (this.type === "fish") this.pickFishSpecies(); this.warpIn(); }
      }
      const behSp = this.behaviorTick(dt, t);   // Peppy Cat 式行为节奏（无 behavior 返回 1）
      // 鱼群巡游：屏蔽单体冲刺（burst 会把个别小鱼甩出鱼团，导致队形散开）
      const burstMul = (this.burstT > 0 && canDash && !inSchoolMode()) ? (this.speciesBurst || 3.1) : 1;
      const sp = d.speed * this.speedMul * this.comboSpeed * this.adaptiveSlow * this.speciesSpeed * (this.cruiser ? 1.5 : 1) * this.stageSpeed * behSp * burstMul;
      // 泳池模式：任意方向直线巡游（随机航向 + 撞边反射 + 定时/冲刺换向），不走三阶段
      if (this.type === "fish" && inPoolMode()) {
        this.updatePoolSwim(dt, t, sp, MS, b);
      } else if (this.type === "fish" && inSchoolMode()) {
        this.updateSchoolSwim(dt, t, sp, MS, b);       // 鱼群模式：boids 结群游动
      } else if (this.stage === 3) {
        // 阶段③：朝航点平滑转向（转向速率有上限，绝不瞬间调头）
        this.steerFish(dt, MS, b, sp, this.wx, this.wy);
        const dx = this.wx - this.x, dy = this.wy - this.y;
        if (dx * dx + dy * dy < 3600) this.newWaypoint();
      } else {
        // 阶段①②：沿泳道前进，纵向缓慢收敛到泳道高度（同样的平滑转向模型）
        const laneY = this.stage === 1 ? this.baseY : this.midY;
        this.steerFish(dt, MS, b, sp, this.x + this.dirX * 320, laneY);
      }
      // 边界：位置已在 steerFish 内夹在屏内，鱼不会游出屏幕淡出消失
      this.fade = 1;
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
    /* ============ 群鼠乱窜：俯视群鼠状态机 ============
       无洞口——scurry 直线疾走（随机航向+撞边反射）→ 随机换向或短暂停顿（停顿=主要命中窗口）；
       被拍中走 vanish 动画，结束后随机换位重生，满屏数量恒定 */
    updateSwarmMouse(dt, t) {
      const b = G.bounds(), MS = Math.pow(G.platform.S || 1, 0.5);
      if (this.swimAng == null) this.swimAng = rand(0, Math.PI * 2);
      if (this._visAng == null) this._visAng = this.swimAng;   // 朝向单独初始化（spawn 只给了 swimAng）
      // 消失动画：倒计时结束随机换位重生
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        if (this.vanishT <= 0) {
          this.vanishT = 0;
          for (let attempt = 0; attempt < 5; attempt++) {
            this.x = b.x + rand(0.1, 0.9) * b.w;
            this.y = b.y + rand(0.14, 0.86) * b.h;
            if (!preys.some(q => q !== this && q.vanishT <= 0 && Math.hypot(q.x - this.x, q.y - this.y) < 100)) break;
          }
          this.swimAng = rand(0, Math.PI * 2); this._visAng = this.swimAng;
          this.state = "scurry"; this.stateT = 0; this.stateDur = rand(1.4, 2.8);
          this.fade = 1;
        }
        return;                                   // 消失期间不移动
      }
      if (this.state == null) { this.state = "scurry"; this.stateT = 0; this.stateDur = rand(1.4, 2.8); }

      const pad = 20 * MS;
      const L = b.x + pad, R = b.x + b.w - pad, T = b.y + pad, B = b.y + b.h - pad;

      // 节奏：直爬一段 → 偶尔停一下；换向只做小幅调整（不画圈）
      this.stateT += dt;
      if (this.state === "pause") {
        if (this.stateT >= this.stateDur) { this.state = "scurry"; this.stateT = 0; this.stateDur = rand(1.4, 2.8); }
      } else if (this.stateT >= this.stateDur) {
        this.stateT = 0;
        if (Math.random() < 0.45) { this.state = "pause"; this.stateDur = 0.4; }   // 停驻嗅探 0.4s = 命中窗口
        else { this.stateDur = rand(1.4, 2.8); this._turnTo = this.swimAng + rand(-0.45, 0.45); }   // 小幅转向也平滑过渡
      }

      if (this.state !== "pause") {
        const sp = this.def.speed * this.speedMul * (1 + ((G.session.stage || 1) - 1) * 0.16)
          * (this.adaptiveSlow || 1) * (this.comboSpeed || 1);
        // 撞墙后的新航向：逐步转过去（沿墙滑行），不瞬间甩头
        if (this._turnTo != null) {
          let da = this._turnTo - this.swimAng;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          const step = 3.6 * dt;
          this.swimAng += clamp(da, -step, step);
          if (Math.abs(da) < 0.06) this._turnTo = null;
        }
        // 直线前进（位移沿当前朝向，不绕目标点转圈）
        this.x += Math.cos(this.swimAng) * sp * dt * MS;
        this.y += Math.sin(this.swimAng) * sp * dt * MS;
        // 撞墙：夹回屏内 + 指定一个朝屏内的新航向（下面逐步转过去）
        let bumped = false;
        if (this.x < L)      { this.x = L; this._turnTo = rand(-0.7, 0.7); bumped = true; }
        else if (this.x > R) { this.x = R; this._turnTo = Math.PI + rand(-0.7, 0.7); bumped = true; }
        if (this.y < T)      { this.y = T; this._turnTo = Math.PI / 2 + rand(-0.7, 0.7); bumped = true; }
        else if (this.y > B) { this.y = B; this._turnTo = -Math.PI / 2 + rand(-0.7, 0.7); bumped = true; }
        if (bumped) { this.stateT = 0; this.stateDur = rand(1.4, 2.8); }
      }

      // 位置兜底夹在屏内
      this.x = clamp(this.x, b.x + 16 * MS, b.x + b.w - 16 * MS);
      this.y = clamp(this.y, b.y + 16 * MS, b.y + b.h - 16 * MS);
      // 渲染朝向快速对齐实际航向（撞墙换向时也不会长时间背对前进方向）
      let dv = this.swimAng - this._visAng;
      while (dv > Math.PI) dv -= Math.PI * 2;
      while (dv < -Math.PI) dv += Math.PI * 2;
      this._visAng += clamp(dv, -9 * dt, 9 * dt);
      this.faceDir = Math.cos(this.swimAng) >= 0 ? 1 : -1;
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
          this.state = "HOVER"; this.stateT = 0;
          this.hoverDur = 0.3;                  // 惊飞后先悬停 0.3s 再加速（给猫反应窗口）
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
          if (q !== this && (q.type === "laser" || q.type === "pool")) d = Math.min(d, Math.hypot(q.x - x, q.y - y));
        });
        if (d >= minDist) return { x, y };
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
      return best || { x: b.x + rand(0.03, 0.97) * b.w, y: b.y + rand(0.03, 0.97) * b.h };
    }
    /* 暗夜萤光：虫子在石板地上爬行（慢速爬 → 停驻命中窗口 → 原地转向再爬），
       全程在固定容器内连续移动，不瞬移不消失 */
    updateCrawl(dt, t) {
      const b = G.bounds();
      if (this.stage !== G.session.stage) this.stage = G.session.stage;
      const P = G.POOL_PARAMS[this.stage] || G.POOL_PARAMS[1];
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        if (this.vanishT <= 0) {
          this.vanishT = 0;
          const s0 = this.laserSpot();
          this.x = s0.x; this.y = s0.y;
          this.crawlAng = rand(0, Math.PI * 2);
          this.straight = Math.random() < 0.5;        // 一半虫子走直线（撞边反射），一半蛇行
          this.state = "crawl"; this.stateT = 0;
          this.stateDur = rand(P.dart[0], P.dart[1]);
        }
        return;
      }
      const MS = Math.pow(G.platform.S || 1, 0.5);
      const inset = 26 * Math.pow(G.platform.S || 1, 0.4);   // 只留极窄边距防裁切，虫子可爬到屏幕边缘
      const L = b.x + inset, Rt = b.x + b.w - inset, T = b.y + inset, Bm = b.y + b.h - inset;
      if (this.crawlAng == null) this.crawlAng = rand(0, Math.PI * 2);
      this.stateT += dt;
      if (this.state === "crawl") {
        // 爬行：前进 + 行为分流——直线虫走直线撞边才转向，蛇行虫带正弦微摆
        const stage = G.session.stage || 1;
        const sp = (195 + (stage - 1) * 72) * MS * this.speedMul * (this.adaptiveSlow || 1);   // 连击只加光效不加速度
        if (!this.straight) this.crawlAng += Math.sin(t * 3.1 + this.phase) * 1.5 * dt;
        // 同伴避让：靠近其他虫子时平滑转向离开（避免重叠）
        const keepOut = 115 * MS;
        preys.forEach(q => {
          if (q === this || q.type !== "pool" || q.vanishT > 0) return;
          const dx = this.x - q.x, dy = this.y - q.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.01 && d < keepOut) {
            let da = Math.atan2(dy, dx) - this.crawlAng;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            this.crawlAng += da * Math.min(1, (1 - d / keepOut) * 6) * dt * 6;
          }
        });
        this.x += Math.cos(this.crawlAng) * sp * dt;
        this.y += Math.sin(this.crawlAng) * sp * dt;
        // 边界处理：直线虫像台球一样沿边反射（撞边才改变方向）；蛇行虫朝中心折返
        if (this.x < L || this.x > Rt || this.y < T || this.y > Bm) {
          this.x = Math.min(Math.max(this.x, L), Rt);
          this.y = Math.min(Math.max(this.y, T), Bm);
          if (this.straight) {
            if (this.x <= L || this.x >= Rt) this.crawlAng = Math.PI - this.crawlAng;
            if (this.y <= T || this.y >= Bm) this.crawlAng = -this.crawlAng;
          } else {
            this.crawlAng = Math.atan2(b.y + b.h / 2 - this.y, b.x + b.w / 2 - this.x) + rand(-0.5, 0.5);
          }
        }
        // 爬行留下荧光足迹
        this.trailAcc += Math.hypot(this.x - (this.lastTrailX || this.x), this.y - (this.lastTrailY || this.y));
        if (this.trailAcc > 26) { this.trailAcc = 0; G.laserTrail(this.x, this.y, "pool"); }
        this.lastTrailX = this.x; this.lastTrailY = this.y;
        if (this.stateT >= this.stateDur) {
          this.state = "pause"; this.stateT = 0;
          this.stateDur = rand(P.hold[0], P.hold[1]) * 1.5;   // 停驻 = 主要命中窗口
        }
      } else {
        // 停驻：原地不动，触角轻摆；被同伴逼近时缓慢挪开（避免叠在一起）
        this.crawlAng += Math.sin(t * 1.7 + this.phase) * 0.25 * dt;
        const keepOut2 = 95 * MS;
        preys.forEach(q => {
          if (q === this || q.type !== "pool" || q.vanishT > 0) return;
          const dx = this.x - q.x, dy = this.y - q.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.01 && d < keepOut2) {
            const push = 55 * MS * dt * (1 - d / keepOut2);
            this.x = Math.min(Math.max(this.x + dx / d * push, L), Rt);
            this.y = Math.min(Math.max(this.y + dy / d * push, T), Bm);
          }
        });
        if (this.stateT >= this.stateDur / Math.sqrt(Math.max(this.comboSpeed || 1, 1))) {
          this.stateT = 0;
          this.state = "crawl";
          this.stateDur = rand(P.dart[0], P.dart[1]);
          if (!this.straight) this.crawlAng += rand(-1.3, 1.3);   // 蛇行虫起步前原地转向；直线虫保持原方向
        }
      }
      this.fade = 1;
    }
    laserTeleport() {      const s0 = this.laserSpot();
      this.x = s0.x; this.y = s0.y;
      if (this.type === "pool") {
        // 萤光瞬移：只散几点萤火碎屑，不出冲击环——环留给真实命中（防满屏圆环抢戏）
        G.sparkBurst(this.x, this.y, "#e8ff9a", 4);
        G.pollenBurst(this.x, this.y, 3);
      } else {
        G.laserFlash(this.x, this.y, this.laserVar && this.laserVar.key);
      }
      this.laserNewWaypoint();
      if (this.type === "pool") this._headAng = Math.atan2(this.vy, this.vx);   // 瞬移后立即朝向新航向
    }
    updateLaser(dt, t) {
      const d = this.def, b = G.bounds();
      const isPool = this.type === "pool";
      if (this.stage !== G.session.stage) this.stage = G.session.stage;
      const P = (isPool ? G.POOL_PARAMS : G.LASER_PARAMS)[this.stage] || (isPool ? G.POOL_PARAMS[1] : G.LASER_PARAMS[1]);
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
      // 瞬移预警：原地高频闪烁 0.3s（渲染层按 preTele 处理闪烁），结束后瞬移
      if (this.state === "preTele") {
        if (this.stateT >= 0.3) { this.state = "dart"; this.stateT = 0; this.laserTeleport(); }
        this.fade = 1;
        return;
      }
      // pool 专属固定容器：飞行/悬停都约束在这块内缩区域里（不贴边、不瞬移出容器）
      const inset = isPool ? 46 * Math.pow(G.platform.S || 1, 0.4) : 10;
      const L = b.x + inset, Rt = b.x + b.w - inset, T = b.y + inset, B = b.y + b.h - inset;
      if (this.state === "dart") {
        const sp = d.speed * this.speedMul * this.comboSpeed * (this.adaptiveSlow || 1) * (this.speciesSpeed || 1);
        const MS = Math.pow(G.platform.S || 1, 0.5);
        this.x += this.vx * sp * dt * MS;
        this.y += this.vy * sp * dt * MS;
        if (isPool) {
          // 飞行侧摆：沿速度法线做正弦摆动（S 形飘飞，像扇着翅膀滑翔，替代直线乱窜）
          const sway = Math.sin(t * 4.6 + this.phase) * 30 * dt * MS;
          this.x += -this.vy * sway;
          this.y += this.vx * sway;
        }
        let bounced = false;
        if (this.x < L)         { this.x = L;             this.vx = Math.abs(this.vx); bounced = true; }
        else if (this.x > Rt)   { this.x = Rt;            this.vx = -Math.abs(this.vx); bounced = true; }
        if (this.y < T)         { this.y = T;             this.vy = Math.abs(this.vy); bounced = true; }
        else if (this.y > B)    { this.y = B;             this.vy = -Math.abs(this.vy); bounced = true; }
        if (bounced) {
          G.playBounce();
          this.wx = this.x + this.vx * 260; this.wy = this.y + this.vy * 260;
        }
        if (P.trail || isPool) {
          this.trailAcc += Math.hypot(this.x - this.lastTrailX, this.y - this.lastTrailY);
          if (this.trailAcc > 22) {
            this.trailAcc = 0;
            // 水面光斑：掠过留下小水花痕（比激光灼痕更轻，避免满屏脏点）
            if (isPool) G.laserTrail(this.x, this.y, "pool");
            else G.laserTrail(this.x, this.y, this.laserVar && this.laserVar.key);
          }
        }
        this.lastTrailX = this.x; this.lastTrailY = this.y;
        const near = (this.wx - this.x) * (this.wx - this.x) + (this.wy - this.y) * (this.wy - this.y) < 900;
        if (near || this.stateT >= this.stateDur * 2.2) {
          this.state = "hold"; this.stateT = 0;
          this.stateDur = rand(P.hold[0], P.hold[1]);
        } else if (!isPool && Math.random() < P.tele * dt * 8) {
          // pool 不瞬移：只在固定容器内连续飞行（避免"突然消失"）；激光瞬移前先闪烁预警 0.3s
          this.state = "preTele"; this.stateT = 0;
        }
      } else {
        // hold 停留（主要命中窗口）
        this.x += Math.sin(t * 7 + this.phase) * 2 * dt;
        this.y += Math.cos(t * 8.3 + this.phase) * 2 * dt;
        if (this.stateT >= this.stateDur / Math.sqrt(Math.max(this.comboSpeed || 1, 1))) {
          this.stateT = 0;
          if (!isPool && Math.random() < P.tele) { this.state = "preTele"; }
          else { this.state = "dart"; this.laserNewWaypoint(); }
        }
      }
      this.fade = 1;
    }

    /* ============ 命中判定（对齐 DOM 包围盒点击语义） ============ */
    hittable(x, y) {
      if (this.vanishT > 0) return false;
      if (this.type === "frog") {
        // 重生等待期不可拍；命中盒外扩 15%（落水瞬间放宽到 25%，只要拍在荷叶上都算）
        if (this.rspT > 0 || this.fade < 0.4) return false;
        const pad = this.fState === "land" ? 1.25 : 1.15;
        const hw = this.baseW * this.sc * 0.5 * pad, hh = this.baseH * this.sc * 0.5 * pad;
        const cy = this.y - (this.jumpH || 0);
        if (Math.abs(x - this.x) <= hw && Math.abs(y - cy) <= hh) return true;
        // 腾空时水面投影同样可命中（不要求精确压在抛起的身体上）
        return this.fState === "leap" && Math.abs(x - this.x) <= hw && Math.abs(y - this.y) <= hh;
      }
      // 蝴蝶移动快、入场频繁：宽容判定（外扩 1.7 倍 ≈ 可见翅膀再加大圈容错边；半透明期放宽到 0.25）
      // 鱼群小鱼太小：外扩 1.5 倍保证猫拍得中
      const bPad = this.type === "butterfly" ? 1.7
        : (this.type === "fish" && inSchoolMode()) ? 1.5
        : this.type === "laser" ? 1.25 : 1;              // 激光光点小：命中区外扩 25% 好拍
      const fMin = this.type === "butterfly" ? 0.25 : 0.4;
      if (this.fade < fMin) return false;
      const hw = this.baseW * this.sc * (this.sxMul || 1) / 2 * bPad, hh = this.baseH * this.sc / 2 * bPad;
      const cy = this.y - (this.hopOff || 0);       // hop 弹跳偏移：命中跟着视觉走
      if (Math.abs(x - this.x) > hw || Math.abs(y - cy) > hh) return false;
      if (this.type === "mouse") {
        if (G.scene && G.scene.mouseBg === "swarm") {
          // 群鼠：加高命中盒覆盖头+耳（视觉 120×100,命中 116×86 中心略偏上）
          const hw2 = this.baseW * this.sc * 0.42, hh2 = this.baseH * this.sc * 0.74;
          return Math.abs(x - this.x) <= hw2 && Math.abs(y - this.y - this.baseH * this.sc * 0.08) <= hh2;
        }
        return (this.state === "peek" || this.state === "dart") && this.lift < 48;
      }
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
        if (G.scene && G.scene.mouseBg === "swarm") {
          // 群鼠乱窜：俯视鼠——柔光 + 随游动轻微倾斜，无洞口裁剪
          ctx.translate(this.x, this.y);
          const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 66 * this.sc);
          gr.addColorStop(0, "rgba(255,248,244,.45)");
          gr.addColorStop(0.5, "rgba(255,236,240,.16)");
          gr.addColorStop(1, "rgba(255,236,240,0)");
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(0, 0, 66 * this.sc, 0, Math.PI * 2); ctx.fill();
          // 整只鼠按爬行方向旋转（头朝行进方向）+ 极轻的待机晃动，动作与移动方向一致
          ctx.rotate((this._visAng || 0) + Math.PI / 2 + Math.sin(t * 1.7 + (this.phase || 0)) * 0.03);
          const s = this.sc * vs;
          ctx.scale(s, s);
          ctx.translate(-60, -50);
          G.draw.mouseTop(ctx, this, t);
        } else {
          // 裁剪到猎物包围盒（模拟 overflow:hidden 的洞口钻出效果）
          const hw = this.baseW * this.sc / 2, hh = this.baseH * this.sc / 2;
          ctx.translate(this.x, this.y);
          ctx.beginPath(); ctx.rect(-hw, -hh + this.lift * this.sc, hw * 2, hh * 2); ctx.clip();
          ctx.translate(0, this.lift * this.sc);
          const s = this.sc;
          ctx.scale(s * (this.def.face ? this.faceDir : 1), s);
          ctx.translate(-60, -39);
          G.draw.mouse(ctx, this, t);
        }
      } else if (this.type === "butterfly") {
        const tilt = this.state === "FLAP" ? -12 : this.state === "GLIDE" ? 6 : this.state === "LANDING" ? -8 : 0;
        ctx.translate(this.x, this.y);
        ctx.rotate(tilt * Math.PI / 180 * (this.faceDir || 1));
        const s = this.sc * vs * (this.speciesScale || 1);
        ctx.scale(s, s);
        ctx.translate(-60, -56);
        G.draw.butterfly(ctx, this, t);
      } else if (this.type === "laser" || this.type === "pool") {
        ctx.translate(this.x, this.y);
        if (this.type === "pool") G.draw.poolLight(ctx, this, t);
        else G.draw.laser(ctx, this, t);
      } else if (this.type === "frog") {
        // 水面投影：与身体分离来表达"跳起来了"（跳跃中影子留在地面并变小）
        const lift = this.jumpH || 0;
        ctx.save();
        ctx.globalAlpha = clamp(alpha * (0.42 - lift / 900), 0.05, 0.42);
        ctx.fillStyle = "#041e22";
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 8 * this.sc, this.baseW * this.sc * (0.30 - lift / 1400),
          this.baseH * this.sc * (0.12 - lift / 3200), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // 发光：深色水面上青蛙要"亮"出来（猫更容易锁定）；腾空时更亮更大，同时也是 +2 窗口的视觉提示
        const glowK = this.fState === "leap" ? 1.6 : this.fState === "crouch" ? 1.0 : 0.8;
        const pulse = 0.84 + 0.16 * Math.sin(t * 2.6 + (this.phase || 0));
        const gx = this.x, gy = this.y - lift - 6;
        const gr = 52 * this.sc * (this.fState === "leap" ? 1.35 : 1);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = clamp(alpha * 0.8 * pulse, 0, 1);
        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        glow.addColorStop(0, "rgba(226,255,170," + clamp(0.22 * glowK, 0, 1).toFixed(3) + ")");
        glow.addColorStop(0.5, "rgba(170,240,110," + clamp(0.13 * glowK, 0, 1).toFixed(3) + ")");
        glow.addColorStop(1, "rgba(150,230,120,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(this.x, this.y - lift - 6);
        ctx.rotate(this._visRot || 0);
        // 视觉尺寸 0.85：让荷叶从身体两侧露出一圈，才像"蹲在叶子上"（命中盒仍按原尺寸，判定不受影响）
        const s = this.sc * vs * 0.85;
        ctx.scale(s * (this.faceDir || 1), s * (this._squash || 1));
        ctx.translate(-48, -39);
        G.draw.frog(ctx, this, t);
        ctx.restore();
      } else {
        // 泳池模式：鱼身柔光（泳池玩具截图里的发光小鱼）；鱼群模式：银白小鱼光
        if (this.type === "fish" && inPoolMode()) {
          const gr = ctx.createRadialGradient(this.x, this.y - (this.hopOff || 0), 0, this.x, this.y - (this.hopOff || 0), 62 * (this.sc || 1));
          gr.addColorStop(0, "rgba(255,236,150,.30)");
          gr.addColorStop(0.55, "rgba(255,210,110,.12)");
          gr.addColorStop(1, "rgba(255,210,110,0)");
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(this.x, this.y - (this.hopOff || 0), 62 * (this.sc || 1), 0, Math.PI * 2); ctx.fill();
        } else if (this.type === "fish" && inSchoolMode()) {
          const gr = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 26 * (this.sc || 1));
          gr.addColorStop(0, "rgba(225,246,255,.42)");
          gr.addColorStop(1, "rgba(205,238,255,0)");
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(this.x, this.y, 26 * (this.sc || 1), 0, Math.PI * 2); ctx.fill();
        }
        // hop 绒线拖尾（毛线球式轨迹）：画在鱼身后面
        if (this.trail && this.trail.length > 1) {
          const col = (this.speciesColors && this.speciesColors.fin) || "#d9a83f";
          ctx.save();
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          for (let i = 1; i < this.trail.length; i++) {
            const a = (this.trail[i].life != null ? this.trail[i].life : 1) * 0.42 * (i / this.trail.length) * (this.fade || 1);
            if (a <= 0.02) continue;
            ctx.globalAlpha = clamp(a, 0, 1) * (alpha / Math.max(this.fade, 0.01));
            ctx.strokeStyle = col;
            ctx.lineWidth = (1.5 + i * 0.55) * (this.sc || 1);
            ctx.beginPath();
            ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.translate(this.x, this.y - (this.hopOff || 0));
        const s = this.sc * vs * (this.speciesScale || 1);
        if (this.type === "fish" && (inPoolMode() || inSchoolMode()) && this._visAng != null) {
          // 泳池/鱼群：鱼头朝实际航向旋转；向左游时沿航向轴翻肚回正（背鳍始终朝上）
          // 翻面加死区：航向接近垂直时不再每帧正/反来回切（修复贴边时鱼尾闪动）
          const ca2 = Math.cos(this._visAng);
          if (ca2 > 0.12) this._flip = 0;
          else if (ca2 < -0.12) this._flip = 1;
          ctx.rotate(this._visAng);
          if (this._flip) ctx.scale(1, -1);
          ctx.scale(s * (this.sxMul || 1), s);
        } else {
          ctx.scale(s * (this.def.face ? this.faceDir : 1) * (this.sxMul || 1), s);
        }
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
      // 开局鱼种去重：洗牌后按序取，保证同时在场鱼互不相同（泳池走限定鱼种表）
      const list = (G.fishSpeciesList && G.fishSpeciesList()) || G.FISH_SPECIES;
      const idxs = list.map((_, i) => i);
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(rand(0, i + 1));
        const tmp = idxs[i]; idxs[i] = idxs[j]; idxs[j] = tmp;
      }
      for (let i = 0; i < n; i++) preys.push(new Prey("fish", list[idxs[i % idxs.length]]));
    } else {
      for (let i = 0; i < n; i++) preys.push(new Prey(G.config.targetType));
    }
  };
  G.clearPreys = () => { preys.length = 0; };

  /* 多只模式：猎物同时在场数量随阶段循序渐进（①3 → ②5 → ③7，上限 7）；单只模式不变。
     捕鼠按洞口数封顶（至少留 1 个空洞供轮换）。 */
  G.stageTargetCount = () => {
    // 群鼠乱窜：固定数量（4/5/6），不受「猎物数量」设置影响（俯视群鼠玩法本身即多只）
    if (G.config.targetType === "mouse" && G.scene && G.scene.mouseBg === "swarm") {
      return ({ 1: 4, 2: 5, 3: 6 })[G.session.stage] || 4;
    }
    if (Number(G.config.preyCount) === 1) return 0;
    const base = ({ 1: 3, 2: 5, 3: 7 })[G.session.stage] || 3;
    if (G.config.targetType === "mouse") {
      const holeN = (G.scene && G.scene.holes ? G.scene.holes.length : 8);
      return Math.min(base, Math.max(1, holeN - 1));
    }
    // 水面追光：光斑太多会满屏乱闪，封顶 3→4→5
    if (G.config.targetType === "pool") return ({ 1: 3, 2: 4, 3: 5 })[G.session.stage] || 3;
    // 青蛙跳：每只独占一片荷叶，封顶按荷叶数（6 片）留 1 片空叶供轮换
    if (G.config.targetType === "frog") {
      const padN = (G.scene && G.scene.pads ? G.scene.pads.length : 6);
      return Math.min(({ 1: 3, 2: 4, 3: 5 })[G.session.stage] || 3, Math.max(1, padN - 1));
    }
    // 鱼群巡游：极小的鱼聚成发光"饵球"，数量（24→32→40）——太多会看花也更费电
    if (G.config.targetType === "fish" && G.session.sea && G.session.sea.key === "school") {
      return ({ 1: 24, 2: 32, 3: 40 })[G.session.stage] || 24;
    }
    return base;
  };
  G.topUpPreys = () => {
    const target = G.stageTargetCount();
    while (target && preys.length < target) {
      if (G.config.targetType === "fish") {
        // 补点时避开已在场品种（限定表 5 种 < 上限 7，池内允许复现；海域 10 种可全程不重样）
        const used = {};
        preys.forEach(p => { if (p.type === "fish" && p.species) used[p.species.key] = 1; });
        const list = (G.fishSpeciesList && G.fishSpeciesList()) || G.FISH_SPECIES;
        const pool = list.filter(s => !used[s.key]);
        preys.push(new Prey("fish", pool.length ? pool[Math.floor(rand(0, pool.length))] : undefined));
      } else {
        preys.push(new Prey(G.config.targetType));
      }
    }
  };
};
