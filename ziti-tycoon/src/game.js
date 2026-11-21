import { sfx } from './audio.js';

const SAVE_KEY = 'ziti_glizzy_tycoon_save_v2';
const BASE_WEIGHT = 160;

const WEIGHT_TIERS = [
  { name: 'LVL 1 • SKINNY SNACKER', min: 160, fat: 0.0 },
  { name: 'LVL 2 • LUNCH TABLE REGULAR', min: 350, fat: 0.12 },
  { name: 'LVL 3 • GLIZZY GOBBLER', min: 900, fat: 0.24 },
  { name: 'LVL 4 • BAKED ZITI BANDIT', min: 2800, fat: 0.36 },
  { name: 'LVL 5 • ABSOLUTE UNIT', min: 9000, fat: 0.48 },
  { name: 'LVL 6 • BUFFET DESTROYER', min: 30000, fat: 0.60 },
  { name: 'LVL 7 • HEFTY TITAN', min: 100000, fat: 0.72 },
  { name: 'LVL 8 • GRAVITATIONAL ZITI', min: 400000, fat: 0.84 },
  { name: 'LVL 9 • PLANETARY GLIZZY', min: 2000000, fat: 0.94 },
  { name: 'LVL 10 • ZITI SINGULARITY', min: 12000000, fat: 1.0 },
];

const FOOD_MENU = [
  { id: 'glizzy', name: 'Cafeteria Glizzy', icon: '🌭', desc: 'Classic steamed hot dog on a warm bun.', baseCost: 25, basePower: 1 },
  { id: 'chili_dog', name: 'Chili Cheese Dog', icon: '🌶️', desc: 'Loaded with melted cheddar & chili.', baseCost: 240, basePower: 4 },
  { id: 'baked_ziti', name: 'Corner Baked Ziti', icon: '🍝', desc: 'Bubbling marinara & ricotta perfection.', baseCost: 1800, basePower: 15 },
  { id: 'footlong', name: 'Stadium Footlong', icon: '🌭', desc: 'Double-length glizzy with mustard stripes.', baseCost: 14000, basePower: 55 },
  { id: 'grandma_ziti', name: "Grandma's Double Ziti", icon: '🧀', desc: 'Triple mozzarella crust straight from the oven.', baseCost: 95000, basePower: 220 },
  { id: 'ziti_dog', name: 'Deep-Fried Ziti Dog', icon: '🔥', desc: 'A hot dog stuffed inside baked ziti. Illegal.', baseCost: 700000, basePower: 900 },
  { id: 'ziti_tray', name: 'Catering Ziti Pan', icon: '🍲', desc: 'Feeds a family of 12. He eats it solo.', baseCost: 5500000, basePower: 3800 },
  { id: 'truffle_platter', name: 'Golden Ziti & Glizzy Feast', icon: '👑', desc: '24k gold-leaf parmesan & wagyu glizzies.', baseCost: 48000000, basePower: 16000 },
];

const CREW_LIST = [
  {
    id: 'hoodie_bro',
    name: 'Late-Night Plug',
    img: 'assets/hoodie_bro.jpg',
    desc: 'Pulls up after hours with nonstop hot dogs.',
    baseCost: 120,
    baseRate: 1.5,
    pos: { left: '5%', top: '24%' },
  },
  {
    id: 'chair_bro',
    name: 'Tailgate Griller',
    img: 'assets/chair_bro.jpg',
    desc: 'Never leaves the camp chair. Never stops grilling.',
    baseCost: 1100,
    baseRate: 9,
    pos: { right: '5%', top: '24%' },
  },
  {
    id: 'suburb_bro',
    name: 'Suburb Ziti Chef',
    img: 'assets/suburb_bro.jpg',
    desc: 'Mass-producing trays of baked ziti from the suburbs.',
    baseCost: 10500,
    baseRate: 52,
    pos: { left: '4%', bottom: '18%' },
  },
  {
    id: 'celsius_plug',
    name: 'Celsius Supplier',
    img: 'assets/celsius.jpg',
    desc: 'Watermelon Lemonade IV drip for max chew speed.',
    baseCost: 95000,
    baseRate: 280,
    pos: { right: '4%', bottom: '18%' },
  },
  {
    id: 'suit_bro',
    name: 'The CEO',
    img: 'assets/suit_bro.jpg',
    desc: "Grainger's top prospect funding mega ziti factories.",
    baseCost: 850000,
    baseRate: 1600,
    pos: { left: '16%', top: '14%' },
  },
];

