// lichessEngine.js - Motor usando API de Lichess (GRATIS Y POTENTE)
import { Chess } from 'chess.js';

class LichessEngine {
  constructor() {
    this.isReady = true; // API siempre lista
    this.thinking = false;
    this.apiUrl = 'https://lichess.org/api/cloud-eval';
  }

  async init() {
    console.log('✅ Lichess API lista (sin instalación)');
    return true;
  }

  async getBestMove(fen, difficulty = 'easy') {
    if (this.thinking) return null;
    
    this.thinking = true;
    const startTime = Date.now();

    try {
      // Configuración por dificultad
      const config = {
        easy: { depth: 1, multiPv: 1 },
        medium: { depth: 18, multiPv: 1 },
        hard: { depth: 30, multiPv: 1 }
      };

      const settings = config[difficulty] || config.medium;
      
      // Llamar a la API de Lichess
      const response = await fetch(`${this.apiUrl}?fen=${encodeURIComponent(fen)}&multiPv=${settings.multiPv}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extraer mejor movimiento
      let bestMove = null;
      if (data.pvs && data.pvs.length > 0) {
        const firstPv = data.pvs[0];
        if (firstPv.moves) {
          const moves = firstPv.moves.split(' ');
          bestMove = moves[0]; // Primer movimiento en notación UCI
        }
      }

      const searchTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`🎯 [${difficulty.toUpperCase()}] Lichess: ${bestMove} (${searchTime}s, depth ${data.depth || 'N/A'})`);

      this.thinking = false;
      return bestMove;
      
    } catch (error) {
      console.error('❌ Error Lichess API:', error);
      this.thinking = false;
      return null;
    }
  }

  uciToMove(game, uciMove) {
    if (!uciMove || uciMove.length < 4) return null;

    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    try {
      return game.move({ from, to, promotion });
    } catch (error) {
      console.error('❌ Error:', error);
      return null;
    }
  }

  async makeSmartMove(game, difficulty = 'easy') {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Easy: aleatorio
    if (difficulty === 'easy') {
      if (Math.random() > 0.15) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
      const captures = moves.filter(m => m.captured);
      return captures.length > 0 
        ? captures[Math.floor(Math.random() * captures.length)]
        : moves[Math.floor(Math.random() * moves.length)];
    }

    // Medium y Hard: usar Lichess
    console.log(`🔍 Consultando Lichess (${difficulty})...`);
    const uciMove = await this.getBestMove(game.fen(), difficulty);
    
    if (!uciMove) {
      console.warn('⚠️ Fallback aleatorio');
      return moves[Math.floor(Math.random() * moves.length)];
    }

    return this.uciToMove(game, uciMove);
  }

  async evaluatePosition(fen, depth = 20) {
    try {
      const response = await fetch(`${this.apiUrl}?fen=${encodeURIComponent(fen)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('API Error');

      const data = await response.json();
      
      let evaluation = 0;
      let bestMove = null;

      if (data.pvs && data.pvs.length > 0) {
        const firstPv = data.pvs[0];
        
        // Evaluar en centipawns
        if (firstPv.cp !== undefined) {
          evaluation = firstPv.cp / 100;
        } else if (firstPv.mate !== undefined) {
          evaluation = firstPv.mate > 0 ? 99 : -99;
        }
        
        if (firstPv.moves) {
          const moves = firstPv.moves.split(' ');
          bestMove = moves[0];
        }
      }

      return { evaluation, bestMove };
      
    } catch (error) {
      console.error('❌ Error evaluación:', error);
      return { evaluation: 0, bestMove: null };
    }
  }

  async analyzeGame(moves, playerColor) {
    const mistakes = [];
    const game = new Chess();
    
    console.log('🔍 Analizando con Lichess...');
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isPlayerMove = (i % 2 === 0 && playerColor === 'w') || 
                          (i % 2 === 1 && playerColor === 'b');
      
      if (isPlayerMove) {
        const evalBefore = await this.evaluatePosition(game.fen(), 20);
        game.move(move);
        const evalAfter = await this.evaluatePosition(game.fen(), 20);
        
        const diff = Math.abs(evalAfter.evaluation - evalBefore.evaluation);
        if (diff > 1.5) {
          mistakes.push({
            move: move,
            moveNumber: Math.floor(i / 2) + 1,
            evaluation: evalAfter.evaluation,
            better: evalBefore.bestMove,
            loss: diff.toFixed(2)
          });
        }
      } else {
        game.move(move);
      }
    }
    
    console.log(`✅ ${mistakes.length} errores`);
    return mistakes;
  }

  terminate() {
    // No hay nada que cerrar con API
    console.log('👋 Lichess API cerrada');
  }
}

let lichessInstance = null;

export const getLichessEngine = () => {
  if (!lichessInstance) {
    lichessInstance = new LichessEngine();
  }
  return lichessInstance;
};

export default LichessEngine;