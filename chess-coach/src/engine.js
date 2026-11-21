import { Chess } from 'chess.js';

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

// Piece-square bonus tables (from White's perspective, rank 8 down to rank 1)
const PST_PAWN = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0],
];

const PST_CENTER = [
  [-40,-30,-20,-20,-20,-20,-30,-40],
  [-30,-10,  0,  5,  5,  0,-10,-30],
  [-20,  5, 15, 20, 20, 15,  5,-20],
  [-20, 10, 20, 28, 28, 20, 10,-20],
  [-20, 10, 20, 28, 28, 20, 10,-20],
  [-20,  5, 15, 20, 20, 15,  5,-20],
  [-30,-10,  0,  5,  5,  0,-10,-30],
  [-40,-30,-20,-20,-20,-20,-30,-40],
];

export function cpToWinProb(cp) {
  const clamped = Math.max(-1500, Math.min(1500, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

export function winProbLossToAccuracy(loss) {
  if (loss <= 0) return 100;
  const acc = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export function formatEval(cp, mate = null) {
  if (mate !== null && mate !== 0) {
    return `${mate > 0 ? '+' : '-'}M${Math.abs(mate)}`;
  }
  const pawns = cp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

export function uciPvToSan(fen, pvUciList, maxMoves = 6) {
  try {
    const c = new Chess(fen);
    const out = [];
    for (let i = 0; i < Math.min(maxMoves, pvUciList.length); i++) {
      const uci = pvUciList[i];
      if (!uci || uci.length < 4) break;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const m = c.move({ from, to, promotion });
      if (!m) break;
      out.push(m.san);
    }
    return out;
  } catch {
    return [];
  }
}

export class StockfishEngine {
  constructor(onStatusChange) {
    this.worker = null;
    this.ready = false;
    this.usingFallback = false;
    this.onStatusChange = onStatusChange || (() => {});
    this.currentResolver = null;
    this.initWorker();
  }

  initWorker() {
    try {
      const blob = new Blob(
        [`importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');`],
        { type: 'application/javascript' }
      );
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);

      let lastInfo = { cp: 0, mate: null, pv: [], depth: 0 };

      this.worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line === 'uciok') {
          this.ready = true;
          this.onStatusChange('Stockfish 10 WASM Ready');
        } else if (line.startsWith('info ') && line.includes(' score ') && line.includes(' pv ')) {
          const depthMatch = line.match(/depth (\d+)/);
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          const pvMatch = line.match(/ pv (.+)$/);

          const d = depthMatch ? parseInt(depthMatch[1], 10) : 0;
          if (d >= lastInfo.depth) {
            lastInfo.depth = d;
            if (mateMatch) {
              const m = parseInt(mateMatch[1], 10);
              lastInfo.mate = m;
              lastInfo.cp = m > 0 ? 10000 - Math.abs(m) * 50 : -10000 + Math.abs(m) * 50;
            } else if (cpMatch) {
              lastInfo.mate = null;
              lastInfo.cp = parseInt(cpMatch[1], 10);
            }
            if (pvMatch) {
              lastInfo.pv = pvMatch[1].trim().split(/\s+/);
            }
          }
        } else if (line.startsWith('bestmove ')) {
          const parts = line.split(/\s+/);
          const bestUci = parts[1] && parts[1] !== '(none)' ? parts[1] : (lastInfo.pv[0] || null);
          if (this.currentResolver) {
            const resolve = this.currentResolver;
            this.currentResolver = null;
            resolve({
              cp: lastInfo.cp,
              mate: lastInfo.mate,
              bestMoveUci: bestUci,
              pv: lastInfo.pv.length ? lastInfo.pv : (bestUci ? [bestUci] : []),
            });
          }
          lastInfo = { cp: 0, mate: null, pv: [], depth: 0 };
        }
      };

      this.worker.onerror = () => {
        this.usingFallback = true;
        this.ready = true;
        this.onStatusChange('Tactical Coach Engine Ready');
      };

      this.worker.postMessage('uci');
      this.worker.postMessage('setoption name Threads value 1');
    } catch {
      this.usingFallback = true;
      this.ready = true;
      this.onStatusChange('Tactical Coach Engine Ready');
    }
  }

  /**
   * Evaluates a FEN position and returns evaluation normalized to WHITE's perspective:
   * { cpWhite, mateWhite, bestMoveUci, pv }
   */
  async evaluateFen(fen, depth = 12) {
    const chess = new Chess(fen);
    const turn = chess.turn(); // 'w' or 'b'

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        const cpWhite = turn === 'w' ? -10000 : 10000;
        const mateWhite = turn === 'w' ? -1 : 1;
        return { cpWhite, mateWhite, bestMoveUci: null, pv: [] };
      }
      return { cpWhite: 0, mateWhite: null, bestMoveUci: null, pv: [] };
    }

    if (this.usingFallback || !this.worker) {
      return this.fallbackEvaluate(chess);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.currentResolver = null;
        resolve(this.fallbackEvaluate(chess));
      }, 2800);

      this.currentResolver = (res) => {
        clearTimeout(timeout);
        const sign = turn === 'w' ? 1 : -1;
        resolve({
          cpWhite: res.cp * sign,
          mateWhite: res.mate !== null ? res.mate * sign : null,
          bestMoveUci: res.bestMoveUci,
          pv: res.pv,
        });
      };

      this.worker.postMessage('stop');
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  fallbackEvaluate(chess) {
    const turn = chess.turn();
    const moves = chess.moves({ verbose: true });
    let bestScore = -Infinity;
    let bestMove = moves[0] || null;

    for (const m of moves) {
      chess.move(m);
      const score = -this.alphaBeta(chess, 2, -Infinity, Infinity);
      chess.undo();
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
      }
    }

    const sign = turn === 'w' ? 1 : -1;
    const uci = bestMove ? `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}` : null;
    return {
      cpWhite: Math.round(bestScore * sign),
      mateWhite: null,
      bestMoveUci: uci,
      pv: uci ? [uci] : [],
    };
  }

  alphaBeta(chess, depth, alpha, beta) {
    if (chess.isCheckmate()) return -9999;
    if (chess.isDraw()) return 0;
    if (depth <= 0) return this.staticEvalSideToMove(chess);

    const moves = chess.moves({ verbose: true });
    moves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

    for (const m of moves) {
      chess.move(m);
      const score = -this.alphaBeta(chess, depth - 1, -beta, -alpha);
      chess.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  staticEvalSideToMove(chess) {
    const board = chess.board();
    let whiteScore = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const base = PIECE_VALUES[p.type] || 0;
        const pstRow = p.color === 'w' ? r : 7 - r;
        const pst = p.type === 'p' ? PST_PAWN[pstRow][c] : (p.type === 'n' || p.type === 'b' ? PST_CENTER[pstRow][c] : 0);
        if (p.color === 'w') whiteScore += base + pst;
        else whiteScore -= base + pst;
      }
    }
    return chess.turn() === 'w' ? whiteScore : -whiteScore;
  }
}

