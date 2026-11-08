/* prey.js — 四套猎物状态机（鱼三阶段 / 老鼠 peek-dart-hole / 蝴蝶七态 / 激光甩停）
   参数与流转逻辑与 H5 原型 1:1 对齐；渲染改为 Canvas 矢量绘制 */
module.exports = function (G) {
  const rand = G.rand, clamp = G.clamp;
  let preys = [];
  G.preys = preys;
  /* 泳池模式判定：捕鱼 + 当前海域为泳池追鱼（鱼不出屏，区别于水草模式的边界渐隐玩法） */
  /* 第一版萤光只有一只萤光小虫；保留函数签名给构造/重生调用。 */
  const pickFfToy = () => (G.FF_TOYS && G.FF_TOYS[0]) || { key: "firefly", size: 1 };
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
        this.nightMode = G.currentBg() === "night";
        this.nightSpecies = "ladybug"; this.nightPhase = -1; this.nightMoveT = 0;
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
        this.slot = -1; this.targetSlot = -1;   // 荷叶上的座位号（同叶多只错开摆放）
        this.shareScale = 1;                    // 同叶多只时略微缩小，减少相互遮挡
        this.drownK = 0;                        // 沉入水中的进度（渲染用）
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
      this.ffSizeBase = D0.size;                       // 暗夜萤光换玩具时按它重算体型
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
    /* 换一个发光玩具：key 给绘制/音效分支，体型进命中盒，节奏倍率给 updateFirefly */
    applyToy(toy) {
      this.toy = toy;
      this.species = toy.key;
      this.sizeMul = this.ffSizeBase * toy.size;
      this.applySize();
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

    /* 兔子：屏内随机换点 + 随机航向（视频里暗场后换处出现，不做边缘进场/往返巡逻） */
    spawnPoolSide() {
      const b = G.bounds();
      const S = G.platform.S || 1;
      const pad = 62 * Math.pow(S, 0.4);
      this.x = rand(b.x + pad, Math.max(b.x + pad + 1, b.x + b.w - pad));
      this.y = rand(b.y + pad, Math.max(b.y + pad + 1, b.y + b.h - pad));
      // 路线尽量是一条接近直线的长跑：横屏以左右为主，允许一点上下坡度；
      // 出生后不再每段改方向，只有撞到边界才镜像反弹。
      this.driftAng = (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.24, 0.24);
      this.crawlAng = this.driftAng;
      this.targetAng = this.driftAng;
      this.vx = Math.cos(this.driftAng); this.vy = Math.sin(this.driftAng);
      this.patrol = null; this.tp = null; this.tpNext = 1e9;
      this.spd = 0; this.fadeInT = 0; this.trailT = rand(0.05, 0.2);
      // 头朝行进方向（局部 -Y 为头），不再整只 360° 自转：真实兔子是朝前跑的。
      this.baseSpin = this.driftAng + Math.PI / 2;
      this.spinBase = this.baseSpin;
      this.spinK = this.baseSpin;
      const P = (G.RABBIT || {})[this.stage || 1] || (G.RABBIT && G.RABBIT[1]);
      this.walking = true;
      this.walkT = P ? rand(P.walk[0], P.walk[1]) : 1.6;
      this.hopPhase = rand(0, 0.1); this.hopLift = 0;
    }
    /* 每一趟换一种曲线：sine S 弯 / arc 拱形 / diagonal 斜向换道 / zigzag 折线。
       横向主方向不变，只让纵向路线有变化；到侧边才掉头。 */
    startPatrolLeg() {
      const p = this.patrol;
      if (!p) return;
      const b = G.bounds();
      const S = G.platform.S || 1;
      const padY = 70 * Math.pow(S, 0.4);
      const laneRange = Math.min(100 * Math.pow(S, 0.4), b.h * 0.22);
      p.baseY = clamp(this.y, b.y + padY, b.y + b.h - padY);
      p.legStartX = this.x;
      p.phase = 0;
      const r = Math.random();
      p.style = r < 0.45 ? "sine" : r < 0.72 ? "arc" : r < 0.9 ? "diagonal" : "zigzag";
      p.amp = rand(0.45, 1) * laneRange * (Math.random() < 0.5 ? -1 : 1);
      p.cycles = rand(0.9, 2.0);
      p.laneTo = clamp(p.baseY + rand(-laneRange, laneRange), b.y + padY, b.y + b.h - padY);
    }
    patrolPathY() {
      const p = this.patrol;
      if (!p) return this.y;
      const b = G.bounds();
      const S = G.platform.S || 1;
      const inset = 4 * Math.pow(S, 0.4);
      const L = b.x + inset, Rt = b.x + b.w - inset, T = b.y + inset, Bm = b.y + b.h - inset;
      const targetX = p.goingOut ? (p.side < 0 ? Rt : L) : (p.side < 0 ? L : Rt);
      let t = (this.x - p.legStartX) / ((targetX - p.legStartX) || 1);
      t = Math.max(0, Math.min(1, t));
      let y = p.baseY;
      if (p.style === "sine") y += p.amp * Math.sin(t * Math.PI * 2 * p.cycles);
      else if (p.style === "arc") y += p.amp * Math.sin(t * Math.PI);
      else if (p.style === "diagonal") y += (p.laneTo - p.baseY) * t + p.amp * 0.12 * Math.sin(t * Math.PI);
      else {
        const q = t * p.cycles * 2;
        const f = q - Math.floor(q);
        y += p.amp * (f < 0.5 ? f * 2 : (1 - f) * 2);
      }
      return Math.max(T + 18, Math.min(Bm - 18, y));
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
          /* 发光玩具：出生点压在屏内边距里，直接进入跑动态。
             节奏对齐参考视频：慢爬与急爬交替、呼吸脉动、周期性"亮一下"（甩耳/张翅/开鞘）。 */
          this.spawnPoolSide();                        // 从左侧或右侧边缘进入
          this.pulseT = rand(0, Math.PI * 2);          // 腹部呼吸相位（每只错开，不同步闪）
          this.ph = rand(0, Math.PI * 2);              // 触须/发光点的相位
          this.gaitT = 0; this.fast = false; this.spd = 0; this.moveK = 0;
          this.stepK = rand(0, Math.PI * 2);           // 六足步态相位
          this.applyToy(pickFfToy());                   // 第一版萤光：固定萤光小虫
          this.elytraK = 0.28; this.flareCd = rand(0.8, 2.2); this.flare = null;
          this.tp = null; this.darkT = 0;
          this.hopT = 0; this.hopDur = rand(0.95, 1.2); // 跳得更少、单次更远
          this.hopOff = 0;
          this.hopPauseT = 0; this.hopCount = 0; this.hopHeight = rand(0.34, 0.48);
          this.hopLaunchPending = true;
          this.crouching = false; this.crouchK = 0;
          this.walkRestT = 0; this.walkRestCd = rand(2.2, 4.5);
          this.ladyExplore = null; this.wingK = 0;
          this.moveSoundT = rand(0.8, 1.8);
          this.fadeInT = 0; this.trailT = 0;
          this.state = "crawl"; this.stateT = 0; this.stateDur = 99;
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
        if (this.nightMode) { this.nightEnter(); return; }
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
    /* 落到一片荷叶上：优先空叶（避免多只挤在一起），没有空叶则挑最空的一片并坐不同座位 */
    spawnOnPad() {
      const pads = (G.scene && G.scene.pads) || [];
      if (!pads.length) {
        const b = G.bounds();
        this.x = b.x + b.w / 2; this.y = b.y + b.h / 2;
        this.padIdx = -1; this.slot = -1; this.targetSlot = -1;
      } else {
        const occ = pads.map((_, i) => (G.padOccupants ? G.padOccupants(i).length : 0));
        const floating = (i) => (pads[i].sinkState || "float") === "float";   // 正在沉/已沉的叶不能落
        const freeSlot = (i) => (G.padFreeSlot ? G.padFreeSlot(i, this, true) : 0);
        let free = pads.map((_, i) => i).filter(i => i !== this.padIdx && floating(i) && occ[i] < 3 && freeSlot(i) >= 0);
        const empty = free.filter(i => occ[i] === 0);        // 空叶优先：多只青蛙不往同一片叶上堆
        if (empty.length) free = empty;
        else if (free.length) {
          const minOcc = Math.min.apply(null, free.map(i => occ[i]));
          free = free.filter(i => occ[i] === minOcc);
        }
        if (!free.length) free = pads.map((_, i) => i).filter(i => i !== this.padIdx && floating(i));
        if (!free.length) free = [0];
        const pick = free[Math.floor(rand(0, free.length))];
        const slot = freeSlot(pick);
        this.padIdx = pick;
        this.slot = slot >= 0 ? slot : 0;
        this.targetSlot = -1;
        this.shareScale = occ[pick] >= 1 ? 0.88 : 1;
        const off = G.padSlotPos ? G.padSlotPos(pads[pick], this.slot) : { dx: 0, dy: 0 };
        this.x = pads[pick].x + off.dx;
        this.y = pads[pick].y + off.dy;
      }
      this.fState = "crouch"; this.fT = 0; this.leapK = 0; this.jumpH = 0;
      this.chain = 0; this.rspT = 0; this.vanishT = 0; this.fade = 1;
      this.drownK = 0;
      this._visRot = 0; this._squash = 1;
      if (G.session && G.session.stage) this.stage = G.session.stage;
      this.pickTargetPad();
    }
    /* 选下一片落点荷叶：阶段①只挑最近的（短弧线好追），连跳第二跳必跨远 */
    pickTargetPad() {
      const pads = (G.scene && G.scene.pads) || [];
      if (!pads.length) { this.targetPadIdx = -1; this.targetSlot = -1; return; }
      const P = G.FROG_PARAMS[this.stage || 1] || G.FROG_PARAMS[1];
      // 占用：已落定的青蛙（slot ≥ 0 表示蹲在叶上）。跃空中的青蛙把"落点"也预留下来，
      // 否则两只同时跳向同一片叶会叠在一起（之前看到的重叠就是这么来的）
      const occ = pads.map((_, i) => (G.padOccupants ? G.padOccupants(i).length : 0));
      const booked = {};
      preys.forEach(q => {
        if (q === this || q.type !== "frog") return;
        if (q.fState === "leap" && q.targetPadIdx >= 0 && q.targetPadIdx !== this.padIdx) booked[q.targetPadIdx] = 1;
      });
      const freeSlot = (i) => (G.padFreeSlot ? G.padFreeSlot(i, this, true) : 0);
      const floating = (i) => (pads[i].sinkState || "float") === "float";
      const usable = (i) => i !== this.padIdx && floating(i) && occ[i] < 3 && freeSlot(i) >= 0;
      let cands = pads.map((_, i) => i).filter(i => usable(i) && !booked[i]);
      const empty = cands.filter(i => occ[i] === 0);            // 空叶优先
      if (empty.length) cands = empty;
      else if (cands.length) {
        // 只剩别人占着的叶：挑最空的那片（青蛙数多于空叶时才会走到这里）
        const minOcc = Math.min.apply(null, cands.map(i => occ[i]));
        cands = cands.filter(i => occ[i] === minOcc);
      }
      if (!cands.length) {
        // 全被预订：退一步允许与空中的青蛙同叶，但仍避开"已经三只"的叶
        cands = pads.map((_, i) => i).filter(i => usable(i));
      }
      if (!cands.length) cands = pads.map((_, i) => i).filter(i => i !== this.padIdx && floating(i) && occ[i] < 3);
      if (!cands.length) { this.targetPadIdx = this.padIdx; this.targetSlot = this.slot; return; }
      const cur = pads[this.padIdx] || pads[0];
      const dist = (i) => Math.hypot(pads[i].x - cur.x, pads[i].y - cur.y);
      if (P.roam) {
        // ④ 换场：周边 2 片叶距离内的荷叶都能选（gap = 相邻叶间距）
        const gap = (G.scene && G.scene.padNeighborDist) || 160;
        const around = cands.filter(i => dist(i) <= gap * P.roam * 0.9);
        if (around.length) cands = around;
      } else if (P.nearFirst > 0) {
        cands.sort((a, b) => dist(a) - dist(b));
        cands = cands.slice(0, Math.max(1, P.nearFirst));
      } else if (this.chain >= 1) {
        cands.sort((a, b) => dist(b) - dist(a));          // 连跳第二跳：取最远的一半
        cands = cands.slice(0, Math.max(1, Math.ceil(cands.length / 2)));
      }
      this.targetPadIdx = cands[Math.floor(rand(0, cands.length))];
      // 预订落点座位：两只青蛙跳同一片叶时也坐不同位置，不会落到同一个点上
      const ts = freeSlot(this.targetPadIdx);
      this.targetSlot = ts >= 0 ? ts : 0;
    }
    /* 蹲在叶上：跟随荷叶的漂浮（叶在缓慢移动，青蛙不能留在原地漂走） */
    followPad(pads) {
      const p = pads[this.padIdx];
      if (!p || this.slot < 0) return;
      const off = G.padSlotPos ? G.padSlotPos(p, this.slot) : { dx: 0, dy: 0 };
      this.x = p.x + off.dx;
      this.y = p.y + off.dy;
      this.baseY = this.y;
    }
    /* 荷叶被压沉：这只青蛙跟着落水（视觉下沉 + 淡出，随后换叶重生） */
    startDrown(pad) {
      if (this.fState === "drown" || this.vanishT > 0 || this.rspT > 0) return;
      this.slot = -1;
      this.drownX0 = this.x; this.drownY0 = this.y;
      this.drownDepth = (pad ? pad.r : 26) * rand(0.55, 0.9);
      this.drownK = 0; this.fT = 0;
      this.fState = "drown";
      if (G.padSplash) G.padSplash(this.x, this.y, (pad ? pad.r : 26) * 0.55, false);
    }
    startLeap() {
      const pads = (G.scene && G.scene.pads) || [];
      if (this.targetPadIdx < 0 || this.targetPadIdx === this.padIdx || !pads[this.targetPadIdx]) this.pickTargetPad();
      this.leapFromX = this.x; this.leapFromY = this.y;   // 从当前叶上的座位起跳
      this.slot = -1; this.shareScale = 1;                // 离叶即释放座位，别的青蛙可落这里
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
      // 荷叶被三只青蛙压沉：跟着一起落水（沉下去 → 缩小淡出 → 换叶重生）
      if (this.fState === "drown") {
        this.fT += dt;
        const dk = Math.min(1, this.fT / 0.5);
        this.drownK = dk;
        this.x = this.drownX0;
        this.y = this.drownY0 + this.drownDepth * dk;
        this._squash = 1 - dk * 0.18;
        this._visRot = 0;
        if (dk >= 1) {
          this.drownK = 0; this.fade = 0; this.rspT = 1.0; this.fT = 0;
          this.fState = "crouch";
          if (G.padSplash) G.padSplash(this.x, this.y, 14, false);   // 入水的一小圈
        }
        return;
      }
      this.fade = 1;
      // 时长缩放：难度 / 自适应辅助 / 连击提速 全部压进同一乘子（与现有玩法一致）
      const k = clamp((this.speedMul || 1) * (this.adaptiveSlow || 1) * (this.comboSpeed || 1), 0.45, 2.4);
      this.fT += dt * k;
      const MS = Math.pow(G.platform.S || 1, 0.5);

      if (this.fState === "crouch") {
        this.followPad(pads);                 // 荷叶在漂：蹲着的青蛙跟着走
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
        const B = pads[this.targetPadIdx];
        this.leapK = Math.min(1, this.fT / P.leap);
        const k2 = this.leapK;
        if (B) {
          // 终点取"预订座位"的当前位置（目标叶也在漂，所以每帧重算，落点始终准）
          const off = G.padSlotPos ? G.padSlotPos(B, this.targetSlot >= 0 ? this.targetSlot : 0) : { dx: 0, dy: 0 };
          const bx = B.x + off.dx, by = B.y + off.dy;
          const ax = this.leapFromX != null ? this.leapFromX : this.x;
          const ay = this.leapFromY != null ? this.leapFromY : this.y;
          this.x = ax + (bx - ax) * k2;
          this.y = ay + (by - ay) * k2;
          this.jumpH = 4 * 66 * MS * k2 * (1 - k2);        // 抛物线：最高点 ~66px
          this.faceDir = bx < ax ? -1 : 1;
        }
        this._visRot = (0.5 - k2) * 0.85;                  // 起跳抬头 → 落地低头
        this._squash = 1 + Math.sin(k2 * Math.PI) * 0.08;
        if (this.leapK >= 1) {
          this.padIdx = this.targetPadIdx;
          this.slot = this.targetSlot >= 0 ? this.targetSlot : 0;
          this.targetSlot = -1;
          const mine = (G.padOccupants ? G.padOccupants(this.padIdx).length : 0);
          this.shareScale = mine >= 2 ? 0.88 : 1;          // 同叶不止一只：略缩一点，少挡彼此
          this.followPad(pads);
          this.fState = "land"; this.fT = 0; this.jumpH = 0; this._squash = 0.82;
          if (G.playFrogLandCroak) G.playFrogLandCroak();   // 落地后"呱呱"两声（不再有起跳音）
          const pad = pads[this.padIdx];
          if (G.padSplash) G.padSplash(this.x, this.y, (pad ? pad.r : 40) * 0.95, false);   // 叶缘一圈水花
          else if (G.ripple) G.ripple(this.x, this.y, false);
          if (G.padSway) G.padSway(this.x, this.y);
          // 小荷叶一踩就沉（且不再浮起）；大荷叶要挤到第三只才压沉
          const landedPad = pads[this.padIdx];
          if (G.padSink && ((landedPad && landedPad.small) || mine >= 3)) G.padSink(this.padIdx);
        }
        return;
      }
      if (this.fState === "land") {
        this.followPad(pads);
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
      this.followPad(pads);
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
      // 萤光小虫被拍：0.08s 收光即灭（第一版"一拍就灭"），updateFirefly 内接暗场后在别处亮起
      if (this.type === "pool") { this.burstT = 0; this.vanishT = 0.08; return; }
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
      if (this.type === "pool") { this.updateFirefly(dt, t); return; }
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
      if (this.nightMode) { this.updateNight(dt, b); return; }
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
    nightEnter(edgeSide) {
      const b=G.bounds(),side=edgeSide==null?Math.floor(rand(0,4)):edgeSide,pad=44;
      if(side===0){this.x=b.x-pad;this.y=rand(b.y+pad,b.y+b.h-pad)}else if(side===1){this.x=b.x+b.w+pad;this.y=rand(b.y+pad,b.y+b.h-pad)}else if(side===2){this.x=rand(b.x+pad,b.x+b.w-pad);this.y=b.y-pad}else{this.x=rand(b.x+pad,b.x+b.w-pad);this.y=b.y+b.h+pad}
      this.nightHeading=Math.atan2(b.y+b.h*.5-this.y,b.x+b.w*.5-this.x);this.nightMoveT=0;this.nightPause=0;this.fade=1;this.nightEntering=true;
    }
    updateNight(dt,b) {
      if(this.vanishT>0){this.vanishT-=dt;if(this.vanishT<=0){this.vanishT=0;this.nightTransition=null;this.nightEdge=null;this.nightEnter();}return;}
      const species=["ladybug","spider","dragonfly","fly"],target=Math.floor((G.session.time||0)/18)%species.length;
      if(target!==(G.session.nightPhase||0)&&this.nightTransition!==target){
        // 18 秒到点后继续当前动物，朝最近的边缘移动；抵达边缘才同步换景、换动物与动作。
        let side=0;
        const candidates=[{side:0,d:Math.abs(this.x-b.x)},{side:1,d:Math.abs(b.x+b.w-this.x)},{side:2,d:Math.abs(this.y-b.y)},{side:3,d:Math.abs(b.y+b.h-this.y)}];
        candidates.sort((a,c)=>a.d-c.d);side=candidates[0].side;
        const tx=side===0?b.x:(side===1?b.x+b.w:this.x),ty=side===2?b.y:(side===3?b.y+b.h:this.y);
        this.nightHeading=Math.atan2(ty-this.y,tx-this.x);this.nightTransition=target;this.nightEdge=side;
      }
      this.nightMoveT+=dt;if(this.nightPause>0){this.nightPause-=dt;return;}
      if(this.nightMoveT>=1.25){this.nightMoveT=0;this.nightPause=.32;if(this.nightTransition==null)this.nightHeading+=(Math.random()<.5?-1:1)*rand(2,3)*Math.PI/180;}
      const speed=105,edge=8,nx=this.x+Math.cos(this.nightHeading)*speed*dt,ny=this.y+Math.sin(this.nightHeading)*speed*dt;
      const side=this.nightEdge;
      const reached=side===0?nx<=b.x+edge:side===1?nx>=b.x+b.w-edge:side===2?ny<=b.y+edge:ny>=b.y+b.h-edge;
      this.x=nx;this.y=ny;
      if(this.nightTransition!=null&&reached){G.session.nightPhase=this.nightTransition;this.nightPhase=this.nightTransition;this.nightSpecies=species[this.nightPhase];const enterSide=this.nightEdge;this.nightTransition=null;this.nightEnter(enterSide);}
      else if(this.nightTransition==null&&this.nightEntering){
        if(this.x>=b.x&&this.x<=b.x+b.w&&this.y>=b.y&&this.y<=b.y+b.h)this.nightEntering=false;
      } else if(this.nightTransition==null){
        // 已进入屏幕后在边缘折返，不随机重生；避免瞬移造成闪烁，也保持连续移动。
        if(this.x<b.x){this.x=b.x;this.nightHeading=Math.atan2(Math.sin(this.nightHeading),Math.abs(Math.cos(this.nightHeading)));}
        else if(this.x>b.x+b.w){this.x=b.x+b.w;this.nightHeading=Math.atan2(Math.sin(this.nightHeading),-Math.abs(Math.cos(this.nightHeading)));}
        if(this.y<b.y){this.y=b.y;this.nightHeading=Math.atan2(Math.abs(Math.sin(this.nightHeading)),Math.cos(this.nightHeading));}
        else if(this.y>b.y+b.h){this.y=b.y+b.h;this.nightHeading=Math.atan2(-Math.abs(Math.sin(this.nightHeading)),Math.cos(this.nightHeading));}
      }
      this.faceDir=Math.cos(this.nightHeading)>=0?1:-1;this.state="FLAP";
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
    /* 暗夜萤光：发光玩具在石墙/木地板上左右往返，每趟走 S 弯/拱形/斜向/折线；
       主方向不变，只有到达左右侧终点才掉头；点击或两回趟完成才消失 */
    /* ============ 发光玩具：慢爬/急爬两档 + 亮一下 + 呼吸脉动 ============
       节奏沿用早期 23.9s 猫玩平板视频的逐帧测量，造型则按 Peppy Cat 实机图重画：
         · 帧速度中位 18% 屏宽/秒、90 分位 53%/秒，段落内速度方差高达 2.1
           → 不是"匀速漂移"，而是"走两步、急爬一下"的两档步态；
         · 每只玩具整只朝行进方向旋转（尾巴/翅膀拖在身后），老鼠再额外转 90° 让头朝前；
         · 每 2–4 秒耳朵/翅膀/鞘壳放大"亮一下"，给猫一个动态提示。 */
    /* ============ 兔子模式：一点点往前小跳 + 走停交替 ============
       30fps 逐帧实测：走 0.9–3.1s / 停 0.9–2.0s；走段每帧 4–8px 的小碎步，
       段内移动方向夹角中位 2.7°（整段直线，不随机拐弯；头朝行进方向，撞边才平滑转向）；暗场约 1.4s 换点。 */
    updateRabbit(dt, t) {
      const b = G.bounds();
      if (this.stage !== G.session.stage) this.stage = G.session.stage;
      const P = (G.RABBIT || {})[this.stage] || (G.RABBIT && G.RABBIT[1]);
      if (!P) return;

      /* 收光 → 暗场 → 换点淡入（视频里 5 段出现、段间隔中位 1.37s） */
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        this.fade = Math.max(0, Math.min(1, this.vanishT / 0.08));
        if (this.vanishT <= 0) {
          this.vanishT = 0; this.fade = 0;
          this.darkT = rand(P.dark[0], P.dark[1]);
        }
        return;
      }
      if (this.darkT > 0) {
        this.darkT -= dt;
        this.fade = 0;
        if (this.darkT <= 0) {
          this.darkT = 0;
          this.relocate(true);
          this.fade = 0; this.fadeInT = 0.26;
          if (G.playFireflySpawn) G.playFireflySpawn();   // 换点淡入：一声极轻的出现 tick
        }
        return;
      }
      if (this.fadeInT > 0) {
        this.fadeInT -= dt;
        this.fade = Math.min(1, 1 - Math.max(0, this.fadeInT) / 0.26);
        if (this.fadeInT <= 0) { this.fadeInT = 0; this.fade = 1; }
      } else this.fade = 1;

      /* 走 / 停交替：停时完全静止，走时一小跳一小跳朝前挪（不做随机转向） */
      this.walkT = (this.walkT == null ? rand(P.walk[0], P.walk[1]) : this.walkT) - dt;
      if (this.walkT <= 0) {
        this.walking = !this.walking;
        this.walkT = this.walking ? rand(P.walk[0], P.walk[1]) : rand(P.rest[0], P.rest[1]);
        this.hopPhase = 0; this.hopLift = 0;
        // 换走段不改航向：整段旅程保持同一条直线，只有撞边才反弹
      }
      this.pulseK = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * P.pulse + (this.ph || 0));
      if (!this.walking) {
        this.spd = 0; this.moveK = 0; this.hopLift = 0;
        this.spinBase = this.spinBase == null ? (this.baseSpin || 0) : this.spinBase;
        this.spinK = this.spinBase + Math.sin(t * 2.1 + (this.ph || 0)) * 0.012;   // 停住时轻微呼吸摆
        return;
      }

      /* 一小跳：hopPhase 在 [0, hopDur+hopGap) 内循环；前半段前快后慢地挪 step，
         后半段是落地的短暂停顿。整体就是「一点点往前跳」，不是匀速滑行。 */
      const cycle = P.hopDur + P.hopGap;
      const prevPhase = this.hopPhase || 0;
      this.hopPhase = prevPhase + dt;
      // 一次落地一声：周期约 0.16–0.18s，和视频轻响间隔 0.14–0.18s 对齐
      if (prevPhase < P.hopDur && this.hopPhase >= P.hopDur && G.playRabbitStepSfx) G.playRabbitStepSfx();
      while (this.hopPhase >= cycle) this.hopPhase -= cycle;
      if (this.hopPhase < P.hopDur) {
        const k = this.hopPhase / P.hopDur;
        const norm = 1 / (1 - 0.55 / 2);                 // 让速度积分恰好等于 step
        // 横屏时如果仍按屏宽算，兔子 0.8s 就跑完可玩高度；改为按「宽高较小者」算，
        // 横屏约 3.2s 跑完高度，竖屏保持原来的 4.9s 手感。
        const span = Math.min(b.w, b.h * 0.75);
        this.spd = (P.step * span / 100) / P.hopDur * (1 - 0.55 * k) * norm;
        this.hopLift = Math.sin(Math.PI * k);
        this.moveK = 0.55 + 0.45 * this.hopLift;
      } else {
        this.spd = 0; this.hopLift = 0; this.moveK = 0.2;
      }
      this.vx = Math.cos(this.driftAng) * this.spd;
      this.vy = Math.sin(this.driftAng) * this.spd;
      this.x += this.vx * dt; this.y += this.vy * dt;

      /* 贴边镜像反弹：只在边界改航向，屏幕中间不会突然拐弯 */
      const pad = 34 * (G.platform.S || 1);
      if (this.x < b.x + pad) { this.x = b.x + pad; this.driftAng = Math.PI - this.driftAng; }
      else if (this.x > b.x + b.w - pad) { this.x = b.x + b.w - pad; this.driftAng = Math.PI - this.driftAng; }
      if (this.y < b.y + pad) { this.y = b.y + pad; this.driftAng = -this.driftAng; }
      else if (this.y > b.y + b.h - pad) { this.y = b.y + b.h - pad; this.driftAng = -this.driftAng; }

      /* 头朝行进方向：撞边反弹时在 ~0.15s 内平滑转向，跑动中再叠一点小摆。
         不再做 360° 自转，兔子看起来是真的朝前跑，而不是被转着圈的贴纸。 */
      const spinTarget = this.driftAng + Math.PI / 2;
      if (this.spinBase == null) this.spinBase = spinTarget;
      let ds = ((spinTarget - this.spinBase + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.spinBase += ds * Math.min(1, dt * 9);
      this.spinK = this.spinBase + Math.sin(t * 2.6 + (this.ph || 0)) * 0.015 + this.hopLift * 0.04;
      this.crawlAng = this.driftAng;
      this.trailT = (this.trailT == null ? 0.1 : this.trailT) - dt;
      if (this.trailT <= 0) {
        this.trailT = rand(0.18, 0.34);
        if (this.fade > 0.45 && this.hopLift > 0.4 && G.emberTrail) G.emberTrail(this.x, this.y);
      }
    }

    updateFirefly(dt, t) {
      const b = G.bounds();
      if (this.stage !== G.session.stage) this.stage = G.session.stage;
      // Peppy Cat 式连续追逐没有“越玩越快、越刷越多”的关卡爬坡；
      // 速度由设置中的难度控制，密度由单只/多只控制，整局保持稳定。
      const P = G.FIREFLY[1];
      const toy = this.toy || { spd: 1, fastP: 0, gait: 1, flare: 1 };
      const motion = toy.motion || "wander";
      const S = G.platform.S || 1;
      const MS = Math.pow(S, 0.5);
      const inset = 4 * Math.pow(S, 0.4);
      const L = b.x + inset, Rt = b.x + b.w - inset, T = b.y + inset, Bm = b.y + b.h - inset;

      // 腹部呼吸（绘制层用它做大小/亮度起伏）
      this.pulseT = (this.pulseT || 0) + dt * Math.PI * 2 * (P.pulse || 1.9);
      this.pulseK = 0.5 + 0.5 * Math.sin(this.pulseT);

      /* ---------- 被拍中：0.08s 收光 → 暗 0.1–0.6s → 别处亮起
         视频里 9 段的间隔是 0.1–1.7s，不是拍完立刻原地出现 ---------- */
      if (this.vanishT > 0) {
        this.vanishT -= dt;
        this.fade = Math.max(0, Math.min(1, this.vanishT / 0.08));
        if (this.vanishT <= 0) {
          this.vanishT = 0;
          this.fade = 0;
          this.darkT = rand(0.12, 0.55);
        }
        return;
      }
      if (this.darkT > 0) {
        this.darkT -= dt;
        this.fade = 0;
        if (this.darkT <= 0) {
          this.darkT = 0;
          this.tp = { phase: "in", t: 0 };
          this.relocate(true);
        }
        return;
      }

      /* ---------- 自发换位：罕见（视频 24 秒只有 2 次）。0.18s 暗下去 → 别处亮起来 ---------- */
      if (this.tp) {
        this.tp.t += dt;
        if (this.tp.phase === "out") {
          this.fade = Math.max(0, 1 - this.tp.t / 0.18);
          if (this.tp.t >= 0.18) { this.tp = { phase: "in", t: 0 }; this.relocate(); }
        } else {
          this.fade = Math.min(1, this.tp.t / 0.26);
          if (this.tp.t >= 0.26) {
            this.tp = null; this.fade = 1;
            this.tpNext = 1e9;
          }
        }
        return;
      }
      this.fade = 1;

      /* ---------- 两档步态：慢爬 / 急爬，各自持续 0.4–1.2s（每种动物有自己的倍率，见 G.FF_TOYS） ---------- */
      this.gaitT = (this.gaitT || 0) - dt;
      if (this.gaitT <= 0) {
        this.fast = Math.random() < clamp((P.fastP || 0.4) + (toy.fastP || 0), 0.05, 0.85);
        this.gaitT = (this.fast ? rand(P.gait[0], P.gait[0] * 1.6) : rand(P.gait[1] * 0.8, P.gait[1] * 1.5)) * (toy.gait || 1);
        // 换挡只改速度，不改变航向：动物一直朝当前方向走，撞墙才转向
      }
      let targetSp = (this.fast ? P.fast : P.slow) * MS * (this.speedMul || 1) * (this.adaptiveSlow || 1) * (toy.spd || 1);
      // 瓢虫：走一段 → 停下 → 原地探索半圈（身体缓慢转向）→ 换一条路线继续
      if (motion === "straight" && this.patrol) {
        if (this.ladyExplore) {
          targetSp = 0;
        } else {
          this.walkRestCd -= dt;
          if (this.walkRestCd <= 0) {
            const dur = rand(0.8, 1.4);
            this.ladyExplore = {
              t: 0, dur,
              baseAng: this.crawlAng == null ? this.driftAng : this.crawlAng,
              dir: Math.random() < 0.5 ? -1 : 1
            };
            this.walkRestCd = rand(2.8, 5.5);
            targetSp = 0;
          }
        }
      }
      // 速度平滑：不一瞬间变速（否则像瞬移），但 0.15s 就到位，仍有"急爬"的突然感
      this.spd = this.spd == null ? targetSp : this.spd + (targetSp - this.spd) * Math.min(1, dt * 7);
      const slowRef = Math.max(20, P.slow * MS);
      this.moveK = Math.max(0, Math.min(1.4, this.spd / slowRef - 0.15));
      // 步态相位跟着实际速度走：停在原地时脚也不乱划
      this.stepK = (this.stepK || 0) + dt * (2.6 + this.spd * 0.035) * (0.12 + 0.88 * Math.min(1, this.moveK));

      /* ---------- 左右往返：从一侧进场，到对面再回来；两趟后消失换新动物 ---------- */
      if (this.patrol) {
        const pt = this.patrol;
        const targetX = pt.goingOut
          ? (pt.side < 0 ? Rt : L)
          : (pt.side < 0 ? L : Rt);
        this.driftAng = targetX > this.x ? 0 : Math.PI;
        const ty = this.patrolPathY();
        if (!this.crouching && !this.ladyExplore) this.y += (ty - this.y) * Math.min(1, dt * 5);   // 蹲守/探索时完全不动
      } else {
        if (this.x <= L + 2 && Math.cos(this.driftAng) < 0) this.driftAng = Math.PI - this.driftAng;
        if (this.x >= Rt - 2 && Math.cos(this.driftAng) > 0) this.driftAng = Math.PI - this.driftAng;
        if (this.y <= T + 2 && Math.sin(this.driftAng) < 0) this.driftAng = -this.driftAng;
        if (this.y >= Bm - 2 && Math.sin(this.driftAng) > 0) this.driftAng = -this.driftAng;
      }

      /* ---------- 同伴避让：别叠成一坨（轻柔推离，不改航向感；蹲守时保持不动） ---------- */
      if (!this.crouching && !this.ladyExplore) preys.forEach(q => {
        if (q === this || q.type !== "pool" || q.vanishT > 0) return;
        const dx = this.x - q.x, dy = this.y - q.y;
        const d = Math.hypot(dx, dy);
        const keep = 96 * MS;
        if (d > 0.01 && d < keep) {
          const push = (1 - d / keep) * 30 * MS * dt;
          this.x = Math.min(Math.max(this.x + dx / d * push, L), Rt);
          this.y = Math.min(Math.max(this.y + dy / d * push, T), Bm);
        }
      });

      /* ---------- 兔子：一跳一跳地前进（空中快、落地慢） ---------- */
      let speedK = 1;
      if (motion === "hop") {
        if (this.hopPauseT > 0) {
          // 蹲守：原地不动 0.5s，身体压低；开始时播放极轻的鼻息/咀嚼声
          this.hopPauseT -= dt;
          speedK = 0;
          this.hopOff = 0;
          this.crouching = true;
          this.crouchK = Math.min(1, (this.crouchK || 0) + dt * 8);
          if (this.hopPauseT <= 0) { this.crouching = false; this.hopLaunchPending = true; }
        } else {
          this.crouching = false;
          this.crouchK = Math.max(0, (this.crouchK || 0) - dt * 6);
          if (this.hopLaunchPending) {
            this.hopLaunchPending = false;
            if (G.playRabbitHopSfx) G.playRabbitHopSfx();
          }
          this.hopT = (this.hopT || 0) + dt;
          const hd = this.hopDur || 1.05;
          const hp = Math.min(1, this.hopT / hd);
          const air = Math.sin(Math.PI * hp);
          this.hopOff = air * (this.sc || 1) * 30 * (this.hopHeight || 0.78);
          speedK = 0.20 + 1.80 * air;
          if (this.hopT >= hd) {
            this.hopT = 0;
            this.hopDur = rand(0.9, 1.2);
            this.hopHeight = rand(0.34, 0.48);
            this.hopCount = (this.hopCount || 0) + 1;
            if (G.playRabbitLandSfx) G.playRabbitLandSfx();   // 落地一声
            // 每一次落地都先蹲 0.5s，再跳下一跳（跳频明显降低）
            this.hopPauseT = 0.5;
            this.crouching = true;
            this.crouchK = 0;
          }
        }
      } else {
        this.hopOff = 0;
      }

      /* ---------- 位移 ---------- */
      const prevX = this.x, prevY = this.y;
      this.x += Math.cos(this.driftAng) * this.spd * speedK * dt;
      this.y += Math.sin(this.driftAng) * this.spd * speedK * dt;
      this.x = Math.min(Math.max(this.x, L), Rt);
      this.y = Math.min(Math.max(this.y, T), Bm);
      if (this.patrol) {
        const pt = this.patrol;
        const reached = pt.goingOut
          ? (pt.side < 0 ? this.x >= Rt - 2 : this.x <= L + 2)
          : (pt.side < 0 ? this.x <= L + 2 : this.x >= Rt - 2);
        if (reached) {
          if (!pt.goingOut) {
            pt.returns++;
            if (pt.returns >= 2) { this.vanish(); return; }   // 来两趟回到原点 → 消失，等待新动物
          }
          pt.goingOut = !pt.goingOut;
          this.driftAng = pt.goingOut
            ? (pt.side < 0 ? 0 : Math.PI)
            : (pt.side < 0 ? Math.PI : 0);
          this.startPatrolLeg();          // 回程换一种曲线/换道
        }
      }
      const ddx = this.x - prevX, ddy = this.y - prevY;
      this.crawlAng = (Math.hypot(ddx, ddy) > 0.15) ? Math.atan2(ddy, ddx) : this.driftAng;
      if (this.ladyExplore) {
        const e = this.ladyExplore;
        e.t += dt;
        const k = Math.min(1, e.t / e.dur);
        // 前半段转到反向、后半段转回；看起来像原地探了半圈
        this.crawlAng = e.baseAng + e.dir * Math.PI * Math.sin(Math.PI * k);
        if (e.t >= e.dur) {
          this.ladyExplore = null;
          this.walkRestCd = rand(2.8, 5.5);
          if (this.patrol) this.startPatrolLeg();   // 探完换一条路线/方向
        }
      }
      const exploring = !!this.ladyExplore;
      this.wingK = exploring
        ? 0.58 + 0.34 * Math.sin(t * 17 + (this.ph || 0))
        : 0.10 + 0.08 * Math.sin(t * 4.5 + (this.ph || 0));
      this.vx = Math.cos(this.driftAng); this.vy = Math.sin(this.driftAng);
      // 头朝行进方向（局部 -Y 为头）：撞边反弹后平滑转身，萤火虫不横着爬
      {
        const want = this.crawlAng + Math.PI / 2;
        const cur = this.spinK == null ? want : this.spinK;
        let dA = want - cur;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        this.spinK = cur + dA * Math.min(1, dt * 9);
      }

      /* ---------- "亮一下"：兔子甩耳 / 老鼠抖尾 / 瓢虫抖触角，常态微亮，周期性放大一档 ---------- */
      this.flareCd = (this.flareCd == null ? rand(P.flare[0], P.flare[1]) * (toy.flare || 1) : this.flareCd) - dt;
      if (this.flareCd <= 0 && !this.flare) {
        this.flare = { t: 0 };
        this.flareCd = rand(P.flare[0], P.flare[1]) * (toy.flare || 1);
      }
      let op = 0.28 + 0.05 * Math.sin(t * 1.6 + (this.ph || 0));
      if (this.flare) {
        this.flare.t += dt;
        const ft = this.flare.t;
        if (ft < 0.10) op = 0.28 + 0.67 * (ft / 0.10);              // 快速张开
        else if (ft < 0.20) op = 0.95;                              // 保持一下
        else if (ft < 0.58) op = 0.95 - 0.67 * ((ft - 0.20) / 0.38); // 慢慢收回
        else { op = 0.28; this.flare = null; }
      }
      this.elytraK = op;

      /* ---------- 下一次自发换位（pool 不再自发换位） ---------- */
      if (!this.patrol) {
        this.tpNext = (this.tpNext == null ? rand(P.tele[0], P.tele[1]) : this.tpNext) - dt;
        if (this.tpNext <= 0) this.tp = { phase: "out", t: 0 };
      }
    }
    /* 换一个"别处"：pool 从左右边缘重新进场；其他模式仍用随机换位 */
    relocate(fresh) {
      if (this.type === "pool") {
        this.spawnPoolSide();
        this.gaitT = 0; this.spd = 0; this.moveK = 0; this.flare = null;
        this.ladyExplore = null; this.wingK = 0;
        if (fresh) {
          this.applyToy(pickFfToy());
        }
        this.flareCd = rand(0.6, 1.8) * ((this.toy && this.toy.flare) || 1);
        return;
      }
      const b = G.bounds();
      const inset = 40 * Math.pow(G.platform.S || 1, 0.4);
      const far = Math.min(b.w, b.h) * 0.42;
      const keepAng = this.driftAng;        // 自发换位保留航向；只有被拍重生才换方向
      let nx = this.x, ny = this.y;
      for (let i = 0; i < 14; i++) {
        nx = rand(b.x + inset, b.x + b.w - inset);
        ny = rand(b.y + inset, b.y + b.h - inset);
        if (Math.hypot(nx - this.x, ny - this.y) > far) break;
      }
      this.x = nx; this.y = ny;
      this.driftAng = fresh ? rand(0, Math.PI * 2) : keepAng;
      this.crawlAng = this.driftAng;
      this.gaitT = 0; this.spd = 0; this.moveK = 0; this.flare = null;
      this.hopT = 0; this.hopOff = 0;
      if (fresh) this.applyToy(pickFfToy());      // 被拍重生：换一种动物，画面不单调
      this.flareCd = rand(0.6, 1.8) * ((this.toy && this.toy.flare) || 1);
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
      // 瞬移预警：原地高频闪烁 0.3s（渲染层按 preTele 处理闪烁），结束后瞬移
      if (this.state === "preTele") {
        if (this.stateT >= 0.3) { this.state = "dart"; this.stateT = 0; this.laserTeleport(); }
        this.fade = 1;
        return;
      }
      const inset = 10;
      const L = b.x + inset, Rt = b.x + b.w - inset, T = b.y + inset, B = b.y + b.h - inset;
      if (this.state === "dart") {
        const sp = d.speed * this.speedMul * this.comboSpeed * (this.adaptiveSlow || 1) * (this.speciesSpeed || 1);
        const MS = Math.pow(G.platform.S || 1, 0.5);
        this.x += this.vx * sp * dt * MS;
        this.y += this.vy * sp * dt * MS;
        let bounced = false;
        if (this.x < L)         { this.x = L;             this.vx = Math.abs(this.vx); bounced = true; }
        else if (this.x > Rt)   { this.x = Rt;            this.vx = -Math.abs(this.vx); bounced = true; }
        if (this.y < T)         { this.y = T;             this.vy = Math.abs(this.vy); bounced = true; }
        else if (this.y > B)    { this.y = B;             this.vy = -Math.abs(this.vy); bounced = true; }
        if (bounced) {
          G.playBounce();
          this.wx = this.x + this.vx * 260; this.wy = this.y + this.vy * 260;
        }
        if (P.trail) {
          this.trailAcc += Math.hypot(this.x - this.lastTrailX, this.y - this.lastTrailY);
          if (this.trailAcc > 22) {
            this.trailAcc = 0;
            G.laserTrail(this.x, this.y, this.laserVar && this.laserVar.key);
          }
        }
        this.lastTrailX = this.x; this.lastTrailY = this.y;
        const near = (this.wx - this.x) * (this.wx - this.x) + (this.wy - this.y) * (this.wy - this.y) < 900;
        if (near || this.stateT >= this.stateDur * 2.2) {
          this.state = "hold"; this.stateT = 0;
          this.stateDur = rand(P.hold[0], P.hold[1]);
        } else if (Math.random() < P.tele * dt * 8) {
          // 激光瞬移前先闪烁预警 0.3s
          this.state = "preTele"; this.stateT = 0;
        }
      } else {
        // hold 停留（主要命中窗口）
        this.x += Math.sin(t * 7 + this.phase) * 2 * dt;
        this.y += Math.cos(t * 8.3 + this.phase) * 2 * dt;
        if (this.stateT >= this.stateDur / Math.sqrt(Math.max(this.comboSpeed || 1, 1))) {
          this.stateT = 0;
          if (Math.random() < P.tele) { this.state = "preTele"; }
          else { this.state = "dart"; this.laserNewWaypoint(); }
        }
      }
      this.fade = 1;
    }

    /* ============ 命中判定（对齐 DOM 包围盒点击语义） ============ */
    hittable(x, y) {
      if (this.vanishT > 0) return false;
      if (this.type === "frog") {
        // 重生等待期不可拍；正沉入水里的也不可拍（已经掉进荷塘了）；命中盒外扩 15%（落水瞬间放宽到 25%，只要拍在荷叶上都算）
        if (this.rspT > 0 || this.fade < 0.4 || this.fState === "drown") return false;
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
      const cy = this.y;
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
        if (this.nightMode) {
          ctx.translate(this.x,this.y);ctx.rotate(this.nightHeading||0);
          ctx.scale(this.sc*vs,this.sc*vs);
          const tint={ladybug:"#ff3c57",spider:"#cd67ff",dragonfly:"#4be7ff",fly:"#ffe66b"}[this.nightSpecies]||"#eaffff";
          ctx.save();ctx.shadowColor=tint;ctx.shadowBlur=30+8*Math.sin(t*5);ctx.fillStyle=tint;ctx.globalAlpha=.32;ctx.beginPath();ctx.arc(0,0,50,0,Math.PI*2);ctx.fill();ctx.restore();
          G.draw.nightInsect(ctx,this.nightSpecies,t,this);ctx.restore();return;
        }
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
      } else if (this.type === "frog") {
        const drownK0 = this.drownK || 0;
        if (drownK0 > 0) ctx.globalAlpha *= Math.max(0.06, 1 - drownK0 * 0.92);   // 沉入水中：整体淡出
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
        // 同叶多只时再略缩一点（shareScale）；沉入水中时缩小淡出
        const dk = this.drownK || 0;
        const s = this.sc * vs * 0.85 * (this.shareScale || 1) * (1 - dk * 0.34);
        ctx.scale(s * (this.faceDir || 1), s * (this._squash || 1));
        ctx.translate(-48, -39);
        G.draw.frog(ctx, this, t);
        ctx.restore();
      } else if (this.type === "pool") {
        // 第一版萤光：萤火虫自带底光/旋转/淡入淡出（D.poolLight 内部按 p.fade 接管透明度）
        ctx.translate(this.x, this.y - (this.hopOff || 0));
        G.draw.poolLight(ctx, this, t);
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

  /* 每段只出现一种动物；换景淡入结束时同步切换造型和对应动作。 */
  G.buildPreys = () => {
    preys.forEach(p => {
      if (p.holeIdx >= 0 && G.scene.holeOwners && G.scene.holeOwners[p.holeIdx] === p) G.scene.holeOwners[p.holeIdx] = null;
    });
    preys.length = 0;
    if (G.scene.holeOwners) G.scene.holeOwners = G.scene.holeOwners.map(() => null);
    if (G.scene.holeHeat) G.scene.holeHeat = G.scene.holeHeat.map(() => []);
    // 第一版萤光：开局固定 1 只萤光小虫（多只设置也不加量）
    const n = G.config.targetType === "pool" ? 1
      : G.config.targetType === "butterfly" && G.currentBg() === "night" ? 1
      : (Number(G.config.preyCount) === 1 ? 1 : 3);
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
    // 鱼群巡游：小银鱼聚成"饵球"；数量按「猎物数量」设置分两档、随阶段递增。
    // 必须放在下面的单只判断之前——否则单只设置下鱼群也会只剩 1 条，失去结群效果。
    if (G.config.targetType === "fish" && G.session.sea && G.session.sea.key === "school") {
      return Number(G.config.preyCount) === 1
        ? ({ 1: 3, 2: 4, 3: 5 })[G.session.stage] || 3
        : ({ 1: 6, 2: 9, 3: 12 })[G.session.stage] || 6;
    }
    // 第一版萤光：整局固定一只萤光小虫，与单只/多只设置无关。
    if (G.config.targetType === "pool") return 1;
    if (Number(G.config.preyCount) === 1) return 0;
    const base = ({ 1: 3, 2: 5, 3: 7 })[G.session.stage] || 3;
    if (G.config.targetType === "mouse") {
      const holeN = (G.scene && G.scene.holes ? G.scene.holes.length : 8);
      return Math.min(base, Math.max(1, holeN - 1));
    }
    // 青蛙跳：荷叶数 6，按阶段封顶（3/4/5），留 1 片空叶供轮换；漂着/正沉的叶不计
    if (G.config.targetType === "frog") {
      const pads = (G.scene && G.scene.pads) || [];
      const padN = pads.length || 6;
      const floatN = pads.filter(p => (p.sinkState || "float") === "float").length || padN;
      return Math.min(({ 1: 3, 2: 4, 3: 5, 4: 5 })[G.session.stage] || 3, Math.max(1, floatN - 1));
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