const BOOSTS = [
  { id: 'parmesan', name: 'Extra Parmesan Shaker', icon: '🧀', desc: '2x value on every tap bite.', cost: 600, type: 'tapMult', value: 2 },
  { id: 'double_fist', name: 'Double-Fist Technique', icon: '🙌', desc: '2x tap power & faster feast streak.', cost: 4500, type: 'tapMult', value: 2 },
  { id: 'mustard', name: 'Bottomless Mustard', icon: '🌭', desc: '2x output for Late-Night Plug & Tailgate Griller.', cost: 12000, type: 'crewBoost', targets: ['hoodie_bro', 'chair_bro'], value: 2 },
  { id: 'celsius_case', name: 'Costco Celsius Case', img: 'assets/celsius.jpg', desc: 'Muscle Overdrive lasts 18s and gives 6x bites!', cost: 55000, type: 'overdriveBoost', value: 1 },
  { id: 'ziti_oven', name: 'Suburban Brick Oven', img: 'assets/suburb_bro.jpg', desc: '3x output for Suburb Ziti Chef.', cost: 180000, type: 'crewBoost', targets: ['suburb_bro'], value: 3 },
  { id: 'boardroom', name: 'CEO Merger', img: 'assets/suit_bro.jpg', desc: '3x output for The CEO & +50% all income.', cost: 1200000, type: 'globalMult', value: 1.5, targets: ['suit_bro'], crewValue: 3 },
  { id: 'titanium_jaw', name: 'Titanium Jawline', icon: '⚡', desc: '3x tap bite power permanently this season.', cost: 4500000, type: 'tapMult', value: 3 },
];

const QUIPS_NORMAL = [
  'Feed me ziti!',
  'More glizzies pls',
  'Needs extra cheese',
  'Bulking season',
  'I can eat 10 more',
  'Getting hefty...',
];

const QUIPS_BUFF = [
  'CELSIUS KICKED IN!',
  'PURE PROTEIN ZITI!',
  'ABSOLUTE BEAST!',
  'CANNOT BE STOPPED!',
];