export function getMaterialCount(chess, color) {
  let sum = 0;
  for (const row of chess.board()) {
    for (const p of row) {
      if (p && p.color === color && p.type !== 'k') {
        sum += PIECE_VALUES[p.type] || 0;
      }
    }
  }
  return sum;
}

/**
 * Finds pieces of `color` that are currently attacked by the opponent and either
 * undefended or attacked by a lower-value piece.
 */
export function findHangingPieces(fen, color) {
  const chess = new Chess(fen);
  const opp = color === 'w' ? 'b' : 'w';
  const board = chess.board();
  const hanging = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color || p.type === 'k') continue;
      const sq = p.square;
      if (chess.isAttacked(sq, opp)) {
        const defended = chess.isAttacked(sq, color);
        if (!defended || PIECE_VALUES[p.type] >= 500) {
          hanging.push({
            square: sq,
            type: p.type,
            name: PIECE_NAMES[p.type],
            value: PIECE_VALUES[p.type],
            undefended: !defended,
          });
        }
      }
    }
  }
  hanging.sort((a, b) => b.value - a.value);
  return hanging;
}

export function classifyMove({
  ply,
  bookPly,
  moverColor,
  prevCpWhite,
  afterCpWhite,
  bestMoveUci,
  playedUci,
  prevFen,
  afterFen,
}) {
  const sign = moverColor === 'w' ? 1 : -1;
  const prevMoverCp = prevCpWhite * sign;
  const afterMoverCp = afterCpWhite * sign;

  const prevWin = cpToWinProb(prevMoverCp);
  const afterWin = cpToWinProb(afterMoverCp);
  const winLoss = Math.max(0, prevWin - afterWin);
  const cpLoss = Math.max(0, prevMoverCp - afterMoverCp);
  const accuracy = winProbLossToAccuracy(winLoss);

  if (ply <= bookPly && cpLoss < 45) {
    return { key: 'book', label: 'BOOK', symbol: '📖', winLoss, cpLoss, accuracy: Math.max(95, accuracy) };
  }

  const isEngineBest = bestMoveUci && playedUci === bestMoveUci;

  // Check if player sacrificed material while keeping a strong/winning position
  const beforeChess = new Chess(prevFen);
  const afterChess = new Chess(afterFen);
  const opp = moverColor === 'w' ? 'b' : 'w';
  const myMatBefore = getMaterialCount(beforeChess, moverColor) - getMaterialCount(beforeChess, opp);
  const myMatAfter = getMaterialCount(afterChess, moverColor) - getMaterialCount(afterChess, opp);
  const hangingAfter = findHangingPieces(afterFen, moverColor);
  const offeredPiece = hangingAfter.some((h) => h.value >= 320 && h.undefended);

  if ((isEngineBest || winLoss < 2.2) && afterMoverCp > 120 && (offeredPiece && myMatAfter <= myMatBefore)) {
    return { key: 'brilliant', label: 'BRILLIANT', symbol: '!!', winLoss, cpLoss, accuracy: 100 };
  }

  if (isEngineBest) {
    if (afterMoverCp - prevMoverCp >= 130 || (afterMoverCp > 150 && Math.abs(prevMoverCp) < 60)) {
      return { key: 'great', label: 'GREAT', symbol: '!', winLoss, cpLoss, accuracy: 100 };
    }
    return { key: 'best', label: 'BEST', symbol: '★', winLoss, cpLoss, accuracy: 100 };
  }

  if (winLoss <= 3.5 || cpLoss <= 28) {
    return { key: 'good', label: 'EXCELLENT', symbol: '✓', winLoss, cpLoss, accuracy };
  }
  if (winLoss <= 9.5 || cpLoss <= 85) {
    return { key: 'inaccuracy', label: 'INACCURACY', symbol: '?!', winLoss, cpLoss, accuracy };
  }
  if (winLoss <= 20 || cpLoss <= 200) {
    return { key: 'mistake', label: 'MISTAKE', symbol: '?', winLoss, cpLoss, accuracy };
  }
  return { key: 'blunder', label: 'BLUNDER', symbol: '??', winLoss, cpLoss, accuracy };
}

