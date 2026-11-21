import * as THREE from 'three';
import { Arena, ARENA_RADIUS } from './arena.js';
import { Player } from './player.js';
import { Enemy } from './enemies.js';
import { EchoAlly } from './echoes.js';
import { ParticleSystem } from './particles.js';
import { SWORDS, getSwordById } from './swords.js';
import { sfx, music } from './audio.js';

const PROG_STORAGE_KEY = 'bounce_back_progression_v1';
const RUN_STORAGE_KEY = 'bounce_back_saved_run_v1';

const PERK_POOL = [
  {
    id: 'damage',
    tag: 'OFFENSE',
    name: 'Overcharge Edge',
    desc: '+35% Base Attack Damage and stronger knockback on every strike.',
    apply: (game) => {
      game.player.attackDamage = Math.round(game.player.attackDamage * 1.35);
      game.player.knockbackForce += 4;
    },
  },
  {
    id: 'speed',
    tag: 'MOBILITY',
    name: 'Kinetic Surge',
    desc: '+18% Move Speed and 25% faster Dash recharge.',
    apply: (game) => {
      game.player.moveSpeed *= 1.18;
      game.player.dashMaxCooldown *= 0.75;
    },
  },
  {
    id: 'hp',
    tag: 'DEFENSE',
    name: 'Titan Frame',
    desc: '+45 Max HP and instant full restore.',
    apply: (game) => {
      game.player.maxHp += 45;
      game.player.hp = game.player.maxHp;
    },
  },
  {
    id: 'echo',
    tag: 'ECHO SQUAD',
    name: 'Echo Overdrive',
    desc: 'All Past-Life Echoes deal +45% more damage.',
    apply: (game) => {
      game.echoPowerMult *= 1.45;
      for (const e of game.echoes) e.powerMult = game.echoPowerMult;
    },
  },
  {
    id: 'lifesteal',
    tag: 'SUSTAIN',
    name: 'Vampiric Strikes',
    desc: 'Heal +5 HP on every melee hit.',
    apply: (game) => {
      game.player.lifesteal += 5;
    },
  },
  {
    id: 'slam',
    tag: 'IMPACT',
    name: 'Seismic Sky-Slam',
    desc: '+45% Sky Slam [E] damage, wider shockwave, and faster cooldown.',
    apply: (game) => {
      game.player.slamDamage = Math.round(game.player.slamDamage * 1.45);
      game.player.slamRadius += 2;
      game.player.slamMaxCooldown = Math.max(2.0, game.player.slamMaxCooldown * 0.78);
    },
  },
];

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.state = 'MENU'; // MENU, PLAYING, PAUSED, PERK_SELECT
    this.pauseOrigin = 'PLAYING'; // PLAYING or MENU
    this.score = 0;
    this.wave = 0;
    this.waveCooldown = 0;
    this.echoPowerMult = 1;
    this.cameraYaw = 0;
    this.cameraPitch = 0.42;
    this.cameraShake = 0;

    // Lobby character showcase rotation
    this.lobbyCharYaw = -0.32;

    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.touchMove = { x: 0, y: 0 };
    if (this.isTouchDevice) {
      document.body.classList.add('touch-mode');
    }
    this.isDraggingLobby = false;

    this.keys = {};
    this.enemies = [];
    this.echoes = [];
    this.activePerks = [];

    this.progression = this.loadProgression();

    this.initThree();
    this.particles = new ParticleSystem(this.scene);
    this.arena = new Arena(this.scene);
    this.player = new Player(this.scene, this.particles);
    this.player.equipSword(this.progression.equippedSword);

    this.setSceneEnvironment('MENU');
    this.bindEvents();
    this.refreshLobbyUI();
    this.lastTime = performance.now();
    this.animate();
  }

  loadProgression() {
    try {
      const raw = localStorage.getItem(PROG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          bestWave: parsed.bestWave || 1,
          bestScore: parsed.bestScore || 0,
          totalBounces: parsed.totalBounces || 0,
          equippedSword: parsed.equippedSword || 'iron_broadsword',
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      bestWave: 1,
      bestScore: 0,
      totalBounces: 0,
      equippedSword: 'iron_broadsword',
    };
  }

  saveProgression() {
    try {
      localStorage.setItem(PROG_STORAGE_KEY, JSON.stringify(this.progression));
    } catch {
      // ignore storage errors
    }
  }

  checkSwordUnlocks() {
    const prevUnlocked = new Set(
      SWORDS.filter((s) => s.checkUnlock(this.progression)).map((s) => s.id)
    );

    let changed = false;
    if (this.wave > this.progression.bestWave) {
      this.progression.bestWave = this.wave;
      changed = true;
    }
    if (this.score > this.progression.bestScore) {
      this.progression.bestScore = this.score;
      changed = true;
    }

    if (changed) {
      this.saveProgression();
      for (const s of SWORDS) {
        if (!prevUnlocked.has(s.id) && s.checkUnlock(this.progression)) {
          this.showBanner('BLADE UNLOCKED!', s.name);
        }
      }
    }
  }

  getSavedRuns() {
    try {
      const raw = localStorage.getItem(RUN_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && parsed.wave) {
        parsed.id = parsed.id || String(Date.now());
        return [parsed];
      }
      return [];
    } catch {
      return [];
    }
  }

  setSavedRuns(runs) {
    try {
      localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(runs));
    } catch {
      // ignore
    }
  }

  saveRunToMemory() {
    const runs = this.getSavedRuns();
    const now = new Date();
    const payload = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      savedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      wave: this.wave,
      score: this.score,
      echoCount: this.echoes.length,
      echoPowerMult: this.echoPowerMult,
      equippedSword: this.player.sword.id,
      player: {
        hp: Math.ceil(this.player.hp),
        maxHp: this.player.maxHp,
        moveSpeed: this.player.moveSpeed,
        attackDamage: this.player.attackDamage,
        knockbackForce: this.player.knockbackForce,
        lifesteal: this.player.lifesteal,
        slamRadius: this.player.slamRadius,
        slamDamage: this.player.slamDamage,
        slamMaxCooldown: this.player.slamMaxCooldown,
        dashMaxCooldown: this.player.dashMaxCooldown,
        bounceCount: this.player.bounceCount,
      },
    };
    runs.unshift(payload);
    this.setSavedRuns(runs);

    const statusEl = document.getElementById('save-status');
    if (statusEl) {
      statusEl.textContent = `Run Saved! (${payload.savedAt} • Wave ${payload.wave})`;
    }
    this.refreshLobbyUI();
    this.renderSavesList();
  }

  deleteSavedRun(id) {
    const runs = this.getSavedRuns().filter((r) => r.id !== id);
    this.setSavedRuns(runs);
    this.refreshLobbyUI();
    this.renderSavesList();
  }

  clearAllSaves() {
    try {
      localStorage.removeItem(RUN_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.refreshLobbyUI();
    this.renderSavesList();
    const statusEl = document.getElementById('save-status');
    if (statusEl) {
      statusEl.textContent = 'All saved runs cleared.';
    }
  }

  loadSavedRun(data) {
    if (!data) return;

    sfx.init();
    music.start();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    this.clearEntities();
    this.player.reset();
    Object.assign(this.player, data.player);
    this.player.equipSword(data.equippedSword || this.progression.equippedSword);
    this.progression.equippedSword = this.player.sword.id;
    this.saveProgression();

    this.score = data.score || 0;
    this.wave = Math.max(0, (data.wave || 1) - 1);
    this.echoPowerMult = data.echoPowerMult || 1;

    const echoCount = data.echoCount || 0;
    for (let i = 0; i < echoCount; i++) {
      const angle = (i / Math.max(1, echoCount)) * Math.PI * 2;
      const pos = new THREE.Vector3(Math.cos(angle) * 3, 0, Math.sin(angle) * 3);
      this.echoes.push(new EchoAlly(this.scene, this.particles, pos, this.echoPowerMult));
    }

    this.setSceneEnvironment('PLAYING');
    this.state = 'PLAYING';
    this.tryLockPointer();
    this.startNextWave();
    this.updateHUD();
  }

  setSceneEnvironment(mode) {
    const isLobby = mode === 'MENU';
    document.getElementById('lobby-backdrop').classList.toggle('hidden', !isLobby);
    this.arena.setLobbyMode(isLobby);

    if (isLobby) {
      this.scene.background = null;
      this.scene.fog = null;
    } else {
      this.scene.background = new THREE.Color(0x14141c);
      this.scene.fog = new THREE.FogExp2(0x14141c, 0.014);
    }
  }

  refreshLobbyUI() {
    const runs = this.getSavedRuns();
    const sword = this.player.sword;

    document.getElementById('top-saves-count').textContent = runs.length;
    document.getElementById('lobby-best-stats').textContent =
      `Best Wave: ${this.progression.bestWave} • High Score: ${this.progression.bestScore}`;

    document.getElementById('lobby-sword-title').textContent = sword.name;
    const dmgPct = Math.round(sword.stats.damageMult * 100);
    const spdPct = Math.round(sword.stats.speedMult * 100);
    document.getElementById('lobby-sword-stats').textContent =
      `${dmgPct}% Damage • ${sword.stats.range.toFixed(1)}m Reach • ${spdPct}% Speed`;

    document.getElementById('mode-sword-label').textContent = sword.name;

    // Render Right-Side Vertical Blade Rack
    const rack = document.getElementById('lobby-sword-rack');
    rack.innerHTML = '';

    for (const s of SWORDS) {
      const unlocked = s.checkUnlock(this.progression);
      const equipped = this.player.sword.id === s.id;

      const checkSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      const swordSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"></path><path d="M13 19l6-6"></path></svg>`;
      const lockSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

      const slot = document.createElement('button');
      slot.className = `rack-slot ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}`;
      slot.innerHTML = `
        <div class="slot-info">
          <div class="slot-name">${s.name}</div>
          <div class="slot-sub">${unlocked ? s.subtitle : s.unlockText}</div>
        </div>
        <div class="slot-badge">${equipped ? checkSvg : unlocked ? swordSvg : lockSvg}</div>
      `;

      slot.addEventListener('click', () => {
        sfx.init();
    music.start();
        if (unlocked) {
          this.player.equipSword(s.id);
          this.progression.equippedSword = s.id;
          this.saveProgression();
          sfx.swing();
          this.particles.burst(new THREE.Vector3(0.5, 1.1, 0.2), s.slashColor, 12, 3.5, 0.65);
          this.refreshLobbyUI();
          this.updateHUD();
        } else {
          this.openPauseMenu('MENU', 'armory');
        }
      });

      rack.appendChild(slot);
    }
  }

  initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.95);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
    dirLight.position.set(16, 28, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 90;
    const d = 28;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.renderer.domElement && this.state === 'PLAYING') {
        this.openPauseMenu('PLAYING', 'system');
      }
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyP' || e.code === 'KeyM') {
        if (this.state === 'PLAYING') {
          this.openPauseMenu('PLAYING', 'system');
          return;
        } else if (this.state === 'PAUSED') {
          this.closePauseMenu();
          return;
        }
      }

      if (this.state === 'PLAYING') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.player.jump();
        } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          this.player.dash(this.getMoveInput());
        } else if (e.code === 'KeyE' || e.code === 'KeyQ') {
          this.player.triggerSlam();
        } else if (e.code === 'KeyJ' || e.code === 'KeyF') {
          this.performAttack();
        }
      } else if (this.state === 'PERK_SELECT') {
        if (e.code === 'Digit1' && this.activePerks[0]) this.selectPerk(0);
        if (e.code === 'Digit2' && this.activePerks[1]) this.selectPerk(1);
        if (e.code === 'Digit3' && this.activePerks[2]) this.selectPerk(2);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (this.state === 'MENU') {
        this.isDraggingLobby = true;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingLobby = false;
    });

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING' || this.isTouchDevice) return;
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.tryLockPointer();
      }
      if (e.button === 0) {
        this.performAttack();
      } else if (e.button === 2) {
        this.player.dash(this.getMoveInput());
      }
    });

    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (this.state === 'MENU' && this.isDraggingLobby) {
        this.lobbyCharYaw += e.movementX * 0.008;
        return;
      }
      if (this.state !== 'PLAYING') return;
      if (document.pointerLockElement === this.renderer.domElement) {
        this.cameraYaw -= e.movementX * 0.0028;
        this.cameraPitch = THREE.MathUtils.clamp(
          this.cameraPitch + e.movementY * 0.0022,
          0.16,
          1.15
        );
      }
    });

    // Lobby Buttons
    document.getElementById('start-btn').addEventListener('click', () => {
      sfx.init();
      sfx.uiClick();
      music.start();
      this.startGame();
    });
    const toggleMusicUI = () => {
      sfx.init();
      sfx.uiClick();
      const playing = music.toggle();
      const pathsOn = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
      const pathsOff = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
      document.getElementById('top-music-svg').innerHTML = playing ? pathsOn : pathsOff;
      document.getElementById('hud-music-svg').innerHTML = playing ? pathsOn : pathsOff;
    };
    document.getElementById('top-music-btn').addEventListener('click', toggleMusicUI);
    document.getElementById('hud-music-btn').addEventListener('click', toggleMusicUI);
    document.getElementById('start-saves-btn').addEventListener('click', () => {
      sfx.init();
      sfx.uiClick();
      this.openPauseMenu('MENU', 'saves');
    });
    document.getElementById('top-saves-btn').addEventListener('click', () => {
      sfx.init();
      sfx.uiClick();
      this.openPauseMenu('MENU', 'saves');
    });
    document.getElementById('start-armory-btn').addEventListener('click', () => {
      sfx.init();
      sfx.uiClick();
      this.openPauseMenu('MENU', 'armory');
    });
    document.getElementById('top-fullscreen-btn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });

    // HUD & Pause Menu Buttons
    document.getElementById('hud-menu-btn').addEventListener('click', () => {
      if (this.state === 'PLAYING') this.openPauseMenu('PLAYING', 'system');
    });
    document.getElementById('resume-btn').addEventListener('click', () => this.closePauseMenu());
    document.getElementById('save-btn').addEventListener('click', () => this.saveRunToMemory());
    document.getElementById('open-saves-btn').addEventListener('click', () => this.switchPauseTab('saves'));
    document.getElementById('saves-new-save-btn').addEventListener('click', () => this.saveRunToMemory());
    document.getElementById('clear-saves-btn').addEventListener('click', () => this.clearAllSaves());
    document.getElementById('saves-back-btn').addEventListener('click', () => {
      if (this.pauseOrigin === 'MENU') {
        this.closePauseMenu();
      } else {
        this.switchPauseTab('system');
      }
    });
    document.getElementById('restart-btn').addEventListener('click', () => {
      document.getElementById('pause-screen').classList.add('hidden');
      this.startGame();
    });
    document.getElementById('main-menu-btn').addEventListener('click', () => this.returnToMainMenu());
    document.getElementById('armory-back-btn').addEventListener('click', () => {
      if (this.pauseOrigin === 'MENU') {
        this.closePauseMenu();
      } else {
        this.switchPauseTab('system');
      }
    });

    document.getElementById('tab-system-btn').addEventListener('click', () => this.switchPauseTab('system'));
    document.getElementById('tab-saves-btn').addEventListener('click', () => this.switchPauseTab('saves'));
    document.getElementById('tab-armory-btn').addEventListener('click', () => this.switchPauseTab('armory'));

    this.setupTouchControls();
  }

  tryLockPointer() {
    if (this.isTouchDevice) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignore on browsers that disallow pointer lock
    }
  }

  setupTouchControls() {
    const enableTouchMode = () => {
      if (!this.isTouchDevice) {
        this.isTouchDevice = true;
        document.body.classList.add('touch-mode');
      }
    };
    window.addEventListener('touchstart', enableTouchMode, { once: true, passive: true });

    const joystick = document.getElementById('touch-joystick');
    const knob = document.getElementById('touch-joystick-knob');
    let joyTouchId = null;
    const maxRadius = 42;

    const updateJoystick = (touch) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove.x = dx / maxRadius;
      this.touchMove.y = dy / maxRadius;
    };

    const resetJoystick = () => {
      joyTouchId = null;
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
    };

    joystick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      enableTouchMode();
      if (joyTouchId === null && e.changedTouches.length > 0) {
        joyTouchId = e.changedTouches[0].identifier;
        updateJoystick(e.changedTouches[0]);
      }
    }, { passive: false });

    joystick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) updateJoystick(t);
      }
    }, { passive: false });

    const onJoyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) resetJoystick();
      }
    };
    joystick.addEventListener('touchend', onJoyEnd);
    joystick.addEventListener('touchcancel', onJoyEnd);

    const bindAction = (id, fn) => {
      const btn = document.getElementById(id);
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        enableTouchMode();
        sfx.init();
        if (this.state === 'PLAYING') fn();
      }, { passive: false });
    };

    bindAction('touch-slash-btn', () => this.performAttack());
    bindAction('touch-jump-btn', () => this.player.jump());
    bindAction('touch-dash-btn', () => this.player.dash(this.getMoveInput()));
    bindAction('touch-slam-btn', () => this.player.triggerSlam());

    // Multi-touch camera aim & lobby character spin on canvas
    let lookTouchId = null;
    let lastLookX = 0;
    let lastLookY = 0;

    this.renderer.domElement.addEventListener('touchstart', (e) => {
      enableTouchMode();
      if (lookTouchId !== null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== joyTouchId) {
          lookTouchId = t.identifier;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
          break;
        }
      }
    }, { passive: true });

    this.renderer.domElement.addEventListener('touchmove', (e) => {
      if (this.state !== 'PLAYING' && this.state !== 'MENU') return;
      for (const t of e.changedTouches) {
        if (t.identifier !== lookTouchId) continue;
        e.preventDefault();
        const dx = t.clientX - lastLookX;
        const dy = t.clientY - lastLookY;
        lastLookX = t.clientX;
        lastLookY = t.clientY;

        if (this.state === 'MENU') {
          this.lobbyCharYaw += dx * 0.01;
        } else if (this.state === 'PLAYING') {
          this.cameraYaw -= dx * 0.0055;
          this.cameraPitch = THREE.MathUtils.clamp(
            this.cameraPitch + dy * 0.004,
            0.16,
            1.15
          );
        }
      }
    }, { passive: false });

    const endLook = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    };
    this.renderer.domElement.addEventListener('touchend', endLook);
    this.renderer.domElement.addEventListener('touchcancel', endLook);
  }

  openPauseMenu(origin = 'PLAYING', tab = 'system') {
    this.pauseOrigin = origin;
    this.state = 'PAUSED';
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    document.getElementById('save-status').textContent = '';
    document.getElementById('tab-system-btn').classList.toggle('hidden', origin === 'MENU');
    document.getElementById('saves-new-save-btn').classList.toggle('hidden', origin === 'MENU');
    document.getElementById('resume-btn').textContent = origin === 'MENU' ? 'Back' : 'Resume Fight';

    const strip = document.getElementById('pause-stats-strip');
    strip.innerHTML = `
      <div class="mini-stat"><div class="k">Wave</div><div class="v">${this.wave}</div></div>
      <div class="mini-stat"><div class="k">Score</div><div class="v">${this.score}</div></div>
      <div class="mini-stat"><div class="k">Bounce Backs</div><div class="v">${this.player.bounceCount}</div></div>
      <div class="mini-stat"><div class="k">Echoes</div><div class="v">${this.echoes.length}</div></div>
    `;

    this.renderSavesList();
    this.renderArmory();
    this.switchPauseTab(tab);
    document.getElementById('pause-screen').classList.remove('hidden');
  }

  closePauseMenu() {
    document.getElementById('pause-screen').classList.add('hidden');
    if (this.pauseOrigin === 'MENU') {
      this.state = 'MENU';
      this.refreshLobbyUI();
    } else {
      this.state = 'PLAYING';
      this.tryLockPointer();
      this.updateHUD();
    }
  }

  returnToMainMenu() {
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.clearEntities();
    this.player.reset();
    this.player.equipSword(this.progression.equippedSword);
    this.setSceneEnvironment('MENU');
    this.refreshLobbyUI();
    this.state = 'MENU';
  }

  switchPauseTab(tab) {
    document.getElementById('tab-system').classList.toggle('hidden', tab !== 'system');
    document.getElementById('tab-saves').classList.toggle('hidden', tab !== 'saves');
    document.getElementById('tab-armory').classList.toggle('hidden', tab !== 'armory');
    document.getElementById('tab-system-btn').classList.toggle('active', tab === 'system');
    document.getElementById('tab-saves-btn').classList.toggle('active', tab === 'saves');
    document.getElementById('tab-armory-btn').classList.toggle('active', tab === 'armory');
    if (tab === 'saves') this.renderSavesList();
  }

  renderSavesList() {
    const list = document.getElementById('saves-list');
    const runs = this.getSavedRuns();
    const clearBtn = document.getElementById('clear-saves-btn');
    if (clearBtn) clearBtn.disabled = runs.length === 0;

    list.innerHTML = '';

    if (runs.length === 0) {
      list.innerHTML = `<div class="saves-empty">No saved runs yet.<br/>Click "Save Current Run" during any match to store a snapshot here.</div>`;
      return;
    }

    runs.forEach((run, index) => {
      const sword = getSwordById(run.equippedSword);
      const row = document.createElement('div');
      row.className = 'save-row';
      row.innerHTML = `
        <div>
          <div class="save-title">Save #${runs.length - index} • Wave ${run.wave} (${run.savedAt || 'Saved'})</div>
          <div class="save-details">
            Score: ${run.score} • Bounce Backs: ${run.player?.bounceCount || 0} • Echoes: ${run.echoCount || 0}<br/>
            HP: ${run.player?.hp || 100}/${run.player?.maxHp || 100} • Sword: ${sword.name}
          </div>
        </div>
        <div class="save-actions">
          <button class="btn btn-primary load-save-btn">Load</button>
          <button class="btn btn-danger delete-save-btn">Delete</button>
        </div>
      `;

      row.querySelector('.load-save-btn').addEventListener('click', () => {
        this.loadSavedRun(run);
      });
      row.querySelector('.delete-save-btn').addEventListener('click', () => {
        this.deleteSavedRun(run.id);
      });

      list.appendChild(row);
    });
  }

  renderArmory() {
    const grid = document.getElementById('armory-grid');
    grid.innerHTML = '';

    for (const sword of SWORDS) {
      const unlocked = sword.checkUnlock(this.progression);
      const equipped = this.player.sword.id === sword.id;

      const card = document.createElement('div');
      card.className = `sword-card ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}`;

      const dmgPct = Math.round(sword.stats.damageMult * 100);
      const spdPct = Math.round(sword.stats.speedMult * 100);

      card.innerHTML = `
        <div>
          <div class="sword-name">${sword.name}</div>
          <div class="sword-sub">${sword.subtitle}</div>
          <div class="sword-stats" style="margin-top:8px;">
            Damage: ${dmgPct}% • Reach: ${sword.stats.range.toFixed(1)}m<br/>
            Speed: ${spdPct}% • Cooldown: ${sword.stats.cooldown}s
          </div>
        </div>
        <div>
          ${
            unlocked
              ? `<button class="btn ${equipped ? 'btn-secondary' : 'btn-primary'}" style="width:100%;padding:10px;" ${
                  equipped ? 'disabled' : ''
                }>${equipped ? 'Equipped' : 'Equip Sword'}</button>`
              : `<div class="sword-unlock">Locked: ${sword.unlockText}</div>`
          }
        </div>
      `;

      if (unlocked && !equipped) {
        card.querySelector('button').addEventListener('click', () => {
          this.player.equipSword(sword.id);
          this.progression.equippedSword = sword.id;
          this.saveProgression();
          this.renderArmory();
          this.refreshLobbyUI();
          this.updateHUD();
        });
      }

      grid.appendChild(card);
    }
  }

  startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    this.score = 0;
    this.wave = 0;
    this.echoPowerMult = 1;
    this.player.reset();
    this.player.equipSword(this.progression.equippedSword);
    this.clearEntities();

    this.setSceneEnvironment('PLAYING');
    this.state = 'PLAYING';
    this.tryLockPointer();
    this.startNextWave();
    this.updateHUD();
  }

  clearEntities() {
    for (const e of this.enemies) {
      if (!e.dead) {
        this.scene.remove(e.group);
      }
    }
    for (const echo of this.echoes) {
      echo.destroy();
    }
    this.enemies = [];
    this.echoes = [];
    this.particles.clear();
  }

  showBanner(title, sub) {
    const banner = document.getElementById('wave-banner');
    document.getElementById('wave-banner-title').textContent = title;
    document.getElementById('wave-banner-sub').textContent = sub;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 2000);
  }

  startNextWave() {
    this.wave++;
    this.checkSwordUnlocks();
    sfx.waveStart();

    const rareBossSpawn = Math.random() < 0.05;

    this.showBanner(
      `WAVE ${this.wave}`,
      rareBossSpawn ? 'RARE BOSS INCOMING!' : this.wave % 3 === 0 ? 'Boss Incoming!' : 'Clear the Arena!'
    );

    const waveScale = 1 + (this.wave - 1) * 0.16;
    const swarmerCount = 4 + this.wave * 2;
    const chargerCount = this.wave >= 2 ? Math.floor(this.wave * 0.8) : 0;
    const bruteCount = this.wave >= 3 ? Math.floor((this.wave - 1) / 2) : 0;

    const spawnAtEdge = (type) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = ARENA_RADIUS - 3.5;
      const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.enemies.push(new Enemy(this.scene, this.particles, type, pos, waveScale));
      this.particles.burst(pos, 0xffb82e, 8, 5, 0.7);
    };

    for (let i = 0; i < swarmerCount; i++) spawnAtEdge('swarmer');
    for (let i = 0; i < chargerCount; i++) spawnAtEdge('charger');
    for (let i = 0; i < bruteCount; i++) spawnAtEdge('brute');
    if (this.wave % 3 === 0) spawnAtEdge('boss');
    if (rareBossSpawn) spawnAtEdge('rare_boss');
  }

  getMoveInput() {
    let forward = -this.touchMove.y;
    let right = this.touchMove.x;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) right += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) right -= 1;

    if (Math.abs(forward) < 0.05 && Math.abs(right) < 0.05) return new THREE.Vector3();

    const camForward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const camRight = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

    const vec = new THREE.Vector3()
      .addScaledVector(camForward, forward)
      .addScaledVector(camRight, right);
    if (vec.lengthSq() > 1) vec.normalize();
    return vec;
  }

  spawnDamagePopup(worldPos, text, color = '#ffcb1f') {
    const vec = worldPos.clone();
    vec.y += 1.6;
    vec.project(this.camera);
    if (vec.z > 1) return;

    const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vec.y * 0.5) + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = 'dmg-popup';
    el.textContent = text;
    el.style.left = `${x + (Math.random() - 0.5) * 24}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  performAttack() {
    this.player.attack(this.enemies, (enemy, dmg) => {
      this.cameraShake = Math.max(this.cameraShake, 0.22);
      this.spawnDamagePopup(enemy.pos, `${dmg}`, '#ffcb1f');
      if (enemy.dead) {
        this.score += enemy.scoreValue;
        this.checkSwordUnlocks();
      }
    });
  }

  handleSlamImpact(pos, radius, damage) {
    this.cameraShake = 0.65;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const toEnemy = new THREE.Vector3().subVectors(enemy.pos, pos);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist <= radius + enemy.radius) {
        const dir = dist > 0.01 ? toEnemy.normalize() : new THREE.Vector3(0, 0, 1);
        enemy.takeDamage(damage, dir, 22);
        this.spawnDamagePopup(enemy.pos, `${damage}!`, '#38bdf8');
        if (enemy.dead) {
          this.score += enemy.scoreValue;
          this.checkSwordUnlocks();
        }
      }
    }
  }

  triggerBounceBack() {
    this.player.bounceBackRevive();
    this.progression.totalBounces++;
    this.saveProgression();
    this.checkSwordUnlocks();
    this.cameraShake = 0.75;

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const toEnemy = new THREE.Vector3().subVectors(enemy.pos, this.player.pos);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist < 11) {
        const dir = dist > 0.01 ? toEnemy.normalize() : new THREE.Vector3(0, 0, 1);
        enemy.takeDamage(25, dir, 24);
        if (enemy.dead) this.score += enemy.scoreValue;
      }
    }

    if (this.echoes.length < 8) {
      this.echoes.push(
        new EchoAlly(this.scene, this.particles, this.player.pos, this.echoPowerMult)
      );
    } else {
      this.echoPowerMult *= 1.2;
      for (const echo of this.echoes) echo.powerMult = this.echoPowerMult;
    }

    const flash = document.getElementById('bounce-flash');
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 1500);

    this.openPerkModal();
  }

  openPerkModal() {
    this.state = 'PERK_SELECT';
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const shuffled = [...PERK_POOL].sort(() => Math.random() - 0.5);
    this.activePerks = shuffled.slice(0, 3);

    const container = document.getElementById('perk-cards');
    container.innerHTML = '';

    this.activePerks.forEach((perk, idx) => {
      const card = document.createElement('button');
      card.className = 'perk-card';
      card.innerHTML = `
        <div class="perk-key">${idx + 1}</div>
        <div class="perk-tag">${perk.tag}</div>
        <div class="perk-name">${perk.name}</div>
        <div class="perk-desc">${perk.desc}</div>
      `;
      card.addEventListener('click', () => this.selectPerk(idx));
      container.appendChild(card);
    });

    document.getElementById('perk-screen').classList.remove('hidden');
  }

  selectPerk(index) {
    const perk = this.activePerks[index];
    if (!perk) return;
    perk.apply(this);
    document.getElementById('perk-screen').classList.add('hidden');
    this.state = 'PLAYING';
    this.tryLockPointer();
    this.updateHUD();
  }

  updateHUD() {
    document.getElementById('wave-num').textContent = this.wave;
    document.getElementById('score-num').textContent = this.score;
    document.getElementById('bounce-num').textContent = this.player.bounceCount;
    document.getElementById('echo-num').textContent = this.echoes.length;
    document.getElementById('hud-sword-name').textContent = this.player.sword.name;

    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    const hpFill = document.getElementById('hp-bar-fill');
    hpFill.style.width = `${hpPct}%`;
    hpFill.classList.toggle('low', hpPct <= 30);
    document.getElementById('hp-text').textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;

    if (this._lastHudHp !== undefined && this.player.hp < this._lastHudHp) {
      const hpBox = document.getElementById('hud-hp-box');
      hpBox.classList.remove('hurt-shake');
      void hpBox.offsetWidth;
      hpBox.classList.add('hurt-shake');
    }
    this._lastHudHp = this.player.hp;

    const dashPct = (1 - this.player.dashCooldown / this.player.dashMaxCooldown) * 100;
    document.getElementById('dash-bar-fill').style.width = `${Math.min(100, Math.max(0, dashPct))}%`;

    const slamPct = (1 - this.player.slamCooldown / this.player.slamMaxCooldown) * 100;
    document.getElementById('slam-bar-fill').style.width = `${Math.min(100, Math.max(0, slamPct))}%`;
  }

  updateCamera(dt) {
    const isLobby = this.state === 'MENU' || (this.state === 'PAUSED' && this.pauseOrigin === 'MENU');
    if (isLobby) {
      // Frame the 3D character standing center-right on the lobby screen!
      const lobbyCamPos = new THREE.Vector3(-0.35, 1.28, 3.45);
      this.camera.position.lerp(lobbyCamPos, Math.min(1, 10 * dt));
      this.camera.lookAt(-0.32, 1.05, 0);
      return;
    }

    const dist = 10.5;
    const height = Math.sin(this.cameraPitch) * dist + 2.2;
    const horiz = Math.cos(this.cameraPitch) * dist;

    const targetPos = new THREE.Vector3(
      this.player.pos.x + Math.sin(this.cameraYaw) * horiz,
      this.player.pos.y + height,
      this.player.pos.z + Math.cos(this.cameraYaw) * horiz
    );

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
      targetPos.x += (Math.random() - 0.5) * this.cameraShake;
      targetPos.y += (Math.random() - 0.5) * this.cameraShake;
    }

    this.camera.position.lerp(targetPos, Math.min(1, 12 * dt));
    const lookTarget = new THREE.Vector3(
      this.player.pos.x,
      this.player.pos.y + 1.3,
      this.player.pos.z
    );
    this.camera.lookAt(lookTarget);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const time = now * 0.001;

    if (this.state !== 'PAUSED') {
      this.arena.update(dt, time);
      this.particles.update(dt);
    }

    if (this.state === 'PLAYING') {
      const moveInput = this.getMoveInput();
      this.player.update(dt, moveInput, this.arena, this.enemies, (pos, r, dmg) =>
        this.handleSlamImpact(pos, r, dmg)
      );

      for (const echo of this.echoes) {
        echo.update(dt, time, this.enemies, this.echoes, (enemy, dmg) => {
          this.spawnDamagePopup(enemy.pos, `${dmg}`, '#4ade80');
          if (enemy.dead) {
            this.score += enemy.scoreValue;
            this.checkSwordUnlocks();
          }
        });
      }

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.dead) {
          this.enemies.splice(i, 1);
          continue;
        }
        e.update(dt, this.player.pos, this.player, this.enemies, this.arena, this.camera.position);
      }

      if (this.player.hp <= 0) {
        this.triggerBounceBack();
      }

      if (this.enemies.length === 0) {
        this.waveCooldown += dt;
        if (this.waveCooldown >= 1.4) {
          this.waveCooldown = 0;
          this.startNextWave();
        }
      }

      this.updateHUD();
    } else if (this.state === 'MENU' || (this.state === 'PAUSED' && this.pauseOrigin === 'MENU')) {
      this.player.updateLobbyPose(dt, time);
      this.player.group.rotation.y = this.lobbyCharYaw;
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