function fmt(n) {
  if (n < 1000) return Math.floor(n).toLocaleString();
  const units = ['K', 'M', 'B', 'T', 'Qa'];
  let u = -1;
  let val = n;
  while (val >= 1000 && u < units.length - 1) {
    val /= 1000;
    u++;
  }
  return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)}${units[u]}`;
}

function fmtWeight(lbs) {
  if (lbs >= 10000) {
    const tons = lbs / 2000;
    return `${fmt(tons)} Tons`;
  }
  return `${Math.floor(lbs).toLocaleString()} lbs`;
}

class ZitiTycoon {
  constructor() {
    this.state = this.defaultState();
    this.activeTab = 'food';
    this.combo = 0;
    this.overdriveLeft = 0;
    this.chompTimer = 0;
    this.lastTierIdx = 0;
    this.bonusSpawnTimer = 14;
    this.cravingGoal = 15;
    this.cravingProgress = 0;
    this.lastFrame = performance.now();

    this.dom = {
      weight: document.getElementById('weight-display'),
      rate: document.getElementById('rate-display'),
      cash: document.getElementById('cash-display'),
      tap: document.getElementById('tap-display'),
      tierName: document.getElementById('tier-name'),
      tierNext: document.getElementById('tier-next'),
      tierFill: document.getElementById('tier-fill'),
      stage: document.getElementById('stage'),
      cravingText: document.getElementById('craving-text'),
      cravingReward: document.getElementById('craving-reward'),
      cravingFill: document.getElementById('craving-fill'),
      overdriveBanner: document.getElementById('overdrive-banner'),
      overdriveTimer: document.getElementById('overdrive-timer'),
      comboMult: document.getElementById('combo-mult'),
      comboFill: document.getElementById('combo-fill'),
      crewStage: document.getElementById('crew-stage'),
      eaterBtn: document.getElementById('eater-btn'),
      eaterQuip: document.getElementById('eater-quip'),
      charRig: document.getElementById('character-rig'),
      headWrap: document.getElementById('head-wrap'),
      eaterImg: document.getElementById('eater-img'),
      eaterAura: document.getElementById('eater-aura'),
      fatBodyGroup: document.getElementById('fat-body-group'),
      buffBodyGroup: document.getElementById('buff-body-group'),
      fatTorso: document.getElementById('fat-torso'),
      fatBelly: document.getElementById('fat-belly'),
      fatArmL: document.getElementById('fat-arm-l'),
      fatArmR: document.getElementById('fat-arm-r'),
      plateIcon: document.getElementById('plate-icon'),
      plateName: document.getElementById('plate-name'),
      bonusLayer: document.getElementById('bonus-layer'),
      fxLayer: document.getElementById('fx-layer'),
      shopList: document.getElementById('shop-list'),
      soundBtn: document.getElementById('sound-btn'),
      soundIcon: document.getElementById('sound-icon'),
      offlineModal: document.getElementById('offline-modal'),
      offlineSummary: document.getElementById('offline-summary'),
      offlineClaim: document.getElementById('offline-claim-btn'),
    };

    this.loadSave();
    this.lastTierIdx = this.getTierIndex();
    this.bindEvents();
    this.renderCrewStage();
    this.renderShop();
    this.updateHUD();

    setInterval(() => this.save(), 3000);
    requestAnimationFrame((t) => this.loop(t));
  }

  defaultState() {
    return {
      weight: BASE_WEIGHT,
      cash: 0,
      totalBites: 0,
      stars: 0,
      foodLevels: { glizzy: 1 },
      crewLevels: {},
      ownedBoosts: {},
      lastSaved: Date.now(),
    };
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.state = {
        ...this.defaultState(),
        ...parsed,
        foodLevels: { glizzy: 1, ...(parsed.foodLevels || {}) },
        crewLevels: { ...(parsed.crewLevels || {}) },
        ownedBoosts: { ...(parsed.ownedBoosts || {}) },
      };

      const awaySec = Math.min(4 * 3600, Math.max(0, (Date.now() - (this.state.lastSaved || Date.now())) / 1000));
      const rate = this.getPassiveRate();
      if (awaySec >= 25 && rate > 0) {
        const gained = rate * awaySec * 0.45;
        this.state.weight += gained;
        this.state.cash += gained;
        this.dom.offlineSummary.textContent =
          `While you were away for ${Math.floor(awaySec / 60)}m ${Math.floor(awaySec % 60)}s, your crew fed him +${fmtWeight(gained)} and earned +$${fmt(gained)}!`;
        this.dom.offlineModal.classList.remove('hidden');
      }
    } catch {
      // Ignore corrupt save
    }
  }

  save() {
    this.state.lastSaved = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage errors
    }
  }

  getPrestigeMult() {
    return 1 + this.state.stars * 0.5;
  }

  getComboMult() {
    if (this.combo >= 85) return 3.0;
    if (this.combo >= 55) return 2.0;
    if (this.combo >= 25) return 1.5;
    return 1.0;
  }

  getOverdriveTapMult() {
    if (this.overdriveLeft <= 0) return 1;
    return this.state.ownedBoosts.celsius_case ? 6 : 4;
  }

  getGlobalBoostMult() {
    let mult = 1;
    for (const b of BOOSTS) {
      if (this.state.ownedBoosts[b.id] && b.type === 'globalMult') {
        mult *= b.value;
      }
    }
    return mult;
  }

  getTapPower() {
    let base = 0;
    for (const f of FOOD_MENU) {
      const lvl = this.state.foodLevels[f.id] || 0;
      base += lvl * f.basePower;
    }
    let tapMult = 1;
    for (const b of BOOSTS) {
      if (this.state.ownedBoosts[b.id] && b.type === 'tapMult') {
        tapMult *= b.value;
      }
    }
    return Math.max(1, base) * tapMult * this.getGlobalBoostMult() * this.getPrestigeMult();
  }

  getCrewRate(crew) {
    const lvl = this.state.crewLevels[crew.id] || 0;
    if (lvl === 0) return 0;
    let mult = 1;
    for (const b of BOOSTS) {
      if (!this.state.ownedBoosts[b.id]) continue;
      if (b.targets && b.targets.includes(crew.id)) {
        mult *= b.crewValue || b.value;
      }
    }
    return lvl * crew.baseRate * mult * this.getGlobalBoostMult() * this.getPrestigeMult();
  }

  getPassiveRate() {
    let total = 0;
    for (const c of CREW_LIST) {
      total += this.getCrewRate(c);
    }
    if (this.overdriveLeft > 0) total *= 2.5;
    return total;
  }

  getFoodCost(food) {
    const lvl = this.state.foodLevels[food.id] || 0;
    return Math.round(food.baseCost * Math.pow(1.36, lvl));
  }

  getCrewCost(crew) {
    const lvl = this.state.crewLevels[crew.id] || 0;
    return Math.round(crew.baseCost * Math.pow(1.30, lvl));
  }

  getHighestFood() {
    let best = FOOD_MENU[0];
    for (const f of FOOD_MENU) {
      if ((this.state.foodLevels[f.id] || 0) > 0) best = f;
    }
    return best;
  }

  getTierIndex() {
    let idx = 0;
    for (let i = 0; i < WEIGHT_TIERS.length; i++) {
      if (this.state.weight >= WEIGHT_TIERS[i].min) idx = i;
    }
    return idx;
  }

  getPendingStars() {
    if (this.state.weight < 100000) return 0;
    return Math.floor(Math.pow(this.state.weight / 100000, 0.5) * 2);
  }

  getCravingReward() {
    return Math.max(25, Math.round(this.getTapPower() * 20 + this.getPassiveRate() * 8));
  }

  bindEvents() {
    const onFeed = (e) => {
      e.preventDefault();
      const rect = this.dom.stage.getBoundingClientRect();
      const pt = e.changedTouches ? e.changedTouches[0] : e;
      const x = pt ? pt.clientX - rect.left : rect.width * 0.5;
      const y = pt ? pt.clientY - rect.top : rect.height * 0.45;
      this.handleBite(x, y);
    };

    this.dom.eaterBtn.addEventListener('pointerdown', onFeed);

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderShop();
      });
    });

    this.dom.soundBtn.addEventListener('click', () => {
      const on = sfx.toggle();
      this.dom.soundIcon.innerHTML = on
        ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>`
        : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
    });

    this.dom.offlineClaim.addEventListener('click', () => {
      sfx.buy();
      this.dom.offlineModal.classList.add('hidden');
    });
  }

  handleBite(x, y) {
    this.combo = Math.min(100, this.combo + (this.state.ownedBoosts.double_fist ? 7.5 : 5));
    const gain = this.getTapPower() * this.getComboMult() * this.getOverdriveTapMult();

    this.state.weight += gain;
    this.state.cash += gain;
    this.state.totalBites++;

    // Craving mini-mission progress
    this.cravingProgress++;
    if (this.cravingProgress >= this.cravingGoal) {
      const reward = this.getCravingReward();
      this.state.cash += reward;
      this.state.weight += reward;
      this.cravingProgress = 0;
      this.cravingGoal = Math.min(50, this.cravingGoal + 5);
      sfx.tierUp();
      const rect = this.dom.stage.getBoundingClientRect();
      this.spawnPop(rect.width * 0.5, rect.height * 0.25, `CRAVING BONUS +$${fmt(reward)}!`, false);
    }

    // Occasional speech bubble swap
    if (this.state.totalBites % 12 === 0) {
      const pool = this.overdriveLeft > 0 ? QUIPS_BUFF : QUIPS_NORMAL;
      this.dom.eaterQuip.textContent = pool[Math.floor(Math.random() * pool.length)];
    }

    // Animate head chomp + squash
    this.dom.eaterImg.src = 'assets/eater_chomp.jpg';
    this.chompTimer = 0.13;
    this.applyBodyVisuals(true);

    sfx.chomp(0.92 + Math.random() * 0.22 + (this.overdriveLeft > 0 ? 0.2 : 0));

    const food = this.getHighestFood();
    this.spawnPop(x, y - 16, `+$${fmt(gain)}`, false);
    this.spawnPop(x + (Math.random() - 0.5) * 44, y - 4, food.icon, true);

    this.checkTierUp();
    this.updateHUD();
    this.refreshAffordability();
  }

  applyBodyVisuals(isChomping = false) {
    const tier = WEIGHT_TIERS[this.getTierIndex()];
    const isBuff = this.overdriveLeft > 0;

    // Toggle Fat Body vs Muscle Powerup Body
    this.dom.fatBodyGroup.classList.toggle('hidden', isBuff);
    this.dom.buffBodyGroup.classList.toggle('hidden', !isBuff);
    this.dom.fatBodyGroup.style.display = isBuff ? 'none' : '';
    this.dom.buffBodyGroup.style.display = isBuff ? '' : 'none';

    // Grow fake fat belly smoothly with weight tier
    const fat = tier.fat; // 0.0 -> 1.0
    const rxTorso = 38 + fat * 48; // 38 -> 86
    const ryTorso = 48 + fat * 12; // 48 -> 60
    const rxBelly = 28 + fat * 44; // 28 -> 72
    const ryBelly = 30 + fat * 16; // 30 -> 46

    this.dom.fatTorso.setAttribute('rx', rxTorso.toFixed(1));
    this.dom.fatTorso.setAttribute('ry', ryTorso.toFixed(1));
    this.dom.fatBelly.setAttribute('rx', rxBelly.toFixed(1));
    this.dom.fatBelly.setAttribute('ry', ryBelly.toFixed(1));

    const armOffset = fat * 34;
    this.dom.fatArmL.setAttribute('d', `M ${(82 - armOffset).toFixed(0)} 28 Q ${(42 - armOffset).toFixed(0)} 56 ${(56 - armOffset * 0.7).toFixed(0)} 84`);
    this.dom.fatArmR.setAttribute('d', `M ${(158 + armOffset).toFixed(0)} 28 Q ${(198 + armOffset).toFixed(0)} 56 ${(184 + armOffset * 0.7).toFixed(0)} 84`);

    // Rig squash & stretch on chomp + overall scale boost
    const sizeScale = 1 + fat * 0.14 + (isBuff ? 0.1 : 0);
    const chompX = isChomping ? 1.07 : 1.0;
    const chompY = isChomping ? 0.93 : 1.0;
    this.dom.charRig.style.transform = `scale(${(sizeScale * chompX).toFixed(3)}, ${(sizeScale * chompY).toFixed(3)})`;
    this.dom.headWrap.style.transform = isChomping ? 'rotate(-5deg) scale(1.06)' : 'rotate(0deg) scale(1)';
    this.dom.eaterAura.style.transform = `scale(${(sizeScale * (isChomping ? 1.16 : 1.0)).toFixed(2)})`;
  }

  checkTierUp() {
    const idx = this.getTierIndex();
    if (idx > this.lastTierIdx) {
      this.lastTierIdx = idx;
      sfx.tierUp();
      const rect = this.dom.stage.getBoundingClientRect();
      this.spawnPop(rect.width * 0.5, rect.height * 0.25, `SIZE UP! ${WEIGHT_TIERS[idx].name.split('• ')[1]}`, false);
    }
  }

  spawnPop(x, y, text, isFood = false) {
    const el = document.createElement('div');
    el.className = `float-pop ${isFood ? 'food-pop' : ''}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (isFood) {
      el.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 90)}px`);
      el.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 70)}deg`);
    }
    this.dom.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }

  spawnBonusDrop() {
    if (this.dom.bonusLayer.children.length > 0) return;

    const isCelsius = Math.random() < 0.7;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bonus-drop';
    btn.style.left = `${14 + Math.random() * 68}%`;
    btn.style.top = `${22 + Math.random() * 44}%`;

    if (isCelsius) {
      btn.innerHTML = `<img src="assets/celsius.jpg" alt="Celsius" /><span class="bonus-tag">MUSCLE!</span>`;
    } else {
      btn.innerHTML = `<span style="font-size:32px">🍝</span><span class="bonus-tag">JACKPOT!</span>`;
    }

    const timeout = setTimeout(() => btn.remove(), 8000);

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(timeout);
      btn.remove();
      if (isCelsius) {
        this.triggerOverdrive();
      } else {
        const jackpot = this.getCravingReward() * 2;
        this.state.cash += jackpot;
        this.state.weight += jackpot;
        sfx.tierUp();
        const rect = this.dom.stage.getBoundingClientRect();
        this.spawnPop(rect.width * 0.5, rect.height * 0.35, `GOLDEN ZITI +$${fmt(jackpot)}!`, false);
      }
    });

    this.dom.bonusLayer.appendChild(btn);
  }

  triggerOverdrive() {
    const duration = this.state.ownedBoosts.celsius_case ? 18 : 12;
    this.overdriveLeft = duration;
    this.dom.stage.classList.add('overdrive-active');
    this.dom.overdriveBanner.classList.remove('hidden');
    this.dom.eaterQuip.textContent = QUIPS_BUFF[Math.floor(Math.random() * QUIPS_BUFF.length)];
    sfx.overdrive();
    this.applyBodyVisuals(false);
  }

  renderCrewStage() {
    this.dom.crewStage.innerHTML = '';
    CREW_LIST.forEach((crew, i) => {
      const count = this.state.crewLevels[crew.id] || 0;
      if (count <= 0) return;
      const badge = document.createElement('div');
      badge.className = 'crew-badge';
      badge.style.animationDelay = `${i * 0.35}s`;
      Object.assign(badge.style, crew.pos);
      badge.innerHTML = `<img src="${crew.img}" alt="${crew.name}" /><span class="crew-count-tag">x${count}</span>`;
      this.dom.crewStage.appendChild(badge);
    });
  }

  renderShop() {
    const list = this.dom.shopList;
    list.innerHTML = '';

    if (this.activeTab === 'food') {
      for (const food of FOOD_MENU) {
        const lvl = this.state.foodLevels[food.id] || 0;
        const cost = this.getFoodCost(food);
        const canBuy = this.state.cash >= cost;

        const card = document.createElement('div');
        card.className = `shop-card ${canBuy ? 'affordable' : ''}`;
        card.dataset.cost = cost;
        card.innerHTML = `
          <div class="card-avatar">${food.icon}</div>
          <div class="card-body">
            <div class="card-title-row">
              <div class="card-title">${food.name}</div>
              <span class="card-lvl">Lv ${lvl}</span>
            </div>
            <div class="card-desc">${food.desc}</div>
            <div class="card-stat">+${fmt(food.basePower * this.getPrestigeMult())} / bite</div>
          </div>
          <button class="buy-btn" type="button" ${canBuy ? '' : 'disabled'}>$${fmt(cost)}</button>
        `;

        card.querySelector('.buy-btn').addEventListener('click', () => {
          const c = this.getFoodCost(food);
          if (this.state.cash < c) return;
          this.state.cash -= c;
          this.state.foodLevels[food.id] = (this.state.foodLevels[food.id] || 0) + 1;
          sfx.buy();
          this.save();
          this.renderShop();
          this.updateHUD();
        });
        list.appendChild(card);
      }
    } else if (this.activeTab === 'crew') {
      for (const crew of CREW_LIST) {
        const lvl = this.state.crewLevels[crew.id] || 0;
        const cost = this.getCrewCost(crew);
        const canBuy = this.state.cash >= cost;

        const card = document.createElement('div');
        card.className = `shop-card ${canBuy ? 'affordable' : ''}`;
        card.dataset.cost = cost;
        card.innerHTML = `
          <div class="card-avatar"><img src="${crew.img}" alt="${crew.name}" /></div>
          <div class="card-body">
            <div class="card-title-row">
              <div class="card-title">${crew.name}</div>
              <span class="card-lvl">x${lvl}</span>
            </div>
            <div class="card-desc">${crew.desc}</div>
            <div class="card-stat">+${fmt(crew.baseRate * this.getPrestigeMult())} lbs/s each</div>
          </div>
          <button class="buy-btn" type="button" ${canBuy ? '' : 'disabled'}>$${fmt(cost)}</button>
        `;

        card.querySelector('.buy-btn').addEventListener('click', () => {
          const c = this.getCrewCost(crew);
          if (this.state.cash < c) return;
          this.state.cash -= c;
          this.state.crewLevels[crew.id] = (this.state.crewLevels[crew.id] || 0) + 1;
          sfx.buy();
          this.save();
          this.renderCrewStage();
          this.renderShop();
          this.updateHUD();
        });
        list.appendChild(card);
      }
    } else if (this.activeTab === 'boosts') {
      for (const b of BOOSTS) {
        const owned = !!this.state.ownedBoosts[b.id];
        const canBuy = !owned && this.state.cash >= b.cost;
        const avatar = b.img ? `<img src="${b.img}" alt="${b.name}" />` : b.icon;

        const card = document.createElement('div');
        card.className = `shop-card ${owned ? 'owned-max' : canBuy ? 'affordable' : ''}`;
        if (!owned) card.dataset.cost = b.cost;
        card.innerHTML = `
          <div class="card-avatar">${avatar}</div>
          <div class="card-body">
            <div class="card-title-row">
              <div class="card-title">${b.name}</div>
              ${owned ? '<span class="card-lvl">OWNED</span>' : ''}
            </div>
            <div class="card-desc">${b.desc}</div>
          </div>
          <button class="buy-btn" type="button" ${canBuy ? '' : 'disabled'}>${owned ? 'DONE' : '$' + fmt(b.cost)}</button>
        `;

        card.querySelector('.buy-btn').addEventListener('click', () => {
          if (this.state.ownedBoosts[b.id] || this.state.cash < b.cost) return;
          this.state.cash -= b.cost;
          this.state.ownedBoosts[b.id] = true;
          sfx.tierUp();
          this.save();
          this.renderShop();
          this.updateHUD();
        });
        list.appendChild(card);
      }
    } else if (this.activeTab === 'prestige') {
      const pending = this.getPendingStars();
      const box = document.createElement('div');
      box.className = 'prestige-box';
      box.innerHTML = `
        <div class="prestige-stars">★ ${this.state.stars} GOLDEN ZITI STARS</div>
        <div class="prestige-desc">
          Current permanent multiplier: <b>${Math.round(this.getPrestigeMult() * 100)}%</b><br/>
          Reach <b>100,000 lbs (50 Tons)</b> to start a new Bulk Season and earn <b>+${pending} ★</b> (+50% permanent boost per star).
        </div>
        <button id="prestige-btn" class="primary-btn" type="button" ${pending > 0 ? '' : 'disabled'}>
          ${pending > 0 ? `START NEW BULK (+${pending} ★)` : 'NEED 100,000 LBS TO BULK'}
        </button>
        <button id="hard-reset-btn" class="reset-btn" type="button">Reset All Progress</button>
      `;

      box.querySelector('#prestige-btn').addEventListener('click', () => {
        const gainStars = this.getPendingStars();
        if (gainStars <= 0) return;
        this.state = {
          ...this.defaultState(),
          stars: this.state.stars + gainStars,
        };
        this.lastTierIdx = 0;
        sfx.tierUp();
        this.save();
        this.renderCrewStage();
        this.renderShop();
        this.updateHUD();
      });

      box.querySelector('#hard-reset-btn').addEventListener('click', () => {
        if (!confirm('Reset all weight, crew, and Golden Ziti Stars?')) return;
        this.state = this.defaultState();
        this.lastTierIdx = 0;
        this.save();
        this.renderCrewStage();
        this.renderShop();
        this.updateHUD();
      });

      list.appendChild(box);
    }
  }

  refreshAffordability() {
    this.dom.shopList.querySelectorAll('.shop-card[data-cost]').forEach((card) => {
      const cost = Number(card.dataset.cost);
      const canBuy = this.state.cash >= cost;
      card.classList.toggle('affordable', canBuy);
      const btn = card.querySelector('.buy-btn');
      if (btn) btn.disabled = !canBuy;
    });
  }

  updateHUD() {
    const rate = this.getPassiveRate();
    const tapVal = this.getTapPower() * this.getComboMult() * this.getOverdriveTapMult();

    this.dom.weight.textContent = fmtWeight(this.state.weight);
    this.dom.rate.textContent = `+${fmt(rate)} lbs/sec`;
    this.dom.cash.textContent = `$${fmt(this.state.cash)}`;
    this.dom.tap.textContent = `$${fmt(tapVal)} / bite`;

    const food = this.getHighestFood();
    this.dom.plateIcon.textContent = food.icon;
    this.dom.plateName.textContent = food.name;

    // Craving bar
    this.dom.cravingText.textContent = `CRAVING: ${this.cravingProgress}/${this.cravingGoal} BITES`;
    this.dom.cravingReward.textContent = `+$${fmt(this.getCravingReward())}`;
    this.dom.cravingFill.style.width = `${Math.min(100, (this.cravingProgress / this.cravingGoal) * 100).toFixed(1)}%`;

    const idx = this.getTierIndex();
    const curTier = WEIGHT_TIERS[idx];
    const nextTier = WEIGHT_TIERS[idx + 1];
    this.dom.tierName.textContent = curTier.name;
    if (nextTier) {
      const pct = Math.min(100, Math.max(0, ((this.state.weight - curTier.min) / (nextTier.min - curTier.min)) * 100));
      this.dom.tierNext.textContent = `Next: ${fmtWeight(nextTier.min)}`;
      this.dom.tierFill.style.width = `${pct.toFixed(1)}%`;
    } else {
      this.dom.tierNext.textContent = 'MAX UNIT';
      this.dom.tierFill.style.width = '100%';
    }

    this.dom.comboMult.textContent = `x${this.getComboMult().toFixed(1)}`;
    this.dom.comboFill.style.width = `${this.combo.toFixed(1)}%`;

    if (this.chompTimer <= 0) {
      this.applyBodyVisuals(false);
    }
  }

  loop(now) {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    const rate = this.getPassiveRate();
    if (rate > 0) {
      this.state.weight += rate * dt;
      this.state.cash += rate * dt;
      this.checkTierUp();
    }

    if (this.chompTimer > 0) {
      this.chompTimer -= dt;
      if (this.chompTimer <= 0) {
        this.dom.eaterImg.src = 'assets/eater_idle.jpg';
        this.applyBodyVisuals(false);
      }
    }

    if (this.combo > 0) {
      this.combo = Math.max(0, this.combo - dt * 22);
    }

    if (this.overdriveLeft > 0) {
      this.overdriveLeft = Math.max(0, this.overdriveLeft - dt);
      const mult = this.getOverdriveTapMult();
      this.dom.overdriveTimer.textContent = `${mult}x BITES • ${this.overdriveLeft.toFixed(1)}s`;
      if (this.overdriveLeft <= 0) {
        this.dom.stage.classList.remove('overdrive-active');
        this.dom.overdriveBanner.classList.add('hidden');
        this.dom.eaterQuip.textContent = QUIPS_NORMAL[Math.floor(Math.random() * QUIPS_NORMAL.length)];
        this.applyBodyVisuals(false);
      }
    }

    this.bonusSpawnTimer -= dt;
    if (this.bonusSpawnTimer <= 0) {
      this.bonusSpawnTimer = 18 + Math.random() * 14;
      this.spawnBonusDrop();
    }

    this.updateHUD();
    this.refreshAffordability();

    requestAnimationFrame((t) => this.loop(t));
  }
}

new ZitiTycoon();