/**
 * Generates comprehensive 4-layer coaching explanations for a move.
 */
export function buildDeepCoaching(step) {
  const {
    ply,
    san,
    moverColor,
    prevFen,
    afterFen,
    prevCpWhite,
    afterCpWhite,
    bestSan,
    pvSan,
    punishPvSan,
    classification,
  } = step;

  const sideName = moverColor === 'w' ? 'White' : 'Black';
  const oppName = moverColor === 'w' ? 'Black' : 'White';
  const oppColor = moverColor === 'w' ? 'b' : 'w';

  const beforeChess = new Chess(prevFen);
  const afterChess = new Chess(afterFen);

  const hangingNow = findHangingPieces(afterFen, moverColor);
  const oppHangingBefore = findHangingPieces(prevFen, oppColor);
  const oppHangingNow = findHangingPieces(afterFen, oppColor);

  const phase = ply <= 16 ? 'Opening' : getMaterialCount(afterChess, 'w') + getMaterialCount(afterChess, 'b') <= 2600 ? 'Endgame' : 'Middlegame';

  let headline = '';
  let tactical = '';
  let positional = '';
  let takeaway = '';

  const isBad = ['inaccuracy', 'mistake', 'blunder'].includes(classification.key);

  if (classification.key === 'book') {
    headline = `${san} is standard opening theory, developing harmoniously and fighting for key central squares.`;
    tactical = `No immediate tactical vulnerabilities. Both sides are mobilizing minor pieces toward the center.`;
  } else if (classification.key === 'brilliant') {
    headline = `Brilliant tactical vision! ${san} boldly leaves material exposed because any capture walks into a devastating continuation.`;
    tactical = `Even though a piece appears vulnerable, the resulting open lines and initiative give ${sideName} a decisive attack.`;
  } else if (classification.key === 'great' || classification.key === 'best') {
    headline = `${san} is the engine's top choice, maximizing piece activity and keeping maximum pressure on ${oppName}.`;
    if (oppHangingNow.length > 0) {
      tactical = `Creates direct pressure against ${oppName}'s ${oppHangingNow[0].name} on ${oppHangingNow[0].square}.`;
    } else if (afterChess.inCheck()) {
      tactical = `Delivers a forcing check that restricts ${oppName}'s King and seizes the initiative.`;
    } else {
      tactical = `Maintains solid tactical coordination with no loose or undefended pieces.`;
    }
  } else if (classification.key === 'good') {
    headline = `${san} is a solid, practical move. ${bestSan && bestSan !== san ? `${bestSan} was slightly more precise, but this keeps a healthy position.` : ''}`;
    tactical = `Keeps pieces well-protected while maintaining the balance of the position.`;
  } else if (isBad) {
    // Diagnose specifically WHY it was an inaccuracy/mistake/blunder!
    if (hangingNow.length > 0 && hangingNow[0].undefended) {
      const h = hangingNow[0];
      headline = `${san} leaves your ${h.name} on ${h.square} vulnerable! ${oppName} can punish this immediately${punishPvSan.length ? ` with ${punishPvSan[0]}` : ''}.`;
      tactical = `Your ${h.name} on ${h.square} is attacked and lacks adequate defense. Playing ${bestSan || 'a defensive move'} instead would have kept your material safe.`;
      takeaway = `Before finalizing a move, scan every piece of yours to make sure nothing is left undefended (Loose Pieces Drop Off).`;
    } else if (oppHangingBefore.length > 0 && oppHangingBefore[0].undefended && bestSan) {
      const missed = oppHangingBefore[0];
      headline = `Missed tactical opportunity! ${oppName}'s ${missed.name} on ${missed.square} was vulnerable, and ${bestSan} would have capitalized on it.`;
      tactical = `Instead of ${san}, playing ${bestSan} punished ${oppName}'s uncoordinated pieces (${pvSan.join(' ')}).`;
      takeaway = `Always check all forcing moves (checks, captures, and direct threats) before making a quiet move.`;
    } else if (punishPvSan.length > 0) {
      headline = `${san} allows ${oppName} a strong counter-strike with ${punishPvSan[0]}. The engine strongly preferred ${bestSan || 'an active alternative'}.`;
      tactical = `After ${san}, ${oppName} seizes the advantage via the line: ${punishPvSan.join(' → ')}.`;
      takeaway = `Ask yourself "What is my opponent's most forcing reply?" before committing to ${san}.`;
    } else {
      headline = `${san} loses momentum and drops evaluation. ${bestSan ? `The engine preferred ${bestSan} to fight for the initiative.` : ''}`;
      tactical = `Allows ${oppName} to improve piece coordination without resistance.`;
    }
  }

  // Positional analysis
  const centerSquares = ['d4', 'e4', 'd5', 'e5'];
  let centerControl = 0;
  for (const sq of centerSquares) {
    if (afterChess.isAttacked(sq, moverColor)) centerControl++;
  }

  if (phase === 'Opening') {
    const movedPiece = beforeChess.get(step.from);
    if (movedPiece && movedPiece.type === 'q' && ply < 10) {
      positional = `Bringing the Queen out early in the opening can lose time if ${oppName} attacks it with minor pieces.`;
      if (!takeaway) takeaway = `Develop Knights and Bishops and castle early before launching Queen sorties.`;
    } else {
      positional = `Opening phase: ${sideName} influences ${centerControl}/4 central squares (d4, e4, d5, e5). Prioritize rapid development and King safety.`;
    }
  } else if (phase === 'Middlegame') {
    positional = `Middlegame phase: ${sideName} controls ${centerControl}/4 central squares. Coordinate Rooks on open files and look for outposts for minor pieces.`;
  } else {
    positional = `Endgame phase: King activity and passed pawns are paramount. Centralize your King and push unopposed pawns.`;
  }

  if (!takeaway) {
    if (phase === 'Opening') {
      takeaway = `Fight for the center with pawns, develop Knights before Bishops, and castle by move 10.`;
    } else if (phase === 'Middlegame') {
      takeaway = `Coordinate your pieces toward the weakest square in ${oppName}'s camp and avoid creating pawn weaknesses.`;
    } else {
      takeaway = `In the endgame, the King is a fighting piece—bring it to the center and place Rooks behind passed pawns.`;
    }
  }

  const pvLineText = isBad && pvSan.length
    ? `Better was ${ pvSan.join(' → ') } | After ${san}, opponent has: ${ punishPvSan.length ? punishPvSan.join(' → ') : 'improved initiative' }`
    : pvSan.length
    ? `Engine Continuation: ${ pvSan.join(' → ') }`
    : `Position remains balanced.`;

  return {
    phase,
    headline,
    tactical,
    pvLineText,
    positional,
    takeaway,
    hangingNow,
    oppHangingNow,
  };
}
