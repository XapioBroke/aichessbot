// stockfishWorker.js - Motor Táctico Profesional 100% JavaScript
import { Chess } from 'chess.js';

class TacticalEngine {
  constructor() {
    this.isReady = true; // Siempre listo (no depende de Workers)
  }

  async init() {
    console.log('✅ Motor Táctico Profesional iniciado');
    return true;
  }

  // Evaluar posición con precisión
  evaluatePosition(game) {
    let score = 0;
    const board = game.board();
    
    // Valores de piezas
    const pieceValues = {
      p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
    };
    
    // Tablas de posición para piezas (bonificación por casillas)
    const pawnTable = [
      0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0
    ];
    
    const knightTable = [
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        
        const pieceValue = pieceValues[piece.type] || 0;
        const posIndex = row * 8 + col;
        
        // Bonificación por posición
        let posBonus = 0;
        if (piece.type === 'p') {
          posBonus = piece.color === 'w' ? pawnTable[posIndex] : pawnTable[63 - posIndex];
        } else if (piece.type === 'n') {
          posBonus = knightTable[posIndex];
        }
        
        const totalValue = pieceValue + posBonus;
        score += piece.color === 'w' ? totalValue : -totalValue;
      }
    }
    
    // Bonificación por movilidad
    const whiteMoves = game.moves({ color: 'w' }).length;
    const blackMoves = game.moves({ color: 'b' }).length;
    score += (whiteMoves - blackMoves) * 5;
    
    // Bonificación por desarrollo
    if (game.history().length < 10) {
      const developed = this.getDevelopedPieces(game);
      score += developed * 10;
    }
    
    return score;
  }
  
  getDevelopedPieces(game) {
    const board = game.board();
    let developed = 0;
    
    // Verificar si las piezas salieron de su posición inicial
    if (board[0][1] && board[0][1].type === 'n' && board[0][1].color === 'w') developed--;
    if (board[0][6] && board[0][6].type === 'n' && board[0][6].color === 'w') developed--;
    
    return developed;
  }

  // Algoritmo Minimax con poda Alpha-Beta
  minimax(game, depth, alpha, beta, maximizing) {
    if (depth === 0 || game.isGameOver()) {
      return this.evaluatePosition(game);
    }
    
    const moves = game.moves({ verbose: true });
    
    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        game.move(move);
        const evaluation = this.minimax(game, depth - 1, alpha, beta, false);
        game.undo();
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break; // Poda
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        game.move(move);
        const evaluation = this.minimax(game, depth - 1, alpha, beta, true);
        game.undo();
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break; // Poda
      }
      return minEval;
    }
  }

  async getBestMove(fen, difficulty = 'easy') {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    
    if (moves.length === 0) return null;
    
    // Configuración por dificultad
    const config = {
      easy: { depth: 1, random: 0.8 },     // 80% aleatorio
      medium: { depth: 3, random: 0.3 },    // 30% aleatorio
      hard: { depth: 5, random: 0 }         // 0% aleatorio (siempre mejor)
    };
    
    const settings = config[difficulty] || config.medium;
    
    // Easy: Mayormente aleatorio
    if (Math.random() < settings.random) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`;
    }
    
    // Evaluar todos los movimientos
    let bestMove = null;
    let bestValue = game.turn() === 'w' ? -Infinity : Infinity;
    
    // Ordenar movimientos (capturas primero para mejor poda)
    moves.sort((a, b) => {
      const aScore = a.captured ? 100 : 0;
      const bScore = b.captured ? 100 : 0;
      return bScore - aScore;
    });
    
    for (const move of moves) {
      game.move(move);
      
      // Minimax con poda Alpha-Beta
      const value = this.minimax(
        game, 
        settings.depth - 1, 
        -Infinity, 
        Infinity, 
        game.turn() === 'w'
      );
      
      game.undo();
      
      if (game.turn() === 'w' && value > bestValue) {
        bestValue = value;
        bestMove = move;
      } else if (game.turn() === 'b' && value < bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }
    
    if (!bestMove) {
      bestMove = moves[0];
    }
    
    return `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
  }

  terminate() {
    console.log('Motor táctico cerrado');
  }
}

let engineInstance = null;

export const getStockfishWorker = () => {
  if (!engineInstance) {
    engineInstance = new TacticalEngine();
  }
  return engineInstance;
};

export default TacticalEngine;