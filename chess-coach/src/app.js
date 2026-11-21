import { Chess } from 'chess.js';
import { PIECE_SVGS, detectOpening, SAMPLE_GAMES, OPENING_DRILLS } from './pieces.js';
import {
  StockfishEngine,
  formatEval,
  uciPvToSan,
  classifyMove,
  buildDeepCoaching,
  findHangingPieces,
} from './engine.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

class ChessCoachApp {
  constructor() {
    this.engine = new StockfishEngine((statusText) => {
      document.getElementById('engine-status-text').textContent = statusText;
    });

    this.flipped = false;
    this.currentPly = 0;
    this.positions = []; // index 0 = initial, index i = after ply i
    this.selectedSquare = null;
    this.retryMode = false;
    this.retryTargetUci = null;
    this.analysisRunId = 0;
    this.headers = { White: 'White Player', Black: 'Black Player', WhiteElo: '', BlackElo: '' };
    this.opening = { name: 'Starting Position', bookPly: 0 };

    // Opening Trainer vs AI state
    this.trainerActive = false;
    this.trainerDrill = OPENING_DRILLS[0];
    this.trainerMode = 'guided'; // 'guided' or 'free'
    this.trainerHintUci = null;
    this.aiThinking = false;

    this.bindUI();
    this.populateSamples();
    this.populateTrainerOpenings();
    // Auto-load Sample Game 1 so the user can explore immediately
    this.loadPgnGame(SAMPLE_GAMES[0].pgn);
  }

