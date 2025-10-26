// stockfishEngine.js - Motor de ajedrez con Stockfish
import { Chess } from 'chess.js';

class StockfishEngine {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.thinking = false;
  }

  // Inicializar el motor
  init() {
    return new Promise((resolve) => {
      if (this.engine) {
        resolve(true);
        return;
      }

      try {
        // Cargar Stockfish desde CDN
        const stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');
        this.engine = stockfish;

        this.engine.onmessage = (event) => {
          const message = event.data;
          
          if (message === 'uciok') {
            this.isReady = true;
            console.log('✅ Stockfish listo');
            resolve(true);
          }
          
          if (message.includes('readyok')) {
            this.isReady = true;
          }
        };

        // Iniciar protocolo UCI
        this.engine.postMessage('uci');
        
      } catch (error) {
        console.error('Error inicializando Stockfish:', error);
        resolve(false);
      }
    });
  }

  // Obtener mejor movimiento según dificultad
  async getBestMove(fen, difficulty = 'easy') {
    if (!this.engine || this.thinking) {
      return null;
    }

    return new Promise((resolve) => {
      this.thinking = true;
      let bestMove = null;

      // Configuración según dificultad
      const config = {
        easy: { depth: 1, skillLevel: 1, time: 100 },
        medium: { depth: 10, skillLevel: 10, time: 1000 },
        hard: { depth: 18, skillLevel: 20, time: 2000 }
      };

      const settings = config[difficulty] || config.medium;

      // Listener para capturar el mejor movimiento
      const moveHandler = (event) => {
        const message = event.data;
        
        if (message.includes('bestmove')) {
          const match = message.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (match) {
            bestMove = match[1];
            this.thinking = false;
            this.engine.removeEventListener('message', moveHandler);
            resolve(bestMove);
          }
        }
      };

      this.engine.addEventListener('message', moveHandler);

      // Configurar motor
      this.engine.postMessage('ucinewgame');
      this.engine.postMessage(`setoption name Skill Level value ${settings.skillLevel}`);
      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage(`go depth ${settings.depth} movetime ${settings.time}`);

      // Timeout de seguridad
      setTimeout(() => {
        if (this.thinking) {
          this.thinking = false;
          this.engine.removeEventListener('message', moveHandler);
          resolve(null);
        }
      }, settings.time + 2000);
    });
  }

  // Convertir movimiento UCI a formato Chess.js
  uciToMove(game, uciMove) {
    if (!uciMove || uciMove.length < 4) return null;

    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    try {
      const move = game.move({
        from: from,
        to: to,
        promotion: promotion
      });
      return move;
    } catch (error) {
      console.error('Error convirtiendo movimiento:', error);
      return null;
    }
  }

  // Hacer movimiento inteligente
  async makeSmartMove(game, difficulty = 'easy') {
    if (difficulty === 'easy') {
      // Modo fácil: movimientos aleatorios (más rápido)
      const moves = game.moves({ verbose: true });
      if (moves.length === 0) return null;
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Medio y Difícil: usar Stockfish
    if (!this.isReady) {
      await this.init();
    }

    const fen = game.fen();
    const uciMove = await this.getBestMove(fen, difficulty);
    
    if (!uciMove) {
      // Fallback a movimiento aleatorio
      const moves = game.moves({ verbose: true });
      return moves[Math.floor(Math.random() * moves.length)];
    }

    return this.uciToMove(game, uciMove);
  }

  // Evaluar posición (para análisis futuro)
  async evaluatePosition(fen, depth = 15) {
    if (!this.engine) {
      await this.init();
    }

    return new Promise((resolve) => {
      let evaluation = 0;

      const evalHandler = (event) => {
        const message = event.data;
        
        if (message.includes('score cp')) {
          const match = message.match(/score cp (-?\d+)/);
          if (match) {
            evaluation = parseInt(match[1]) / 100; // Convertir centipawns a pawns
          }
        }
        
        if (message.includes('score mate')) {
          const match = message.match(/score mate (-?\d+)/);
          if (match) {
            const mateIn = parseInt(match[1]);
            evaluation = mateIn > 0 ? 100 : -100; // Jaque mate
          }
        }

        if (message.includes('bestmove')) {
          this.engine.removeEventListener('message', evalHandler);
          resolve(evaluation);
        }
      };

      this.engine.addEventListener('message', evalHandler);
      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage(`go depth ${depth}`);

      setTimeout(() => {
        this.engine.removeEventListener('message', evalHandler);
        resolve(evaluation);
      }, 5000);
    });
  }

  // Cerrar motor
  terminate() {
    if (this.engine) {
      this.engine.terminate();
      this.engine = null;
      this.isReady = false;
      this.thinking = false;
    }
  }
}

// Singleton
let stockfishInstance = null;

export const getStockfishEngine = () => {
  if (!stockfishInstance) {
    stockfishInstance = new StockfishEngine();
  }
  return stockfishInstance;
};

export default StockfishEngine;