  bindUI() {
    document.getElementById('btn-first').addEventListener('click', () => this.goToPly(0));
    document.getElementById('btn-prev').addEventListener('click', () => this.goToPly(this.currentPly - 1));
    document.getElementById('btn-next').addEventListener('click', () => this.goToPly(this.currentPly + 1));
    document.getElementById('btn-last').addEventListener('click', () => this.goToPly(this.positions.length - 1));
    document.getElementById('btn-flip').addEventListener('click', () => {
      this.flipped = !this.flipped;
      this.updatePlayerBars();
      this.renderBoard();
    });

    document.getElementById('btn-next-mistake').addEventListener('click', () => this.jumpToNextMistake());
    document.getElementById('btn-retry').addEventListener('click', () => this.startRetryMode());
    document.getElementById('btn-show-line').addEventListener('click', () => this.previewBestLine());

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') this.goToPly(this.currentPly - 1);
      else if (e.key === 'ArrowRight') this.goToPly(this.currentPly + 1);
      else if (e.key === 'Home') this.goToPly(0);
      else if (e.key === 'End') this.goToPly(this.positions.length - 1);
      else if (e.key === 'f' || e.key === 'F') {
        this.flipped = !this.flipped;
        this.updatePlayerBars();
        this.renderBoard();
      }
    });

    document.getElementById('depth-select').addEventListener('change', () => {
      if (this.positions.length > 1) this.analyzeAllPositions();
    });

    // Lower Panel Tabs
    document.querySelectorAll('.ptab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.switchPanelTab(btn.dataset.ptab);
      });
    });

    document.getElementById('open-trainer-btn').addEventListener('click', () => {
      this.switchPanelTab('trainer');
      this.startOpeningTrainer();
    });

    document.getElementById('trainer-opening-select').addEventListener('change', (e) => {
      const drill = OPENING_DRILLS.find((d) => d.id === e.target.value) || OPENING_DRILLS[0];
      this.trainerDrill = drill;
      this.renderTrainerCard();
    });

    document.getElementById('trainer-mode-select').addEventListener('change', (e) => {
      this.trainerMode = e.target.value;
    });

    document.getElementById('trainer-start-btn').addEventListener('click', () => this.startOpeningTrainer());
    document.getElementById('trainer-hint-btn').addEventListener('click', () => this.showTrainerBookHint());
    document.getElementById('trainer-undo-btn').addEventListener('click', () => this.undoTrainerMove());

    // Eval Chart Click to Jump
    const chart = document.getElementById('eval-chart');
    chart.addEventListener('click', (e) => {
      if (this.positions.length <= 1) return;
      const rect = chart.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetPly = Math.round(pct * (this.positions.length - 1));
      this.goToPly(targetPly);
    });

    // Ask Coach Q&A
    document.querySelectorAll('.q-chip').forEach((chip) => {
      chip.addEventListener('click', () => this.handleAskCoach(chip.dataset.q, chip.textContent));
    });
    document.getElementById('ask-send-btn').addEventListener('click', () => {
      const inp = document.getElementById('ask-input');
      const q = inp.value.trim();
      if (!q) return;
      inp.value = '';
      this.handleAskCoach('custom', q);
    });
    document.getElementById('ask-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('ask-send-btn').click();
    });

    // Import Modal
    const modal = document.getElementById('import-modal');
    document.getElementById('open-import-btn').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('close-import-btn').addEventListener('click', () => modal.classList.add('hidden'));

    document.querySelectorAll('.itab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.itab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.itab;
        ['chesscom', 'lichess', 'pgn', 'samples'].forEach((id) => {
          document.getElementById(`itab-${id}`).classList.toggle('hidden', id !== tab);
        });
      });
    });

    document.getElementById('fetch-chesscom-btn').addEventListener('click', () => this.fetchChessComGames());
    document.getElementById('fetch-lichess-btn').addEventListener('click', () => this.fetchLichessGames());
    document.getElementById('load-pgn-btn').addEventListener('click', () => {
      const raw = document.getElementById('pgn-textarea').value.trim();
      if (!raw) return;
      const color = document.getElementById('pgn-color-select').value;
      this.flipped = color === 'b';
      this.loadPgnGame(raw);
      modal.classList.add('hidden');
    });
  }

  populateSamples() {
    const container = document.getElementById('sample-games-list');
    container.innerHTML = '';
    SAMPLE_GAMES.forEach((g) => {
      const el = document.createElement('div');
      el.className = 'game-item';
      el.innerHTML = `
        <div>
          <div class="game-meta">${g.title}</div>
          <div class="game-sub">${g.white} vs ${g.black} — ${g.sub}</div>
        </div>
        <button class="primary-btn" type="button">Analyze</button>
      `;
      el.querySelector('button').addEventListener('click', () => {
        this.loadPgnGame(g.pgn);
        document.getElementById('import-modal').classList.add('hidden');
      });
      container.appendChild(el);
    });
  }

  async fetchChessComGames() {
    const user = document.getElementById('chesscom-user').value.trim().toLowerCase();
    const list = document.getElementById('chesscom-results');
    if (!user) return;
    list.innerHTML = `<div class="game-sub">Fetching archives for ${user}...</div>`;

    try {
      const archRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
      if (!archRes.ok) throw new Error('User not found on Chess.com');
      const archData = await archRes.json();
      const archives = archData.archives || [];
      if (!archives.length) throw new Error('No public game archives found');

      const latestUrl = archives[archives.length - 1];
      const gamesRes = await fetch(latestUrl);
      const gamesData = await gamesRes.json();
      const games = (gamesData.games || []).filter((g) => g.pgn).reverse().slice(0, 18);

      list.innerHTML = '';
      for (const g of games) {
        const w = g.white?.username || 'White';
        const b = g.black?.username || 'Black';
        const wElo = g.white?.rating ? `(${g.white.rating})` : '';
        const bElo = g.black?.rating ? `(${g.black.rating})` : '';
        const isBlack = b.toLowerCase() === user;

        const row = document.createElement('div');
        row.className = 'game-item';
        row.innerHTML = `
          <div>
            <div class="game-meta">${w} ${wElo} vs ${b} ${bElo}</div>
            <div class="game-sub">${g.time_class || 'chess'} • ${new Date((g.end_time || 0) * 1000).toLocaleDateString()}</div>
          </div>
          <button class="primary-btn" type="button">Analyze</button>
        `;
        row.querySelector('button').addEventListener('click', () => {
          this.flipped = isBlack;
          this.loadPgnGame(g.pgn);
          document.getElementById('import-modal').classList.add('hidden');
        });
        list.appendChild(row);
      }
    } catch (err) {
      list.innerHTML = `<div class="game-sub" style="color:#fca5a5">${err.message || 'Could not load Chess.com games'}</div>`;
    }
  }

  async fetchLichessGames() {
    const user = document.getElementById('lichess-user').value.trim();
    const list = document.getElementById('lichess-results');
    if (!user) return;
    list.innerHTML = `<div class="game-sub">Fetching games from Lichess for ${user}...</div>`;

    try {
      const res = await fetch(
        `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=15&pgnInJson=true`,
        { headers: { Accept: 'application/x-ndjson' } }
      );
      if (!res.ok) throw new Error('User not found on Lichess');
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      list.innerHTML = '';

      for (const line of lines) {
        const g = JSON.parse(line);
        if (!g.pgn) continue;
        const w = g.players?.white?.user?.name || 'White';
        const b = g.players?.black?.user?.name || 'Black';
        const wElo = g.players?.white?.rating ? `(${g.players.white.rating})` : '';
        const bElo = g.players?.black?.rating ? `(${g.players.black.rating})` : '';
        const isBlack = b.toLowerCase() === user.toLowerCase();

        const row = document.createElement('div');
        row.className = 'game-item';
        row.innerHTML = `
          <div>
            <div class="game-meta">${w} ${wElo} vs ${b} ${bElo}</div>
            <div class="game-sub">${g.speed || 'standard'} • ${g.opening?.name || ''}</div>
          </div>
          <button class="primary-btn" type="button">Analyze</button>
        `;
        row.querySelector('button').addEventListener('click', () => {
          this.flipped = isBlack;
          this.loadPgnGame(g.pgn);
          document.getElementById('import-modal').classList.add('hidden');
        });
        list.appendChild(row);
      }
    } catch (err) {
      list.innerHTML = `<div class="game-sub" style="color:#fca5a5">${err.message || 'Could not load Lichess games'}</div>`;
    }
  }

  loadPgnGame(rawText) {
    const chess = new Chess();
    let loaded = false;

    try {
      chess.loadPgn(rawText);
      loaded = chess.history().length > 0;
    } catch {
      loaded = false;
    }

    if (!loaded) {
      try {
        chess.load(rawText);
        loaded = true;
      } catch {
        alert('Could not parse that PGN or FEN. Please check the move text.');
        return;
      }
    }

    const hdrs = chess.header();
    this.headers = {
      White: hdrs.White || 'White Player',
      Black: hdrs.Black || 'Black Player',
      WhiteElo: hdrs.WhiteElo ? `(${hdrs.WhiteElo})` : '',
      BlackElo: hdrs.BlackElo ? `(${hdrs.BlackElo})` : '',
    };

    const verboseHistory = chess.history({ verbose: true });
    const sanHistory = verboseHistory.map((m) => m.san);
    this.opening = detectOpening(sanHistory);
    document.getElementById('opening-badge').textContent = this.opening.name;

    // Replay from start to build position snapshots
    const replay = new Chess();
    this.positions = [
      {
        ply: 0,
        fen: replay.fen(),
        san: 'Start',
        from: null,
        to: null,
        moverColor: null,
        cpWhite: 20,
        mateWhite: null,
        bestMoveUci: null,
        pv: [],
        classification: null,
        coaching: null,
      },
    ];

    verboseHistory.forEach((m, idx) => {
      const prevFen = replay.fen();
      replay.move(m);
      this.positions.push({
        ply: idx + 1,
        prevFen,
        fen: replay.fen(),
        san: m.san,
        from: m.from,
        to: m.to,
        playedUci: `${m.from}${m.to}${m.promotion || ''}`,
        moverColor: m.color,
        cpWhite: 0,
        mateWhite: null,
        bestMoveUci: null,
        pv: [],
        classification: null,
        coaching: null,
      });
    });

    this.currentPly = 0;
    this.retryMode = false;
    this.trainerActive = false;
    this.trainerHintUci = null;
    this.updatePlayerBars();
    this.renderMovesList();
    this.goToPly(0);
    this.analyzeAllPositions();
  }

  async analyzeAllPositions() {
    const runId = ++this.analysisRunId;
    const depth = parseInt(document.getElementById('depth-select').value, 10) || 12;

    const progBox = document.getElementById('analysis-progress-box');
    const progFill = document.getElementById('analysis-progress-fill');
    const progPct = document.getElementById('analysis-progress-pct');
    progBox.classList.remove('hidden');

    for (let i = 0; i < this.positions.length; i++) {
      if (runId !== this.analysisRunId) return;
      const pos = this.positions[i];
      const res = await this.engine.evaluateFen(pos.fen, depth);
      if (runId !== this.analysisRunId) return;

      pos.cpWhite = res.cpWhite;
      pos.mateWhite = res.mateWhite;
      pos.bestMoveUci = res.bestMoveUci;
      pos.pv = res.pv || [];

      if (i > 0) {
        const prev = this.positions[i - 1];
        const bestSanList = uciPvToSan(prev.fen, prev.pv, 5);
        const punishSanList = uciPvToSan(pos.fen, pos.pv, 5);
        pos.bestSan = bestSanList[0] || null;
        pos.pvSan = bestSanList;
        pos.punishPvSan = punishSanList;

        pos.classification = classifyMove({
          ply: i,
          bookPly: this.opening.bookPly,
          moverColor: pos.moverColor,
          prevCpWhite: prev.cpWhite,
          afterCpWhite: pos.cpWhite,
          bestMoveUci: prev.bestMoveUci,
          playedUci: pos.playedUci,
          prevFen: prev.fen,
          afterFen: pos.fen,
        });

        pos.coaching = buildDeepCoaching({
          ply: i,
          san: pos.san,
          from: pos.from,
          to: pos.to,
          moverColor: pos.moverColor,
          prevFen: prev.fen,
          afterFen: pos.fen,
          prevCpWhite: prev.cpWhite,
          afterCpWhite: pos.cpWhite,
          bestSan: pos.bestSan,
          pvSan: pos.pvSan,
          punishPvSan: pos.punishPvSan,
          classification: pos.classification,
        });
      }

      const pct = Math.round(((i + 1) / this.positions.length) * 100);
      progFill.style.width = `${pct}%`;
      progPct.textContent = `${pct}%`;

      this.drawEvalChart();
      this.renderMovesList();
      if (i === this.currentPly) {
        this.renderCurrentStepDetails();
      }
    }

    progBox.classList.add('hidden');
    this.renderReportCard();
    this.renderCurrentStepDetails();
  }

  updatePlayerBars() {
    const topIsBlack = !this.flipped;
    document.getElementById('top-color-dot').className = `color-dot ${topIsBlack ? 'black' : 'white'}`;
    document.getElementById('top-player-name').textContent = topIsBlack ? this.headers.Black : this.headers.White;
    document.getElementById('top-player-elo').textContent = topIsBlack ? this.headers.BlackElo : this.headers.WhiteElo;

    document.getElementById('bottom-color-dot').className = `color-dot ${topIsBlack ? 'white' : 'black'}`;
    document.getElementById('bottom-player-name').textContent = topIsBlack ? this.headers.White : this.headers.Black;
    document.getElementById('bottom-player-elo').textContent = topIsBlack ? this.headers.WhiteElo : this.headers.BlackElo;
  }

  goToPly(ply) {
    if (!this.positions.length) return;
    this.currentPly = Math.max(0, Math.min(this.positions.length - 1, ply));
    this.selectedSquare = null;
    this.retryMode = false;
    this.renderBoard();
    this.renderCurrentStepDetails();
    this.drawEvalChart();
    this.highlightActiveMoveCell();
  }

  squareToCoords(sq) {
    const fileIdx = FILES.indexOf(sq[0]);
    const rankIdx = 8 - parseInt(sq[1], 10);
    const col = this.flipped ? 7 - fileIdx : fileIdx;
    const row = this.flipped ? 7 - rankIdx : rankIdx;
    return { col, row, x: col * 100 + 50, y: row * 100 + 50 };
  }

  renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    const pos = this.positions[this.currentPly];
    if (!pos) return;

    const chess = new Chess(pos.fen);
    const board = chess.board();
    const legalTargets = new Set();

    if (this.selectedSquare) {
      const moves = chess.moves({ square: this.selectedSquare, verbose: true });
      moves.forEach((m) => legalTargets.add(m.to));
    }

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const r = this.flipped ? 7 - displayRow : displayRow;
        const c = this.flipped ? 7 - displayCol : displayCol;
        const sqName = `${FILES[c]}${8 - r}`;
        const isLight = (r + c) % 2 === 0;

        const sqEl = document.createElement('div');
        sqEl.className = `sq ${isLight ? 'light' : 'dark'}`;
        if (pos.from === sqName) sqEl.classList.add('last-from');
        if (pos.to === sqName) sqEl.classList.add('last-to');
        if (this.selectedSquare === sqName) sqEl.classList.add('selected');
        if (legalTargets.has(sqName)) sqEl.classList.add('legal-target');

        if (displayCol === 0) {
          const rankSpan = document.createElement('span');
          rankSpan.className = 'coord-rank';
          rankSpan.textContent = `${8 - r}`;
          sqEl.appendChild(rankSpan);
        }
        if (displayRow === 7) {
          const fileSpan = document.createElement('span');
          fileSpan.className = 'coord-file';
          fileSpan.textContent = FILES[c];
          sqEl.appendChild(fileSpan);
        }

        const piece = board[r][c];
        if (piece) {
          const key = `${piece.color}${piece.type.toUpperCase()}`;
          sqEl.insertAdjacentHTML('beforeend', PIECE_SVGS[key] || '');
        }

        sqEl.addEventListener('click', () => this.onSquareClick(sqName, chess));
        boardEl.appendChild(sqEl);
      }
    }

    this.renderArrowsAndBadge(pos);
  }

  onSquareClick(sqName, chess) {
    if (this.aiThinking) return;

    if (this.selectedSquare && this.selectedSquare !== sqName) {
      const legal = chess.moves({ square: this.selectedSquare, verbose: true });
      const match = legal.find((m) => m.to === sqName);
      if (match) {
        const uci = `${match.from}${match.to}${match.promotion || ''}`;

        // 1. Opening Trainer vs AI Mode
        if (this.trainerActive && this.currentPly === this.positions.length - 1) {
          this.selectedSquare = null;
          this.handleTrainerUserMove(match, chess);
          return;
        }

        // 2. Puzzle Retry Mode
        if (this.retryMode && this.retryTargetUci) {
          if (uci === this.retryTargetUci) {
            document.getElementById('coach-headline').textContent =
              `Spot on! ${match.san} is the engine's #1 move here.`;
            this.retryMode = false;
            this.goToPly(this.currentPly + 1);
          } else {
            document.getElementById('coach-headline').textContent =
              `Not quite (${match.san})—look for a stronger tactical or developing resource!`;
            this.selectedSquare = null;
            this.renderBoard();
          }
          return;
        }
      }
    }

    const p = chess.get(sqName);
    if (p && p.color === chess.turn()) {
      this.selectedSquare = this.selectedSquare === sqName ? null : sqName;
    } else {
      this.selectedSquare = null;
    }
    this.renderBoard();
  }

  renderArrowsAndBadge(pos) {
    const svg = document.getElementById('arrows-svg');
    const badgeLayer = document.getElementById('badge-layer');
    svg.innerHTML = `
      <defs>
        <marker id="arr-green" markerWidth="4" markerHeight="4" refX="2.4" refY="2" orient="auto">
          <polygon points="0 0, 4 2, 0 4" fill="#22c55e" />
        </marker>
        <marker id="arr-red" markerWidth="4" markerHeight="4" refX="2.4" refY="2" orient="auto">
          <polygon points="0 0, 4 2, 0 4" fill="#ef4444" />
        </marker>
      </defs>
    `;
    badgeLayer.innerHTML = '';

    // Draw Book Hint Arrow if active in Opening Trainer
    if (this.trainerHintUci && this.trainerHintUci.length >= 4) {
      const from = this.squareToCoords(this.trainerHintUci.slice(0, 2));
      const to = this.squareToCoords(this.trainerHintUci.slice(2, 4));
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x - (dx / len) * 26);
      line.setAttribute('y2', to.y - (dy / len) * 26);
      line.setAttribute('stroke', '#22c55e');
      line.setAttribute('stroke-width', '18');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.9');
      line.setAttribute('marker-end', 'url(#arr-green)');
      svg.appendChild(line);
    }

    if (this.currentPly === 0 || this.retryMode) return;

    const prev = this.positions[this.currentPly - 1];
    const cls = pos.classification;

    const drawArrow = (uci, color, markerId, opacity = 0.85) => {
      if (!uci || uci.length < 4) return;
      const from = this.squareToCoords(uci.slice(0, 2));
      const to = this.squareToCoords(uci.slice(2, 4));
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const endX = to.x - (dx / len) * 26;
      const endY = to.y - (dy / len) * 26;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', endX);
      line.setAttribute('y2', endY);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '18');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', opacity);
      line.setAttribute('marker-end', `url(#${markerId})`);
      svg.appendChild(line);
    };

    // Always draw Engine Best Move arrow in green if different from played move
    if (prev && prev.bestMoveUci && prev.bestMoveUci !== pos.playedUci) {
      drawArrow(prev.bestMoveUci, '#22c55e', 'arr-green', 0.88);
    }

    if (cls && ['inaccuracy', 'mistake', 'blunder'].includes(cls.key)) {
      drawArrow(pos.playedUci, '#ef4444', 'arr-red', 0.72);
    }

    // Classification badge on destination square
    if (cls && pos.to) {
      const dest = this.squareToCoords(pos.to);
      const badge = document.createElement('div');
      badge.className = `board-cls-badge ${cls.key}`;
      badge.textContent = cls.symbol;
      badge.style.left = `${((dest.col + 0.82) / 8) * 100}%`;
      badge.style.top = `${((dest.row + 0.18) / 8) * 100}%`;
      badgeLayer.appendChild(badge);
    }
  }

  renderCurrentStepDetails() {
    const pos = this.positions[this.currentPly];
    if (!pos) return;

    // Update Eval Bar
    const clampedCp = Math.max(-1000, Math.min(1000, pos.cpWhite));
    const whitePct = 50 + (clampedCp / 1000) * 45;
    document.getElementById('eval-bar-fill').style.height = `${whitePct.toFixed(1)}%`;
    document.getElementById('eval-bar-text').textContent = formatEval(pos.cpWhite, pos.mateWhite);

    const badgeEl = document.getElementById('coach-badge');
    const titleEl = document.getElementById('coach-move-title');
    const shiftEl = document.getElementById('coach-eval-shift');
    const headEl = document.getElementById('coach-headline');
    const compBox = document.getElementById('coach-comparison');

    if (this.currentPly === 0) {
      badgeEl.className = 'cls-badge book';
      badgeEl.textContent = 'START';
      titleEl.textContent = this.opening.name;
      shiftEl.textContent = formatEval(pos.cpWhite, pos.mateWhite);
      headEl.textContent = `Use the ▶ button, Right Arrow key, or click any move in the graph/list to review the game move by move.`;
      compBox.classList.add('hidden');
      return;
    }

    const prev = this.positions[this.currentPly - 1];
    const moveNum = Math.ceil(this.currentPly / 2);
    const prefix = pos.moverColor === 'w' ? `${moveNum}.` : `${moveNum}...`;
    titleEl.textContent = `${prefix} ${pos.san}`;
    shiftEl.textContent = `${formatEval(prev.cpWhite, prev.mateWhite)} → ${formatEval(pos.cpWhite, pos.mateWhite)}`;

    const cls = pos.classification;
    if (cls) {
      badgeEl.className = `cls-badge ${cls.key}`;
      badgeEl.textContent = `${cls.label} ${cls.symbol}`;
    } else {
      badgeEl.className = 'cls-badge book';
      badgeEl.textContent = 'ANALYZING...';
    }

    if (pos.coaching) {
      headEl.textContent = pos.coaching.headline;
      document.getElementById('deep-tactical').textContent = pos.coaching.tactical;
      document.getElementById('deep-pv').textContent = pos.coaching.pvLineText;
      document.getElementById('deep-positional').textContent = pos.coaching.positional;
      document.getElementById('deep-takeaway').textContent = pos.coaching.takeaway;
      document.getElementById('chart-phase-label').textContent = `${pos.coaching.phase} Phase`;
    }

    if (pos.bestSan && pos.bestSan !== pos.san) {
      compBox.classList.remove('hidden');
      document.getElementById('comp-played-move').textContent = pos.san;
      document.getElementById('comp-best-move').textContent = pos.bestSan;
    } else {
      compBox.classList.add('hidden');
    }
  }

  drawEvalChart() {
    const canvas = document.getElementById('eval-chart');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Midline (0.00)
    ctx.strokeStyle = '#2f3a48';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (this.positions.length <= 1) return;

    const xFor = (i) => (i / (this.positions.length - 1)) * w;
    const yFor = (cp) => {
      const clamped = Math.max(-700, Math.min(700, cp));
      return h / 2 - (clamped / 700) * (h * 0.44);
    };

    // Filled curve
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    this.positions.forEach((p, i) => {
      ctx.lineTo(xFor(i), yFor(p.cpWhite));
    });
    ctx.lineTo(w, h / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(229, 169, 60, 0.22)';
    ctx.fill();

    // Stroke curve
    ctx.beginPath();
    this.positions.forEach((p, i) => {
      const x = xFor(i);
      const y = yFor(p.cpWhite);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#e5a93c';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Dots for Mistakes / Blunders
    this.positions.forEach((p, i) => {
      if (!p.classification) return;
      if (p.classification.key === 'blunder' || p.classification.key === 'mistake') {
        ctx.beginPath();
        ctx.arc(xFor(i), yFor(p.cpWhite), 4, 0, Math.PI * 2);
        ctx.fillStyle = p.classification.key === 'blunder' ? '#ef4444' : '#f97316';
        ctx.fill();
      }
    });

    // Current Ply Cursor
    const curX = xFor(this.currentPly);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, h);
    ctx.stroke();
  }

  renderMovesList() {
    const list = document.getElementById('moves-list');
    list.innerHTML = '';

    for (let i = 1; i < this.positions.length; i += 2) {
      const wPos = this.positions[i];
      const bPos = this.positions[i + 1];
      const moveNum = Math.ceil(i / 2);

      const row = document.createElement('div');
      row.className = 'move-pair';

      const makeCell = (pos) => {
        if (!pos) return `<div></div>`;
        const cls = pos.classification;
        const badge = cls ? `<span class="mini-tag cls-badge ${cls.key}">${cls.symbol}</span>` : '';
        return `
          <div class="move-cell ${this.currentPly === pos.ply ? 'active' : ''}" data-ply="${pos.ply}">
            <span>${pos.san}</span>
            ${badge}
          </div>
        `;
      };

      row.innerHTML = `
        <span class="move-num">${moveNum}.</span>
        ${makeCell(wPos)}
        ${makeCell(bPos)}
      `;

      row.querySelectorAll('.move-cell').forEach((cell) => {
        cell.addEventListener('click', () => this.goToPly(parseInt(cell.dataset.ply, 10)));
      });
      list.appendChild(row);
    }
  }

  highlightActiveMoveCell() {
    document.querySelectorAll('.move-cell').forEach((cell) => {
      const ply = parseInt(cell.dataset.ply, 10);
      cell.classList.toggle('active', ply === this.currentPly);
    });
  }

  renderReportCard() {
    const counts = {
      w: { brilliant: 0, great: 0, best: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, accSum: 0, cplSum: 0, n: 0 },
      b: { brilliant: 0, great: 0, best: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, accSum: 0, cplSum: 0, n: 0 },
    };

    for (let i = 1; i < this.positions.length; i++) {
      const p = this.positions[i];
      const cls = p.classification;
      if (!cls) continue;
      const side = counts[p.moverColor];
      side[cls.key] = (side[cls.key] || 0) + 1;
      side.accSum += cls.accuracy;
      side.cplSum += Math.min(400, cls.cpLoss);
      side.n++;
    }

    const wAcc = counts.w.n ? (counts.w.accSum / counts.w.n).toFixed(1) : '--';
    const bAcc = counts.b.n ? (counts.b.accSum / counts.b.n).toFixed(1) : '--';
    const wCpl = counts.w.n ? Math.round(counts.w.cplSum / counts.w.n) : '--';
    const bCpl = counts.b.n ? Math.round(counts.b.cplSum / counts.b.n) : '--';

    document.getElementById('rep-white-name').textContent = this.headers.White;
    document.getElementById('rep-black-name').textContent = this.headers.Black;
    document.getElementById('rep-white-acc').textContent = `${wAcc}%`;
    document.getElementById('rep-black-acc').textContent = `${bAcc}%`;
    document.getElementById('rep-white-cpl').textContent = `Avg Centipawn Loss: ${wCpl}`;
    document.getElementById('rep-black-cpl').textContent = `Avg Centipawn Loss: ${bCpl}`;

    const topIsBlack = !this.flipped;
    document.getElementById('top-Accuracy').textContent = `Acc: ${topIsBlack ? bAcc : wAcc}%`;
    document.getElementById('bottom-Accuracy').textContent = `Acc: ${topIsBlack ? wAcc : bAcc}%`;

    const rows = [
      { key: 'brilliant', label: 'Brilliant (!!)', color: '#0ea5e9' },
      { key: 'great', label: 'Great Move (!)', color: '#3b82f6' },
      { key: 'best', label: 'Best Move (★)', color: '#22c55e' },
      { key: 'good', label: 'Excellent (✓)', color: '#84cc16' },
      { key: 'book', label: 'Book (📖)', color: '#b88b5a' },
      { key: 'inaccuracy', label: 'Inaccuracy (?!)', color: '#eab308' },
      { key: 'mistake', label: 'Mistake (?)', color: '#f97316' },
      { key: 'blunder', label: 'Blunder (??)', color: '#ef4444' },
    ];

    const table = document.getElementById('classification-table');
    table.innerHTML = rows
      .map(
        (r) => `
      <div class="cls-row">
        <span style="color:${r.color}">${counts.w[r.key]}</span>
        <span style="color:${r.color}">${r.label}</span>
        <span style="color:${r.color}">${counts.b[r.key]}</span>
      </div>
    `
      )
      .join('');

    // Build personalized Coach Action Plan
    const planList = document.getElementById('study-plan-list');
    const tips = [];
    const totalBlunders = counts.w.blunder + counts.b.blunder;
    const totalMistakes = counts.w.mistake + counts.b.mistake;

    tips.push(`Opening Repertoire: This game featured the ${this.opening.name} (${this.opening.bookPly} book plies).`);
    if (totalBlunders > 0) {
      tips.push(`Tactical Safety: ${totalBlunders} blunder(s) occurred. Click "Next Mistake ??" and "Retry Move ★" below the board to replay those critical turning points.`);
    }
    if (totalMistakes > 0) {
      tips.push(`Calculation Check: Before moving, verify what your opponent's best forcing reply (check, capture, or threat) will be.`);
    }
    tips.push(`Use the "Ask Coach Q&A" tab on any move to ask unlimited questions about threats, plans, and candidate moves.`);

    planList.innerHTML = tips.map((t) => `<li>${t}</li>`).join('');
  }

  jumpToNextMistake() {
    if (this.positions.length <= 1) return;
    for (let offset = 1; offset < this.positions.length; offset++) {
      const idx = (this.currentPly + offset) % this.positions.length;
      const cls = this.positions[idx]?.classification?.key;
      if (cls === 'blunder' || cls === 'mistake' || cls === 'inaccuracy') {
        this.goToPly(idx);
        return;
      }
    }
  }

  startRetryMode() {
    if (this.currentPly === 0) return;
    const step = this.positions[this.currentPly];
    const prev = this.positions[this.currentPly - 1];
    if (!prev || !prev.bestMoveUci) return;

    this.currentPly = this.currentPly - 1;
    this.retryMode = true;
    this.retryTargetUci = prev.bestMoveUci;
    this.renderBoard();

    const badgeEl = document.getElementById('coach-badge');
    badgeEl.className = 'cls-badge great';
    badgeEl.textContent = 'PUZZLE RETRY ★';
    document.getElementById('coach-move-title').textContent = `Find the Best Move for ${step.moverColor === 'w' ? 'White' : 'Black'}`;
    document.getElementById('coach-headline').textContent =
      `You originally played ${step.san}. Click the piece on the board and play the engine's best move instead!`;
  }

  previewBestLine() {
    if (this.currentPly === 0) return;
    const pos = this.positions[this.currentPly];
    if (!pos || !pos.pvSan || !pos.pvSan.length) return;
    document.getElementById('coach-headline').textContent =
      `Best Engine Continuation from before ${pos.san}: ${pos.pvSan.join(' → ')}`;
  }

  handleAskCoach(type, questionText) {
    const pos = this.positions[this.currentPly];
    if (!pos) return;
    const prev = this.currentPly > 0 ? this.positions[this.currentPly - 1] : pos;
    const chess = new Chess(pos.fen);
    const turnName = chess.turn() === 'w' ? 'White' : 'Black';
    const oppName = chess.turn() === 'w' ? 'Black' : 'White';

    const hangingSideToMove = findHangingPieces(pos.fen, chess.turn());
    const hangingJustMoved = findHangingPieces(pos.fen, chess.turn() === 'w' ? 'b' : 'w');
    const nextPvSan = uciPvToSan(pos.fen, pos.pv, 5);

    let answer = '';

    if (type === 'why') {
      answer = pos.coaching
        ? `${pos.coaching.headline} ${pos.coaching.tactical} (${pos.coaching.pvLineText})`
        : `We are at the starting position. Step forward to any move to get a full tactical explanation.`;
    } else if (type === 'threat') {
      if (nextPvSan.length) {
        answer = `It is ${turnName} to move. ${turnName}'s strongest immediate threat/continuation is ${nextPvSan.join(' → ')}.`;
        if (hangingJustMoved.length) {
          answer += ` In particular, ${oppName}'s ${hangingJustMoved[0].name} on ${hangingJustMoved[0].square} is under direct attack!`;
        }
      } else {
        answer = `No immediate forced tactical threat detected; play focuses on improving piece coordination.`;
      }
    } else if (type === 'hanging') {
      const all = [
        ...hangingJustMoved.map((h) => `${oppName}'s ${h.name} on ${h.square}${h.undefended ? ' (UNDEFENDED!)' : ' (attacked)'}`),
        ...hangingSideToMove.map((h) => `${turnName}'s ${h.name} on ${h.square}${h.undefended ? ' (UNDEFENDED!)' : ' (attacked)'}`),
      ];
      answer = all.length
        ? `Loose / attacked targets on the board right now: ${all.join('; ')}.`
        : `Every piece on the board is currently defended or safe from immediate capture.`;
    } else if (type === 'plan') {
      const evalStr = formatEval(pos.cpWhite, pos.mateWhite);
      answer = `Current Eval: ${evalStr}. Best continuation for ${turnName}: ${nextPvSan.length ? nextPvSan.join(' → ') : 'develop minor pieces'}. ${pos.coaching ? pos.coaching.takeaway : 'Control the center and ensure King safety.'}`;
    } else if (type === 'alternatives') {
      const prevPv = prev && prev.pv ? uciPvToSan(prev.fen, prev.pv, 4) : [];
      answer = `Before ${pos.san}, the engine's top line was ${prevPv.length ? prevPv.join(' → ') : pos.san}. From the current board, ${turnName}'s best move is ${nextPvSan[0] || 'solid development'}.`;
    } else {
      // Custom freeform question
      const qLower = questionText.toLowerCase();
      if (qLower.includes('castle') || qLower.includes('king')) {
        answer = `King Safety Check: ${chess.inCheck() ? `${turnName} is currently in CHECK and must respond immediately!` : `Make sure your King is castled and sheltered behind unmoved pawns before opening central files.`} Engine recommends: ${nextPvSan.join(' → ') || 'developing pieces'}.`;
      } else if (qLower.includes('win') || qLower.includes('ahead') || qLower.includes('eval') || qLower.includes('score')) {
        const leader = Math.abs(pos.cpWhite) < 35 ? 'The position is roughly equal' : pos.cpWhite > 0 ? 'White has the advantage' : 'Black has the advantage';
        answer = `${leader} (${formatEval(pos.cpWhite, pos.mateWhite)}). Best continuation from here: ${nextPvSan.join(' → ')}.`;
      } else {
        answer = `In this position (Eval ${formatEval(pos.cpWhite, pos.mateWhite)}), ${turnName}'s top engine move is ${nextPvSan[0] || '--'} (${nextPvSan.join(' → ')}). ${hangingJustMoved.length ? `Watch out: ${oppName}'s ${hangingJustMoved[0].name} on ${hangingJustMoved[0].square} is exposed.` : pos.coaching ? pos.coaching.takeaway : ''}`;
      }
    }

    const log = document.getElementById('ask-log');
    const item = document.createElement('div');
    item.className = 'qa-bubble';
    item.innerHTML = `
      <div class="qa-q">Q: ${questionText}</div>
      <div>${answer}</div>
    `;
    log.prepend(item);
  }

  switchPanelTab(tab) {
    document.querySelectorAll('.ptab').forEach((b) => {
      b.classList.toggle('active', b.dataset.ptab === tab);
    });
    ['report', 'moves', 'ask', 'trainer'].forEach((id) => {
      document.getElementById(`ptab-${id}`)?.classList.toggle('hidden', id !== tab);
    });
  }

  populateTrainerOpenings() {
    const sel = document.getElementById('trainer-opening-select');
    sel.innerHTML = OPENING_DRILLS.map(
      (d) => `<option value="${d.id}">[${d.color === 'w' ? 'White' : 'Black'}] ${d.name}</option>`
    ).join('');
    this.trainerDrill = OPENING_DRILLS[0];
    this.renderTrainerCard();
  }

  renderTrainerCard() {
    const d = this.trainerDrill;
    if (!d) return;
    document.getElementById('trainer-title').textContent =
      `${d.name.toUpperCase()} (${d.color === 'w' ? 'PLAY AS WHITE' : 'PLAY AS BLACK'})`;
    document.getElementById('trainer-desc').textContent = d.desc;

    const chips = document.getElementById('trainer-line-chips');
    chips.innerHTML = d.moves
      .map((san, idx) => {
        const moveNum = Math.floor(idx / 2) + 1;
        const prefix = idx % 2 === 0 ? `${moveNum}.` : '';
        const cls = idx < this.currentPly ? 'done' : idx === this.currentPly ? 'current' : '';
        return `<span class="book-chip ${cls}">${prefix}${san}</span>`;
      })
      .join('');
  }

  async startOpeningTrainer() {
    this.analysisRunId++;
    this.trainerActive = true;
    this.retryMode = false;
    this.trainerHintUci = null;
    this.aiThinking = false;

    const d = this.trainerDrill;
    this.flipped = d.color === 'b';
    this.headers = {
      White: d.color === 'w' ? 'You (White)' : 'Stockfish AI (White)',
      Black: d.color === 'b' ? 'You (Black)' : 'Stockfish AI (Black)',
      WhiteElo: '',
      BlackElo: '(Coach AI)',
    };
    this.opening = { name: d.name, bookPly: d.moves.length };
    document.getElementById('opening-badge').textContent = `Opening Trainer • ${d.name}`;

    const startChess = new Chess();
    this.positions = [
      {
        ply: 0,
        fen: startChess.fen(),
        san: 'Start',
        from: null,
        to: null,
        moverColor: null,
        cpWhite: 20,
        mateWhite: null,
        bestMoveUci: null,
        pv: [],
        classification: null,
        coaching: null,
      },
    ];
    this.currentPly = 0;

    this.updatePlayerBars();
    this.renderMovesList();
    this.renderTrainerCard();
    this.goToPly(0);

    document.getElementById('coach-badge').className = 'cls-badge book';
    document.getElementById('coach-badge').textContent = 'OPENING DRILL 📖';
    document.getElementById('coach-move-title').textContent = d.name;
    document.getElementById('coach-headline').textContent =
      d.color === 'w'
        ? `Your turn as White! Play 1. ${d.moves[0]} on the board (or click "💡 Show Book Hint").`
        : `AI will open as White... get ready to respond with ${d.moves[1]}!`;

    if (d.color === 'b') {
      await this.makeTrainerAiMove();
    }
  }

  showTrainerBookHint() {
    if (!this.trainerActive) {
      this.startOpeningTrainer();
      return;
    }
    const pos = this.positions[this.currentPly];
    const chess = new Chess(pos.fen);
    const d = this.trainerDrill;

    if (this.currentPly < d.moves.length) {
      const expectedSan = d.moves[this.currentPly];
      const match = chess.moves({ verbose: true }).find((m) => m.san === expectedSan);
      if (match) {
        this.trainerHintUci = `${match.from}${match.to}${match.promotion || ''}`;
        const note = d.notes?.[this.currentPly + 1] || `Book theory move in the ${d.name}.`;
        document.getElementById('coach-headline').textContent = `Book Hint: Play ${expectedSan} — ${note}`;
        this.renderBoard();
        return;
      }
    }

    // Out of book: ask Stockfish for a hint
    this.engine.evaluateFen(pos.fen, 12).then((res) => {
      if (res.bestMoveUci) {
        this.trainerHintUci = res.bestMoveUci;
        const san = uciPvToSan(pos.fen, [res.bestMoveUci], 1)[0] || res.bestMoveUci;
        document.getElementById('coach-headline').textContent = `Engine Hint: Consider playing ${san}!`;
        this.renderBoard();
      }
    });
  }

  undoTrainerMove() {
    if (!this.trainerActive || this.positions.length <= 1 || this.aiThinking) return;
    // Pop AI reply + User move (2 plies if available)
    const popCount = this.positions.length >= 3 ? 2 : 1;
    for (let i = 0; i < popCount; i++) this.positions.pop();
    this.currentPly = this.positions.length - 1;
    this.trainerHintUci = null;
    this.renderMovesList();
    this.renderTrainerCard();
    this.goToPly(this.currentPly);
  }

  async handleTrainerUserMove(moveObj, chessBefore) {
    const d = this.trainerDrill;
    const ply = this.currentPly + 1;
    this.trainerHintUci = null;

    // In Guided Book Mode, check if we are still within the opening book moves
    if (this.trainerMode === 'guided' && this.currentPly < d.moves.length) {
      const expectedSan = d.moves[this.currentPly];
      if (moveObj.san !== expectedSan) {
        const match = chessBefore.moves({ verbose: true }).find((m) => m.san === expectedSan);
        if (match) {
          this.trainerHintUci = `${match.from}${match.to}${match.promotion || ''}`;
        }
        const note = d.notes?.[ply] || `Main book line in the ${d.name}.`;
        document.getElementById('coach-badge').className = 'cls-badge inaccuracy';
        document.getElementById('coach-badge').textContent = 'OFF BOOK ?!';
        document.getElementById('coach-move-title').textContent = `Try ${expectedSan} Instead`;
        document.getElementById('coach-headline').textContent =
          `You played ${moveObj.san}, but the ${d.name} book move here is ${expectedSan} (shown by the green arrow): ${note} (Switch mode to "Free Opening Sparring" if you want to play sidelines!)`;
        this.renderBoard();
        return;
      }
    }

    await this.commitTrainerMove(moveObj);

    const latestPos = this.positions[this.currentPly];
    const latestChess = new Chess(latestPos.fen);
    if (!latestChess.isGameOver()) {
      await this.makeTrainerAiMove();
    }
  }

  async commitTrainerMove(moveObj) {
    const prev = this.positions[this.currentPly];
    const chess = new Chess(prev.fen);
    const m = chess.move(moveObj);
    if (!m) return;

    const ply = this.currentPly + 1;
    const depth = parseInt(document.getElementById('depth-select').value, 10) || 12;

    // Ensure prev has engine eval if not yet evaluated
    if (!prev.bestMoveUci) {
      const prevEval = await this.engine.evaluateFen(prev.fen, depth);
      prev.cpWhite = prevEval.cpWhite;
      prev.mateWhite = prevEval.mateWhite;
      prev.bestMoveUci = prevEval.bestMoveUci;
      prev.pv = prevEval.pv || [];
    }

    const afterFen = chess.fen();
    const res = await this.engine.evaluateFen(afterFen, depth);

    const sanList = this.positions.slice(1).map((p) => p.san).concat(m.san);
    const detected = detectOpening(sanList);
    const inCuratedBook =
      this.currentPly < this.trainerDrill.moves.length &&
      m.san === this.trainerDrill.moves[this.currentPly];

    const bestSanList = uciPvToSan(prev.fen, prev.pv, 5);
    const punishSanList = uciPvToSan(afterFen, res.pv || [], 5);

    const classification = classifyMove({
      ply,
      bookPly: inCuratedBook ? ply : detected.bookPly,
      moverColor: m.color,
      prevCpWhite: prev.cpWhite,
      afterCpWhite: res.cpWhite,
      bestMoveUci: prev.bestMoveUci,
      playedUci: `${m.from}${m.to}${m.promotion || ''}`,
      prevFen: prev.fen,
      afterFen,
    });

    const coaching = buildDeepCoaching({
      ply,
      san: m.san,
      from: m.from,
      to: m.to,
      moverColor: m.color,
      prevFen: prev.fen,
      afterFen,
      prevCpWhite: prev.cpWhite,
      afterCpWhite: res.cpWhite,
      bestSan: bestSanList[0] || null,
      pvSan: bestSanList,
      punishPvSan: punishSanList,
      classification,
    });

    // If this ply has a curated book note, highlight it in the coach headline!
    if (inCuratedBook && this.trainerDrill.notes?.[ply]) {
      coaching.headline = `${this.trainerDrill.notes[ply]} (Book Move 📖)`;
    }

    const newPos = {
      ply,
      prevFen: prev.fen,
      fen: afterFen,
      san: m.san,
      from: m.from,
      to: m.to,
      playedUci: `${m.from}${m.to}${m.promotion || ''}`,
      moverColor: m.color,
      cpWhite: res.cpWhite,
      mateWhite: res.mateWhite,
      bestMoveUci: res.bestMoveUci,
      pv: res.pv || [],
      bestSan: bestSanList[0] || null,
      pvSan: bestSanList,
      punishPvSan: punishSanList,
      classification,
      coaching,
    };

    this.positions.push(newPos);
    this.currentPly = ply;
    this.renderMovesList();
    this.renderTrainerCard();
    this.renderReportCard();
    this.goToPly(ply);
  }

  async makeTrainerAiMove() {
    this.aiThinking = true;
    const pos = this.positions[this.currentPly];
    const chess = new Chess(pos.fen);
    const d = this.trainerDrill;

    await new Promise((r) => setTimeout(r, 320));

    let chosenMove = null;
    // Follow the curated opening book if still in the book line
    const historyMatch = this.positions
      .slice(1)
      .every((p, idx) => p.san === d.moves[idx]);

    if (historyMatch && this.currentPly < d.moves.length) {
      const bookSan = d.moves[this.currentPly];
      chosenMove = chess.moves({ verbose: true }).find((m) => m.san === bookSan) || null;
    }

    if (!chosenMove) {
      // Out of book — let Stockfish AI pick its move!
      const res = await this.engine.evaluateFen(pos.fen, 12);
      if (res.bestMoveUci) {
        const from = res.bestMoveUci.slice(0, 2);
        const to = res.bestMoveUci.slice(2, 4);
        const promotion = res.bestMoveUci.length > 4 ? res.bestMoveUci[4] : undefined;
        chosenMove = chess.moves({ verbose: true }).find(
          (m) => m.from === from && m.to === to && (!promotion || m.promotion === promotion)
        );
      }
      if (!chosenMove) {
        const all = chess.moves({ verbose: true });
        chosenMove = all[0] || null;
      }
    }

    if (chosenMove) {
      await this.commitTrainerMove(chosenMove);
      if (this.currentPly === d.moves.length) {
        document.getElementById('coach-headline').textContent +=
          ` 🎉 You completed the ${d.name} book line! Keep playing to spar out the middlegame against Stockfish AI with live move coaching!`;
      }
    }
    this.aiThinking = false;
  }
}

new ChessCoachApp();
